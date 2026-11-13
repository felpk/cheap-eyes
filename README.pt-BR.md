# cheap-eyes

Skill do Claude Code que acha os bugs que o usuário encontra no primeiro minuto e devolve tudo em texto. Assim o modelo para de pagar por print.

[Read in English](README.md)

**O problema.** O modelo diz "pronto" e você abre a página: o botão está embaixo do aviso de cookies, o celular rola para o lado, a imagem dá 404, o console tem erro. Tudo isso é óbvio no uso. A saída de sempre é "tira um print e olha". Ela não pega o que não aparece na imagem (erro de JS, API falhando, link morto) e custa contexto: a imagem lida na sessão principal fica no histórico e vai de novo em toda mensagem seguinte, até o `/clear`.

**O que ele faz.**

1. O `check.cjs` abre a página no Playwright em 390px e 1280px e mede: rolagem lateral, texto cortado pela caixa, botão coberto por outra coisa, imagem que não carregou, HTTP 4xx/5xx, requisição que falhou, erro de JS, link interno morto, botão de ícone sem nome, alvo de toque menor que 24×24px, texto abaixo do contraste WCAG AA, título com uma palavra sozinha na última linha e página em branco.
2. A saída é texto, com o seletor de cada problema. Repetições vêm agrupadas.
3. Se ainda sobra algo que precisa de olho, o subagente `visual-checker` abre os recortes e responde em texto. A imagem nunca chega na sua sessão.

## Resultados

Todos os números abaixo saem do `bench/`. As saídas brutas estão em `bench/results/`. Foi uma rodada por método, então isto é uma medição, não uma lei.

**Página com 12 bugs plantados** (`bench/fixtures/bugs.html`):

| | cheap-eyes | Prints (o Claude olha 2 prints da página inteira) |
|---|---|---|
| Bugs plantados encontrados | **11 de 12** | 7 de 12 |
| Alarme falso numa página limpa | 0 | não medido |
| Tokens de entrada, primeira tarefa | **53.732** | 82.761 |
| Custo, primeira tarefa | **US$ 0,090** | US$ 0,108 |
| Tokens de entrada, mensagem seguinte | **29.360** | 31.852 |

- O cheap-eyes não pegou o total errado do carrinho (10 + 5 aparecendo como 20). **O print pegou.** O checker mede layout, não significado. Número errado e fluxo quebrado precisam de teste de fluxo de verdade.
- O print não pegou o erro de JS, a API respondendo 500, o link morto, o botão de ícone sem nome e a palavra sozinha no título. Nada disso aparece na imagem.
- A sessão com prints leva cerca de 2.500 tokens a mais para toda mensagem seguinte, até o `/clear`. A maior parte são os dois prints, e o resto é a resposta mais longa dela. Aqui cada print custou cerca de 900 tokens, e uma página grande chega a uns 1.600. Dez prints numa sessão dão 10.000 tokens ou mais a cada mensagem.
- Quem escreveu a página com bugs plantados escreveu também o checker. Isso é viés, por isso ele também rodou em páginas reais.

**Cinco páginas reais em produção** ([detalhes](bench/results/real-pages.md)): 199 achados. Uma amostra de 18 foi conferida no olho pelo subagente: **14 confirmados** e 4 que não eram problema. Dois desses quatro, botões dentro de um carrossel com rolagem, vinham de um bug do checker, já corrigido. Os outros dois são texto logo abaixo da linha de contraste do WCAG que ainda se lê bem. Eles continuam no relatório, marcados como contestados.

## Instalar

No Claude Code:

```
/plugin marketplace add felpk/cheap-eyes
/plugin install cheap-eyes@cheap-eyes
```

Playwright, no projeto que você vai checar (ou aponte `PLAYWRIGHT=` para uma instalação que já existe):

```sh
npm i -D playwright && npx playwright install chromium
```

## Usar

Peça para o Claude checar a página, ou rode você mesmo:

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/ http://localhost:3000/precos
node skills/cheap-eyes/scripts/check.cjs <url> --json            # todos os achados
node skills/cheap-eyes/scripts/check.cjs <url> --crops ./crops   # PNG de cada elemento marcado, para o subagente
```

Código de saída 0 = limpo, 1 = achou problema, 2 = não conseguiu rodar. Dá para usar como trava no CI.

Rodar o benchmark:

```sh
node bench/score.cjs
```

## Limites

- Ele checa a página como ela carrega, sem rolar, clicar ou digitar. Fluxos (login, checkout) precisam de teste no Playwright.
- Ele não julga gosto. "Isso está estranho" continua sendo decisão de uma pessoa ou do subagente.
- O contraste segue o WCAG sobre fundo sólido. Texto sobre imagem ou degradê é pulado.

Licença MIT.
