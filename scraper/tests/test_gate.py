"""Seam do gate: o assumption checker sobre um diretório de staging.

Alimenta dados bons e dados com **cada classe de defeito** (aridade errada, tipo
errado, curso órfão, horário indecodificável, campus divergente do arquivo,
índice inconsistente, id de turma duplicado, código de disciplina duplicado, …)
e afirma pass/violação **por check**, além de confirmar que as violações são
**agregadas** e que o formato legado é **tolerado**."""

import json
import os
import shutil
import tempfile
import unittest
from collections import namedtuple

import gate
from gate import CHECKS, CONSUMPTION_POINTS, decode_horario, run_gate
from semesters import campus_codes_for_semester

REAL_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "matrufsc", "public", "data"))

Raw = namedtuple("Raw", "text")  # conteúdo literal de arquivo (JSON inválido, não-objeto)


# --- construtores de payload bom (cada teste introduz UM defeito) ----------

def good_turma(turma_id="01302", curso=302, legacy=False, horario="2.0730-2 / ADM-101"):
    turma = [turma_id, 72, 50, 10, 0, 5, 0, [horario], ["Prof Fulano"]]
    if not legacy:
        turma.append(curso)
    return turma


def good_disciplina(codigo="ADM7001", turmas=None, legacy=False):
    return [codigo, "ADMINISTRACAO I", "Administração I", turmas if turmas is not None else [good_turma(legacy=legacy)]]


def good_campus(campus="FLO", disciplinas=None, legacy=False, **overrides):
    payload = {
        "campus": campus,
        "data_extracao": "11/07/26 - 10:00",
        "disciplinas": disciplinas if disciplinas is not None else [good_disciplina(legacy=legacy)],
    }
    if not legacy:
        payload["cursos"] = {"302": "CIÊNCIAS CONTÁBEIS"}
    payload.update(overrides)
    return payload


def complete_staging(semester="20262", legacy=False, overrides=None):
    """Um semestre completo e válido: um arquivo por campus esperado.
    `overrides` é keyed pelo nome do arquivo (ex.: "20262-FLO")."""
    overrides = overrides or {}
    files = {}
    for campus in campus_codes_for_semester(semester):
        name = f"{semester}-{campus}"
        files[name] = overrides.get(name, good_campus(campus, legacy=legacy))
    return files


def write_and_run(files, index="auto"):
    """Escreve `files` (nome sem extensão -> payload) num diretório temporário,
    escreve o index.json e roda o gate. `index="auto"` lista os semestres com
    todos os campi presentes; `index=None` não escreve index."""
    data_dir = tempfile.mkdtemp(prefix="gate-test-")
    try:
        present = {}
        for name, payload in files.items():
            semester, campus = name.split("-")
            year_dir = os.path.join(data_dir, semester[:4])
            os.makedirs(year_dir, exist_ok=True)
            path = os.path.join(year_dir, f"{name}.json")
            with open(path, "w", encoding="utf-8") as f:
                if isinstance(payload, Raw):
                    f.write(payload.text)
                else:
                    json.dump(payload, f, ensure_ascii=False)
            present.setdefault(semester, set()).add(campus)

        if index == "auto":
            semesters = [s for s, campi in present.items() if set(campus_codes_for_semester(s)).issubset(campi)]
            index = {"semesters": sorted(semesters, reverse=True)}
        if index is not None:
            with open(os.path.join(data_dir, "index.json"), "w", encoding="utf-8") as f:
                json.dump(index, f)

        return run_gate(data_dir)
    finally:
        shutil.rmtree(data_dir)


def fired(report):
    return {v.check_id for v in report.violations}


def flo(disciplinas=None, **overrides):
    """Atalho: staging completo com o FLO sobrescrito por um payload defeituoso.
    `overrides` pode incluir `campus` (para o teste de campus divergente)."""
    opts = {"campus": "FLO", "disciplinas": disciplinas}
    opts.update(overrides)
    payload = good_campus(**opts)
    return complete_staging(overrides={"20262-FLO": payload})


class GoodData(unittest.TestCase):
    def test_complete_valid_staging_passes(self):
        report = write_and_run(complete_staging())
        self.assertTrue(report.ok, gate.format_report(report))

    def test_real_published_data_passes(self):
        # Trava a tolerância ao legado: os dados de produção (9 campos, sem
        # `cursos`, com dups históricas) devem passar — senão o cron quebra.
        if not os.path.isdir(REAL_DATA_DIR):
            self.skipTest("diretório de dados publicados não encontrado")
        report = run_gate(REAL_DATA_DIR)
        self.assertTrue(report.ok, gate.format_report(report))


class StructuralDefects(unittest.TestCase):
    def test_unparseable_file(self):
        files = complete_staging(overrides={"20262-FLO": Raw("{ not json")})
        self.assertIn("campus_arquivo_parseavel", fired(write_and_run(files)))

    def test_non_object_payload(self):
        files = complete_staging(overrides={"20262-FLO": [1, 2, 3]})
        self.assertIn("campus_arquivo_objeto", fired(write_and_run(files)))

    def test_missing_campus_field(self):
        self.assertIn("campus_campo_presente", fired(write_and_run(flo(campus=""))))

    def test_empty_data_extracao(self):
        self.assertIn("data_extracao_presente", fired(write_and_run(flo(data_extracao=""))))

    def test_empty_disciplinas(self):
        self.assertIn("disciplinas_lista_nao_vazia", fired(write_and_run(flo(disciplinas=[]))))

    def test_bad_cursos_map(self):
        report = write_and_run(flo(cursos={"302": ""}))  # nome de curso vazio
        self.assertIn("cursos_mapa_shape", fired(report))

    def test_disciplina_wrong_arity(self):
        report = write_and_run(flo(disciplinas=[["ADM1", "A", "A"]]))  # 3 campos
        self.assertIn("disciplina_aridade", fired(report))

    def test_disciplina_empty_required_field(self):
        report = write_and_run(flo(disciplinas=[["ADM1", "", "Adm", [good_turma()]]]))  # nome_ascii vazio
        self.assertIn("disciplina_tipos", fired(report))

    def test_turma_wrong_arity(self):
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[["01302", 1, 2, 3]])]))
        self.assertIn("turma_aridade", fired(report))

    def test_turma_wrong_type(self):
        bad = ["01302", "72", 50, 10, 0, 5, 0, ["2.0730-2 / X"], ["P"], 302]  # carga como string
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[bad])]))
        self.assertIn("turma_tipos", fired(report))


class ValueDefects(unittest.TestCase):
    def test_negative_consumed_count(self):
        bad = good_turma()
        bad[2] = -5  # vagas_ofertadas negativa
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[bad])]))
        self.assertIn("turma_contadores_nao_negativos", fired(report))

    def test_alunos_especiais_minus_one_is_tolerated(self):
        # idx 4 (alunos_especiais) = -1 é sentinela normal do CAGR e ignorado
        # pelo frontend: NÃO deve disparar contadores.
        turma = good_turma()
        turma[4] = -1
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertNotIn("turma_contadores_nao_negativos", fired(report))
        self.assertTrue(report.ok, gate.format_report(report))

    def test_curso_not_int(self):
        turma = good_turma(curso="302")  # string em vez de int
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertIn("curso_inteiro_ou_nulo", fired(report))

    def test_horario_bad_format(self):
        turma = good_turma(horario="segunda de manhã")
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertIn("horario_formato", fired(report))


class RelationalDefects(unittest.TestCase):
    def test_orphan_curso(self):
        turma = good_turma(curso=999)  # 999 não está no mapa cursos
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertIn("curso_referencia_integra", fired(report))

    def test_horario_undecodable_bad_time(self):
        turma = good_turma(horario="6.9999-2 / X")  # 9999 fora de HORAS
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertIn("horario_decodificavel", fired(report))

    def test_horario_undecodable_out_of_bounds(self):
        turma = good_turma(horario="6.2110-2 / X")  # último slot + 2 estoura
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertIn("horario_decodificavel", fired(report))

    def test_horario_undecodable_bad_day(self):
        turma = good_turma(horario="9.0730-2 / X")  # dia 9 fora de [1,7]
        report = write_and_run(flo(disciplinas=[good_disciplina(turmas=[turma])]))
        self.assertIn("horario_decodificavel", fired(report))

    def test_campus_mismatch(self):
        # conteúdo diz JOI mas o arquivo é 20262-FLO
        report = write_and_run(flo(campus="JOI"))
        self.assertIn("campus_bate_com_arquivo", fired(report))

    def test_duplicate_disciplina_codigo(self):
        report = write_and_run(flo(disciplinas=[good_disciplina("ADM1"), good_disciplina("ADM1")]))
        self.assertIn("disciplina_codigo_unico", fired(report))

    def test_duplicate_turma_id(self):
        disc = good_disciplina(turmas=[good_turma("01302"), good_turma("01302")])
        report = write_and_run(flo(disciplinas=[disc]))
        self.assertIn("turma_id_unico", fired(report))

    def test_missing_index(self):
        self.assertIn("indice_parseavel", fired(write_and_run(complete_staging(), index=None)))

    def test_index_lists_incomplete_semester(self):
        # index cita 20261 mas não há nenhum arquivo desse semestre
        report = write_and_run(complete_staging(), index={"semesters": ["20262", "20261"]})
        self.assertIn("indice_semestres_completos", fired(report))


class Aggregation(unittest.TestCase):
    def test_collects_all_violations_not_fail_fast(self):
        # Vários defeitos ao mesmo tempo -> vários checks no mesmo relatório.
        bad = good_turma(curso=999, horario="9.9999-9 / X")  # curso órfão + horário quebrado
        bad[2] = -1  # vaga negativa
        disciplinas = [good_disciplina("D1", turmas=[bad]), good_disciplina("D1")]  # + código duplicado
        report = write_and_run(flo(disciplinas=disciplinas, campus="ZZZ"))  # + campus divergente
        got = fired(report)
        for expected in (
            "curso_referencia_integra",
            "horario_decodificavel",
            "turma_contadores_nao_negativos",
            "disciplina_codigo_unico",
            "campus_bate_com_arquivo",
        ):
            self.assertIn(expected, got)
        self.assertGreaterEqual(len(report.violations), 5)


class LegacyTolerance(unittest.TestCase):
    def test_legacy_format_passes(self):
        # Formato legado: turmas de 9 campos, sem `cursos`. Válido no resto.
        report = write_and_run(complete_staging(semester="20252", legacy=True))
        self.assertTrue(report.ok, gate.format_report(report))

    def test_legacy_duplicate_codes_tolerated(self):
        # O legado agrupava por curso e podia repetir código/id de turma;
        # toleramos até o semestre ser re-scrapeado.
        dup = good_campus("FLO", legacy=True, disciplinas=[
            good_disciplina("ACL1", legacy=True),
            good_disciplina("ACL1", legacy=True),  # código duplicado
        ])
        files = complete_staging(semester="20252", legacy=True, overrides={"20252-FLO": dup})
        report = write_and_run(files)
        self.assertNotIn("disciplina_codigo_unico", fired(report))
        self.assertTrue(report.ok, gate.format_report(report))

    def test_new_format_still_enforces_uniqueness(self):
        # A tolerância é só do legado: em arquivo novo (com `cursos`), duplicar
        # código continua sendo violação.
        report = write_and_run(flo(disciplinas=[good_disciplina("ADM1"), good_disciplina("ADM1")]))
        self.assertIn("disciplina_codigo_unico", fired(report))


class Catalog(unittest.TestCase):
    def test_traceability_completa(self):
        # Todo ponto de consumo do frontend é protegido por >=1 check.
        coberto = set()
        for chk in CHECKS:
            coberto.update(chk.consumption)
        faltando = set(CONSUMPTION_POINTS) - coberto
        self.assertFalse(faltando, f"pontos de consumo sem check: {faltando}")

    def test_checks_only_reference_known_consumption(self):
        for chk in CHECKS:
            for key in chk.consumption:
                self.assertIn(key, CONSUMPTION_POINTS, f"{chk.id} referencia consumo desconhecido: {key}")

    def test_check_ids_unique(self):
        ids = [c.id for c in CHECKS]
        self.assertEqual(len(ids), len(set(ids)))

    def test_all_levels_valid(self):
        for chk in CHECKS:
            self.assertIn(chk.level, (gate.ESTRUTURAL, gate.VALOR, gate.RELACIONAL))


class DecodeHorarioMirror(unittest.TestCase):
    """decode_horario espelha getTurmaFromJSON/getHorarioList do frontend."""

    def test_valid_decodes(self):
        self.assertIsNone(decode_horario("6.1830-2 / CTS-SL117A"))
        self.assertIsNone(decode_horario("2.0730-1 / AUX-ALOCAR"))
        self.assertIsNone(decode_horario("5.1420-4 / MAT-201"))

    def test_time_not_in_horas(self):
        # frontend lança "Invalid horarioInicio: 9999"
        self.assertIsNotNone(decode_horario("6.9999-2 / X"))

    def test_out_of_bounds(self):
        # frontend lança "out of bounds": 2110 é o último slot, +2 estoura
        self.assertIsNotNone(decode_horario("6.2110-2 / X"))

    def test_day_out_of_range(self):
        self.assertIsNotNone(decode_horario("8.0730-2 / X"))
        self.assertIsNotNone(decode_horario("0.0730-2 / X"))

    def test_missing_separators(self):
        self.assertIsNotNone(decode_horario("20730-2 / X"))  # sem '.'
        self.assertIsNotNone(decode_horario("2.0730 / X"))   # sem '-'

    def test_nonpositive_duration(self):
        self.assertIsNotNone(decode_horario("2.0730-0 / X"))


if __name__ == "__main__":
    unittest.main()
