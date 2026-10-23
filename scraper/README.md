# Scraper

Scripts que extraem os dados de turmas do CAGR/UFSC e geram os JSONs consumidos
pelo MatrUFSC. Usam Python (via [`uv`](https://docs.astral.sh/uv/)) e não têm
backend em runtime.

Os dados **não** são versionados na `main`: a fonte de verdade é a branch órfã
`data`, publicada pelo workflow `.github/workflows/scrape.yml`. Veja
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) para o fluxo completo até o deploy.

## Como rodar

```bash
cd scraper
uv sync
```

### Atualização automática (reconciliador)

É o que o workflow diário executa. `src/main.py`:

1. Lê o semestre mais recente do baseline (`--public-data-dir`).
2. Calcula o próximo semestre e verifica no CAGR se ele já tem turmas para
   **todos** os campi esperados, executando a busca real (botão "Buscar") para
   cada campus.
3. Se estiver completo, scrapeia esse novo semestre; senão, re-scrapeia o
   semestre mais recente já indexado.
4. Escreve o resultado num diretório de _staging_, reescrevendo cada arquivo de
   campus só quando `disciplinas` ou `cursos` muda de fato.
5. Valida o staging contra o contrato de tuplas do frontend antes de terminar.

```bash
uv run python src/main.py \
  --public-data-dir ../matrufsc/public/data \
  --stage-dir /tmp/matrufsc-data
```

### Semestre específico (manual)

Para forçar o scrape de um semestre (substitui o antigo `make <semestre>`):

```bash
uv run python src/main.py --semester 20262 --stage-dir /tmp/matrufsc-data
```

Depois de validar o staging, copie-o para onde precisar — ou publique na branch
`data`. Localmente, `cd ../matrufsc && npm run data:pull` traz a `data` de volta
para `public/data`.

## Publicação: branch `data`, sem poluir a `main`

O reconciliador só grava no diretório de staging. Quem publica é o workflow:
quando o staging difere da branch `data`, ele cria **um commit na `data`** (com
histórico, um por mudança real) e dispara os deploys. A `main` nunca recebe
commits de dados, e o histórico da `data` vira um registro de quando o CAGR
mudou.

### Evitando commits sem mudança

Cada arquivo de campus tem `data_extracao`, que mudaria a cada scrape. Para não
gerar commits inúteis, `write_campus_if_changed` compara apenas `disciplinas` e
`cursos`: se não mudaram, o arquivo é preservado byte a byte (inclusive o
`data_extracao` antigo). Assim um `git diff` simples decide se há algo a
publicar.

## Módulos

- **`src/main.py`** — reconciliador/orquestrador; ponto de entrada único.
- **`src/get_turmas.py`** — sessão e scraping bruto do CAGR (XML por campus).
  O CAGR só reexecuta a consulta ao receber o evento do botão "Buscar" ou uma
  mudança de página; pedir "página 1" já estando na página 1 devolve o
  resultado anterior, ignorando semestre e campus. Por isso cada campus começa
  por `search()` (página 1) e só depois pagina com `fetch_page()`, e cada
  resposta é conferida contra a página pedida.
- **`src/parse_turmas.py`** — converte os XMLs nas tuplas compactas do app e no
  mapa `cursos`; falha em qualquer linha fora do padrão (ver abaixo).
- **`src/semesters.py`** — regras de dados: campi esperados, cálculo de
  semestre, índice, staging, escrita idempotente e validação de contrato.

## Formato dos dados

Arquivos gravados em `<output_dir>/<ano>/<semestre>-<campus>.json`, ex.
`2026/20262-FLO.json`. Cada arquivo:

```json
{
    "campus": "FLO",
    "data_extracao": "11/04/26 - 20:27",
    "cursos": { "102": "FARMÁCIA", "3": "QUÍMICA - Bacharelado [Campus Florianópolis]" },
    "disciplinas": []
}
```

`cursos` mapeia o id do curso ofertante (como está no link "Currículo" do
CAGR) para o nome que o CAGR mostra depois do `*` no nome da disciplina. O nome
é gravado como vem, inclusive sufixos como `[Campus Joinville]` ou
`[Semestral]`; quando o mesmo id aparece com nomes diferentes, vale o primeiro.

Cada disciplina é uma tupla posicional (para economizar bytes):

```text
[ codigo, nome_ascii_upper, nome, [turmas] ]
```

Cada turma:

```text
[ nome_turma, horas_aula, vagas_ofertadas, vagas_ocupadas,
  alunos_especiais, saldo_vagas, pedidos_sem_vaga, [horarios], [professores],
  curso, status ]
```

`curso` é o id (número) do curso ofertante daquela turma, chave em `cursos`.
`status` é o marcador que o CAGR mostra entre colchetes abaixo do nome
(`Cancelada`, `Reservada Curso`, `Bloqueada (inativa)`...), ou `null` quando
não há. Uma disciplina ofertada para vários cursos aparece uma vez só, com as
turmas de todos eles. `saldo_vagas` é 0 quando o CAGR mostra `LOTADA` no lugar
do número, e `pedidos_sem_vaga` é 0 quando a célula vem vazia.

Arquivos gerados antes desse formato não têm `cursos` e têm turmas de 9
campos. Neles, `nome` e `nome_ascii` carregam o status e o sufixo `*CURSO` da
primeira turma listada (ex.: `Atenção à Saúde IV [Cancelada] *FARMÁCIA`). A
validação do staging decide o formato por arquivo pela presença de `cursos`.
O refresh diário migra o semestre mais recente sozinho; os anteriores só
mudam de formato quando alguém os re-scrapeia com `--semester` e publica.

Os campos de horas/vagas são números, não strings. Os horários seguem o formato
da UFSC:

```text
"2.1010-2 / ARA-ARA209"
 | |    |   |   \----- código da sala
 | |    |   \--------- código do departamento
 | |    \------------- número de aulas seguidas no bloco
 | \------------------ horário da primeira aula do bloco
 \-------------------- dia da semana
```

A ordem das tuplas deve permanecer em sincronia com `JSONDisciplina`/`JSONTurma`
em `matrufsc/src/lib/campusDataQuery.ts` e com o parser em
`matrufsc/src/context/plano/parser.ts`.

### O que faz o scrape falhar

O parser confia na estrutura das páginas do CAGR e não tenta adivinhar: ele
aceita exatamente as formas medidas nas páginas reais. Qualquer página ou
linha fora delas aborta o scrape inteiro, com o conteúdo na mensagem, e o
último dado bom continua publicado:

- página sem a tabela de resultados ou com cabeçalho diferente dos 14 títulos
  conhecidos (pega coluna trocada), ou página que não é a última com menos de
  50 linhas (pega página truncada);
- linha com número de células diferente de 14;
- célula "Currículo" sem exatamente um link, e que seja
  `curriculoCurso?curso=<id>`;
- célula do nome sem 2 linhas (`nome`, `*CURSO`) ou 3 (`nome`, `[status]`,
  `*CURSO`), separadas por `<br/>`, com outro elemento dentro, com colchetes no
  nome ou com colchetes aninhados no status;
- número de vagas/horas que não é só dígitos (exceto o `LOTADA` no saldo);
- horários ou professores fora do padrão de uma entrada seguida de `<br/>`
  (professor como texto ou como `<a>nome</a>`), ou com outro elemento dentro;
- o mesmo par (código, turma) listado duas vezes, sinal de página repetida na
  busca stateful do CAGR; a mensagem mostra as duas cópias;
- turmas do mesmo código com nomes diferentes.

## Testes

```bash
cd scraper
uv run python -m unittest discover -s tests -t .
```

`tests/fixtures/cagr_flo_page1.xml` é uma página real do CAGR; os demais casos
usam páginas mínimas montadas por `tests/cagr_xml.py`.
