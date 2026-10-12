# Méthodologie — réseau des liens

Première collecte : 12 octobre 2026. Assemblé par scripts/build_data.py dans data/reseau.json, affiché par reseau.html.

Objectif : construire un graphe des liens politiques et professionnels entre les candidats à la présidentielle 2027
(et les personnalités qui les relient), pour un site de comparaison. Les nœuds sont des personnes et des
organisations (gouvernements, partis, alliances, élections) ; chaque lien est daté et sourcé.

## Organisations
La liste de référence est dans data/reseau/organisations.json.
Utilise EXACTEMENT ces identifiants. Si une organisation manque (autre parti, gouvernement antérieur ou de 2026,
cabinet, institution comme « Assemblée nationale » n'est PAS utile), déclare-la dans "organisations_nouvelles"
avec un identifiant en minuscules-tirets (convention : gouvernement-<nom du Premier ministre>, nom du parti…).
Les gouvernements sont regroupés par Premier ministre (Fillon I, II, III = gouvernement-fillon).

## Ce qu'on recense pour chaque personne assignée
1. "parcours" : appartenances aux organisations
   - type "gouvernement" : chaque poste au gouvernement (role = intitulé du poste : « Premier ministre »,
     « Ministre de l'Éducation nationale », « Secrétaire d'État chargé de… », « Porte-parole du gouvernement »)
   - type "parti" : adhésion et départ d'un parti (role « Membre », « Président », « Premier secrétaire »,
     « Secrétaire national », « Porte-parole », « Fondateur »…), avec dates de début et de fin si connues
   - type "alliance" / "election" : candidature ou participation notable (ex. « Candidat », « Candidate au 2nd tour »)
   Une entrée par fonction significative ; pas besoin de lister chaque mandat local.
2. "relations" : liens DIRECTS avec d'autres personnes, uniquement politiques ou professionnels et publics :
   - "collaborateur" : a été conseiller, collaborateur parlementaire, directeur de cabinet, directeur ou porte-parole
     de campagne de la cible (ou l'inverse : préciser dans la description)
   - "soutien" : a soutenu publiquement la cible lors d'une élection, d'une primaire ou d'un congrès
   - "rupture" : rupture publique, départ fracassant, exclusion par la cible
   - "rival" : affrontement direct (primaire, congrès, second tour, duel électoral)
   - "nomination" : a été nommé par la cible (ex. Premier ministre nommé par le président) ou l'a nommée
   - "succession" : a succédé à la cible à un poste (ou l'inverse)
   - "famille" : lien familial UNIQUEMENT entre deux personnalités politiques publiques (ex. père/fille dirigeants
     d'un même parti). Jamais de conjoints, compagnons, enfants non publics ou vie privée.
   La cible peut être un autre candidat 2027 (utiliser son slug, liste ci-dessous) ou une personnalité non
   candidate (Emmanuel Macron, Nicolas Sarkozy, Jean-Marie Le Pen, François Bayrou, Jordan Bardella…) : slug =
   prénom-nom en minuscules sans accents. Privilégier les personnalités qui relient plusieurs candidats.
   Ne pas créer de relation « même gouvernement » ou « même parti » : elle se déduit du parcours.
3. Chaque entrée de parcours et chaque relation a une "source_url" (fiche Wikipédia, site officiel du
   gouvernement ou du parti, grand média). Wikipédia est acceptée ici pour les faits biographiques.

## Slugs des candidats et personnalités 2027 (utiliser ces slugs comme "cible")
anasse-kazib, antoine-mikolajczak, benoit-mathieu, bernard-cazeneuve, bruno-le-maire, bruno-retailleau, clara-egger,
david-lisnard, delphine-batho, dominique-de-villepin, edouard-philippe, elisabeth-borne, emmanuel-maurel, eric-zemmour,
fabien-roussel, florian-philippot, francis-lalanne, francois-asselineau, francois-hollande, francois-ruffin,
gabriel-attal, jean-francois-legendre, jean-lassalle, jean-luc-melenchon, jerome-guedj, juan-branco, karim-bouamrane,
manolo-mlekuz, marine-le-pen, marine-tondelier, nathalie-arthaud, nicolas-dupont-aignan, olivier-becht, olivier-faure,
raphael-glucksmann, segolene-royal, selma-labib, sylvain-pierre-durif, xavier-bertrand

## Format : un fichier JSON par personne dans data/reseau/<slug>.json
{
  "slug": "gabriel-attal",
  "nom": "Gabriel Attal",
  "parcours": [
    {"organisation": "gouvernement-attal", "type": "gouvernement", "role": "Premier ministre",
     "debut": "2024-01", "fin": "2024-09", "source_url": "https://..."}
  ],
  "relations": [
    {"cible": "emmanuel-macron", "cible_nom": "Emmanuel Macron", "type": "nomination",
     "description": "Nommé Premier ministre par Emmanuel Macron le 9 janvier 2024.",
     "date": "2024-01", "source_url": "https://..."}
  ],
  "organisations_nouvelles": [
    {"id": "gouvernement-lecornu-2", "nom": "...", "type": "gouvernement", "president": "emmanuel-macron", "debut": "2025-10", "fin": null}
  ],
  "personnes_nouvelles": [
    {"slug": "emmanuel-macron", "nom": "Emmanuel Macron", "description": "Président de la République depuis 2017"}
  ],
  "notes": "Incertitudes éventuelles.",
  "verifie_le": "2026-10-12"
}
- Dates au format AAAA, AAAA-MM ou AAAA-MM-JJ ; "fin": null si en cours.
- Toute personne citée en "cible" qui n'est pas un candidat 2027 doit figurer dans "personnes_nouvelles".
- Descriptions factuelles et neutres, une phrase. Aucune relation inventée ou supposée.
- Valider chaque JSON avec : python3 -c "import json,sys;json.load(open(sys.argv[1]))" <fichier>


## Réseau étendu (acteurs non politiques)

Objectif : étendre le graphe des liens entre candidats à la présidentielle 2027 aux acteurs non directement
politiques (formation, haute fonction publique, entreprises, finance, médias, familles de personnalités publiques),
pour que l'on puisse découvrir des chaînes du type « candidat → entreprise → patron → média → autre responsable ».

### Règles de protection (impératives)
- Seules des PERSONNALITÉS PUBLIQUES sont des nœuds : responsables politiques, dirigeants ou propriétaires
  d'entreprises connues, journalistes et éditorialistes, hauts fonctionnaires nommés, intellectuels connus.
- Liens familiaux ou de couple ("famille", "couple") : UNIQUEMENT entre deux personnalités publiques, et seulement
  si le lien est largement rapporté par plusieurs grands médias. Jamais d'enfants (mineurs ou non publics), de
  conjoints non publics, ni de personnes privées, même pour relier deux familles. Pas de rumeurs ni de relations
  supposées, passées non confirmées ou intimes.
- Pas d'« amitiés » ou de « proximités » vagues : un lien doit être un fait vérifiable (poste occupé, actionnariat,
  promotion d'école, don déclaré, contrat, nomination, mariage public, collaboration documentée).
- Formulation neutre et factuelle ; aucune insinuation (ne pas qualifier un lien de « conflit d'intérêts » sauf si
  une source fiable rapporte une procédure ou une décision officielle en ce sens).
- Sources : grands médias, sites officiels (entreprises, Légifrance, HATVP, Journal officiel), Wikipédia accepté
  pour les faits biographiques simples. Une source_url par entrée.

### Types
- parcours.type (personne → organisation) : gouvernement, parti, mouvement, alliance, election, entreprise, media,
  formation, haute_fonction_publique, think_tank, association, autre
  (role : « Associé-gérant », « Directeur général », « Actionnaire principal », « Chroniqueur », « Élève (promotion
  Voltaire, 1980) », « Inspecteur des finances », « Membre du conseil d'administration »…)
- relations.type (personne → personne) : collaborateur, soutien, rupture, rival, nomination, succession, famille,
  couple, professionnel (ont travaillé ensemble / l'un a employé l'autre / associés), financement (don ou
  financement public et documenté)

### Organisations nouvelles : identifiants en minuscules-tirets
Exemples de convention : ena-promotion-voltaire, ena-promotion-senghor, inspection-generale-des-finances,
conseil-d-etat, rothschild-et-cie, groupe-lvmh, groupe-bollore, vivendi, canal-plus-cnews (ou cnews), iliad-free,
groupe-le-monde, altice-bfm, groupe-tf1, cma-cgm, institut-montaigne, fondation-jean-jaures, terra-nova…
Avant d'inventer un identifiant, vérifie s'il existe déjà dans organisations.json ou dans les fichiers déjà
présents dans le dossier reseau-etendu (un autre agent a peut-être créé le même) et réutilise-le.

### Slugs de personnes
Candidats 2027 : voir SPEC_RESEAU.md. Personnalités déjà connues dans le réseau (à réutiliser telles quelles) :
emmanuel-macron, nicolas-sarkozy, jacques-chirac, francois-mitterrand, lionel-jospin, jean-marie-le-pen,
marion-marechal, jordan-bardella, francois-bayrou, francois-fillon, alain-juppe, philippe-de-villiers,
sarah-knafo, michel-barnier, sebastien-lecornu, gerald-darmanin, laurent-wauquiez, eric-ciotti, valerie-pecresse,
jean-marc-ayrault, manuel-bompard, sophia-chikirou, yannick-jadot, charles-pasqua.
Nouvelles personnes : slug = prenom-nom sans accents.

### Format : fichiers thématiques dans data/reseau/etendu/<theme>.json (chaque entrée nomme sa personne)
{
  "personnes_nouvelles": [
    {"slug": "xavier-niel", "nom": "Xavier Niel", "genre": "acteur", "description": "Fondateur d'Iliad (Free), actionnaire du groupe Le Monde"}
  ],
  "organisations_nouvelles": [
    {"id": "iliad-free", "nom": "Iliad (Free)", "type": "entreprise"}
  ],
  "parcours": [
    {"personne": "xavier-niel", "organisation": "iliad-free", "type": "entreprise", "role": "Fondateur",
     "debut": "1990", "fin": null, "source_url": "https://..."}
  ],
  "relations": [
    {"source": "xavier-niel", "cible": "delphine-arnault", "type": "couple",
     "description": "Compagnon de Delphine Arnault, relation publique depuis 2010 ; mariés en 2026 ?",
     "date": "2010", "source_url": "https://..."}
  ],
  "notes": "Incertitudes, liens écartés et pourquoi.",
  "verifie_le": "2026-10-12"
}
- "genre" : "acteur" (non politique) ou "personnalite" (responsable politique non candidat).
- Toute personne citée (en "personne", "source" ou "cible") qui n'est ni candidate ni dans la liste connue
  ci-dessus doit figurer dans "personnes_nouvelles".
- Dates AAAA, AAAA-MM ou AAAA-MM-JJ ; "fin": null si en cours.
- Valider : python3 -c "import json,sys;json.load(open(sys.argv[1]))" <fichier>


## Validation
python3 scripts/build_data.py vérifie que chaque organisation et chaque personne citée existe, et que les types sont connus.
