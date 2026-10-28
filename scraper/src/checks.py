#!/usr/bin/env python3

"""Checks on the staging that the site parser cannot make.

Whether every tuple can be decoded is decided by `matrufsc/scripts/gate.ts`,
which runs the site's own parser over the staging. Here stays only what needs
the index, the published baseline or the whole file.
"""

import json
import os

from semesters import campus_codes_for_semester, load_json, read_index_semesters

MAX_DISCIPLINAS_DROP = 0.2


def _is_int(value):
    # JSON booleans are ints in Python; reject them explicitly.
    return isinstance(value, int) and not isinstance(value, bool)


def _load_campus_file(ctx, path, campus):
    if not os.path.exists(path):
        raise RuntimeError(f"{ctx} ausente no staging")
    try:
        data = load_json(path)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"{ctx}: JSON invalido ({e})") from e
    if not isinstance(data, dict) or data.get("campus") != campus:
        raise RuntimeError(f"{ctx}: campus invalido ({data.get('campus') if isinstance(data, dict) else data!r})")
    if not isinstance(data.get("data_extracao"), str) or not data["data_extracao"]:
        raise RuntimeError(f"{ctx}: sem data_extracao")
    if not isinstance(data.get("cursos"), dict) or not data["cursos"]:
        raise RuntimeError(f"{ctx}: cursos deve ser um mapa nao vazio")
    if not isinstance(data.get("disciplinas"), list) or not data["disciplinas"]:
        raise RuntimeError(f"{ctx}: sem disciplinas")
    return data


def _check_baseline(ctx, disciplinas, baseline_path):
    """Pega a paginacao do CAGR falhando no meio: a contagem nao pode cair demais."""
    if not os.path.exists(baseline_path):
        return
    baseline = load_json(baseline_path)["disciplinas"]
    if len(disciplinas) < len(baseline) * (1 - MAX_DISCIPLINAS_DROP):
        raise RuntimeError(
            f"{ctx}: {len(disciplinas)} disciplinas, o publicado tem {len(baseline)}; "
            f"queda maior que {MAX_DISCIPLINAS_DROP:.0%}"
        )


def _check_disciplinas(ctx, data):
    """Codigos unicos, todo curso resolvido e nenhum status vazado para o nome."""
    cursos = data["cursos"]
    seen = set()
    for disciplina in data["disciplinas"]:
        if not isinstance(disciplina, list) or len(disciplina) != 3:
            raise RuntimeError(f"{ctx}: disciplina deve ter 3 campos ({disciplina!r})")
        codigo, nome, turmas = disciplina
        if codigo in seen:
            raise RuntimeError(f"{ctx}: codigo {codigo} repetido")
        seen.add(codigo)
        if not isinstance(nome, str) or "[" in nome or "]" in nome:
            raise RuntimeError(f"{ctx} {codigo}: nome com colchetes ({nome!r})")
        for turma in turmas:
            if not isinstance(turma, list) or len(turma) != 11:
                raise RuntimeError(f"{ctx} {codigo}: turma deve ter 11 campos ({turma!r})")
            if not _is_int(turma[9]) or str(turma[9]) not in cursos:
                raise RuntimeError(f"{ctx} {codigo} turma {turma[0]}: curso {turma[9]!r} nao consta em cursos")


def check_stage(stage_dir, public_data_dir):
    """Guardrail before the gate: every indexed semester has every campus, each
    file is readable and not visibly truncated versus what is published."""
    index_path = os.path.join(stage_dir, "index.json")
    if not os.path.exists(index_path):
        raise RuntimeError("index.json ausente no staging")
    semesters = read_index_semesters(index_path)
    if not semesters:
        raise RuntimeError("index vazio; abortando para evitar dados indisponiveis")

    for semester in semesters:
        for campus in campus_codes_for_semester(semester):
            name = os.path.join(semester[:4], f"{semester}-{campus}.json")
            ctx = f"{semester}-{campus}.json"
            data = _load_campus_file(ctx, os.path.join(stage_dir, name), campus)
            _check_baseline(ctx, data["disciplinas"], os.path.join(public_data_dir, name))
            _check_disciplinas(ctx, data)
