#!/usr/bin/env python3

"""Parse raw CAGR XML pages into the compact JSON payload used by MatrUFSC."""

from xml.etree import cElementTree
import unicodedata
import os
import re


def iter_rows_from_xml_text(xml_text):
    """Itera pelas linhas de disciplinas em uma resposta AJAX do CAGR."""
    split = xml_text.split('<?xml version="1.0"?>')

    for xml in split:
        if len(xml) == 0:
            continue

        root = cElementTree.fromstring(xml)
        try:
            rows = root[1][1][2]
        except IndexError:
            continue

        for row in rows:
            yield row


def count_rows_in_xml_text(xml_text):
    return sum(1 for _ in iter_rows_from_xml_text(xml_text))


def parse_xml_text(xml_text):
    """Extrai a lista de disciplinas de uma ou mais respostas XML do CAGR."""

    prev_codigo = None
    cur_materia = None
    materias = []

    for row in iter_rows_from_xml_text(xml_text):
        codigo_disciplina = row[3].text
        nome_turma = row[4].text

        nome_disciplina = row[5].text
        for sub in row[5]:
            nome_disciplina = nome_disciplina + " " + sub.tail

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

        if codigo_disciplina != prev_codigo:
            nome_disciplina_ascii = (
                unicodedata.normalize("NFKD", nome_disciplina)
                .encode("ascii", "ignore")
                .decode("ascii")
                .upper()
            )
            cur_materia = [
                codigo_disciplina,
                nome_disciplina_ascii,
                nome_disciplina,
                [],
            ]
            materias.append(cur_materia)
            prev_codigo = codigo_disciplina

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
        ]
        cur_materia[3].append(turma)

    return materias


def parse_xml_file(filepath):
    """Extrai a lista de disciplinas de um arquivo XML do CAGR."""
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
