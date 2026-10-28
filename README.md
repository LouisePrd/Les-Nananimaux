# Les Nanaminaux

Sculptures 3D génératives inspirées des Nanas de Niki de Saint Phalle, avec des attributs animaux
(cornes, bois, oreilles, ailes, queues). Chaque clic sur « Générer » crée une sculpture différente.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir l'adresse affichée (par défaut http://localhost:5173).

- **Générer** (ou barre d'espace) : nouvelle sculpture, en gardant les réglages fixés
- **Réglages** : chaque réglage est au hasard par défaut (icône ou texte pâle, curseur évidé) ; le modifier le fixe.
  Pour le remettre au hasard : faire défiler le carrousel jusqu'au début, recliquer la palette choisie, ou double-cliquer sur un curseur
- Glisser pour tourner autour, molette pour zoomer
- L'URL contient la graine et les réglages fixés : la copier permet de retrouver exactement la même sculpture

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | Scène Three.js, lumières, caméra, boutons, export PNG |
| `src/random.js` | Générateur aléatoire à graine, et flux séparés par aspect (couleur, pose, bras…) |
| `src/params.js` | Tire tous les paramètres d'une sculpture puis applique les réglages fixés ; lien partageable |
| `src/panel.js` | Panneau de réglages (carrousels, menus, curseurs, cartel) |
| `src/icons.js` | Icônes dessinées des attributs |
| `src/geometry.js` | `variableTube` : tube à rayon variable, utilisé pour les membres, les cornes, les queues… |
| `src/body.js` | Corps : proportions, torse (surface de révolution déformée), poses des bras et jambes |
| `src/attributes.js` | Attributs animaux, répartis en emplacements : tête, dos, queue |
| `src/materials.js` | Palettes et matériaux (`skin` = peau peinte, `limbs` = noir laqué) |
| `src/paint.js` | Motifs génératifs peints sur la peau (bandes, spirale, rayures, mosaïque, uni) |

## Ajouter un attribut animal

Écrire une fonction `(rng, body, skin) => object` dans `src/attributes.js`,
l'ajouter à l'emplacement voulu dans `ATTRIBUTE_SLOTS`, et dessiner son icône dans `src/icons.js`. `body.head`, `body.headR` et `body.anchors`
donnent les points d'accroche.

## Prochaines étapes

- Socle
- Galerie
# les-nananimaux
