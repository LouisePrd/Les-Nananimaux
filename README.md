# Les Nanaminaux

Sculptures 3D génératives inspirées des Nanas de Niki de Saint Phalle, avec des attributs animaux
(cornes, bois, oreilles, ailes, queues). Chaque clic sur « Générer » crée une sculpture différente.

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
