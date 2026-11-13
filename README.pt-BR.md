# cheap-eyes

[English](README.md) · [Français](README.fr.md)

**Problema.** Quando um agente (Claude Code ou outro) lê um print, tirado com Playwright por exemplo, a imagem inteira fica na conversa. Ela vai de novo em toda mensagem seguinte, até o `/clear`.

**Solução.** Uma skill que mantém a imagem inteira fora da conversa principal. No lugar dela, olha com olhos baratos:

1. **Lê os elementos.** Um script abre a página em 390px e 1280px e mede o que tem nela: rolagem lateral, texto cortado, botão embaixo de banner, imagem 404, erro de JS, API falhando, link morto, ícone sem nome, alvo de toque pequeno, texto apagado e palavra sozinha no fim do título. A resposta vem em texto, com o seletor de cada problema.
2. **Só olha quando precisa.** Se algo pede olho, um subagente abre recortes pequenos dos elementos marcados e responde em texto. A imagem morre com o subagente.

## Resultados

| | cheap-eyes | Print na conversa principal |
|---|---|---|
| 12 bugs plantados encontrados | **11** | 7 |
| Tokens de entrada, 1ª tarefa | **53,7 mil** | 82,8 mil |
| Tokens a mais em cada mensagem seguinte | **0** | ~2,5 mil |
| Páginas reais: achados confirmados no olho | 14 de 18 | |

Não pega o que só o significado mostra, como um total errado. Isso pede teste de fluxo. Dados brutos e método em [`bench/`](bench/results/).

## Instalar

```
/plugin marketplace add felpk/cheap-eyes
/plugin install cheap-eyes@cheap-eyes
npm i -D playwright && npx playwright install chromium
```

Depois é só pedir para o Claude checar a página, ou rodar você mesmo:

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/
```

Para olhar uma parte que mudou, recorte essa parte e passe todos os recortes ao subagente numa chamada só. Partes altas saem em fatias, para o texto continuar legível:

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/ --shot "#pricing,footer"
```

MIT
