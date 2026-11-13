# cheap-eyes

[English](README.md) · [Português](README.pt-BR.md)

**Problème.** Quand un agent (Claude Code ou un autre) lit une capture d'écran, prise avec Playwright par exemple, l'image entière reste dans la conversation. Elle est renvoyée à chaque message suivant, jusqu'au `/clear`.

**Solution.** Un skill qui garde l'image entière hors de la conversation principale. À la place, il regarde avec des yeux pas chers :

1. **Lire les éléments.** Un script ouvre la page en 390px et 1280px et mesure ce qu'elle contient : défilement horizontal, texte coupé, bouton sous une bannière, image en 404, erreur JS, appel d'API en échec, lien mort, icône sans nom, zone tactile trop petite, texte trop pâle, mot seul en fin de titre. La réponse arrive en texte, avec un sélecteur pour chaque problème.
2. **Regarder seulement si nécessaire.** Quand il faut un œil, un sous-agent ouvre de petits recadrages des éléments signalés et répond en texte. L'image disparaît avec lui.

## Résultats

| | cheap-eyes | Captures dans la conversation principale |
|---|---|---|
| Bugs trouvés sur 12 plantés | **11** | 7 |
| Tokens en entrée, 1re tâche | **53,7 k** | 82,8 k |
| Tokens en plus à chaque message suivant | **0** | ~2,5 k |
| Pages réelles : problèmes confirmés à l'œil | 14 sur 18 | |

Il rate ce que seul le sens révèle, comme un total faux. Pour ça, il faut un test de parcours. Données brutes et méthode dans [`bench/`](bench/results/).

## Installer

```
/plugin marketplace add felpk/cheap-eyes
/plugin install cheap-eyes@cheap-eyes
npm i -D playwright && npx playwright install chromium
```

Ensuite, demandez à Claude de vérifier une page, ou lancez-le vous-même :

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/
```

Pour regarder une partie modifiée, recadrez-la et passez tous les recadrages au sous-agent en un seul appel. Les parties hautes sortent en tranches, pour que le texte reste lisible :

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/ --shot "#pricing,footer"
```

MIT
