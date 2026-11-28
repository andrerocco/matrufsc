"""Páginas XML mínimas com a estrutura das respostas AJAX do CAGR.

Uma amostra real está em `fixtures/cagr_flo_page1.xml`; os helpers aqui servem
para montar casos-limite que a amostra não cobre.
"""

HEADER_TITLES = (
    "", "Ementa", "Currículo", "Disciplina", "Turma", "Nome da Disciplina", "Horas<br/>Aula",
    "Vagas<br/>Ofertadas", "Vagas<br/>Ocupadas", "Alunos<br/>Especiais", "Saldo<br/>Vagas",
    "Pedidos<br/>sem vaga", "Horários", "Professor",
)
THEAD = "<thead><tr>" + "".join(f"<th><div>{t}</div></th>" for t in HEADER_TITLES) + "</tr></thead>"


def curso_link(curso_id):
    return f'<a href="/relatorios/curriculoCurso?curso={curso_id}&amp;download"><img/></a>'


def nome_cell(nome, nome_curso, status=None):
    lines = [nome] + ([f"[{status}]"] if status is not None else []) + [f"*{nome_curso}"]
    return "<br/>".join(lines)


def cagr_row(
    codigo,
    turma_id,
    nome="Administração I",
    curso_id=302,
    nome_curso="ADMINISTRAÇÃO",
    status=None,
    nums=(72, 50, 10, 0, 40, ""),
    horarios=("2.0730-2 / ADM-101",),
    professores=("Prof Fulano",),
    link=None,
    nome_raw=None,
    nums_raw=None,
    horarios_raw=None,
    prof_raw=None,
    ncells=14,
):
    """Uma linha (`<tr>`) com as 14 células que o parser lê.

    Os parâmetros `*_raw` substituem o conteúdo das células do curso (row[2]),
    do nome (row[5]), dos números (row[6..11]), dos horários (row[12]) e dos
    professores (row[13]) por HTML arbitrário, e `ncells` corta a linha, para
    montar linhas fora do padrão.
    """
    link = curso_link(curso_id) if link is None else link
    nome_raw = nome_cell(nome, nome_curso, status) if nome_raw is None else nome_raw
    nums_raw = [str(n) for n in nums] if nums_raw is None else nums_raw
    horarios_raw = "".join(f"{h}<br/>" for h in horarios) if horarios_raw is None else horarios_raw
    prof_raw = "".join(f'<a href="#">{p}</a><br/>' for p in professores) if prof_raw is None else prof_raw
    cells = [
        "1",
        "<x/>",
        link,
        codigo,
        turma_id,
        nome_raw,
        *nums_raw,
        horarios_raw,
        prof_raw,
    ]
    return "<tr>" + "".join(f"<td>{c}</td>" for c in cells[:ncells]) + "</tr>"


def cagr_table(rows, thead=THEAD):
    return f'<table id="formBusca:dataTable"><colgroup/>{thead}<tbody>{"".join(rows)}</tbody></table>'


def cagr_page(rows, thead=THEAD, table=True):
    body = cagr_table(rows, thead) if table else ""
    return (
        '<?xml version="1.0"?>'
        '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><div/>'
        f"{body}"
        "</body></html>"
    )
