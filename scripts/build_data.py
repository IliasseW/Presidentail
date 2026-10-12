"""Valide les fiches de data/<année>/*.json et les assemble dans data/programmes.json pour le site.

Usage : python3 scripts/build_data.py [--check]
  --check : valide seulement, sans écrire (code de sortie 1 en cas d'erreur).
"""
import glob
import json
import os
import sys

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


def main():
    check_only = "--check" in sys.argv
    all_cands, all_errors, all_warnings = [], [], []
    for year in YEARS:
        cands, errors, warnings = load(year)
        all_cands += cands
        all_errors += errors
        all_warnings += warnings
        print(f"{year} : {len(cands)} fiches, {sum(len(c['propositions']) for c in cands)} propositions")
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
    }
    with open(os.path.join(DATA, "programmes.json"), "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
    print("data/programmes.json écrit")


if __name__ == "__main__":
    main()
