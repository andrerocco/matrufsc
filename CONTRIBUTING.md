# Contribuindo

Esse projeto aceita contribuições, mas não se propõe a ter seu escopo aumentado. O objetivo desta versão do MatrUFSC é manter apenas as funcionalidades essenciais para seu uso, com foco na **estabilidade e durabilidade do projeto no longo prazo**. Dessa forma, preferimos contribuições que foquem em melhorar as funcionalidades, em vez de adicionar novas funcionalidades.

Entretanto, se você tiver uma ideia de nova funcionalidade que realmente acredita fazer sentido ser adicionada a esta versão do projeto, recomendamos que inicie uma discussão por meio de uma issue. Ao propor a funcionalidade, leve em consideração:

- Como o visual dessa funcionalidade se encaixa na interface atual sem aumentar a carga cognitiva?
- Essa funcionalidade será fácil de usar, considerando que o projeto possui uma grande base de usuários não técnicos?
- Essa funcionalidade é realmente necessária ou é apenas um “nice to have”? Caso acredite que seja mais um “nice to have”, sinta-se à vontade para criar um fork deste projeto!

## Rodando o projeto localmente

### Frontend

```bash
cd matrufsc
npm install
npm run dev
```

### Scraper

```bash
cd scraper
uv run main.py
```

### Ferramentas recomendadas

Para manter padronização de formatação e melhor suporte às classes utilitárias, recomendamos instalar no VS Code:

1. Prettier: [esbenp.prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
2. Tailwind CSS IntelliSense: [bradlc.vscode-tailwindcss](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## Estrutura do repositório

- `matrufsc/`: aplicação web (SolidJS + Vite).
- `matrufsc/public/data/`: dados gerados pelo `scraper` e consumidos pelo app em tempo de execução.
- `scraper/`: scripts para extração e transformação dos dados.

## Deployment

O processo de deployment é descrito em detalhes no guia [DEPLOYMENT.md](docs/DEPLOYMENT.md).
