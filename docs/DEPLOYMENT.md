# Deployment

A action [deploy-matrufsc-github-io.yml](.github/workflows/deploy-matrufsc-github-io.yml) faz a build do projeto e serve os arquivos estáticos gerados no repositório [`matrufsc/matrufsc.github.io`](https://github.com/matrufsc/matrufsc.github.io). Dessa forma, temos acesso ao domínio raiz `https://matrufsc.github.io` para o site principal, sem o sufixo `/matrufsc` no final, uma vez que o GitHub Pages exige que o repositório seja nomeado exatamente como `<orgname ou username>.github.io` para servir conteúdo no domínio raiz.

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
