#!/usr/bin/env python3

"""
Pipeline completo de scraping do próximo semestre.

1. Determina o próximo semestre a partir do index.json
2. Verifica se já existe localmente
3. Verifica se está disponível no CAGR
4. Faz o scrape de todos os campi
5. Converte os XMLs em JSON
6. Atualiza o index.json

Exit codes:
  0 - scrape realizado com sucesso
  1 - erro em algum passo
  2 - nenhum semestre novo disponível (não é erro)
"""

from next_semestre import (
    get_latest_semester,
    calc_next_semester,
    semester_exists_locally,
    semester_available_on_cagr,
)
from get_turmas import scrape as scrape_semester
from parse_turmas import parse_xml_file, extract_semester_campus

import datetime
import json
import os
import re
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../matrufsc/public/data")


def step(name):
    print(f"\n{'='*50}")
    print(f"  {name}")
    print(f"{'='*50}")


def parse_xmls(xml_files):
    """Converte XMLs em JSONs no diretório de dados."""
    os.environ["TZ"] = "America/Sao_Paulo"
    data_extracao = datetime.datetime.now().strftime("%d/%m/%y - %H:%M")

    for filepath in xml_files:
        semestre, campus = extract_semester_campus(filepath)
        ano = semestre[:4]

        print(f"  {os.path.basename(filepath)} -> {ano}/{semestre}-{campus}.json...", end=" ", flush=True)

        materias = parse_xml_file(filepath)

        dest_dir = os.path.join(DATA_DIR, ano)
        os.makedirs(dest_dir, exist_ok=True)

        output_path = os.path.join(dest_dir, f"{semestre}-{campus}.json")

        data = {
            "campus": campus,
            "data_extracao": data_extracao,
            "disciplinas": materias,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        print(f"{len(materias)} disciplinas")


def update_index():
    """Atualiza o index.json."""
    semesters = set()

    for year_dir in sorted(os.listdir(DATA_DIR)):
        year_path = os.path.join(DATA_DIR, year_dir)
        if not os.path.isdir(year_path):
            continue
        for filename in os.listdir(year_path):
            match = re.match(r"^(\d{5})-[A-Z]{3}\.json$", filename)
            if match:
                semesters.add(match.group(1))

    sorted_semesters = sorted(semesters, reverse=True)

    index = {
        "semesters": [
            {"value": s, "title": f"{s[:4]}.{s[4]}"} for s in sorted_semesters
        ]
    }

    output_path = os.path.join(DATA_DIR, "index.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

    print(f"  {len(sorted_semesters)} semestres: {', '.join(sorted_semesters)}")


def cleanup(xml_files):
    """Remove XMLs temporários."""
    for f in xml_files:
        if os.path.exists(f):
            os.remove(f)


def main():
    step("1. Determinando proximo semestre")
    try:
        latest = get_latest_semester()
        next_sem = calc_next_semester(latest)
        print(f"Ultimo semestre no repo: {latest}")
        print(f"Proximo semestre: {next_sem}")
    except Exception as e:
        print(f"ERRO ao determinar semestre: {e}")
        sys.exit(1)

    step("2. Verificando se ja existe localmente")
    if semester_exists_locally(next_sem):
        print(f"Semestre {next_sem} ja existe localmente. Nada a fazer.")
        sys.exit(2)
    print(f"Semestre {next_sem} nao encontrado localmente. Continuando...")

    step("3. Verificando disponibilidade no CAGR")
    try:
        available = semester_available_on_cagr(next_sem)
    except Exception as e:
        print(f"ERRO ao consultar CAGR: {e}")
        sys.exit(1)

    if not available:
        print(f"Semestre {next_sem} ainda nao disponivel no CAGR. Nada a fazer.")
        sys.exit(2)
    print(f"Semestre {next_sem} disponivel no CAGR!")

    step(f"4. Scraping do semestre {next_sem}")
    xml_files = []
    try:
        xml_files = scrape_semester(next_sem)
        print(f"{len(xml_files)} arquivos XML gerados")
    except Exception as e:
        print(f"ERRO no scraping: {e}")
        cleanup(xml_files)
        sys.exit(1)

    step("5. Convertendo XML -> JSON")
    try:
        parse_xmls(xml_files)
    except Exception as e:
        print(f"ERRO no parsing: {e}")
        cleanup(xml_files)
        sys.exit(1)

    step("6. Atualizando index.json")
    try:
        update_index()
    except Exception as e:
        print(f"ERRO ao atualizar index: {e}")
        cleanup(xml_files)
        sys.exit(1)

    step("7. Limpeza")
    cleanup(xml_files)
    print("XMLs temporarios removidos")

    print(f"\nSemestre {next_sem} scrapeado com sucesso!")


if __name__ == "__main__":
    main()
