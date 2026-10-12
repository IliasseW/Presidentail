"""Valide les fiches de data/<année>/*.json et les assemble dans data/programmes.json pour le site.

Usage : python3 scripts/build_data.py [--check]
  --check : valide seulement, sans écrire (code de sortie 1 en cas d'erreur).
"""
import glob
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
YEARS = ["2027", "2022"]

# Thèmes et sujets (sous-thèmes) : data/themes.json. Le sujet sert à aligner, ligne par ligne,
# les propositions de candidats différents qui portent sur la même question.
THEMES = json.load(open(os.path.join(DATA, "themes.json"), encoding="utf-8"))
SUJETS = {t["id"]: {s["id"] for s in t["sujets"]} for t in THEMES}
THEME_IDS = set(SUJETS)
NATURES = {"programme", "declaration", "livre"}
STATUT_ORDRE = {"declare": 0, "candidat": 0, "primaire": 1, "non_qualifie": 2, "pressenti": 2, "retire": 3}

# Champs conservés dans le fichier publié (le reste reste dans les fiches sources).
CAND_FIELDS = ["slug", "nom", "parti", "bord", "statut_candidature", "date_declaration",
               "programme", "resultat", "notes", "verifie_le"]
PROP_FIELDS = ["theme", "sujet", "titre", "detail", "nature", "source_url", "source_date"]


def load(year):
    errors, warnings, cands = [], [], []
    for path in sorted(glob.glob(os.path.join(DATA, year, "*.json"))):
        name = f"{year}/{os.path.basename(path)}"
        try:
            c = json.load(open(path, encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{name}: JSON invalide ({e})")
            continue
        for field in ("slug", "nom", "propositions"):
            if field not in c:
                errors.append(f"{name}: champ « {field} » manquant")
        if c.get("slug") and c["slug"] + ".json" != os.path.basename(path):
            errors.append(f"{name}: slug « {c['slug']} » différent du nom de fichier")
        props = []
        for i, p in enumerate(c.get("propositions", [])):
            where = f"{name} #{i} « {p.get('titre', '')[:40]} »"
            if p.get("theme") not in THEME_IDS:
                errors.append(f"{where}: thème inconnu {p.get('theme')!r}")
                continue
            if not p.get("titre"):
                errors.append(f"{where}: titre vide")
                continue
            if not str(p.get("source_url", "")).startswith("http"):
                errors.append(f"{where}: source_url manquante")
                continue
            if p.get("nature") not in NATURES:
                warnings.append(f"{where}: nature inconnue {p.get('nature')!r}")
            if p.get("sujet") not in SUJETS[p["theme"]]:
                warnings.append(f"{where}: sujet {p.get('sujet')!r} absent du thème {p['theme']}, classé dans « autre »")
                p = {**p, "sujet": "autre"}
            if len(p["titre"]) > 90:
                warnings.append(f"{where}: titre de {len(p['titre'])} caractères")
            props.append({k: p.get(k) for k in PROP_FIELDS})
        out = {k: c.get(k) for k in CAND_FIELDS}
        out["annee"] = int(year)
        out["propositions"] = props
        cands.append(out)
    cands.sort(key=lambda c: (STATUT_ORDRE.get(c.get("statut_candidature"), 9),
                              -len(c["propositions"]), c["nom"]))
    return cands, errors, warnings


STATUTS_AFFAIRE = {"enquete", "mise_en_examen", "renvoi_proces", "condamnation_non_definitive",
                   "condamnation_definitive", "relaxe", "non_lieu", "classement", "prescription", "autre"}


def load_affaires(slugs):
    """Affaires judiciaires, une fiche par personne (data/affaires/<slug>.json), valables pour toutes les années."""
    errors, out = [], {}
    for path in sorted(glob.glob(os.path.join(DATA, "affaires", "*.json"))):
        name = f"affaires/{os.path.basename(path)}"
        try:
            a = json.load(open(path, encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{name}: JSON invalide ({e})")
            continue
        if a.get("slug") not in slugs:
            errors.append(f"{name}: aucune fiche candidat pour le slug {a.get('slug')!r}")
            continue
        for i, af in enumerate(a.get("affaires", [])):
            where = f"{name} #{i} « {af.get('intitule', '')[:40]} »"
            if af.get("statut") not in STATUTS_AFFAIRE:
                errors.append(f"{where}: statut inconnu {af.get('statut')!r}")
            if not af.get("sources") or not all(str(s.get("url", "")).startswith("http") for s in af["sources"]):
                errors.append(f"{where}: chaque affaire doit avoir au moins une source avec une URL")
        out[a["slug"]] = {k: a.get(k) for k in ("affaires", "aucune_affaire_trouvee", "notes", "verifie_le")}
    return out, errors


# ---------- réseau des liens (data/reseau/) ----------
TYPES_PARCOURS = {"gouvernement", "parti", "alliance", "election", "mouvement", "entreprise", "media", "formation",
                  "haute_fonction_publique", "think_tank", "association", "autre"}
TYPES_RELATION = {"collaborateur", "soutien", "rupture", "rival", "nomination", "succession", "famille", "couple",
                  "professionnel", "financement"}
PRESIDENTS = {"francois-mitterrand": "François Mitterrand", "jacques-chirac": "Jacques Chirac",
              "nicolas-sarkozy": "Nicolas Sarkozy", "francois-hollande": "François Hollande",
              "emmanuel-macron": "Emmanuel Macron"}


def build_reseau(cands):
    """Assemble data/reseau/*.json en un graphe {noeuds, liens} pour la page Réseau."""
    errors, warnings = [], []
    rdir = os.path.join(DATA, "reseau")
    orgs = {o["id"]: o for o in json.load(open(os.path.join(rdir, "organisations.json"), encoding="utf-8"))}
    # Fiches par personne (data/reseau/<slug>.json) et fiches thématiques du réseau étendu
    # (data/reseau/etendu/<theme>.json, où chaque entrée nomme sa personne).
    fiches = []
    for path in sorted(glob.glob(os.path.join(rdir, "*.json")) + glob.glob(os.path.join(rdir, "etendu", "*.json"))):
        if os.path.basename(path) == "organisations.json":
            continue
        try:
            fiches.append(json.load(open(path, encoding="utf-8")))
        except json.JSONDecodeError as e:
            errors.append(f"reseau/{os.path.basename(path)}: JSON invalide ({e})")
    for f in fiches:
        for o in f.get("organisations_nouvelles") or []:
            orgs.setdefault(o["id"], o)

    # Personnes : candidats 2027 d'abord, puis personnalités citées.
    personnes = {c["slug"]: {"id": c["slug"], "nom": c["nom"], "genre": "candidat", "parti": c.get("parti"),
                             "bord": c.get("bord"), "statut": c.get("statut_candidature")} for c in cands}
    for f in fiches:
        for p in f.get("personnes_nouvelles") or []:
            if p["slug"] not in personnes:
                genre = p.get("genre") if p.get("genre") in ("acteur", "personnalite") else "personnalite"
                personnes[p["slug"]] = {"id": p["slug"], "nom": p["nom"], "genre": genre,
                                        "description": p.get("description")}
    for slug, nom in PRESIDENTS.items():
        personnes.setdefault(slug, {"id": slug, "nom": nom, "genre": "personnalite",
                                    "description": "Président de la République"})

    liens, vus = [], set()
    for f in fiches:
        nom_fiche = f.get("slug") or "étendu"
        if f.get("slug") and f["slug"] not in personnes:
            errors.append(f"reseau/{nom_fiche} : slug inconnu")
            continue
        for e in f.get("parcours") or []:
            src = e.get("personne") or f.get("slug")
            if src not in personnes:
                errors.append(f"reseau/{nom_fiche} : personne inconnue {src!r} (à déclarer dans personnes_nouvelles)")
                continue
            if e.get("organisation") not in orgs:
                errors.append(f"reseau/{nom_fiche} : organisation inconnue {e.get('organisation')!r}")
                continue
            if e.get("type") not in TYPES_PARCOURS:
                warnings.append(f"reseau/{nom_fiche} : type de parcours inconnu {e.get('type')!r}")
            liens.append({"source": src, "cible": e["organisation"], "nature": "parcours", "type": e.get("type"),
                          "role": e.get("role"), "debut": e.get("debut"), "fin": e.get("fin"),
                          "source_url": e.get("source_url")})
        for r in f.get("relations") or []:
            src, cible = r.get("source") or f.get("slug"), r.get("cible")
            if r.get("type") not in TYPES_RELATION:
                errors.append(f"reseau/{nom_fiche} : type de relation inconnu {r.get('type')!r}")
                continue
            if src not in personnes:
                errors.append(f"reseau/{nom_fiche} : personne inconnue {src!r} (à déclarer dans personnes_nouvelles)")
                continue
            if cible not in personnes:
                personnes[cible] = {"id": cible, "nom": r.get("cible_nom") or cible, "genre": "personnalite"}
            # Une relation déclarée des deux côtés n'est gardée qu'une fois.
            cle = (tuple(sorted((src, cible))), r["type"], (r.get("date") or "")[:4])
            if cle in vus:
                continue
            vus.add(cle)
            liens.append({"source": src, "cible": cible, "nature": "relation", "type": r["type"],
                          "description": r.get("description"), "date": r.get("date"),
                          "source_url": r.get("source_url")})
    # Candidat sans fiche de réseau : rattaché au moins à son parti, d'après sa fiche programme.
    avec_fiche = {f.get("slug") for f in fiches}
    for c in cands:
        # « Sans étiquette » n'est pas une organisation : la rattacher créerait de faux liens.
        if c["slug"] in avec_fiche or not c.get("parti") or re.search(r"sans [ée]tiquette|apartisan|ind[ée]pendant", c["parti"], re.I):
            continue
        oid = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFD", c["parti"]).encode("ascii", "ignore").decode().lower()).strip("-")
        orgs.setdefault(oid, {"id": oid, "nom": c["parti"], "type": "parti"})
        liens.append({"source": c["slug"], "cible": oid, "nature": "parcours", "type": "parti", "role": "Candidat 2027",
                      "source_url": (c.get("programme") or {}).get("url")})
    # Le président qui a nommé chaque gouvernement.
    for o in orgs.values():
        if o.get("type") == "gouvernement" and o.get("president") in personnes:
            liens.append({"source": o["president"], "cible": o["id"], "nature": "parcours", "type": "gouvernement",
                          "role": "Président de la République", "debut": o.get("debut"), "fin": o.get("fin")})

    utilises = {l["cible"] for l in liens} | {l["source"] for l in liens}
    noeuds = list(personnes.values()) + [{**o, "genre": "organisation"} for o in orgs.values() if o["id"] in utilises]
    return {"noeuds": noeuds, "liens": liens}, errors, warnings


def main():
    check_only = "--check" in sys.argv
    all_cands, all_errors, all_warnings = [], [], []
    for year in YEARS:
        cands, errors, warnings = load(year)
        all_cands += cands
        all_errors += errors
        all_warnings += warnings
        print(f"{year} : {len(cands)} fiches, {sum(len(c['propositions']) for c in cands)} propositions")
    affaires, errors = load_affaires({c["slug"] for c in all_cands})
    all_errors += errors
    print(f"affaires : {len(affaires)} fiches, {sum(len(a['affaires'] or []) for a in affaires.values())} affaires")
    reseau, errors, warnings = build_reseau([c for c in all_cands if c["annee"] == 2027])
    all_errors += errors
    all_warnings += warnings
    print(f"réseau : {len(reseau['noeuds'])} nœuds, {len(reseau['liens'])} liens")
    for w in all_warnings:
        print("avertissement :", w)
    for e in all_errors:
        print("ERREUR :", e)
    if all_errors:
        sys.exit(1)
    if check_only:
        return
    bundle = {
        # Date de la vérification la plus récente : déterministe, pour que la CI puisse comparer.
        "genere_le": max((c.get("verifie_le") or "" for c in all_cands), default=""),
        "themes": THEMES,
        "candidats": all_cands,
        "affaires": affaires,
    }
    with open(os.path.join(DATA, "programmes.json"), "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(DATA, "reseau.json"), "w", encoding="utf-8") as f:
        json.dump({"genere_le": bundle["genere_le"], **reseau}, f, ensure_ascii=False, separators=(",", ":"))
    print("data/programmes.json et data/reseau.json écrits")


if __name__ == "__main__":
    main()
