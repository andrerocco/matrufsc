import json
import os
import tempfile
import unittest

from checks import check_stage

CAMPI = ("FLO", "JOI", "CBS", "ARA", "BLN")
TURMA = ["01208", 72, 50, 10, 0, 40, 0, ["2.1330-2 / CTC-CTC102"], ["Professor Um"], 208, None]
CURSOS = {"208": "ENGENHARIA MECANICA"}


def campus_file(disciplinas, cursos=CURSOS):
    return {"campus": "JOI", "data_extracao": "01/01/27 - 03:00", "cursos": cursos, "disciplinas": disciplinas}


def write(root, semester, campus, data):
    path = os.path.join(root, semester[:4], f"{semester}-{campus}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(data if isinstance(data, str) else json.dumps({**data, "campus": campus}))


def write_stage(root, files, semesters=("20271",)):
    """`files` mapeia (semestre, campus) para o conteudo; os campi omitidos recebem um arquivo valido."""
    for semester in semesters:
        for campus in CAMPI:
            write(root, semester, campus, files.get((semester, campus), campus_file([["EMB5001", "Nome", [TURMA]]])))
    with open(os.path.join(root, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"semesters": list(semesters)}, f)


class CheckStageTests(unittest.TestCase):
    def check(self, data=None, files=None, baseline=None):
        with tempfile.TemporaryDirectory() as stage, tempfile.TemporaryDirectory() as public:
            files = dict(files or {})
            if data is not None:
                files[("20271", "JOI")] = data
            write_stage(stage, files)
            for key, value in (baseline or {}).items():
                write(public, key[0], key[1], value)
            check_stage(stage, public)

    def test_valid_stage_passes(self):
        self.check(campus_file([["EMB5001", "Nome", [TURMA]]]))

    def test_missing_campus_file(self):
        with tempfile.TemporaryDirectory() as stage, tempfile.TemporaryDirectory() as public:
            write_stage(stage, {})
            os.remove(os.path.join(stage, "2027", "20271-CBS.json"))
            with self.assertRaisesRegex(RuntimeError, "20271-CBS.json ausente no staging"):
                check_stage(stage, public)

    def test_missing_or_empty_index(self):
        with tempfile.TemporaryDirectory() as stage, tempfile.TemporaryDirectory() as public:
            with self.assertRaisesRegex(RuntimeError, "index.json ausente"):
                check_stage(stage, public)
            write_stage(stage, {}, semesters=())
            with self.assertRaisesRegex(RuntimeError, "index vazio"):
                check_stage(stage, public)

    def test_invalid_json(self):
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: JSON invalido"):
            self.check('{"campus":')

    def test_campus_mismatch(self):
        with self.assertRaisesRegex(RuntimeError, r"20271-JOI.json: campus invalido \('FLO'\)"):
            self.check(json.dumps(campus_file([["EMB5001", "Nome", [TURMA]]]) | {"campus": "FLO"}))

    def test_data_extracao_and_disciplinas_required(self):
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: sem data_extracao"):
            self.check(campus_file([["EMB5001", "Nome", [TURMA]]]) | {"data_extracao": ""})
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: sem disciplinas"):
            self.check(campus_file([]))

    def test_cursos_required_and_non_empty(self):
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: cursos deve ser um mapa nao vazio"):
            self.check(campus_file([["EMB5001", "Nome", [TURMA]]], cursos={}))
        without_cursos = campus_file([["EMB5001", "Nome", [TURMA]]])
        del without_cursos["cursos"]
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: cursos deve ser um mapa nao vazio"):
            self.check(without_cursos)

    def test_disciplina_count_cannot_drop_more_than_the_threshold(self):
        baseline = {("20271", "JOI"): campus_file([[f"EMB500{i}", "Nome", [TURMA]] for i in range(10)])}
        eight = campus_file([[f"EMB500{i}", "Nome", [TURMA]] for i in range(8)])
        seven = campus_file([[f"EMB500{i}", "Nome", [TURMA]] for i in range(7)])
        self.check(eight, baseline=baseline)
        self.check(seven)
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: 7 disciplinas, o publicado tem 10; queda maior que 20%"):
            self.check(seven, baseline=baseline)

    def test_rejects_repeated_codigo(self):
        disciplina = ["EMB5001", "Nome", [TURMA]]
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: codigo EMB5001 repetido"):
            self.check(campus_file([disciplina, disciplina]))

    def test_rejects_curso_missing_from_map(self):
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json EMB5001 turma 01208: curso 999 nao consta"):
            self.check(campus_file([["EMB5001", "Nome", [TURMA[:9] + [999, None]]]]))
        with self.assertRaisesRegex(RuntimeError, "curso '208' nao consta"):
            self.check(campus_file([["EMB5001", "Nome", [TURMA[:9] + ["208", None]]]]))

    def test_rejects_turma_without_11_fields(self):
        with self.assertRaisesRegex(RuntimeError, "EMB5001: turma deve ter 11 campos"):
            self.check(campus_file([["EMB5001", "Nome", [TURMA[:9]]]]))

    def test_rejects_status_leaked_into_nome(self):
        with self.assertRaisesRegex(RuntimeError, r"EMB5001: nome com colchetes \('Nome \[Cancelada\]'\)"):
            self.check(campus_file([["EMB5001", "Nome [Cancelada]", [TURMA]]]))

    def test_rejects_disciplina_without_3_fields(self):
        with self.assertRaisesRegex(RuntimeError, "20271-JOI.json: disciplina deve ter 3 campos"):
            self.check(campus_file([["EMB5001", "NOME", "Nome", [TURMA]]]))

    def test_every_indexed_semester_is_checked(self):
        with tempfile.TemporaryDirectory() as stage, tempfile.TemporaryDirectory() as public:
            write_stage(stage, {("20262", "ARA"): campus_file([["EMB5001", "Nome", [TURMA[:9]]]])}, semesters=("20271", "20262"))
            with self.assertRaisesRegex(RuntimeError, "20262-ARA.json EMB5001: turma deve ter 11 campos"):
                check_stage(stage, public)


if __name__ == "__main__":
    unittest.main()
