"""Seam do produtor: `parse_xml_text(xml) -> (disciplinas, cursos)`.

Testa o comportamento externo do contrato (dado XML do CAGR, saem tuplas/mapa),
não a implementação. Cobre nome limpo, curso por turma, mapa `cursos`,
disciplina multi-curso com nome único, `curso = null` e a agregação por código
(a mesma disciplina em blocos não-consecutivos vira uma só)."""

import os
import unittest

from parse_turmas import parse_xml_text
from cagr_xml import cagr_page, cagr_row

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


class GoldenRealPage(unittest.TestCase):
    """Amostra real de página 1 de FLO/20262 (curso único: FARMÁCIA)."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(FIXTURES, "cagr_flo_page1.xml"), encoding="utf-8") as f:
            cls.disciplinas, cls.cursos = parse_xml_text(f.read())

    def test_extrai_disciplinas(self):
        self.assertEqual(len(self.disciplinas), 12)

    def test_codigos_unicos(self):
        codigos = [d[0] for d in self.disciplinas]
        self.assertEqual(len(codigos), len(set(codigos)))

    def test_nome_limpo_sem_sufixo_de_curso(self):
        # Nenhum nome carrega o sufixo `*CURSO` do CAGR.
        for _, nome_ascii, nome, _turmas in self.disciplinas:
            self.assertNotIn("*", nome)
            self.assertNotIn("*", nome_ascii)
        primeira = self.disciplinas[0]
        self.assertEqual(primeira[0], "ACL5134")
        self.assertEqual(primeira[2], "Atenção à Saúde IV")
        self.assertEqual(primeira[1], "ATENCAO A SAUDE IV")  # nome_ascii NFKD/upper

    def test_curso_por_turma_e_mapa_cursos(self):
        # Toda turma referencia o curso ofertante (102 = FARMÁCIA) e o mapa
        # resolve o id em nome.
        self.assertEqual(self.cursos, {"102": "FARMÁCIA"})
        primeira_turma = self.disciplinas[0][3][0]
        self.assertEqual(len(primeira_turma), 10)  # contrato de 10 campos
        self.assertEqual(primeira_turma[9], 102)   # curso no fim da tupla


class SyntheticContract(unittest.TestCase):
    """Casos-limite do contrato via XML mínimo do CAGR."""

    def test_multi_curso_vira_uma_disciplina_com_nome_unico(self):
        # Mesmo código em blocos não-consecutivos (ofertado a 2 cursos) -> uma
        # única disciplina, nome único, com as turmas dos dois cursos.
        page = cagr_page([
            cagr_row("ADM7001", "01302", "Administração I", curso_id=302, nome_curso="CIÊNCIAS CONTÁBEIS"),
            cagr_row("MAT1000", "09999", "Cálculo I"),  # outra disciplina no meio
            cagr_row("ADM7001", "02777", "Administração I", curso_id=777, nome_curso="ADMINISTRAÇÃO"),
        ])
        disciplinas, cursos = parse_xml_text(page)

        codigos = [d[0] for d in disciplinas]
        self.assertEqual(codigos, ["ADM7001", "MAT1000"])  # ADM7001 uma só vez

        adm = disciplinas[0]
        self.assertEqual(adm[2], "Administração I")  # nome único e limpo
        self.assertEqual([t[0] for t in adm[3]], ["01302", "02777"])  # turmas dos 2 cursos
        self.assertEqual([t[9] for t in adm[3]], [302, 777])          # curso por turma
        self.assertEqual(cursos, {"302": "CIÊNCIAS CONTÁBEIS", "777": "ADMINISTRAÇÃO"})

    def test_curso_null_quando_linha_sem_curso(self):
        page = cagr_page([cagr_row("MAT1000", "09999", "Cálculo I")])  # sem link de curso
        disciplinas, cursos = parse_xml_text(page)

        turma = disciplinas[0][3][0]
        self.assertIsNone(turma[9])   # curso = null
        self.assertEqual(cursos, {})  # nada some/entra no mapa

    def test_turma_repetida_e_deduplicada_por_id(self):
        # Se o CAGR relista a mesma turma (mesmo código + mesmo id), mantém a 1a.
        page = cagr_page([
            cagr_row("ADM7001", "01302", "Administração I", curso_id=302, nome_curso="X", nums=(72, 50, 10, 0, 40, 0)),
            cagr_row("ADM7001", "01302", "Administração I", curso_id=302, nome_curso="X", nums=(72, 99, 99, 0, 0, 0)),
        ])
        disciplinas, _ = parse_xml_text(page)

        turmas = disciplinas[0][3]
        self.assertEqual(len(turmas), 1)
        self.assertEqual(turmas[0][2], 50)  # a primeira (vagas_ofertadas=50), não a duplicata

    def test_horarios_e_professores_multiplos(self):
        page = cagr_page([
            cagr_row("ADM7001", "01302", "Administração I", curso_id=302, nome_curso="X",
                     horarios=("2.0730-2 / ADM-101", "4.1010-2 / ADM-101"),
                     professores=("Prof A", "Prof B")),
        ])
        disciplinas, _ = parse_xml_text(page)
        turma = disciplinas[0][3][0]
        self.assertEqual(turma[7], ["2.0730-2 / ADM-101", "4.1010-2 / ADM-101"])
        self.assertEqual(turma[8], ["Prof A", "Prof B"])


if __name__ == "__main__":
    unittest.main()
