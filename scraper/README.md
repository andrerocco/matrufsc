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
   campus só quando `disciplinas` muda de fato.
5. Roda o **gate de integridade** sobre o staging: se qualquer suposição do
   frontend for violada, falha (exit não-zero) e não publica (veja abaixo).

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
gerar commits inúteis, `write_campus_if_changed` compara apenas `disciplinas`:
se não mudou, o arquivo é preservado byte a byte (inclusive o `data_extracao`
antigo). Assim um `git diff` simples decide se há algo a publicar.

## Módulos

- **`src/main.py`** — reconciliador/orquestrador; ponto de entrada único.
- **`src/get_turmas.py`** — sessão e scraping bruto do CAGR (XML por campus).
  O CAGR só reexecuta a consulta ao receber o evento do botão "Buscar" ou uma
  mudança de página; pedir "página 1" já estando na página 1 devolve o
  resultado anterior, ignorando semestre e campus. Por isso cada campus começa
  por `search()` (página 1) e só depois pagina com `fetch_page()`, e cada
  resposta é conferida contra a página pedida.
- **`src/parse_turmas.py`** — converte os XMLs nas tuplas compactas do app.
- **`src/semesters.py`** — regras de dados: campi esperados, cálculo de
  semestre, índice, staging e escrita idempotente.
- **`src/gate.py`** — gate de integridade pré-publicação (assumption checker):
  catálogo enumerável de checks que valida o staging contra as suposições do
  frontend. Rodável isoladamente (veja abaixo).

## Gate de integridade

Antes de publicar, `main.py` roda o **gate** (`src/gate.py`) sobre o staging: um
assumption checker que valida o diretório inteiro contra as suposições que o
frontend faz do JSON. O frontend é um consumidor puro (sem backend em runtime),
então dado fora do contrato pode quebrá-lo em runtime — inclusive lançar exceção
no parser de horário. Se qualquer check falha, o gate agrega **todas** as
violações num relatório e o workflow falha (exit não-zero, sem commit na `data`).

É um catálogo enumerável de checks nomeados em três níveis: `estrutural`
(forma/tipo das tuplas), `valor` (faixas e formato de string) e `relacional`
(integridade referencial e consistência entre arquivos). O check central é
`horario_decodificavel`: garante que todo horário decodifica sob as mesmas
regras do frontend (`HORAS`/`DIAS_SEMANA`, **espelhadas** em `gate.py` — mudar
uma tabela exige atualizar os dois lados), impedindo a exceção do parser. O
formato legado (turma de 9 campos, `cursos` ausente) é tolerado durante a
migração, até cada semestre histórico ser re-scrapeado — inclusive a unicidade
de código de disciplina/id de turma, que o produtor legado (que agrupava por
curso) podia violar e que o novo produtor garante.

Rodar isoladamente sobre um diretório de dados:

```bash
uv run python src/gate.py ../matrufsc/public/data
```

Ver a rastreabilidade (cada ponto de consumo do frontend → check que o protege;
adicionar consumo no frontend exige adicionar um check):

```bash
uv run python src/gate.py --traceability
```

## Testes

O scraper usa `unittest` da stdlib (sem deps novas). Rode a partir de `scraper/`:

```bash
uv run python -m unittest discover -s tests -t .
```

- `tests/test_parse_turmas.py` — o produtor (`parse_xml_text`), dirigido por uma
  amostra real do CAGR (`tests/fixtures/`) e fixtures sintéticas.
- `tests/test_gate.py` — o gate: dados bons e cada classe de defeito, pass/violação
  por check, agregação, tolerância ao legado e rastreabilidade.

O outro lado do contrato — a suíte do parser do frontend — roda com
`cd ../matrufsc && npm test`.

## Formato dos dados

Arquivos gravados em `<output_dir>/<ano>/<semestre>-<campus>.json`, ex.
`2026/20262-FLO.json`. Cada arquivo:

```json
{
    "campus": "FLO",
    "data_extracao": "11/04/26 - 20:27",
    "cursos": { "302": "CIÊNCIAS CONTÁBEIS", "342": "CIÊNCIA DA INFORMAÇÃO" },
    "disciplinas": []
}
```

`cursos` mapeia `id -> nome` dos cursos ofertantes vistos no campus. O id é o
mesmo que o CAGR usa no filtro `selectCursosGraduacao`, e cada turma referencia
um deles pelo campo `curso` (veja abaixo). O nome da disciplina **não** carrega
mais o sufixo `*CURSO` do CAGR: o curso passou a viver, por turma, no formato.

Cada disciplina é uma tupla posicional (para economizar bytes):

```text
[ codigo, nome_ascii_upper, nome, [turmas] ]
```

Cada turma:

```text
[ nome_turma, horas_aula, vagas_ofertadas, vagas_ocupadas,
  alunos_especiais, saldo_vagas, pedidos_sem_vaga, [horarios], [professores], curso ]
```

`curso` é o id do curso ofertante da turma (chave em `cursos`) ou `null` quando
o CAGR não informa. Uma disciplina pode ter turmas de cursos diferentes; o
conjunto de cursos de uma disciplina é a união dos `curso` das suas turmas.

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
