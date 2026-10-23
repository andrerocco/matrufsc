import os
import tempfile
import unittest

from parse_turmas import parse_xml_file, parse_xml_text
from cagr_xml import THEAD, cagr_page, cagr_row, curso_link

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def turma_by_id(disciplinas, codigo, turma_id):
    for disciplina in disciplinas:
        if disciplina[0] == codigo:
            for turma in disciplina[3]:
                if turma[0] == turma_id:
                    return turma
    raise AssertionError(f"{codigo} {turma_id} nao encontrada")


def full_page(prefix, n=50):
    return [cagr_row(f"{prefix}{i:04d}", "01302") for i in range(n)]


class RealPageTests(unittest.TestCase):
    """Página 1 real de FLO: 50 linhas, todas do curso 102 (FARMÁCIA)."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(FIXTURES, "cagr_flo_page1.xml"), encoding="utf-8") as f:
            cls.disciplinas, cls.cursos = parse_xml_text(f.read())

    def test_agrupa_as_50_linhas_em_12_disciplinas(self):
        self.assertEqual(sum(len(d[3]) for d in self.disciplinas), 50)
        self.assertEqual(
            [(d[0], d[2]) for d in self.disciplinas],
            [
                ("ACL5134", "Atenção à Saúde IV"),
                ("ACL5139", "Gestão da Qualidade em Análises Clínicas"),
                ("ACL5142", "Trabalho de Conclusão de Curso II (TCC)"),
                ("ACL5143", "Estágio em Análises Clínicas"),
                ("ACL5144", "Biossegurança e Boas Práticas de Laboratório"),
                ("ACL5145", "Laboratório Móvel de Educação em Saúde (EXT= 72h-a)"),
                ("ACL5146", "Parasitologia Clínica"),
                ("ACL5147", "Bioquímica Clínica"),
                ("ACL5148", "Imunologia Clínica"),
                ("ACL5149", "Citologia Clínica"),
                ("ACL5150", "Micologia Clínica"),
                ("ACL5151", "Uroanálise"),
            ],
        )
        self.assertEqual(self.disciplinas[0][1], "ATENCAO A SAUDE IV")

    def test_curso_por_turma_e_mapa(self):
        self.assertEqual(self.cursos, {"102": "FARMÁCIA"})
        for disciplina in self.disciplinas:
            for turma in disciplina[3]:
                self.assertEqual(len(turma), 11)
                self.assertEqual(turma[9], 102)

    def test_status_por_turma(self):
        self.assertIsNone(turma_by_id(self.disciplinas, "ACL5134", "08102A")[10])
        self.assertEqual(turma_by_id(self.disciplinas, "ACL5139", "08102")[10], "Cancelada")
        self.assertEqual(turma_by_id(self.disciplinas, "ACL5145", "04102A")[10], "Reservada Curso")

    def test_horarios_e_professores(self):
        turma = turma_by_id(self.disciplinas, "ACL5134", "08102A")
        self.assertEqual(turma[7], ["2.1330-3 / CCS-J006"])
        self.assertEqual(turma[8][:2], ["Cleonice Maria Michelon", "Jussara Kasuko Palmeiro"])
        self.assertEqual(turma_by_id(self.disciplinas, "ACL5143", "09102B")[7:9], [[], []])

    def test_lotada_vira_saldo_zero_e_pedidos_vazio_tambem(self):
        self.assertEqual(turma_by_id(self.disciplinas, "ACL5139", "08102")[5:7], [0, 0])
        self.assertEqual(turma_by_id(self.disciplinas, "ACL5134", "08102A")[5:7], [12, 0])


class GroupingTests(unittest.TestCase):
    def test_mesmo_codigo_em_blocos_separados_vira_uma_disciplina(self):
        page = cagr_page([
            cagr_row("ADM7001", "01302", curso_id=302, nome_curso="CIÊNCIAS CONTÁBEIS"),
            cagr_row("MAT1000", "09999", nome="Cálculo I", curso_id=1, nome_curso="MATEMÁTICA"),
            cagr_row("ADM7001", "02777", curso_id=777, nome_curso="ADMINISTRAÇÃO"),
        ])
        disciplinas, cursos = parse_xml_text(page)

        self.assertEqual([d[0] for d in disciplinas], ["ADM7001", "MAT1000"])
        self.assertEqual([t[0] for t in disciplinas[0][3]], ["01302", "02777"])
        self.assertEqual([t[9] for t in disciplinas[0][3]], [302, 777])
        self.assertEqual(cursos, {"302": "CIÊNCIAS CONTÁBEIS", "1": "MATEMÁTICA", "777": "ADMINISTRAÇÃO"})

    def test_status_so_na_turma_que_o_tem(self):
        page = cagr_page([
            cagr_row("ADM7001", "01302", status="Cancelada"),
            cagr_row("ADM7001", "02302"),
        ])
        disciplinas, _ = parse_xml_text(page)
        self.assertEqual(disciplinas[0][2], "Administração I")
        self.assertEqual([t[10] for t in disciplinas[0][3]], ["Cancelada", None])

    def test_asterisco_dentro_do_nome_e_conteudo(self):
        page = cagr_page([cagr_row("CSO7708", "01301", nome="Trabalho de Conclusão de Curso I - TCC I (*)")])
        disciplinas, _ = parse_xml_text(page)
        self.assertEqual(disciplinas[0][2], "Trabalho de Conclusão de Curso I - TCC I (*)")

    def test_nome_do_curso_fica_como_o_cagr_manda_e_o_primeiro_vence(self):
        page = cagr_page([
            cagr_row("EMC5001", "01236", curso_id=236, nome_curso="ENGENHARIA DE MATERIAIS"),
            cagr_row("EMC5002", "01236", curso_id=236, nome_curso="ENGENHARIA DE MATERIAIS [Semestral]"),
            cagr_row("ARA5001", "01653", curso_id=653, nome_curso="ENGENHARIA DE ENERGIA [Campus Araranguá]"),
        ])
        _, cursos = parse_xml_text(page)
        self.assertEqual(cursos, {"236": "ENGENHARIA DE MATERIAIS", "653": "ENGENHARIA DE ENERGIA [Campus Araranguá]"})

    def test_professores_como_texto_link_ou_vazio(self):
        page = cagr_page([
            cagr_row("ADM7001", "01302", prof_raw="Professor A Contratar<br/>"),
            cagr_row("ADM7001", "02302", prof_raw=""),
            cagr_row("ADM7001", "03302", prof_raw='<a href="x">Ana</a><br/>Beto<br/><a href="y">Caio</a><br/>'),
        ])
        disciplinas, _ = parse_xml_text(page)
        self.assertEqual([t[8] for t in disciplinas[0][3]], [["Professor A Contratar"], [], ["Ana", "Beto", "Caio"]])

    def test_horarios_um_por_linha(self):
        page = cagr_page([
            cagr_row("ADM7001", "01302", horarios=("2.0730-2 / A", "4.0730-2 / B")),
            cagr_row("ADM7001", "02302", horarios=()),
        ])
        disciplinas, _ = parse_xml_text(page)
        self.assertEqual([t[7] for t in disciplinas[0][3]], [["2.0730-2 / A", "4.0730-2 / B"], []])

    def test_paginas_cheias_seguidas_da_ultima(self):
        xml = cagr_page(full_page("AAA")) + cagr_page(full_page("BBB")) + cagr_page([cagr_row("CCC0001", "01302")])
        disciplinas, _ = parse_xml_text(xml)
        self.assertEqual(len(disciplinas), 101)


class RejectionTests(unittest.TestCase):
    def assert_rejects(self, rows, message, **page_kwargs):
        with self.assertRaisesRegex(RuntimeError, message):
            parse_xml_text(cagr_page(rows, **page_kwargs))

    def test_turma_repetida_identica(self):
        row = cagr_row("ADM7001", "01302")
        self.assert_rejects(
            [row, cagr_row("MAT1000", "01302"), row],
            r"linha 3 \(ADM7001 01302\): turma ja listada na linha 1, copia identica: \['01302', 72, .*\] vs \['01302', 72, .*\]",
        )

    def test_turma_repetida_divergente(self):
        self.assert_rejects(
            [cagr_row("ADM7001", "01302", nums=(72, 50, 10, 0, 40, "")), cagr_row("ADM7001", "01302", nums=(72, 99, 99, 0, 0, ""))],
            r"turma ja listada na linha 1, copia diferente: \['01302', 72, 50, .*\] vs \['01302', 72, 99, .*\]",
        )

    def test_turma_repetida_em_outra_pagina(self):
        xml = cagr_page(full_page("AAA")) + cagr_page([cagr_row("AAA0007", "01302")])
        with self.assertRaisesRegex(RuntimeError, r"linha 51 \(AAA0007 01302\): turma ja listada na linha 8"):
            parse_xml_text(xml)

    def test_nome_diferente_entre_turmas_do_mesmo_codigo(self):
        self.assert_rejects(
            [cagr_row("ADM7001", "01302", nome="Administração I"), cagr_row("ADM7001", "02302", nome="Administração 1")],
            r"linha 2 \(ADM7001 02302\): nome difere .*'Administração 1' vs 'Administração I'",
        )

    def test_linha_sem_link_de_curso(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", link="<span/>")], r"esperado um unico link .* encontrado \[\]")

    def test_links_de_curso_fora_do_padrao(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", link=curso_link(1) + curso_link(2))], r"encontrado \['/relatorios/curriculoCurso\?curso=1&download', '/relatorios/curriculoCurso\?curso=2&download'\]")
        self.assert_rejects([cagr_row("ADM7001", "01302", link=curso_link(5) + curso_link(5))], "esperado um unico link")
        self.assert_rejects([cagr_row("ADM7001", "01302", link=curso_link(5) + '<a href=""/>')], "esperado um unico link")
        self.assert_rejects([cagr_row("ADM7001", "01302", link='<a href="ementa.xhtml?curso=7"><img/></a>')], "esperado um unico link")
        self.assert_rejects([cagr_row("ADM7001", "01302", link=curso_link("102x"))], "esperado um unico link")
        self.assert_rejects([cagr_row("ADM7001", "01302", link=curso_link("0102"))], "esperado um unico link")

    def test_celula_do_nome_fora_do_padrao(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I")], r"celula do nome com 1 linha\(s\), esperado 2 ou 3: \['Administração I'\]")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/>[Cancelada]<br/>[Semestral]<br/>*ADM")], "celula do nome com 4 linha")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/><span>[Cancelada]</span><br/>*ADM")], "celula do nome com <span>, esperado so <br/>")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/>ADMINISTRAÇÃO")], r"linha do curso fora do padrao \*CURSO: \['Administração I', 'ADMINISTRAÇÃO'\]")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/>*")], r"linha do curso fora do padrao")

    def test_status_fora_do_padrao(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/>Cancelada<br/>*ADM")], r"linha de status fora do padrao \[..\]: \['Administração I', 'Cancelada', '\*ADM'\]")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/>[ ]<br/>*ADM")], "linha de status fora do padrao")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I<br/>[Cancelada] [Semestral]<br/>*ADM")], "linha de status fora do padrao")

    def test_nome_vazio_ou_com_colchetes(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="<br/>*ADM")], r"nome da disciplina vazio ou com colchetes: \['', '\*ADM'\]")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="[Cancelada]<br/>*ADM")], "nome da disciplina vazio ou com colchetes")
        self.assert_rejects([cagr_row("ADM7001", "01302", nome_raw="Administração I [Cancelada]<br/>*ADM")], "nome da disciplina vazio ou com colchetes")

    def test_codigo_ou_turma_vazios(self):
        self.assert_rejects([cagr_row("", "01302")], r"linha 1 \(\? 01302\): codigo da disciplina ou id da turma vazio: <tr><td>1</td>")
        self.assert_rejects([cagr_row("ADM7001", "")], "codigo da disciplina ou id da turma vazio")

    def test_linha_com_menos_celulas(self):
        self.assert_rejects([cagr_row("ADM7001", "01302"), cagr_row("ADM7002", "01302", ncells=13)], "linha 2: 13 celulas, esperado 14: <tr>")

    def test_numeros_fora_do_padrao(self):
        for valor in ("<b>12</b>", "72.0", "-3", "+3", " 7 ", "1_0", ""):
            self.assert_rejects(
                [cagr_row("ADM7001", "01302", nums_raw=["72", "50", "10", valor, "40", ""])],
                r"linha 1 \(ADM7001 01302\): alunos_especiais nao e um numero: <td",
            )

    def test_saldo_fora_do_padrao(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", nums_raw=["72", "50", "10", "0", "<span>CHEIA</span>", ""])], "saldo_vagas nao e um numero: <td><span>CHEIA</span></td>")
        self.assert_rejects([cagr_row("ADM7001", "01302", nums_raw=["72", "50", "10", "0", "<span>LOTADA</span>x", ""])], "saldo_vagas nao e um numero")
        self.assert_rejects([cagr_row("ADM7001", "01302", nums_raw=["72", "50", "10", "0", "", ""])], "saldo_vagas nao e um numero")

    def test_saldo_lotada_vira_zero(self):
        page = cagr_page([cagr_row("ADM7001", "01302", nums_raw=["72", "50", "10", "0", '<span style="color: red">LOTADA</span>', ""])])
        disciplinas, _ = parse_xml_text(page)
        self.assertEqual(disciplinas[0][3][0][5:7], [0, 0])

    def test_pedidos_fora_do_padrao(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", nums_raw=["72", "50", "10", "0", "40", "<span/>"])], "pedidos_sem_vaga nao e um numero")

    def test_professores_fora_do_padrao(self):
        for prof_raw in (
            '<a href="x"></a><br/>',
            '<a href="x"> </a><br/>',
            '<a href="x">Ana</a>Beto<br/>',
            'Ana<a href="x">Beto</a><br/>',
            '<a href="x"><b>Ana</b></a><br/>',
            '<a href="x">Ana</a>',
            '<a href="x">Ana</a><a href="y">Beto</a><br/>',
            '<a href="x">Ana</a><br/><br/><a href="y">Beto</a><br/>',
            "<br/>",
            "Ana",
        ):
            self.assert_rejects([cagr_row("ADM7001", "01302", prof_raw=prof_raw)], r"professores fora do padrao \(<a>nome</a>\|nome\)<br/>: <td>")
        self.assert_rejects([cagr_row("ADM7001", "01302", prof_raw="<span>Ana</span><br/>")], "professores fora do padrao")

    def test_horarios_fora_do_padrao(self):
        self.assert_rejects([cagr_row("ADM7001", "01302", horarios_raw="<span>2.0730-2 / A</span>")], "celula de horarios com <span>, esperado so <br/>")
        self.assert_rejects([cagr_row("ADM7001", "01302", horarios_raw="2.0730-2 / A<br/><br/>4.0730-2 / B<br/>")], "horarios fora do padrao horario<br/>: <td>")
        self.assert_rejects([cagr_row("ADM7001", "01302", horarios_raw="2.0730-2 / A")], "horarios fora do padrao")
        self.assert_rejects([cagr_row("ADM7001", "01302", horarios_raw="<br/>")], "horarios fora do padrao")

    def test_pagina_sem_tabela(self):
        xml = cagr_page(full_page("AAA")) + cagr_page([], table=False)
        with self.assertRaisesRegex(RuntimeError, "pagina 2: sem a tabela formBusca:dataTable"):
            parse_xml_text(xml)

    def test_pagina_com_cabecalho_diferente(self):
        trocado = THEAD.replace("Vagas<br/>Ofertadas", "Vagas<br/>Ocupadas", 1)
        self.assert_rejects([cagr_row("ADM7001", "01302")], r"pagina 1: cabecalho da tabela diferente do esperado: \('', 'Ementa', .*'VagasOcupadas', 'VagasOcupadas'", thead=trocado)
        self.assert_rejects([cagr_row("ADM7001", "01302")], "cabecalho da tabela diferente", thead="<thead><tr/></thead>")
        self.assert_rejects([cagr_row("ADM7001", "01302")], "cabecalho da tabela diferente", thead="")

    def test_pagina_do_meio_com_menos_linhas(self):
        xml = cagr_page(full_page("AAA")) + cagr_page(full_page("BBB", 49)) + cagr_page([cagr_row("CCC0001", "01302")])
        with self.assertRaisesRegex(RuntimeError, "pagina 2 de 3: 49 linhas, esperado 50"):
            parse_xml_text(xml)


class ParseFileTests(unittest.TestCase):
    def test_erro_vem_com_o_nome_do_arquivo(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "20271_JOI.xml")
            with open(path, "w", encoding="utf-8") as f:
                f.write(cagr_page([cagr_row("ADM7001", "01302", ncells=13)]))
            with self.assertRaisesRegex(RuntimeError, "^20271_JOI.xml: linha 1: 13 celulas"):
                parse_xml_file(path)
            with open(path, "w", encoding="utf-8") as f:
                f.write("<not xml")
            with self.assertRaisesRegex(RuntimeError, "^20271_JOI.xml: "):
                parse_xml_file(path)


if __name__ == "__main__":
    unittest.main()
