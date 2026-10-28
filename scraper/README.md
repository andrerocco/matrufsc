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
5. Confere o staging (ver [Validação](#validação)) antes de terminar.

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

Depois, rode o gate do site sobre o staging
(`cd ../matrufsc && npm run data:gate -- /tmp/matrufsc-data`) e copie-o para
onde precisar — ou publique na branch `data`. Localmente, `cd ../matrufsc && npm run data:pull` traz a `data` de volta
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
  resposta é conferida contra a página pedida. A paginação é por deslocamento
  sobre a consulta viva: uma turma inserida ou removida no CAGR no meio do
  scrape repete ou engole uma linha na fronteira de página. Por isso o total
  que a página 1 anuncia ("N resultados foram encontrados") tem de bater com
  as linhas coletadas, e uma nova busca ao fim do campus tem de anunciar o
  mesmo total.
- **`src/parse_turmas.py`** — converte os XMLs nas tuplas compactas do app e no
  mapa `cursos`; falha em qualquer linha fora do padrão (ver abaixo).
- **`src/semesters.py`** — regras de dados: campi esperados, cálculo de
  semestre, índice, staging e escrita idempotente.
- **`src/checks.py`** — conferências do staging que o parser do site não faz
  (ver [Validação](#validação)).

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
[ codigo, nome, [turmas] ]
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

Todos os semestres publicados precisam estar neste formato: o site e as
conferências não aceitam outro. Um semestre publicado antes dele só volta a
passar depois de re-scrapeado com `--semester`.

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
em `matrufsc/src/data/schema.ts` e com o parser em `matrufsc/src/data/parse.ts`.
É esse parser que o gate roda sobre o staging antes de publicar.

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
- campus cujas linhas coletadas diferem do total anunciado na página 1, ou cujo
  total mudou entre a busca inicial e a busca repetida ao fim (o CAGR foi
  editado durante o scrape; rodar de novo resolve);
- turmas do mesmo código com nomes diferentes.

## Validação

Dois programas precisam concordar sobre o formato dos JSONs: o scraper, que os
escreve, e o site, que os lê. Em vez de reimplementar as regras do site em
Python, o workflow roda o próprio parser do site sobre o staging:

```bash
cd ../matrufsc
npm run data:gate -- /tmp/matrufsc-data
```

`matrufsc/scripts/gate.ts` chama `getDisciplinaFromJSON` para cada disciplina
de cada `<ano>/<semestre>-<campus>.json`, com o `cursos` daquele arquivo, e
lista todo erro como `<arquivo> <codigo> <turma>: <mensagem>` — horário fora do
formato `dia.HHMM-N / sala`, em dia fora de 1 a 7 ou fora da tabela de horas
do site, turma com número de campos errado, curso que não consta em `cursos`,
JSON inválido. Se o site não consegue ler, o navegador também não, e
a publicação para ali.

O Python (`src/checks.py`, chamado por `main.py` antes do gate) fica só com o
que o parser do site não enxerga:

- arquivo de campus ausente, JSON inválido, `campus` diferente do nome do
  arquivo, `data_extracao` vazio ou `disciplinas` vazio, para todo campus de
  todo semestre do `index.json` (CAGR fora do ar devolve página vazia);
- número de disciplinas caiu mais de 20% em relação ao publicado
  (`--public-data-dir`) para o mesmo semestre e campus (paginação que falhou
  no meio);
- `cursos` ausente ou vazio, código de disciplina repetido, disciplina ou
  turma com número de campos diferente de 3 e 11, turma cujo curso não consta
  em `cursos`, e `[` ou `]` no nome da disciplina (o marcador `[Cancelada]`
  vazou para o nome).

## Testes

```bash
cd scraper
uv run python -m unittest discover -s tests -t .
```

`tests/fixtures/cagr_flo_page1.xml` é uma página real do CAGR; os demais casos
usam páginas mínimas montadas por `tests/cagr_xml.py`.
