# Méthodologie — affaires judiciaires des candidats

Première collecte : 12 octobre 2026. Une fiche par personne dans data/affaires/<slug>.json, valable pour 2022 et 2027.

Objectif : pour chaque personne assignée, recenser les procédures judiciaires la visant personnellement
(enquêtes, mises en examen, procès, condamnations, relaxes, non-lieux, classements sans suite, prescriptions),
avec leur statut exact à jour, pour l'afficher sur un comparateur électoral. Sujet sensible : la règle est
l'exactitude, la neutralité et la présomption d'innocence.

## Ce qu'on inclut
- Procédures pénales où la personne est visée : enquête préliminaire ou information judiciaire la visant
  nommément, garde à vue, mise en examen, statut de témoin assisté, renvoi devant un tribunal, jugement,
  appel, cassation, et leur issue (condamnation, relaxe, acquittement, non-lieu, classement sans suite, prescription).
- Procédures devant la Cour de justice de la République, la Cour de discipline budgétaire, etc.
- Condamnations civiles ou pénales pour diffamation/injure, et décisions d'inéligibilité.
- Les affaires anciennes sont incluses si elles ont abouti à une décision (même ancienne) ou si elles sont
  encore régulièrement citées ; préciser l'année.

## Ce qu'on exclut
- Rumeurs, accusations médiatiques ou politiques sans procédure judiciaire ouverte.
- Affaires où la personne est seulement victime, plaignante ou simple témoin (non visée).
- Vie privée, famille, proches (sauf si la personne elle-même est poursuivie).
- Procédures visant uniquement un parti ou une collectivité sans que la personne soit mise en cause nommément
  (le mentionner dans "notes" si c'est notable, ex. parti condamné).

## Sources
- Au moins une source fiable par affaire : AFP, Le Monde, franceinfo, Le Figaro, Libération, Mediapart,
  Le Parisien, Ouest-France, Public Sénat, LCP, BFMTV, Reuters, communiqués du parquet ou de la juridiction.
  Pour toute condamnation ou mise en examen, viser DEUX sources concordantes quand c'est possible.
- Wikipédia : seulement pour repérer des pistes, jamais comme source unique.
- Vérifier le DERNIER état de chaque affaire (appel ? cassation ? décision rendue ?) à la date du jour.
- En cas de doute non levé : ne pas inclure l'affaire, l'expliquer dans "notes".

## Statuts (champ "statut", utiliser EXACTEMENT ces identifiants)
- enquete            : enquête préliminaire ou information judiciaire en cours visant la personne (sans mise en examen connue)
- mise_en_examen     : mise en examen ou témoin assisté, instruction en cours (préciser dans "resume")
- renvoi_proces      : renvoyée devant une juridiction, procès à venir ou en cours, pas encore jugée
- condamnation_non_definitive : condamnée en première instance ou en appel, recours en cours ou encore possible
- condamnation_definitive     : condamnation devenue définitive
- relaxe             : relaxe ou acquittement (préciser si définitif)
- non_lieu           : non-lieu
- classement         : classement sans suite
- prescription       : prescription / extinction de l'action publique
- autre              : autre issue (préciser)

## Format : un fichier JSON par personne dans
data/affaires/<slug>.json (même slug que la fiche programme)

{
  "slug": "marine-le-pen",
  "nom": "Marine Le Pen",
  "affaires": [
    {
      "intitule": "Affaire des assistants parlementaires européens du FN",
      "qualification": "Détournement de fonds publics",
      "statut": "condamnation_non_definitive",
      "resume": "1 à 3 phrases factuelles et neutres : rôle de la personne, peines prononcées, dates des décisions, recours en cours.",
      "date_derniere_etape": "2026-07-07",
      "sources": [
        {"url": "https://...", "media": "franceinfo", "date": "2026-07-07"}
      ]
    }
  ],
  "aucune_affaire_trouvee": false,
  "notes": "Recherches effectuées, incertitudes, affaires écartées et pourquoi.",
  "verifie_le": "2026-10-12"
}

- Si aucune procédure n'est trouvée : "affaires": [], "aucune_affaire_trouvee": true, et décrire dans "notes"
  ce qui a été cherché (ex. « recherches : nom + condamné, mis en examen, enquête, procès, relaxe »).
- Rédaction strictement neutre : verbes juridiques exacts (« mis en examen pour », « condamné en première
  instance à », « relaxé »), pas d'adjectifs, pas de jugement. Ne jamais écrire « coupable » pour une décision
  non définitive.
- Valider avec : python3 scripts/build_data.py --check (statuts autorisés, au moins une source par affaire).

## Mise à jour
- Vérifier régulièrement le dernier état des affaires en cours (enquete, mise_en_examen, renvoi_proces,
  condamnation_non_definitive) et des recours dont l'issue n'est pas connue (signalés dans "resume" ou "notes").
- Une personne non identifiée avec certitude (homonymes) n'a pas de fiche : le site affiche « Non vérifié ».
