#!/usr/bin/env python3

"""Gate de integridade pré-publicação do MatrUFSC (assumption checker).

O frontend é um consumidor **puro** de JSON estático: não há backend em runtime,
então ele confia cegamente no que o scraper publicou na branch `data`. Este
módulo é o **portão** que fecha esse contrato: antes de publicar, valida o
diretório de staging inteiro contra **todas** as suposições que o frontend faz.
Se qualquer suposição falha, o orquestrador aborta (exit não-zero, sem publicar)
e o frontend nunca recebe dado que o quebre.

Arquitetura — catálogo enumerável de checks nomeados:

- Cada check declara `id` estável, o `nível` (estrutural | valor | relacional),
  a `suposição` que garante e o(s) `ponto(s) de consumo` do frontend que protege.
- A execução **não** é fail-fast: cada check varre o staging e agrega **todas**
  as violações; `run_gate` junta tudo num relatório único (check + arquivo +
  registro ofensor), para o mantenedor corrigir de uma vez.
- O catálogo (`CHECKS`) é enumerável para revisão de cobertura. `CONSUMPTION_POINTS`
  lista cada ponto de consumo do frontend; a rastreabilidade (consumo → check) é
  derivada do catálogo e guardada por teste, de modo que adicionar consumo no
  frontend exija adicionar um check.

Uso isolado (validar um diretório local antes de publicar):

    uv run python gate.py <data_dir>
    uv run python gate.py --traceability
"""

import argparse
import json
import os
import re
import sys
from collections import namedtuple
from dataclasses import dataclass, field
from typing import Callable, Iterator, Optional

from semesters import DATA_FILE_RE, SEMESTER_RE, campus_codes_for_semester, normalize_semester_entry

# ---------------------------------------------------------------------------
# Fonte de verdade das regras de horário (ESPELHO do frontend).
#
# ATENÇÃO: estas tabelas espelham `matrufsc/src/context/plano/constants.ts`.
# O check `horario_decodificavel` usa-as para garantir que nenhum horário
# publicado cairia fora dos limites que fazem o parser de horário do frontend
# (`getHorarioList` em parser.ts) lançar exceção. Mudança aqui exige atualizar
# o outro lado — e vice-versa.
# ---------------------------------------------------------------------------
HORAS = (
    "0730", "0820", "0910", "1010", "1100",
    "1330", "1420", "1510", "1620", "1710",
    "1830", "1920", "2020", "2110",
)
DIAS_SEMANA = (1, 2, 3, 4, 5, 6, 7)  # 1 = domingo, ..., 7 = sábado

# Níveis de check.
ESTRUTURAL = "estrutural"  # forma/tipo: aridade das tuplas, tipos por posição
VALOR = "valor"            # valor por campo: faixas, formato de string
RELACIONAL = "relacional"  # integridade referencial e consistência entre arquivos


# ---------------------------------------------------------------------------
# Pontos de consumo do frontend (o que o app assume do JSON).
#
# Cada chave é um ponto onde o frontend lê o dado publicado; o valor descreve
# onde isso acontece. Todo ponto precisa ser protegido por ao menos um check
# (garantido por `test_gate.py::test_traceability_completa`). Ao adicionar um
# novo consumo no frontend, acrescente a chave aqui e um check que a referencie.
# ---------------------------------------------------------------------------
CONSUMPTION_POINTS = {
    "fetch_json": "campusDataQuery.fetchCampusData: await resp.json()",
    "campus_object": "JSONCampus: acesso a .campus/.data_extracao/.cursos/.disciplinas",
    "campus_routing": "getDisciplinaFromJSON(json, campus, semester)",
    "data_extracao_display": "JSONCampus.data_extracao (exibição da última atualização)",
    "disciplinas_iter": "campusDataQuery: disciplinas.map(getDisciplinaFromJSON)",
    "cursos_map": "JSONCampus.cursos: Record<string, string>",
    "disciplina_destructure": "getDisciplinaFromJSON: const [id, _, nome, rawTurmas] = json",
    "nome_display": "Materia.nome (exibição na lista/busca)",
    "nome_ascii_search": "searchDisciplinas: busca por nome_ascii (índice 1 da disciplina)",
    "turma_destructure": "getTurmaFromJSON: destructuring posicional dos índices 0–8",
    "professores_search": "Turma.professores (índice 8; exibição/busca)",
    "turma_counts_display": "getTurmaFromJSON: carga_horaria/vagas_* (índices 1–6)",
    "curso_field_type": "JSONTurma[9]: number | null (curso ofertante)",
    "horario_split": "getTurmaFromJSON: rawAula.split(' / ') / .split('.') / .split('-')",
    "horario_decode": "getHorarioList (lança exceção) + grade por dia_semana",
    "curso_resolution": "futuro: resolução curso→nome via JSONCampus.cursos[curso]",
    "file_routing": "fetch de data/<ano>/<semestre>-<campus>.json (roteamento por arquivo)",
    "semester_routing": "semestre no caminho data/<ano>/<sem>-<campus> e SEMESTER_PATTERN da URL",
    "disciplina_by_codigo": "índice de disciplina por código; reconstrução por URL",
    "turma_by_id": "casamento de turma por id; reconstrução por URL",
    "index_fetch": "app: fetch de index.json (lista de semestres)",
    "index_semester_files": "app: fetch de cada data/<ano>/<sem>-<campus>.json do semestre indexado",
}


@dataclass(frozen=True)
class Violation:
    """Uma suposição violada, com o suficiente para corrigir: qual check falhou,
    em que arquivo, com que mensagem e uma amostra do registro ofensor."""

    check_id: str
    level: str
    file: str
    message: str
    sample: object = None


@dataclass(frozen=True)
class Check:
    """Uma entrada do catálogo: metadados + a função que varre o staging."""

    id: str
    level: str
    assumption: str
    consumption: tuple  # chaves em CONSUMPTION_POINTS
    fn: Callable[["Ctx"], Iterator["_Finding"]]


# Cada check produz `_Finding`s (arquivo/mensagem/amostra); o runner carimba
# `check_id`/`level` a partir do catálogo, para o check não se repetir.
_Finding = namedtuple("_Finding", ["file", "message", "sample"])
_Finding.__new__.__defaults__ = (None,)  # `sample` opcional

CHECKS: list[Check] = []


def check(id, level, assumption, consumption):
    """Registra uma função de check no catálogo enumerável `CHECKS`."""

    unknown = [c for c in consumption if c not in CONSUMPTION_POINTS]
    if unknown:
        raise ValueError(f"check {id!r} referencia pontos de consumo desconhecidos: {unknown}")

    def deco(fn):
        CHECKS.append(Check(id, level, assumption, tuple(consumption), fn))
        return fn

    return deco


# ---------------------------------------------------------------------------
# Contexto de staging: os arquivos carregados uma vez, para os checks varrerem.
# ---------------------------------------------------------------------------
@dataclass
class CampusFile:
    filename: str          # ex.: "20262-FLO.json"
    semester: str          # do nome do arquivo
    campus: str            # do nome do arquivo
    data: object           # JSON parseado (ou None se não parseou)
    parse_error: Optional[str] = None


@dataclass
class Ctx:
    data_dir: str
    campus_files: list = field(default_factory=list)
    index_present: bool = False
    index_data: object = None
    index_parse_error: Optional[str] = None


def load_ctx(data_dir):
    """Carrega o diretório de staging num `Ctx`: descobre os arquivos de campus
    (`<ano>/<semestre>-<campus>.json`), parseia cada um (guardando erros de
    parse em vez de estourar) e lê o `index.json`."""

    ctx = Ctx(data_dir=os.path.abspath(data_dir))

    for year_dir in sorted(os.listdir(data_dir)):
        year_path = os.path.join(data_dir, year_dir)
        if not os.path.isdir(year_path):
            continue
        for filename in sorted(os.listdir(year_path)):
            match = DATA_FILE_RE.match(filename)
            if not match:
                continue
            semester, campus = match.groups()
            data, err = _load_json_or_error(os.path.join(year_path, filename))
            ctx.campus_files.append(CampusFile(filename, semester, campus, data, err))

    index_path = os.path.join(data_dir, "index.json")
    if os.path.exists(index_path):
        ctx.index_present = True
        ctx.index_data, ctx.index_parse_error = _load_json_or_error(index_path)

    return ctx


def _load_json_or_error(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f), None
    except (json.JSONDecodeError, OSError) as e:
        return None, str(e)


# ---------------------------------------------------------------------------
# Decodificador de horário — ESPELHO de getTurmaFromJSON/getHorarioList.
# ---------------------------------------------------------------------------
def decode_horario(raw):
    """Retorna None se `raw` decodifica sob as regras do frontend, ou uma string
    com o motivo caso contrário.

    Espelha `matrufsc/src/context/plano/parser.ts`:
        const [info, sala] = rawAula.split(" / ");
        const [dia_semana, info2] = info.split(".");
        const [horario_inicio, aulas] = info2.split("-");
        // getHorarioList: HORAS.indexOf(horario_inicio) !== -1
        //                 e index + aulas - 1 < HORAS.length
    Além de impedir a exceção do parser, garante o decode correto (dia válido,
    duração inteira positiva), que a grade por `dia_semana` assume."""

    info = raw.split(" / ")[0]

    bits = info.split(".")
    if len(bits) < 2:
        return "sem separador '.' (esperado dia.horario)"
    dia_str, info2 = bits[0], bits[1]
    try:
        dia = int(dia_str)
    except ValueError:
        return f"dia não é inteiro: {dia_str!r}"
    if dia not in DIAS_SEMANA:
        return f"dia da semana fora de [1,7]: {dia}"

    bits2 = info2.split("-")
    if len(bits2) < 2:
        return "sem separador '-' (esperado horario-duracao)"
    horario_inicio, aulas_str = bits2[0], bits2[1]
    if horario_inicio not in HORAS:
        return f"hora inicial fora do conjunto de horas: {horario_inicio!r}"
    try:
        aulas = int(aulas_str)
    except ValueError:
        return f"duração não é inteiro: {aulas_str!r}"
    if aulas < 1:
        return f"duração menor que 1: {aulas}"
    if HORAS.index(horario_inicio) + aulas > len(HORAS):
        return f"início + duração excede os slots do dia: {horario_inicio}+{aulas}"
    return None


# ---------------------------------------------------------------------------
# Helpers de forma (guardam checks para não cascatear de um registro quebrado).
# ---------------------------------------------------------------------------
def _is_int(value):
    # Booleanos são int em Python; rejeita explicitamente.
    return isinstance(value, int) and not isinstance(value, bool)


def _nonempty_str(value):
    return isinstance(value, str) and bool(value)


def _turma_shaped(turma):
    return isinstance(turma, list) and len(turma) in (9, 10)


def _disciplina_shaped(disc):
    return isinstance(disc, list) and len(disc) == 4 and isinstance(disc[3], list)


def _is_legacy(cf):
    """Arquivo em formato legado (pré-migração): sem o campo `cursos`. Nesses
    arquivos as turmas vêm com 9 campos e as garantias do novo contrato que só
    o novo produtor estabelece (unicidade de código/id) não valem — são
    toleradas até o semestre ser re-scrapeado (ver spec, retrocompat)."""
    return isinstance(cf.data, dict) and "cursos" not in cf.data


def _arity(value):
    return len(value) if isinstance(value, list) else f"não-lista({type(value).__name__})"


def _short(value, limit=80):
    text = repr(value)
    return text if len(text) <= limit else text[:limit] + "…"


def _content_files(ctx):
    """Arquivos de campus que parsearam para um objeto — seguros para inspeção."""
    return [cf for cf in ctx.campus_files if isinstance(cf.data, dict)]


def _disciplinas(cf):
    ds = cf.data.get("disciplinas")
    return ds if isinstance(ds, list) else []


def _horarios(turma):
    return turma[7] if _turma_shaped(turma) and isinstance(turma[7], list) else []


def _iter_turmas(cf):
    """Itera (disc_index, turma_index, turma, codigo) sobre disciplinas bem-formadas."""
    for di, disc in enumerate(_disciplinas(cf)):
        if not _disciplina_shaped(disc):
            continue
        codigo = disc[0] if _nonempty_str(disc[0]) else f"disciplina {di}"
        for ti, turma in enumerate(disc[3]):
            yield di, ti, turma, codigo


# ===========================================================================
# Catálogo de checks
# ===========================================================================

# --- Estrutural ------------------------------------------------------------

@check("campus_arquivo_parseavel", ESTRUTURAL,
       "Todo arquivo de campus é JSON válido e parseável.",
       ["fetch_json"])
def _chk_parseavel(ctx):
    for cf in ctx.campus_files:
        if cf.parse_error:
            yield _Finding(cf.filename, f"JSON inválido: {cf.parse_error}")


@check("campus_arquivo_objeto", ESTRUTURAL,
       "O payload de campus é um objeto JSON.",
       ["campus_object"])
def _chk_objeto(ctx):
    for cf in ctx.campus_files:
        if cf.parse_error is None and not isinstance(cf.data, dict):
            yield _Finding(cf.filename, f"payload não é objeto: {type(cf.data).__name__}")


@check("campus_campo_presente", ESTRUTURAL,
       "O campo `campus` é uma string não-vazia.",
       ["campus_routing"])
def _chk_campus_campo(ctx):
    for cf in _content_files(ctx):
        if not _nonempty_str(cf.data.get("campus")):
            yield _Finding(cf.filename, f"campus ausente/vazio: {cf.data.get('campus')!r}")


@check("data_extracao_presente", ESTRUTURAL,
       "O campo `data_extracao` é uma string não-vazia.",
       ["data_extracao_display"])
def _chk_data_extracao(ctx):
    for cf in _content_files(ctx):
        if not _nonempty_str(cf.data.get("data_extracao")):
            yield _Finding(cf.filename, f"data_extracao ausente/vazia: {cf.data.get('data_extracao')!r}")


@check("disciplinas_lista_nao_vazia", ESTRUTURAL,
       "`disciplinas` é uma lista não-vazia.",
       ["disciplinas_iter"])
def _chk_disciplinas_lista(ctx):
    for cf in _content_files(ctx):
        ds = cf.data.get("disciplinas")
        if not isinstance(ds, list) or not ds:
            yield _Finding(cf.filename, "disciplinas ausente ou vazia")


@check("cursos_mapa_shape", ESTRUTURAL,
       "`cursos`, quando presente, é um mapa string→string não-vazia (ausência é tolerada no legado).",
       ["cursos_map"])
def _chk_cursos_shape(ctx):
    for cf in _content_files(ctx):
        if "cursos" not in cf.data:
            continue  # legado: arquivo ainda sem o campo
        cursos = cf.data["cursos"]
        if not isinstance(cursos, dict):
            yield _Finding(cf.filename, f"cursos não é objeto: {type(cursos).__name__}")
            continue
        for key, value in cursos.items():
            if not isinstance(key, str) or not _nonempty_str(value):
                yield _Finding(cf.filename, f"entrada de curso inválida: {key!r} → {value!r}", (key, value))


@check("disciplina_aridade", ESTRUTURAL,
       "Cada disciplina é uma tupla de 4 campos.",
       ["disciplina_destructure"])
def _chk_disc_aridade(ctx):
    for cf in _content_files(ctx):
        for di, disc in enumerate(_disciplinas(cf)):
            if not isinstance(disc, list) or len(disc) != 4:
                yield _Finding(cf.filename, f"disciplina {di}: aridade {_arity(disc)} (esperado 4)", _short(disc))


@check("disciplina_tipos", ESTRUTURAL,
       "codigo, nome_ascii e nome são strings não-vazias; turmas é uma lista não-vazia.",
       ["nome_display", "nome_ascii_search", "disciplina_by_codigo"])
def _chk_disc_tipos(ctx):
    for cf in _content_files(ctx):
        for di, disc in enumerate(_disciplinas(cf)):
            if not (isinstance(disc, list) and len(disc) == 4):
                continue  # aridade tratada por disciplina_aridade
            codigo, nome_ascii, nome, turmas = disc
            for value, name in ((codigo, "codigo"), (nome_ascii, "nome_ascii"), (nome, "nome")):
                if not _nonempty_str(value):
                    yield _Finding(cf.filename, f"disciplina {di}: {name} inválido: {value!r}", _short(disc))
            if not isinstance(turmas, list) or not turmas:
                yield _Finding(cf.filename, f"disciplina {di} ({codigo!r}): turmas ausente ou vazia", _short(disc))


@check("turma_aridade", ESTRUTURAL,
       "Cada turma é uma tupla de 10 campos (ou 9, legado durante a migração).",
       ["turma_destructure"])
def _chk_turma_aridade(ctx):
    for cf in _content_files(ctx):
        for di, ti, turma, codigo in _iter_turmas(cf):
            if not _turma_shaped(turma):
                yield _Finding(cf.filename, f"{codigo} turma {ti}: aridade {_arity(turma)} (esperado 9 ou 10)", _short(turma))


@check("turma_tipos", ESTRUTURAL,
       "Tipos certos por posição: id string não-vazia; campos numéricos (índices 1–6) inteiros; "
       "horarios e professores listas de strings.",
       ["turma_destructure", "turma_counts_display", "professores_search", "horario_split"])
def _chk_turma_tipos(ctx):
    for cf in _content_files(ctx):
        for di, ti, turma, codigo in _iter_turmas(cf):
            if not _turma_shaped(turma):
                continue
            if not _nonempty_str(turma[0]):
                yield _Finding(cf.filename, f"{codigo} turma {ti}: id inválido: {turma[0]!r}", _short(turma))
            for idx in range(1, 7):
                if not _is_int(turma[idx]):
                    yield _Finding(cf.filename, f"{codigo} turma {ti}: campo numérico {idx} não é inteiro: {turma[idx]!r}", _short(turma))
            for idx, name in ((7, "horarios"), (8, "professores")):
                value = turma[idx]
                if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
                    yield _Finding(cf.filename, f"{codigo} turma {ti}: {name} deve ser lista de strings", _short(turma))


# --- Valor -----------------------------------------------------------------

@check("turma_contadores_nao_negativos", VALOR,
       "As contagens que o frontend exibe — carga_horaria (1), vagas_ofertadas (2), vagas_ocupadas (3) — "
       "são não-negativas. Os índices 4–6 (alunos_especiais/saldo/pedidos) são ignorados pelo frontend "
       "e o CAGR emite -1 como sentinela em alunos_especiais, então só exigimos que sejam inteiros (turma_tipos).",
       ["turma_counts_display"])
def _chk_contadores(ctx):
    for cf in _content_files(ctx):
        for di, ti, turma, codigo in _iter_turmas(cf):
            if not _turma_shaped(turma):
                continue
            for idx in (1, 2, 3):
                value = turma[idx]
                if _is_int(value) and value < 0:  # tipo não-inteiro é tratado por turma_tipos
                    yield _Finding(cf.filename, f"{codigo} turma {ti}: contagem {idx} negativa: {value!r}", _short(turma))


@check("curso_inteiro_ou_nulo", VALOR,
       "O curso da turma (índice 9), quando presente, é inteiro ou null.",
       ["curso_field_type"])
def _chk_curso_tipo(ctx):
    for cf in _content_files(ctx):
        for di, ti, turma, codigo in _iter_turmas(cf):
            if not _turma_shaped(turma) or len(turma) < 10:
                continue
            curso = turma[9]
            if curso is not None and not _is_int(curso):
                yield _Finding(cf.filename, f"{codigo} turma {ti}: curso deve ser inteiro ou null: {curso!r}", _short(turma))


HORARIO_RE = re.compile(r"^\d+\.\d{4}-\d+ / .+$")


@check("horario_formato", VALOR,
       "Cada string de horário casa o formato `D.HHMM-N / SALA`.",
       ["horario_split"])
def _chk_horario_formato(ctx):
    for cf in _content_files(ctx):
        for di, ti, turma, codigo in _iter_turmas(cf):
            for horario in _horarios(turma):
                if not isinstance(horario, str) or not HORARIO_RE.match(horario):
                    yield _Finding(cf.filename, f"{codigo} turma {ti}: horário fora do formato: {horario!r}", horario)


# --- Relacional ------------------------------------------------------------

@check("curso_referencia_integra", RELACIONAL,
       "Todo `curso` não-nulo de turma existe nas chaves do mapa `cursos` (sem referência órfã).",
       ["curso_resolution"])
def _chk_curso_ref(ctx):
    for cf in _content_files(ctx):
        cursos = cf.data.get("cursos")
        curso_keys = set(cursos.keys()) if isinstance(cursos, dict) else set()
        for di, ti, turma, codigo in _iter_turmas(cf):
            if not _turma_shaped(turma) or len(turma) < 10:
                continue
            curso = turma[9]
            if curso is None or not _is_int(curso):
                continue
            if str(curso) not in curso_keys:
                yield _Finding(cf.filename, f"{codigo} turma {ti}: curso {curso} ausente do mapa `cursos`", _short(turma))


@check("horario_decodificavel", RELACIONAL,
       "Todo horário decodifica sob as regras do frontend: hora inicial ∈ HORAS, "
       "início + duração ≤ nº de slots, dia da semana ∈ [1,7]. Impede a exceção do parser de horário.",
       ["horario_decode"])
def _chk_horario_decod(ctx):
    for cf in _content_files(ctx):
        for di, ti, turma, codigo in _iter_turmas(cf):
            for horario in _horarios(turma):
                if not isinstance(horario, str):
                    continue  # tipo tratado por turma_tipos
                reason = decode_horario(horario)
                if reason:
                    yield _Finding(cf.filename, f"{codigo} turma {ti}: horário indecodificável ({reason}): {horario!r}", horario)


@check("campus_bate_com_arquivo", RELACIONAL,
       "O `campus` do conteúdo bate com o campus do nome do arquivo (sem rotulagem trocada).",
       ["file_routing"])
def _chk_campus_match(ctx):
    for cf in _content_files(ctx):
        content_campus = cf.data.get("campus")
        if _nonempty_str(content_campus) and content_campus != cf.campus:
            yield _Finding(cf.filename, f"campus do conteúdo ({content_campus!r}) != campus do arquivo ({cf.campus!r})")


@check("semestre_valido", RELACIONAL,
       "O semestre no nome do arquivo é válido: 5 dígitos com o período 1 (primeiro) ou 2 (segundo).",
       ["semester_routing"])
def _chk_semestre_valido(ctx):
    for cf in ctx.campus_files:
        if not SEMESTER_RE.match(cf.semester) or cf.semester[4] not in ("1", "2"):
            yield _Finding(cf.filename, f"semestre inválido no nome do arquivo: {cf.semester!r}")


@check("disciplina_codigo_unico", RELACIONAL,
       "O código de disciplina é único dentro de um campus (o novo produtor agrega todas as turmas "
       "de um código numa só disciplina). Tolerado no legado, que agrupava por curso.",
       ["disciplina_by_codigo"])
def _chk_codigo_unico(ctx):
    for cf in _content_files(ctx):
        if _is_legacy(cf):
            continue
        seen = {}
        for di, disc in enumerate(_disciplinas(cf)):
            if not _disciplina_shaped(disc) or not _nonempty_str(disc[0]):
                continue
            codigo = disc[0]
            if codigo in seen:
                yield _Finding(cf.filename, f"código de disciplina duplicado: {codigo!r} (disciplinas {seen[codigo]} e {di})", codigo)
            else:
                seen[codigo] = di


@check("turma_id_unico", RELACIONAL,
       "O id de turma é único dentro de uma disciplina. Tolerado no legado, que podia repetir "
       "turmas ao listar a mesma disciplina em blocos de cursos diferentes.",
       ["turma_by_id"])
def _chk_turma_id_unico(ctx):
    for cf in _content_files(ctx):
        if _is_legacy(cf):
            continue
        for di, disc in enumerate(_disciplinas(cf)):
            if not _disciplina_shaped(disc):
                continue
            codigo, seen = disc[0], set()
            for turma in disc[3]:
                if not _turma_shaped(turma) or not _nonempty_str(turma[0]):
                    continue
                tid = turma[0]
                if tid in seen:
                    yield _Finding(cf.filename, f"{codigo!r}: id de turma duplicado: {tid!r}", tid)
                else:
                    seen.add(tid)


@check("indice_parseavel", RELACIONAL,
       "index.json existe, parseia e é um objeto com a lista não-vazia `semesters`.",
       ["index_fetch"])
def _chk_indice_parseavel(ctx):
    if not ctx.index_present:
        yield _Finding("index.json", "index.json ausente no staging")
        return
    if ctx.index_parse_error:
        yield _Finding("index.json", f"index.json inválido: {ctx.index_parse_error}")
        return
    data = ctx.index_data
    if not isinstance(data, dict) or not isinstance(data.get("semesters"), list):
        yield _Finding("index.json", "index.json não é objeto com a lista `semesters`")
        return
    if not data["semesters"]:
        yield _Finding("index.json", "index.json não lista nenhum semestre (dados indisponíveis)")


@check("indice_semestres_completos", RELACIONAL,
       "Cada semestre indexado é bem-formado e tem todos os campi esperados presentes e parseáveis.",
       ["index_semester_files"])
def _chk_indice_completos(ctx):
    if not ctx.index_present or ctx.index_parse_error or not isinstance(ctx.index_data, dict):
        return  # tratado por indice_parseavel
    semesters = ctx.index_data.get("semesters")
    if not isinstance(semesters, list):
        return
    present = {(cf.semester, cf.campus) for cf in ctx.campus_files if cf.parse_error is None and isinstance(cf.data, dict)}
    for entry in semesters:
        semester = normalize_semester_entry(entry)  # str/dict->value + SEMESTER_RE (mesma regra do índice)
        if semester is None or semester[4] not in ("1", "2"):
            yield _Finding("index.json", f"semestre inválido no índice: {entry!r}", entry)
            continue
        for campus in campus_codes_for_semester(semester):
            if (semester, campus) not in present:
                yield _Finding("index.json", f"semestre {semester} indexado mas {semester}-{campus}.json ausente ou não-parseável", semester)


# ===========================================================================
# Runner e relatório
# ===========================================================================
@dataclass
class GateReport:
    violations: list
    checks_run: int

    @property
    def ok(self):
        return not self.violations


def run_gate(data_dir):
    """Executa **todos** os checks sobre o diretório de staging e agrega as
    violações num `GateReport` (não para no primeiro erro)."""
    ctx = load_ctx(data_dir)
    violations = []
    for chk in CHECKS:
        for finding in chk.fn(ctx):
            violations.append(Violation(chk.id, chk.level, finding.file, finding.message, finding.sample))
    return GateReport(violations=violations, checks_run=len(CHECKS))


_CHECKS_BY_ID = None


def _checks_by_id():
    global _CHECKS_BY_ID
    if _CHECKS_BY_ID is None:
        _CHECKS_BY_ID = {c.id: c for c in CHECKS}
    return _CHECKS_BY_ID


def format_report(report, max_samples=5):
    """Relatório agregado e legível, agrupado por check (o mais severo primeiro:
    estrutural → valor → relacional)."""
    if report.ok:
        return f"Gate OK: {report.checks_run} checks, 0 violações."

    order = {ESTRUTURAL: 0, VALOR: 1, RELACIONAL: 2}
    by_check = {}
    for violation in report.violations:
        by_check.setdefault(violation.check_id, []).append(violation)

    lines = [f"Gate de integridade FALHOU: {len(report.violations)} violação(ões) em {len(by_check)} check(s)."]
    for check_id in sorted(by_check, key=lambda cid: (order.get(_checks_by_id()[cid].level, 9), cid)):
        found = by_check[check_id]
        meta = _checks_by_id()[check_id]
        lines.append("")
        lines.append(f"[{meta.level}] {check_id} — {len(found)} violação(ões)")
        lines.append(f"    suposição: {meta.assumption}")
        for violation in found[:max_samples]:
            sample = f"  amostra={_short(violation.sample)}" if violation.sample is not None else ""
            lines.append(f"    - {violation.file}: {violation.message}{sample}")
        if len(found) > max_samples:
            lines.append(f"    … e mais {len(found) - max_samples}")
    return "\n".join(lines)


def traceability_rows():
    """Rastreabilidade consumo do frontend → checks que o protegem.

    Retorna [(consumption_key, descrição, [check_ids])], na ordem de
    `CONSUMPTION_POINTS`. Um ponto sem checks é uma lacuna de cobertura."""
    rows = []
    for key, description in CONSUMPTION_POINTS.items():
        protecting = [c.id for c in CHECKS if key in c.consumption]
        rows.append((key, description, protecting))
    return rows


def format_traceability():
    lines = ["Rastreabilidade — ponto de consumo do frontend → check(s) que o protegem", ""]
    for key, description, protecting in traceability_rows():
        status = ", ".join(protecting) if protecting else "*** SEM CHECK ***"
        lines.append(f"- {key}: {status}")
        lines.append(f"    {description}")
    lines.append("")
    lines.append(f"{len(CHECKS)} checks no catálogo, {len(CONSUMPTION_POINTS)} pontos de consumo.")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Gate de integridade pré-publicação do MatrUFSC.")
    parser.add_argument("data_dir", nargs="?", help="Diretório de dados (staging) a validar.")
    parser.add_argument("--traceability", action="store_true",
                        help="Imprime o mapa de rastreabilidade (consumo do frontend → check) e sai.")
    args = parser.parse_args(argv)

    if args.traceability:
        print(format_traceability())
        return 0

    if not args.data_dir:
        parser.error("informe o diretório de dados, ou use --traceability")

    report = run_gate(args.data_dir)
    if report.ok:
        print(f"Gate OK: {report.checks_run} checks, 0 violações.")
        return 0
    print(format_report(report), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
