# Deployment

A action [deploy-matrufsc-github-io.yml](.github/workflows/deploy-matrufsc-github-io.yml) faz a build do projeto e serve os arquivos estáticos gerados no repositório [`matrufsc/matrufsc.github.io`](https://github.com/matrufsc/matrufsc.github.io). Dessa forma, temos acesso ao domínio raiz `https://matrufsc.github.io` para o site principal, sem o sufixo `/matrufsc` no final, uma vez que o GitHub Pages exige que o repositório seja nomeado exatamente como `<orgname ou username>.github.io` para servir conteúdo no domínio raiz.

## Dados de curso e a branch `data`

Os JSONs de curso **não** ficam versionados na `main`. A fonte de verdade é a
branch órfã `data`, atualizada diariamente pelo workflow
[`scrape.yml`](../.github/workflows/scrape.yml):

1. O scraper compara os dados do CAGR com a branch `data` e só publica um commit
   novo quando `disciplinas` muda de fato — o histórico da `data` serve como
   registro de quando o CAGR mudou, sem poluir a `main`.
2. Ao publicar, o workflow dispara os dois deploys via `workflow_dispatch`.
3. Cada deploy roda `npm run data:pull`, que extrai a `data` para
   `matrufsc/public/data` **antes** do `vite build`. Assim o site continua 100%
   estático em runtime — os dados vão embutidos no `dist`.

Consequências:

- A `main` não recebe commits de dados; seu histórico fica limpo.
- `matrufsc/public/data` é ignorado pelo git (veja `matrufsc/.gitignore`). Para
  desenvolver localmente, rode `npm run data:pull` uma vez após clonar.
- A branch `data` precisa existir no remoto para os deploys funcionarem. Para
  semeá-la a partir dos dados atuais e enviá-la:

  ```bash
  git branch data "$(git commit-tree "$(git rev-parse main:matrufsc/public/data)" -m 'data: seed inicial')"
  git push -u origin data
  ```

Detalhes do scraper e do formato dos dados estão em
[`scraper/README.md`](../scraper/README.md).

### Configuração dos repositórios

Para que fosse possível enviar os arquivos para o repositório de destino, foi necessário:

1. Gerar um par de chaves SSH: `ssh-keygen -t ed25519 -C "github-actions@matrufsc" -f github-actions-deploy` (cria os arquivos `github-actions-deploy` e `github-actions-deploy.pub`).
2. No respositório `matrufsc/matrufsc.github.io`, acessar Settings → Deploy keys → Add deploy key.
    - Em "Title", dar um nome à chave (ex: "GitHub Actions — Deploy from caravelahc/matrufsc to Pages")
    - Em "Key", colar o conteúdo da chave pública (`github-actions-deploy.pub`)
    - Marcar a opção "Allow write access".

3. No repositório origem, acessar Settings → Secrets and variables → Actions → New repository secret.
    - Em "Name", colar: `DEPLOY_KEY_MATRUFSC_GITHUB_IO`
    - Em "Secret", colar o conteúdo da chave privada (`github-actions-deploy`).
