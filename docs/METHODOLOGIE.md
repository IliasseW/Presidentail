# Méthodologie — collecte des programmes

Ce document décrit le format des fiches de `data/2027/` et `data/2022/` et les règles suivies pour les remplir.
Première collecte : 12 octobre 2026.

## Objectif
Pour chaque candidat assigné, recenser TOUTES ses propositions programmatiques connues pour 2027, point par point,
classées dans les thèmes ci-dessous, pour alimenter un comparateur en ligne.

## Thèmes (utiliser EXACTEMENT ces identifiants)
- economie         : Économie, entreprises, fiscalité, industrie, commerce
- finances_publiques : Dette, déficit, dépenses publiques, impôts de l'État (vue budgétaire)
- travail_retraites : Travail, emploi, chômage, retraites
- pouvoir_achat    : Salaires, prix, pouvoir d'achat, énergie au quotidien
- sante            : Santé, hôpital, médecine, dépendance/grand âge
- education        : École, enseignement supérieur, jeunesse
- securite_justice : Sécurité, police, justice, prisons
- immigration      : Immigration, asile, nationalité, intégration
- ecologie_energie : Climat, environnement, énergie (nucléaire, renouvelables), transports
- agriculture      : Agriculture, alimentation, pêche, ruralité agricole
- institutions     : Institutions, démocratie, RIC, mode de scrutin, décentralisation
- europe_international : Union européenne, politique étrangère, commerce international
- defense          : Défense, armées, OTAN, Ukraine/conflits
- logement         : Logement, urbanisme
- social           : Protection sociale, famille, handicap, pauvreté, égalité femmes-hommes
- numerique_recherche : Numérique, IA, recherche, innovation
- culture_medias   : Culture, médias, audiovisuel public, sport
- territoires      : Services publics, outre-mer, ruralité, transports locaux
- societe          : Laïcité, fin de vie, droits, mœurs, cultes

## Règles
1. N'inventer AUCUNE proposition. Chaque proposition doit être adossée à une source consultée (URL).
2. Sources prioritaires : site officiel du candidat/parti (programme, livre-programme, "projet"), puis grands médias
   (Le Monde, Les Échos, Le Figaro, Libération, franceinfo, LCP, Public Sénat, Ouest-France, BFM, AFP),
   puis comparateurs (Fondation IFRAP ifrap.org/comparateurs/presidentielles-2027, Institut Montaigne, etc.).
   Éviter les sites agrégateurs anonymes comme source unique (votons-2027.fr, monvote2027.fr, france-vote.fr,
   candidats2027.org, elyseescope.com…) : utilisables pour trouver des pistes, mais vérifier ailleurs.
3. Ne retenir que des propositions formulées pour 2027 (ou réaffirmées depuis 2025). Une proposition d'une
   campagne antérieure (2022) n'est admise que si elle a été explicitement reprise depuis 2025 — sinon l'exclure.
4. Champ "nature" : "programme" (document programmatique officiel), "declaration" (interview, discours, tribune,
   meeting), "livre" (ouvrage du candidat).
5. Formulation : "titre" court et neutre (≤ 90 caractères, verbe à l'infinitif quand possible, ex. "Abaisser l'âge de
   départ à la retraite à 60 ans"), "detail" 1-2 phrases factuelles avec chiffres si disponibles. Pas de jugement.
6. Si un candidat n'a quasiment rien publié, le dire dans "programme.statut" et "notes" plutôt que remplir.
7. Viser l'exhaustivité raisonnable pour les candidats majeurs (souvent 30-80 propositions), quelques-unes pour les petits.

## Format : un fichier JSON PAR candidat, dans
data/2027/<slug>.json
(slug = nom en minuscules sans accents, tirets, ex. "jean-luc-melenchon")

{
  "slug": "jean-luc-melenchon",
  "nom": "Jean-Luc Mélenchon",
  "parti": "La France insoumise",
  "bord": "gauche radicale",            // extreme-gauche | gauche-radicale | gauche | ecologiste | centre | droite | extreme-droite | souverainiste | divers
  "statut_candidature": "declare",      // declare | primaire | pressenti | retire
  "date_declaration": "2026-05-03",     // ou null
  "programme": {
    "statut": "complet",                // complet | partiel | aucun
    "titre": "L'Avenir en commun (version 2027)",  // ou null
    "url": "https://...",               // ou null
    "date_publication": "2026-..."      // ou null
  },
  "propositions": [
    {
      "theme": "travail_retraites",
      "titre": "Abaisser l'âge légal de départ à la retraite à 60 ans",
      "detail": "Retour à 60 ans avec 40 annuités.",
      "nature": "programme",
      "source_url": "https://...",
      "source_date": "2026-06-01"       // date de la source si connue, sinon null
    }
  ],
  "sources_consultees": ["https://..."],
  "notes": "Remarques utiles (ex. incertitudes, programme annoncé pour janvier 2027...)",
  "verifie_le": "2026-10-12"
}

Le JSON doit être valide (pas de commentaires dans le vrai fichier). Vérifier avec : python3 scripts/build_data.py --check

## Programmes de 2022 (data/2022/)

Même format et mêmes thèmes, avec ces différences :
- On collecte le programme présenté pour la présidentielle d'avril 2022 (ou, pour une candidature non qualifiée
  ou une primaire, le projet présenté pendant la campagne 2021-2022). La règle 3 ne s'applique pas.
- Sources prioritaires : document programme officiel 2022 (y compris via web.archive.org), puis comparateurs
  de presse de 2022, puis Wikipédia uniquement pour le résultat électoral.
- Champs supplémentaires : "annee": 2022, "resultat" (ex. « 1er tour : 21,95 % (3e) »),
  "statut_candidature" : "candidat" (qualifié au 1er tour) | "non_qualifie" | "primaire".
- Même slug que la fiche 2027, pour pouvoir comparer un candidat avec lui-même.

## Mise à jour

1. Modifier ou ajouter la fiche dans data/<année>/ (conserver les propositions existantes, ajouter les nouvelles,
   mettre à jour programme, statut_candidature, notes et verifie_le).
2. Lancer python3 scripts/build_data.py, qui valide les fiches et régénère data/programmes.json.
