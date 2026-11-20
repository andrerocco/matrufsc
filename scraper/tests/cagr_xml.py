"""Constrói páginas XML mínimas com a mesma estrutura das respostas AJAX do
CAGR, para dirigir os testes do produtor (`parse_xml_text`).

O parser localiza a tabela pelo id `formBusca:dataTable` e lê os `<tbody>` no
namespace XHTML; dentro da linha indexa por posição (`row[2]` = link do curso;
`row[3]` = código; `row[4]` = id da turma; `row[5]` = nome; `row[6..11]` =
números; `row[12]` = horários; `row[13]` = professores). Uma amostra real de
página está em `fixtures/cagr_flo_page1.xml`."""


def cagr_row(codigo, turma_id, nome, curso_id=None, nome_curso=None, nums=(72, 50, 10, 0, 40, 0),
             horarios=("2.0730-2 / ADM-101",), professores=("Prof Fulano",)):
    """Uma linha (`<tr>`) do CAGR com as 14 células que o parser lê.

    - `curso_id`/`nome_curso`: quando dados, geram o link de Currículo (row[2]) e
      o sufixo `*NOME` do nome (row[5]); quando None, a linha não tem curso.
    - `nums`: (horas_aula, vagas_ofertadas, vagas_ocupadas, alunos_especiais,
      saldo_vagas, pedidos_sem_vaga) = row[6..11].
    """
    if curso_id is not None:
        link = f'<a href="/relatorios/curriculoCurso?curso={curso_id}&amp;download"><img/></a>'
    else:
        link = "<span/>"

    nome_cell = nome
    if nome_curso is not None:
        nome_cell = f"{nome}<br/>*{nome_curso}"

    num_cells = "".join(f"<td>{n}</td>" for n in nums)

    # Horários: texto da célula + tails de <br/> (como o CAGR serializa).
    if horarios:
        horario_cell = horarios[0] + "".join(f"<br/>{h}" for h in horarios[1:])
    else:
        horario_cell = ""

    # Professores: um <a> por professor (têm atributo, que o parser usa).
    prof_cell = "".join(f'<a href="#">{p}</a>' for p in professores)

    return (
        "<tr>"
        "<td>1</td>"          # row[0] índice
        "<td><x/></td>"       # row[1] (ignorado)
        f"<td>{link}</td>"    # row[2] link do curso
        f"<td>{codigo}</td>"  # row[3] código da disciplina
        f"<td>{turma_id}</td>"  # row[4] id da turma
        f"<td>{nome_cell}</td>"  # row[5] nome (+ *CURSO)
        f"{num_cells}"        # row[6..11] números
        f"<td>{horario_cell}</td>"  # row[12] horários
        f"<td>{prof_cell}</td>"     # row[13] professores
        "</tr>"
    )


def cagr_page(rows):
    """Envelopa linhas na estrutura que `iter_rows_from_xml_text` percorre
    (tabela `formBusca:dataTable`, `<tbody>` em XHTML)."""
    body = "".join(rows)
    return (
        '<?xml version="1.0"?>'
        '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><div/>'
        f'<table id="formBusca:dataTable"><colgroup/><thead/><tbody>{body}</tbody></table>'
        "</body></html>"
    )
