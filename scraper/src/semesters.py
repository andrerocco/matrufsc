#!/usr/bin/env python3

import datetime
import json
import os
import re
import shutil

CAMPUS_CODES = ("FLO", "JOI", "CBS", "ARA", "BLN")
CAMPUS_FORM_VALUES = {
    "FLO": "1",
    "JOI": "2",
    "CBS": "3",
    "ARA": "4",
    "BLN": "5",
}

DATA_FILE_RE = re.compile(r"^(\d{5})-([A-Z]{3})\.json$")
SEMESTER_RE = re.compile(r"^\d{5}$")
DEFAULT_PUBLIC_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../matrufsc/public/data"))


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def extraction_time():
    os.environ["TZ"] = "America/Sao_Paulo"
    return datetime.datetime.now().strftime("%d/%m/%y - %H:%M")


def campus_codes_for_semester(semester):
    if semester >= "20141":
        return CAMPUS_CODES
    return tuple(campus for campus in CAMPUS_CODES if campus != "BLN")


def calc_next_semester(current):
    year = int(current[:4])
    half = current[4]
    if half == "1":
        return f"{year}2"
    return f"{year + 1}1"


def normalize_semester_entry(entry):
    if isinstance(entry, dict):
        entry = entry.get("value")
    if entry is None:
        return None

    value = str(entry)
    if not SEMESTER_RE.match(value):
        return None
    return value


def read_index_semesters(index_path):
    data = load_json(index_path)

    semesters = [
        value
        for value in (normalize_semester_entry(entry) for entry in data.get("semesters", []))
        if value is not None
    ]
    return sorted(set(semesters), reverse=True)


def discover_semester_campuses(data_dir):
    semesters = {}

    for year_dir in sorted(os.listdir(data_dir)):
        year_path = os.path.join(data_dir, year_dir)
        if not os.path.isdir(year_path):
            continue

        for filename in os.listdir(year_path):
            match = DATA_FILE_RE.match(filename)
            if not match:
                continue

            semester, campus = match.groups()
            semesters.setdefault(semester, set()).add(campus)

    return semesters


def discover_complete_semesters(data_dir):
    semester_campuses = discover_semester_campuses(data_dir)
    complete = []

    for semester, campuses in semester_campuses.items():
        expected = set(campus_codes_for_semester(semester))
        if expected.issubset(campuses):
            complete.append(semester)

    return sorted(complete, reverse=True)


def build_index(data_dir):
    return {"semesters": discover_complete_semesters(data_dir)}


def get_latest_indexed_semester(data_dir):
    index_path = os.path.join(data_dir, "index.json")
    if os.path.exists(index_path):
        semesters = read_index_semesters(index_path)
        if semesters:
            return semesters[0]

    semesters = discover_complete_semesters(data_dir)
    if semesters:
        return semesters[0]

    raise RuntimeError("No semesters found in data index")


def prepare_stage(public_data_dir, stage_dir):
    public_data_dir = os.path.abspath(public_data_dir)
    stage_dir = os.path.abspath(stage_dir)

    if os.path.exists(stage_dir):
        shutil.rmtree(stage_dir)

    # Seed the stage from the current data so unchanged campi keep byte-identical
    # files (see write_campus_if_changed). On a first run there is no baseline
    # yet, so start from an empty stage.
    if os.path.isdir(public_data_dir):
        shutil.copytree(public_data_dir, stage_dir)
    else:
        os.makedirs(stage_dir)
    return stage_dir


def write_campus_if_changed(data_dir, semester, campus, disciplinas, data_extracao):
    output_path = os.path.join(data_dir, semester[:4], f"{semester}-{campus}.json")
    data = {
        "campus": campus,
        "data_extracao": data_extracao,
        "disciplinas": disciplinas,
    }

    if os.path.exists(output_path):
        try:
            existing = load_json(output_path)
            if existing.get("campus") == campus and existing.get("disciplinas") == disciplinas:
                print(f"  {semester}-{campus}.json unchanged")
                return False
        except json.JSONDecodeError:
            pass

    write_json(output_path, data)
    print(f"  {semester}-{campus}.json updated ({len(disciplinas)} disciplinas)")
    return True


def write_index_if_changed(data_dir):
    index = build_index(data_dir)
    output_path = os.path.join(data_dir, "index.json")

    if os.path.exists(output_path):
        try:
            if load_json(output_path) == index:
                print(f"  index.json unchanged ({', '.join(index['semesters'])})")
                return False
        except json.JSONDecodeError:
            pass

    write_json(output_path, index)
    print(f"  index.json updated ({', '.join(index['semesters'])})")
    return True


def _is_int(value):
    # JSON booleans are ints in Python; reject them explicitly.
    return isinstance(value, int) and not isinstance(value, bool)


def _validate_turma(ctx, turma):
    if not isinstance(turma, list) or len(turma) != 9:
        raise RuntimeError(f"{ctx}: turma deve ter 9 campos, tem {len(turma) if isinstance(turma, list) else 'nao-lista'}")
    if not isinstance(turma[0], str) or not turma[0]:
        raise RuntimeError(f"{ctx}: id da turma invalido")
    for i in range(1, 7):
        if not _is_int(turma[i]):
            raise RuntimeError(f"{ctx}: campo numerico {i} nao e inteiro ({turma[i]!r})")
    for i, name in ((7, "horarios"), (8, "professores")):
        if not isinstance(turma[i], list) or not all(isinstance(x, str) for x in turma[i]):
            raise RuntimeError(f"{ctx}: {name} deve ser lista de strings")


def _validate_disciplina(ctx, disciplina):
    if not isinstance(disciplina, list) or len(disciplina) != 4:
        raise RuntimeError(f"{ctx}: disciplina deve ter 4 campos")
    codigo, nome_ascii, nome, turmas = disciplina
    for value, name in ((codigo, "codigo"), (nome_ascii, "nome_ascii"), (nome, "nome")):
        if not isinstance(value, str) or not value:
            raise RuntimeError(f"{ctx}: {name} invalido")
    if not isinstance(turmas, list) or not turmas:
        raise RuntimeError(f"{ctx}: deve ter ao menos uma turma")
    for i, turma in enumerate(turmas):
        _validate_turma(f"{ctx} turma {i}", turma)


def validate_data_dir(data_dir):
    """Guardrail before publishing: index is non-empty and every campus file
    matches the tuple contract the frontend parser decodes."""
    index = build_index(data_dir)
    if not index["semesters"]:
        raise RuntimeError("index vazio; abortando para evitar dados indisponiveis")

    for semester in index["semesters"]:
        for campus in campus_codes_for_semester(semester):
            path = os.path.join(data_dir, semester[:4], f"{semester}-{campus}.json")
            if not os.path.exists(path):
                raise RuntimeError(f"{semester}-{campus}.json ausente no staging")

            data = load_json(path)
            if data.get("campus") != campus:
                raise RuntimeError(f"{semester}-{campus}.json possui campus invalido: {data.get('campus')}")
            if not isinstance(data.get("data_extracao"), str) or not data["data_extracao"]:
                raise RuntimeError(f"{semester}-{campus}.json sem data_extracao")
            disciplinas = data.get("disciplinas")
            if not isinstance(disciplinas, list) or not disciplinas:
                raise RuntimeError(f"{semester}-{campus}.json nao possui disciplinas")
            for i, disciplina in enumerate(disciplinas):
                _validate_disciplina(f"{semester}-{campus} disciplina {i}", disciplina)
