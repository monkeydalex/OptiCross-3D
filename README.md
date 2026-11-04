# OptiCross 3D

Simulateur 3D/2D de cross-connect et d'infrastructure télécom : modélisation de salles (opérateur, MMR, client), baies et calepinage sur dalles 60 × 60 cm, brassage optique (jarretières, câbles rocades 12FO/24FO), bilan de liaison et export documentaire SVG/PDF.

**Démo en ligne : https://monkeydalex.github.io/OptiCross-3D/**

> Les données du site d'exemple (nom du datacenter, adresse, opérateur, numéros de commande) sont fictives.

## Fonctionnalités

- Vue 3D (Three.js) des salles, baies, équipements, chemins de câbles et fibres
- Plan 2D interactif avec calepinage des baies
- Simulateur de brassage : création de jarretières et de cross-connects mono ou bi-fibre
- Calcul d'atténuation et de bilan optique
- Bibliothèque d'équipements et inventaire
- Export de la documentation en SVG et PDF

## Lancer en local

Prérequis : [Bun](https://bun.sh).

```bash
bun install
bun run dev      # http://localhost:3000
bun run build    # build de production dans dist/
bun run lint     # vérification des types
```

## Stack

React 19, Three.js, Tailwind CSS 4, Vite 8, TypeScript 7, jsPDF.

## Licence

[ISC](LICENSE)
