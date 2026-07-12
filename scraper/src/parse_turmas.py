#!/usr/bin/env python3

"""Parse raw CAGR XML pages into the compact JSON payload used by MatrUFSC."""

from xml.etree import cElementTree
import unicodedata
import os
import re


XHTML_NS = "{http://www.w3.org/1999/xhtml}"


def find_id(xml, id):
    for x in xml:
        if x.get("id") == id:
            return x
        y = find_id(x, id)
        if y is not None:
            return y
    return None


def iter_rows_from_xml_text(xml_text):
    """Itera pelas linhas de disciplinas em uma ou mais respostas AJAX do CAGR."""
    for xml in xml_text.split('<?xml version="1.0"?>'):
        if not xml.strip():
            continue

        table = find_id(cElementTree.fromstring(xml), "formBusca:dataTable")
        if table is None:
            continue

        for section in table:
            if section.tag == XHTML_NS + "tbody":
                yield from section


def count_rows_in_xml_text(xml_text):
    return sum(1 for _ in iter_rows_from_xml_text(xml_text))


CURSO_ID_RE = re.compile(r"curso=(\d+)")


def _extract_curso_id(cell):
    """Id do curso ofertante, lido do link 'Currículo' da linha (ex.
    `curriculoCurso?curso=302`). Cada turma pertence a exatamente um curso;
    retorna o inteiro ou None quando a linha não tem esse link."""
    for el in cell.iter():
        href = el.get("href")
        if href:
            match = CURSO_ID_RE.search(href)
            if match:
                return int(match.group(1))
    return None


def _split_nome_curso(cell):
    """Separa a célula do nome em (nome_disciplina, nome_curso).

    O CAGR anexa o curso ofertante como um sufixo `*NOME` depois de um <br/>
    (ex.: `Administração I<br/>*CIÊNCIAS CONTÁBEIS`). O nome da disciplina é o
    mesmo para todos os cursos; só o sufixo varia, então ele é removido daqui e
    o curso passa a viver no campo estruturado da turma."""
    partes = [cell.text or ""]
    nome_curso = None
    for sub in cell:
        tail = sub.tail or ""
        if tail.strip().startswith("*"):
            nome_curso = tail.strip()[1:].strip()
        elif tail:
            partes.append(tail)
    nome = " ".join(parte for parte in partes if parte).strip()
    return nome, nome_curso


def parse_xml_text(xml_text):
    """Extrai (disciplinas, cursos) de uma ou mais respostas XML do CAGR.

    `cursos` é o mapa {id: nome} dos cursos ofertantes vistos neste campus,
    usado pelo frontend para resolver o `curso` de cada turma."""

    materias_by_codigo = {}    # codigo -> tupla da disciplina (ordem de 1a aparicao)
    turma_ids_by_codigo = {}   # codigo -> ids de turma ja incluidos (dedup)
    cursos = {}

    for row in iter_rows_from_xml_text(xml_text):
        codigo_disciplina = row[3].text
        nome_turma = row[4].text

        nome_disciplina, nome_curso = _split_nome_curso(row[5])
        curso_id = _extract_curso_id(row[2])
        if curso_id is not None:
            chave = str(curso_id)
            if nome_curso:
                cursos[chave] = nome_curso
            else:
                cursos.setdefault(chave, chave)

        horas_aula = int(row[6].text)
        vagas_ofertadas = int(row[7].text)
        vagas_ocupadas = int(row[8].text)
        alunos_especiais = int(row[9].text)
        try:
            saldo_vagas = int(row[10].text)
        except TypeError:
            saldo_vagas = 0
        try:
            pedidos_sem_vaga = int(row[11].text)
        except TypeError:
            pedidos_sem_vaga = 0

        horarios = []
        if row[12].text:
            horarios.append(row[12].text)
        for sub in row[12]:
            if sub.tail:
                horarios.append(sub.tail)

        professores = []
        if len(row[13]):
            if not row[13][0].text:
                professores.append(row[13].text)
        for sub in row[13]:
            if sub.attrib:
                professores.append(sub.text)
            elif sub.tail:
                professores.append(sub.tail)

        # Uma disciplina e a UNIAO das suas turmas por codigo, mesmo quando o
        # CAGR lista o mesmo codigo em blocos nao-consecutivos (ex.: oferta a
        # cursos diferentes). Agrupar por codigo (e nao so por linhas
        # consecutivas) faz a disciplina aparecer uma unica vez, com nome unico
        # e todas as suas turmas -- e mantem o codigo unico por campus, como o
        # gate exige e o frontend assume (indice por codigo, casamento por id).
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
            turma_ids_by_codigo[codigo_disciplina] = set()

        turma = [
            nome_turma,
            horas_aula,
            vagas_ofertadas,
            vagas_ocupadas,
            alunos_especiais,
            saldo_vagas,
            pedidos_sem_vaga,
            horarios,
            professores,
            curso_id,
        ]
        # Dedup por id de turma (unico por disciplina): se o CAGR relistar a
        # mesma turma sob outro bloco, mantem a primeira.
        seen_ids = turma_ids_by_codigo[codigo_disciplina]
        if nome_turma not in seen_ids:
            seen_ids.add(nome_turma)
            materia[3].append(turma)

    return list(materias_by_codigo.values()), cursos


def parse_xml_file(filepath):
    """Extrai (disciplinas, cursos) de um arquivo XML do CAGR."""
    with open(filepath, "r", encoding="utf-8") as f:
        return parse_xml_text(f.read())


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
