#!/usr/bin/env python3

"""Parse raw CAGR XML pages into the compact JSON payload used by MatrUFSC.

The parser trusts the structure CAGR emits and refuses to guess: a page or a
row whose shape differs from what CAGR serves today aborts the whole parse, so
a layout change on CAGR stops publication instead of producing incomplete data.
"""

from xml.etree import cElementTree
import unicodedata
import os
import re


XHTML_NS = "{http://www.w3.org/1999/xhtml}"
A = XHTML_NS + "a"
BR = XHTML_NS + "br"
SPAN = XHTML_NS + "span"
TABLE_ID = "formBusca:dataTable"
ROWS_PER_PAGE = 50
HEADER = (
    "",
    "Ementa",
    "Currículo",
    "Disciplina",
    "Turma",
    "Nome da Disciplina",
    "HorasAula",
    "VagasOfertadas",
    "VagasOcupadas",
    "AlunosEspeciais",
    "SaldoVagas",
    "Pedidossem vaga",
    "Horários",
    "Professor",
)
CURSO_HREF_RE = re.compile(r"curriculoCurso\?curso=(0|[1-9]\d*)(?:&|$)")
STATUS_RE = re.compile(r"\[([^\[\]]+)\]")
INT_RE = re.compile(r"\d+")


def find_id(xml, id):
    for x in xml:
        if x.get("id") == id:
            return x
        y = find_id(x, id)
        if y is not None:
            return y
    return None


def _split_pages(xml_text):
    for xml in xml_text.split('<?xml version="1.0"?>'):
        if xml.strip():
            yield cElementTree.fromstring(xml)


def _table_sections(table):
    return {section.tag.replace(XHTML_NS, ""): section for section in table}


def iter_rows_from_xml_text(xml_text):
    """Itera pelas linhas de disciplinas em uma ou mais respostas AJAX do CAGR."""
    for page in _split_pages(xml_text):
        table = find_id(page, TABLE_ID)
        if table is not None:
            yield from _table_sections(table).get("tbody", ())


def count_rows_in_xml_text(xml_text):
    return sum(1 for _ in iter_rows_from_xml_text(xml_text))


def _describe(element):
    """O elemento serializado, sem o namespace, para mensagens de erro."""
    xml = cElementTree.tostring(element, encoding="unicode")
    return re.sub(r"<(/?)\w+:", r"<\1", re.sub(r' xmlns:\w+="[^"]*"', "", xml))


def _iter_page_rows(xml_text):
    """Linhas de todas as páginas, exigindo de cada página a tabela com o
    cabeçalho conhecido e, de toda página que não é a última, ROWS_PER_PAGE linhas."""
    pages = list(_split_pages(xml_text))
    for n, page in enumerate(pages, start=1):
        table = find_id(page, TABLE_ID)
        if table is None:
            raise RuntimeError(f"pagina {n}: sem a tabela {TABLE_ID}")
        sections = _table_sections(table)
        thead = sections.get("thead")
        header = tuple("".join(th.itertext()).strip() for th in (thead[0] if thead is not None and len(thead) else []))
        if header != HEADER:
            raise RuntimeError(f"pagina {n}: cabecalho da tabela diferente do esperado: {header}")
        rows = list(sections.get("tbody", ()))
        if n < len(pages) and len(rows) != ROWS_PER_PAGE:
            raise RuntimeError(f"pagina {n} de {len(pages)}: {len(rows)} linhas, esperado {ROWS_PER_PAGE}")
        yield from rows


def _cell_lines(cell, ctx, campo):
    """Linhas de uma célula, como o CAGR as separa com <br/>."""
    for sub in cell:
        if sub.tag != BR:
            raise RuntimeError(f"{ctx}: {campo} com <{sub.tag.replace(XHTML_NS, '')}>, esperado so <br/>: {_describe(cell)}")
    return [(cell.text or "").strip()] + [(sub.tail or "").strip() for sub in cell]


def _parse_curso_id(cell, ctx):
    """Id do curso ofertante, lido do link 'Currículo' (`curriculoCurso?curso=302`)."""
    hrefs = [el.get("href") for el in cell.iter() if el.get("href") is not None]
    match = CURSO_HREF_RE.search(hrefs[0]) if len(hrefs) == 1 else None
    if match is None:
        raise RuntimeError(
            f"{ctx}: esperado um unico link curriculoCurso?curso=<id> na celula do curriculo, encontrado {hrefs}"
        )
    return int(match.group(1))


def _parse_nome(cell, ctx):
    """Célula do nome: `Nome<br/>*CURSO` ou `Nome<br/>[Status]<br/>*CURSO`.

    Devolve (nome, status, nome_curso); status é None quando não há linha do meio.
    """
    lines = _cell_lines(cell, ctx, "celula do nome")
    if len(lines) == 2:
        nome, curso = lines
        status = None
    elif len(lines) == 3:
        nome, status, curso = lines
        match = STATUS_RE.fullmatch(status)
        if match is None or not match.group(1).strip():
            raise RuntimeError(f"{ctx}: linha de status fora do padrao [..]: {lines!r}")
        status = match.group(1).strip()
    else:
        raise RuntimeError(f"{ctx}: celula do nome com {len(lines)} linha(s), esperado 2 ou 3: {lines!r}")

    if not nome or "[" in nome or "]" in nome:
        raise RuntimeError(f"{ctx}: nome da disciplina vazio ou com colchetes: {lines!r}")
    nome_curso = curso[1:].strip()
    if not curso.startswith("*") or not nome_curso:
        raise RuntimeError(f"{ctx}: linha do curso fora do padrao *CURSO: {lines!r}")
    return nome, status, nome_curso


def _parse_int(cell, ctx, name):
    if len(cell) or cell.text is None or INT_RE.fullmatch(cell.text) is None:
        raise RuntimeError(f"{ctx}: {name} nao e um numero: {_describe(cell)}")
    return int(cell.text)


def _parse_saldo_vagas(cell, ctx):
    """O CAGR troca o saldo por um `<span>LOTADA</span>` quando não há vaga."""
    if cell.text is None and len(cell) == 1 and cell[0].tag == SPAN and not cell[0].tail:
        if (cell[0].text or "").strip() == "LOTADA":
            return 0
    return _parse_int(cell, ctx, "saldo_vagas")


def _parse_pedidos_sem_vaga(cell, ctx):
    if cell.text is None and not len(cell):
        return 0
    return _parse_int(cell, ctx, "pedidos_sem_vaga")


def _parse_horarios(cell, ctx):
    """Um horário por linha, cada um seguido de <br/>; a célula vazia não tem nenhum."""
    if cell.text is None and not len(cell):
        return []
    lines = _cell_lines(cell, ctx, "celula de horarios")
    if lines[-1] != "" or "" in lines[:-1]:
        raise RuntimeError(f"{ctx}: horarios fora do padrao horario<br/>: {_describe(cell)}")
    return lines[:-1]


def _parse_professores(cell, ctx):
    """Um professor por linha, como texto ou como `<a>nome</a>`, cada um seguido de <br/>."""

    def fail():
        raise RuntimeError(f"{ctx}: professores fora do padrao (<a>nome</a>|nome)<br/>: {_describe(cell)}")

    professores = []
    pendente = (cell.text or "").strip() or None
    for sub in cell:
        if sub.tag == A:
            nome = (sub.text or "").strip()
            if pendente is not None or not nome or len(sub) or (sub.tail or "").strip():
                fail()
            pendente = nome
        elif sub.tag == BR:
            if pendente is None:
                fail()
            professores.append(pendente)
            pendente = (sub.tail or "").strip() or None
        else:
            fail()
    if pendente is not None:
        fail()
    return professores


def parse_xml_text(xml_text):
    """Extrai (disciplinas, cursos) de uma ou mais respostas XML do CAGR.

    As turmas são agrupadas por código em qualquer posição da listagem, e
    `cursos` é o mapa {id: nome} dos cursos ofertantes vistos neste campus.
    """

    materias_by_codigo = {}
    seen_turmas = {}
    cursos = {}

    for n, row in enumerate(_iter_page_rows(xml_text), start=1):
        if len(row) != len(HEADER):
            raise RuntimeError(f"linha {n}: {len(row)} celulas, esperado {len(HEADER)}: {_describe(row)}")

        codigo_disciplina = (row[3].text or "").strip()
        nome_turma = (row[4].text or "").strip()
        ctx = f"linha {n} ({codigo_disciplina or '?'} {nome_turma or '?'})"
        if not codigo_disciplina or not nome_turma:
            raise RuntimeError(f"{ctx}: codigo da disciplina ou id da turma vazio: {_describe(row)}")

        curso_id = _parse_curso_id(row[2], ctx)
        nome_disciplina, status, nome_curso = _parse_nome(row[5], ctx)
        turma = [
            nome_turma,
            _parse_int(row[6], ctx, "horas_aula"),
            _parse_int(row[7], ctx, "vagas_ofertadas"),
            _parse_int(row[8], ctx, "vagas_ocupadas"),
            _parse_int(row[9], ctx, "alunos_especiais"),
            _parse_saldo_vagas(row[10], ctx),
            _parse_pedidos_sem_vaga(row[11], ctx),
            _parse_horarios(row[12], ctx),
            _parse_professores(row[13], ctx),
            curso_id,
            status,
        ]

        anterior = seen_turmas.get((codigo_disciplina, nome_turma))
        if anterior is not None:
            n_anterior, turma_anterior = anterior
            igual = "identica" if turma_anterior == turma else "diferente"
            raise RuntimeError(
                f"{ctx}: turma ja listada na linha {n_anterior}, copia {igual}: {turma_anterior!r} vs {turma!r}"
            )
        seen_turmas[(codigo_disciplina, nome_turma)] = (n, turma)
        cursos.setdefault(str(curso_id), nome_curso)

        materia = materias_by_codigo.get(codigo_disciplina)
        if materia is None:
            nome_disciplina_ascii = (
                unicodedata.normalize("NFKD", nome_disciplina)
                .encode("ascii", "ignore")
                .decode("ascii")
                .upper()
            )
            materia = [
                codigo_disciplina,
                nome_disciplina_ascii,
                nome_disciplina,
                [],
            ]
            materias_by_codigo[codigo_disciplina] = materia
        elif materia[2] != nome_disciplina:
            raise RuntimeError(
                f"{ctx}: nome difere do de outra turma da mesma disciplina: {nome_disciplina!r} vs {materia[2]!r}"
            )
        materia[3].append(turma)

    return list(materias_by_codigo.values()), cursos


def parse_xml_file(filepath):
    """Extrai (disciplinas, cursos) de um arquivo XML do CAGR."""
    with open(filepath, "r", encoding="utf-8") as f:
        try:
            return parse_xml_text(f.read())
        except Exception as e:
            raise RuntimeError(f"{os.path.basename(filepath)}: {e}") from e


def extract_semester_campus(filepath):
    """Extrai semestre e campus do nome do arquivo XML (ex: 20251_FLO.xml)."""
    basename = os.path.splitext(os.path.basename(filepath))[0]
    match = re.match(r"^(\d{5})_([A-Z]{3})$", basename)
    if not match:
        raise ValueError(
            f"Nome de arquivo inválido: '{basename}'. "
            f"Esperado formato: <semestre>_<campus>.xml (ex: 20251_FLO.xml)"
        )
    return match.group(1), match.group(2)
