Este repositório contém os bancos de dados extraídos do CAGR para serem
utilizados no MatrUFSC, disponível no seguinte repositório:
https://github.com/ramiropolla/matrufsc_dbs.git

O banco de dados é gerado usando os script src/get_turmas.py e
src/parse_turmas.py. Estes scripts são específicos para o sistema de
cadastro de disciplinas da UFSC.

get_turmas.py pega os dados do CAGR e os grava separados por semestre e campus.
O modo de usar é: ./src/get_turmas.py <semestre>

parse_turmas.py gera arquivos .json dos arquivos xml criados por get_turmas.
O modo de usar é: ./src/parse_turmas.py <diretório de saída> <arquivos XML de entrada...>

Exemplo:
  ./src/parse_turmas.py ../matrufsc/public/data 20251_FLO.xml 20251_JOI.xml 20251_CBS.xml

Estrutura de saída:
  <output_dir>/<ano>/<semestre>-<campus>.json

  Exemplo:
    ../matrufsc/public/data/2025/20251-FLO.json
    ../matrufsc/public/data/2025/20251-JOI.json
    ../matrufsc/public/data/2025/20251-CBS.json

Cada JSON segue a seguinte estrutura:

{
  "campus": "<código do campus>",
  "data_extracao": "<data e hora da captura>",
  "disciplinas": [lista de disciplinas]
}

Cada disciplina é uma lista com a seguinte estrutura:
[ "código da disciplina", "nome da disciplina em ascii e caixa alta", "nome da disciplina", [lista de turmas] ]

Cada turma é uma lista com a seguinte estrutura:
[ "nome_turma", horas_aula, vagas_ofertadas, vagas_ocupadas, alunos_especiais, saldo_vagas, pedidos_sem_vaga, [horarios], [professores]]

Os dados relativos a horas_aula e vagas são em números, não strings.
Os horários são no formato disponibilizado pela UFSC:
"2.1010-2 / ARA-ARA209"
 | |    |   |   \----- código da sala
 | |    |   \--------- código do departamento
 | |    \------------- número de aulas seguidas no bloco
 | \------------------ horário da primeira aula do bloco
 \-------------------- dia da semana

Os professores são dispostos numa lista de strings.
