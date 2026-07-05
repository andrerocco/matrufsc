#!/usr/bin/env python3

"""
Reconcile MatrUFSC data with CAGR.

Daily behavior (no --semester):
1. Check whether the next semester has rows for every expected campus.
2. If complete, scrape that new semester and index it.
3. Otherwise, refresh the latest indexed semester.
4. Write staged campus JSON files only when the class payload changed.

Manual behavior (--semester 20262): scrape exactly that semester, skipping the
availability probe. This replaces the old `make <semester>` target.

The scraper only ever writes to a staging directory; the GitHub Actions
workflow publishes the resulting diff to the `data` branch (the single source
of truth for course JSON, baked into the build by `npm run data:pull`).
"""

from get_turmas import CagrSession, probe_semester_availability, scrape as scrape_semester
from parse_turmas import extract_semester_campus, parse_xml_file
from semesters import (
    DEFAULT_PUBLIC_DATA_DIR,
    calc_next_semester,
    campus_codes_for_semester,
    extraction_time,
    get_latest_indexed_semester,
    prepare_stage,
    validate_data_dir,
    write_campus_if_changed,
    write_index_if_changed,
)

import argparse
import os
import sys
import tempfile


def step(name):
    print(f"\n{'=' * 50}")
    print(f"  {name}")
    print(f"{'=' * 50}")


def choose_target_semester(session, public_data_dir):
    latest = get_latest_indexed_semester(public_data_dir)
    next_semester = calc_next_semester(latest)
    campus_codes = campus_codes_for_semester(next_semester)

    print(f"Ultimo semestre indexado: {latest}")
    print(f"Proximo semestre candidato: {next_semester}")

    availability = probe_semester_availability(next_semester, campus_codes=campus_codes, session=session)
    available = [campus for campus, is_available in availability.items() if is_available]
    missing = [campus for campus, is_available in availability.items() if not is_available]

    if not missing:
        print(f"Semestre {next_semester} disponivel para todos os campi: {', '.join(available)}")
        return next_semester, "new"

    if available:
        print(
            f"Semestre {next_semester} parcialmente disponivel "
            f"({', '.join(available)}); faltando {', '.join(missing)}."
        )
    else:
        print(f"Semestre {next_semester} ainda nao disponivel no CAGR.")

    print(f"Atualizando o semestre mais recente indexado: {latest}")
    return latest, "refresh"


def parse_and_write_xmls(xml_files, stage_dir):
    changed = False
    data_extracao = extraction_time()

    for filepath in xml_files:
        semester, campus = extract_semester_campus(filepath)
        disciplinas = parse_xml_file(filepath)
        if not disciplinas:
            raise RuntimeError(f"{os.path.basename(filepath)} nao possui disciplinas; abortando para evitar dados vazios")

        changed = write_campus_if_changed(stage_dir, semester, campus, disciplinas, data_extracao) or changed

    changed = write_index_if_changed(stage_dir) or changed
    return changed


def scrape_and_reconcile(semester, mode, session, stage_dir):
    campus_codes = campus_codes_for_semester(semester)
    with tempfile.TemporaryDirectory(prefix=f"matrufsc-{semester}-") as temp_dir:
        xml_files = scrape_semester(
            semester,
            output_dir=temp_dir,
            campus_codes=campus_codes,
            session=session,
        )
        print(f"{len(xml_files)} arquivos XML gerados para {semester} ({mode})")
        return parse_and_write_xmls(xml_files, stage_dir)


def parse_args():
    parser = argparse.ArgumentParser(description="Scrape CAGR data into a staged MatrUFSC data directory.")
    parser.add_argument(
        "--public-data-dir",
        default=DEFAULT_PUBLIC_DATA_DIR,
        help="Current public data directory used to choose the target semester.",
    )
    parser.add_argument(
        "--stage-dir",
        required=True,
        help="Directory where the reconciled data will be staged. It is replaced on each run.",
    )
    parser.add_argument(
        "--semester",
        help="Scrape this semester (e.g. 20262), skipping the availability probe. "
        "Without it, the reconciler chooses the target semester automatically.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    try:
        stage_dir = prepare_stage(args.public_data_dir, args.stage_dir)

        session = CagrSession()
        if args.semester:
            step(f"1. Semestre forcado: {args.semester}")
            target_semester, mode = args.semester, "manual"
        else:
            step("1. Verificando disponibilidade")
            target_semester, mode = choose_target_semester(session, args.public_data_dir)

        step(f"2. Scraping do semestre {target_semester}")
        changed = scrape_and_reconcile(target_semester, mode, session, stage_dir)

        step("3. Validando staging")
        validate_data_dir(stage_dir)
        print(f"Dados staged em {stage_dir}")

        step("4. Resultado")
        if changed:
            print("Dados staged com alteracoes.")
        else:
            print("Dados staged sem alteracoes.")
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
