#!/usr/bin/env python3

"""
Converte os XMLs gerados por get_turmas.py em arquivos JSON separados
por semestre e campus.

Uso: ./parse_turmas.py <diretório de saída> <arquivos XML de entrada...>

Exemplo:
  ./parse_turmas.py ../matrufsc/public/data 20251_FLO.xml 20251_JOI.xml

Estrutura de saída:
  <output_dir>/<ano>/<semestre>-<campus>.json
  Ex: ../matrufsc/public/data/2025/20251-FLO.json

Cada JSON segue o formato:
  {
    "campus": "FLO",
    "data_extracao": "10/04/26 - 14:30",
    "disciplinas": [ ... ]
  }
"""

from xml.etree import cElementTree
import unicodedata
import datetime
import json
import sys
import os
import re


def parse_xml_file(filepath):
    """Extrai a lista de disciplinas de um arquivo XML do CAGR."""
    with open(filepath, "r") as f:
        split = f.read().split('<?xml version="1.0"?>')

    prev_codigo = None
    cur_materia = None
    materias = []

    for xml in split:
        if len(xml) == 0:
            continue
        for row in cElementTree.fromstring(xml)[1][1][2]:
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


def main():
    if len(sys.argv) < 3:
        print(f"Uso: {sys.argv[0]} <diretório de saída> <arquivos XML...>")
        print(f"Exemplo: {sys.argv[0]} ../matrufsc/public/data 20251_FLO.xml 20251_JOI.xml")
        sys.exit(1)

    os.environ["TZ"] = "America/Sao_Paulo"

    output_dir = sys.argv[1]
    input_files = sys.argv[2:]
    data_extracao = datetime.datetime.now().strftime("%d/%m/%y - %H:%M")

    for filepath in input_files:
        semestre, campus = extract_semester_campus(filepath)
        ano = semestre[:4]

        print(f"Processando {filepath} → {ano}/{semestre}-{campus}.json")

        materias = parse_xml_file(filepath)

        dest_dir = os.path.join(output_dir, ano)
        os.makedirs(dest_dir, exist_ok=True)

        output_path = os.path.join(dest_dir, f"{semestre}-{campus}.json")

        data = {
            "campus": campus,
            "data_extracao": data_extracao,
            "disciplinas": materias,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        print(f"  → {len(materias)} disciplinas salvas em {output_path}")

    print("Concluído.")


if __name__ == "__main__":
    main()
