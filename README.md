# Présidentielle 2027 — comparateur des programmes

Site statique qui compare, thème par thème, les propositions des candidats à l'élection présidentielle française de 2027, avec leurs programmes de 2022 pour ceux qui s'étaient déjà présentés.

- Choisir deux candidats ou plus (y compris un même candidat en 2022 et en 2027).
- Filtrer par thème (19 thèmes) et rechercher un mot dans les propositions.
- Chaque proposition renvoie à sa source et indique si elle vient d'un programme officiel, d'une déclaration ou d'un livre.
- Pour chaque candidat, les procédures judiciaires le visant (enquêtes, mises en examen, condamnations, relaxes, non-lieux…), avec leur statut à jour et leurs sources.
- Une page « Réseau » (`reseau.html`) : graphe des liens entre candidats, personnalités, gouvernements, partis, entreprises, médias et écoles, avec recherche du chemin entre deux personnes.
- L'état des filtres est dans l'URL : un comparatif se partage par simple lien.

## Lancer en local

```sh
python3 scripts/build_data.py   # valide les fiches et régénère data/programmes.json
python3 -m http.server 8000     # puis ouvrir http://localhost:8000
```

Le site n'a aucune étape de compilation : `index.html`, `reseau.html`, `assets/` (dont D3 7.9.0 dans `assets/vendor/`) et les fichiers `data/*.json` assemblés suffisent (GitHub Pages, Netlify, etc.).

## Données

| Dossier | Contenu |
|---|---|
| `data/2027/<slug>.json` | Une fiche par candidat ou personnalité pour 2027 (source de vérité) |
| `data/2022/<slug>.json` | Programme de 2022 des candidats 2027 qui s'étaient déjà présentés |
| `data/themes.json` | Les 19 thèmes et leurs sujets (lignes du comparatif) |
| `data/affaires/<slug>.json` | Affaires judiciaires de chaque personne (méthode : `docs/AFFAIRES.md`) |
| `data/reseau/` | Liens du réseau : `organisations.json`, une fiche par candidat, et `etendu/` pour les acteurs non politiques (méthode : `docs/RESEAU.md`) |
| `data/programmes.json`, `data/reseau.json` | Fichiers assemblés lus par le site — **généré**, ne pas modifier à la main |
| `docs/METHODOLOGIE.md` | Format des fiches, liste des thèmes et règles de sourçage |

Pour ajouter ou corriger une proposition : modifier la fiche dans `data/<année>/`, puis relancer `python3 scripts/build_data.py`. Le script refuse un thème inconnu ou une proposition sans source.

## Avertissement

Aucune candidature n'est officielle avant la publication de la liste par le Conseil constitutionnel, après validation des 500 parrainages. Toute personne est présumée innocente tant qu'une condamnation définitive n'a pas été prononcée. Beaucoup de programmes 2027 ne sont pas encore publiés : les fiches le signalent (`programme.statut`) et leurs `notes` détaillent les incertitudes.
