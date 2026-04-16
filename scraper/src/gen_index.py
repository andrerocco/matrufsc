#!/usr/bin/env python3

"""
Gera data/index.json a partir dos arquivos JSON existentes em data/<ano>/.

Varre as pastas de ano e lista os semestres disponíveis, ordenados do mais
recente para o mais antigo.

Uso: python gen_index.py <diretório de dados>
Exemplo: python gen_index.py ../../matrufsc/public/data
"""

import json
import os
import re
import sys


def main():
    if len(sys.argv) < 2:
        print(f"Uso: {sys.argv[0]} <diretório de dados>")
        sys.exit(1)

    data_dir = sys.argv[1]
    semesters = set()

    for year_dir in sorted(os.listdir(data_dir)):
        year_path = os.path.join(data_dir, year_dir)
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

    output_path = os.path.join(data_dir, "index.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

    print(f"index.json gerado com {len(sorted_semesters)} semestres: {', '.join(sorted_semesters)}")


if __name__ == "__main__":
    main()
