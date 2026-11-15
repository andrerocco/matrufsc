#!/usr/bin/env python3

"""
Reconcile MatrUFSC data with CAGR.

Daily behavior (no --semester):
1. Check whether the next semester has rows for every expected campus.
2. If complete, scrape that new semester and index it.
3. Otherwise, refresh the latest indexed semester.
4. Write staged campus JSON files only when the class payload or curso map changed.
5. Run the checks the site parser cannot make; the workflow then runs that
   parser over the stage (`npm run data:gate`) before publishing.

Manual behavior (--semester 20262, or several: --semester 20252 20261 20262):
scrape exactly those semesters into the same staging, skipping the availability
probe; the checks run once, over the result. This replaces the old
`make <semester>` target.

The scraper only ever writes to a staging directory; the GitHub Actions
workflow publishes the resulting diff to the `data` branch (the single source
of truth for course JSON, baked into the build by `npm run data:pull`).
"""

from checks import check_stage
from get_turmas import CagrSession, probe_semester_availability, scrape as scrape_semester
from parse_turmas import extract_semester_campus, parse_xml_file
from semesters import (
    DEFAULT_PUBLIC_DATA_DIR,
    SEMESTER_RE,
    calc_next_semester,
    campus_codes_for_semester,
    extraction_time,
    get_latest_indexed_semester,
    prepare_stage,
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


def parse_and_write_xmls(xml_files, stage_dir, file_by_codes=None):
    """`file_by_codes` leva a comparacao de um semestre para o seguinte na mesma execucao."""
    changed = False
    data_extracao = extraction_time()
    file_by_codes = {} if file_by_codes is None else file_by_codes

    for filepath in xml_files:
        semester, campus = extract_semester_campus(filepath)
        disciplinas, cursos = parse_xml_file(filepath)
        if not disciplinas:
            raise RuntimeError(f"{os.path.basename(filepath)} nao possui disciplinas; abortando para evitar dados vazios")

        codes = frozenset(disciplina[0] for disciplina in disciplinas)
        if codes in file_by_codes:
            raise RuntimeError(
                f"{semester}-{campus} e {file_by_codes[codes]} retornaram as mesmas disciplinas; "
                "o CAGR ignorou o filtro de campus ou de semestre, abortando para evitar dados trocados"
            )
        file_by_codes[codes] = f"{semester}-{campus}"

        changed = write_campus_if_changed(stage_dir, semester, campus, disciplinas, cursos, data_extracao) or changed

    changed = write_index_if_changed(stage_dir) or changed
    return changed


def forced_session(semester):
    """Sessao nova por semestre: a busca do CAGR guarda estado, e nada na resposta diz de que semestre ela e."""
    session = CagrSession()
    if semester not in session.available_semesters():
        raise RuntimeError(f"Semestre {semester} nao consta na lista de semestres do CAGR")
    return session


def scrape_and_reconcile(semester, mode, session, stage_dir, file_by_codes):
    campus_codes = campus_codes_for_semester(semester)
    with tempfile.TemporaryDirectory(prefix=f"matrufsc-{semester}-") as temp_dir:
        xml_files = scrape_semester(
            semester,
            output_dir=temp_dir,
            campus_codes=campus_codes,
            session=session,
        )
        print(f"{len(xml_files)} arquivos XML gerados para {semester} ({mode})")
        return parse_and_write_xmls(xml_files, stage_dir, file_by_codes)


def semester_arg(value):
    if not SEMESTER_RE.match(value):
        raise argparse.ArgumentTypeError(f"semestre invalido: {value!r} (esperado AAAAS, ex.: 20262)")
    return value


def parse_args(argv=None):
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
        nargs="+",
        type=semester_arg,
        metavar="SEMESTRE",
        help="Scrape these semesters (e.g. 20262, or 20252 20261 20262) into the same staging, "
        "skipping the availability probe. Without it, the reconciler chooses the target semester automatically.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    try:
        stage_dir = prepare_stage(args.public_data_dir, args.stage_dir)

        if args.semester:
            targets = list(dict.fromkeys(args.semester))
            step(f"1. Semestres forcados: {', '.join(targets)}")
            mode, session = "manual", None
        else:
            step("1. Verificando disponibilidade")
            session = CagrSession()
            target, mode = choose_target_semester(session, args.public_data_dir)
            targets = [target]

        changed = False
        file_by_codes = {}
        for semester in targets:
            step(f"2. Scraping do semestre {semester}")
            changed = (
                scrape_and_reconcile(semester, mode, session or forced_session(semester), stage_dir, file_by_codes)
                or changed
            )

        step("3. Conferindo staging")
        check_stage(stage_dir, args.public_data_dir)
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
