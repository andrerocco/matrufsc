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
   **todos** os campi esperados.
3. Se estiver completo, scrapeia esse novo semestre; senão, re-scrapeia o
   semestre mais recente já indexado.
4. Escreve o resultado num diretório de _staging_, reescrevendo cada arquivo de
   campus só quando `disciplinas` muda de fato.
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
gerar commits inúteis, `write_campus_if_changed` compara apenas `disciplinas`:
se não mudou, o arquivo é preservado byte a byte (inclusive o `data_extracao`
antigo). Assim um `git diff` simples decide se há algo a publicar.

## Módulos

- **`src/main.py`** — reconciliador/orquestrador; ponto de entrada único.
- **`src/get_turmas.py`** — sessão e scraping bruto do CAGR (XML por campus).
- **`src/parse_turmas.py`** — converte os XMLs nas tuplas compactas do app.
- **`src/semesters.py`** — regras de dados: campi esperados, cálculo de
  semestre, índice, staging, escrita idempotente e validação de contrato.

## Formato dos dados

Arquivos gravados em `<output_dir>/<ano>/<semestre>-<campus>.json`, ex.
`2026/20262-FLO.json`. Cada arquivo:

```json
{
    "campus": "FLO",
    "data_extracao": "11/04/26 - 20:27",
    "disciplinas": []
}
```

Cada disciplina é uma tupla posicional (para economizar bytes):

```text
[ codigo, nome_ascii_upper, nome, [turmas] ]
```

Cada turma:

```text
[ nome_turma, horas_aula, vagas_ofertadas, vagas_ocupadas,
  alunos_especiais, saldo_vagas, pedidos_sem_vaga, [horarios], [professores] ]
```

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
