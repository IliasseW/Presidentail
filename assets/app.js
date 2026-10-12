"use strict";

const STATUT = {
  declare: "Candidature déclarée",
  primaire: "En primaire",
  pressenti: "Non déclaré (pressenti)",
  retire: "Retiré ou battu à la primaire",
  candidat: "Candidat au 1er tour",
  non_qualifie: "Non qualifié pour le 1er tour",
};
const PROGRAMME = {
  complet: "Programme publié",
  partiel: "Programme partiel",
  aucun: "Pas de programme publié",
};
const NATURE = { declaration: "Déclaration", livre: "Livre" };
// Statuts des affaires judiciaires et leur famille (couleur de l'étiquette).
const AFFAIRE = {
  enquete: ["Enquête en cours", "encours"],
  mise_en_examen: ["Mise en examen", "encours"],
  renvoi_proces: ["Renvoyé en procès", "encours"],
  condamnation_non_definitive: ["Condamnation non définitive", "condamne"],
  condamnation_definitive: ["Condamnation définitive", "condamne"],
  relaxe: ["Relaxe", "clos"],
  non_lieu: ["Non-lieu", "clos"],
  classement: ["Classement sans suite", "clos"],
  prescription: ["Prescription", "clos"],
  autre: ["Autre décision ou sanction", "autre"],
};
const PRESOMPTION = "Toute personne est présumée innocente tant qu'une condamnation définitive n'a pas été prononcée. Seules les procédures judiciaires visant personnellement le candidat et rapportées par des sources fiables sont recensées.";
const GROUPS = [
  { titre: "Candidats déclarés 2027", test: (c) => c.annee === 2027 && (c.statut_candidature === "declare" || c.statut_candidature === "primaire") },
  { titre: "Pressentis 2027", test: (c) => c.annee === 2027 && c.statut_candidature === "pressenti" },
  { titre: "Retirés ou battus à la primaire 2027", test: (c) => c.annee === 2027 && c.statut_candidature === "retire" },
  { titre: "Programmes de 2022", test: (c) => c.annee === 2022 },
];

const state = { selected: [], themes: new Set(), query: "" };
let DATA = null;
let BY_KEY = new Map();

const $ = (sel) => document.querySelector(sel);
const keyOf = (c) => `${c.slug}@${c.annee}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return isNaN(d) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
// L'année n'est affichée que pour 2022, ou quand le même candidat est sélectionné pour deux années.
const label = (c) => {
  const twice = state.selected.filter((k) => k.startsWith(`${c.slug}@`)).length > 1;
  return c.annee === 2027 && !twice ? c.nom : `${c.nom} (${c.annee})`;
};
const selectedCands = () => state.selected.map((k) => BY_KEY.get(k));
const visibleThemes = () => DATA.themes.filter((t) => !state.themes.size || state.themes.has(t.id));

function highlight(text) {
  const safe = esc(text);
  if (!state.query) return safe;
  const q = esc(state.query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
}

function matchesQuery(p) {
  if (!state.query) return true;
  const q = fold(state.query);
  return fold(p.titre).includes(q) || fold(p.detail).includes(q);
}

/* ---------- état dans l'URL (lien partageable) ---------- */
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  state.selected = (params.get("c") || "").split(",").filter((k) => BY_KEY.has(k));
  state.themes = new Set((params.get("t") || "").split(",").filter((t) => DATA.themes.some((th) => th.id === t)));
  state.query = params.get("q") || "";
}
function writeHash() {
  const params = new URLSearchParams();
  if (state.selected.length) params.set("c", state.selected.join(","));
  if (state.themes.size) params.set("t", [...state.themes].join(","));
  if (state.query) params.set("q", state.query);
  const h = params.toString().replace(/%40/g, "@").replace(/%2C/g, ",");
  history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
}

/* ---------- filtres ---------- */
function renderSelection() {
  $("#selection").innerHTML = state.selected.map((k) => {
    const c = BY_KEY.get(k);
    return `<li>${esc(label(c))}<button type="button" data-remove="${esc(k)}" aria-label="Retirer ${esc(label(c))}">×</button></li>`;
  }).join("");
}

function renderPicker() {
  const q = fold($("#picker-search").value);
  $("#picker-list").innerHTML = GROUPS.map((g) => {
    const items = DATA.candidats.filter(g.test).filter((c) => !q || fold(c.nom).includes(q) || fold(c.parti).includes(q));
    if (!items.length) return "";
    return `<div class="picker-group"><h3>${esc(g.titre)}</h3>${items.map((c) => {
      const k = keyOf(c);
      const on = state.selected.includes(k);
      return `<button type="button" class="picker-item" data-pick="${esc(k)}" aria-pressed="${on}">
        <span>${on ? "✓ " : ""}${esc(c.nom)}</span><small>${esc(c.parti || "")} · ${c.propositions.length} prop.</small></button>`;
    }).join("")}</div>`;
  }).join("") || `<p class="empty">Aucun résultat.</p>`;
}

function renderThemes() {
  $("#themes").innerHTML = DATA.themes.map((t) =>
    `<button type="button" class="chip" data-theme="${t.id}" aria-pressed="${state.themes.has(t.id)}">${esc(t.libelle)}</button>`
  ).join("");
  $("#all-themes").setAttribute("aria-pressed", String(state.themes.size === 0));
}

function setPicker(open) {
  $("#picker").hidden = !open;
  $("#open-picker").textContent = open ? "Fermer la liste" : "Ajouter un candidat";
  if (open) $("#picker-search").focus();
}

/* ---------- comparatif ---------- */
function programmeLine(c) {
  const p = c.programme || {};
  const lib = PROGRAMME[p.statut] || "Programme : statut inconnu";
  return p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${lib}</a>` : lib;
}

function statutLine(c) {
  if (c.annee !== 2027 && c.resultat) return c.resultat;
  const s = STATUT[c.statut_candidature] || c.statut_candidature || "";
  return c.date_declaration && c.annee === 2027 ? `${s} (${fmtDate(c.date_declaration)})` : s;
}

function affaireBadge(statut, n = 1) {
  const [lib, fam] = AFFAIRE[statut] || [statut, "autre"];
  return `<span class="badge st-${fam}">${esc(lib)}${n > 1 ? ` ×${n}` : ""}</span>`;
}

// Résumé court : « 1 condamnation non définitive, 1 relaxe ».
function affairesSummary(c) {
  const a = DATA.affaires?.[c.slug];
  if (!a) return `<span class="none">Non vérifié</span>`;
  if (!a.affaires?.length) return `<span class="none">Aucune procédure recensée</span>`;
  const counts = {};
  a.affaires.forEach((af) => { counts[af.statut] = (counts[af.statut] || 0) + 1; });
  return `<span class="affaires-sum">${Object.entries(counts).map(([st, n]) => affaireBadge(st, n)).join("")}</span>`;
}

function affairesDetail(c) {
  const a = DATA.affaires?.[c.slug];
  if (!a?.affaires?.length) {
    return affairesSummary(c) + (a?.notes ? `<details><summary>Précisions</summary><p>${esc(a.notes)}</p></details>` : "");
  }
  return `${affairesSummary(c)}
    <details><summary>Détail des ${a.affaires.length} procédure${a.affaires.length > 1 ? "s" : ""}</summary>
    <ul class="affaires">${a.affaires.map((af) => `<li>
      <div class="prop-title">${esc(af.intitule)}</div>
      <div class="prop-meta">${affaireBadge(af.statut)}${af.qualification ? `<span>${esc(af.qualification)}</span>` : ""}${af.date_derniere_etape ? `<span>${fmtDate(af.date_derniere_etape)}</span>` : ""}</div>
      ${af.resume ? `<p class="prop-detail">${esc(af.resume)}</p>` : ""}
      <div class="prop-meta">${(af.sources || []).map((src) => `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.media || "Source")}</a>`).join("")}</div>
    </li>`).join("")}</ul>${a.notes ? `<p class="prop-detail">${esc(a.notes)}</p>` : ""}</details>`;
}

// Bandeau collant : un en-tête par candidat, aligné sur les colonnes du comparatif.
function renderCompareHead(cols) {
  $("#compare-head").style.setProperty("--n", cols.length);
  $("#compare-head").innerHTML = `<div class="corner">Sujet</div>` + cols.map((c) => `<div class="head-cell">
      <strong>${esc(label(c))}</strong>
      <span>${esc(c.parti || "")}</span>
    </div>`).join("");
}

function renderSynthese(cols, perTheme) {
  const rows = visibleThemes().map((t) => {
    const counts = cols.map((c, i) => perTheme.get(t.id)[i].length);
    if (state.query && counts.every((n) => !n)) return "";
    return `<tr><th scope="row"><a href="#theme-${t.id}">${esc(t.libelle)}</a></th>${counts.map((n) =>
      `<td class="num">${n ? n : `<span class="none" title="Aucune proposition recensée">—</span>`}</td>`).join("")}</tr>`;
  }).join("");
  $("#synthese").innerHTML = `<div class="synthese">
    <h2>Vue d'ensemble</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Candidat</th>${cols.map((c) => `<th>${esc(label(c))}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><th scope="row">Statut</th>${cols.map((c) => `<td>${esc(statutLine(c))}</td>`).join("")}</tr>
        <tr><th scope="row">Programme</th>${cols.map((c) => `<td>${programmeLine(c)}${c.programme?.titre ? `<span class="prog-title">${esc(c.programme.titre)}</span>` : ""}</td>`).join("")}</tr>
        <tr><th scope="row">Réseau</th>${cols.map((c) => `<td><a href="reseau.html#${esc(c.slug)}">Voir ses liens</a></td>`).join("")}</tr>
        <tr><th scope="row">Affaires judiciaires</th>${cols.map((c) => `<td>${affairesDetail(c)}</td>`).join("")}</tr>
        <tr><th scope="row">Notes</th>${cols.map((c) => `<td>${c.notes ? `<details><summary>Incertitudes</summary><p>${esc(c.notes)}</p></details>` : "—"}</td>`).join("")}</tr>
        ${cols.some((c) => c.annee === 2027 && BY_KEY.has(`${c.slug}@2022`)) ? `<tr><th scope="row">2022</th>${cols.map((c) =>
          c.annee === 2027 && BY_KEY.has(`${c.slug}@2022`) && !state.selected.includes(`${c.slug}@2022`)
            ? `<td><button type="button" class="btn btn-ghost btn-small" data-pick="${esc(c.slug)}@2022">Ajouter son programme 2022</button></td>` : "<td></td>").join("")}</tr>` : ""}
      </tbody>
      <tbody class="counts">
        <tr class="subhead"><th scope="row">Propositions par thème</th>${cols.map(() => "<td></td>").join("")}</tr>
        ${rows}
      </tbody>
    </table></div>
    <p class="presomption">${PRESOMPTION}</p>
  </div>`;
}

function renderProp(p) {
  const nature = NATURE[p.nature] ? `<span class="badge badge-nature">${NATURE[p.nature]}</span>` : "";
  const date = p.source_date ? `<span>${fmtDate(p.source_date)}</span>` : "";
  return `<li>
    <div class="prop-title">${highlight(p.titre)}</div>
    ${p.detail ? `<p class="prop-detail">${highlight(p.detail)}</p>` : ""}
    <div class="prop-meta">${nature}<a href="${esc(p.source_url)}" target="_blank" rel="noopener">Source</a>${date}</div>
  </li>`;
}

// Un thème = un tableau : une ligne par sujet, une colonne par candidat.
function renderTheme(t, cols, perCol) {
  const rows = t.sujets.map((s) => {
    const cells = perCol.map((ps) => ps.filter((p) => (p.sujet || "autre") === s.id));
    if (cells.every((ps) => !ps.length)) return "";
    return `<div class="row">
      <div class="sujet">${esc(s.libelle)}</div>
      ${cells.map((ps, i) => `<div class="cell" data-cand="${esc(label(cols[i]))}">${ps.length
        ? `<ul>${ps.map(renderProp).join("")}</ul>`
        : `<p class="none">Aucune proposition recensée</p>`}</div>`).join("")}
    </div>`;
  }).join("");
  if (!rows) return "";
  return `<section class="theme-section" id="theme-${t.id}">
    <h2>${esc(t.libelle)}</h2>
    <div class="theme-table" style="--n: ${cols.length}">${rows}</div>
  </section>`;
}

function renderCompare() {
  const cols = selectedCands();
  $("#compare").hidden = !cols.length;
  $("#overview").hidden = cols.length > 0;
  if (!cols.length) return;
  const perTheme = new Map(DATA.themes.map((t) => [t.id, cols.map((c) => c.propositions.filter((p) => p.theme === t.id && matchesQuery(p)))]));
  renderCompareHead(cols);
  renderSynthese(cols, perTheme);
  const html = visibleThemes().map((t) => renderTheme(t, cols, perTheme.get(t.id))).join("");
  $("#results").innerHTML = (cols.length === 1 ? `<p class="hint">Ajoutez un deuxième candidat pour comparer leurs propositions sujet par sujet.</p>` : "")
    + (html || `<p class="empty">Aucune proposition ne correspond à ces filtres.</p>`);
}

function renderOverview() {
  const table = (titre, rows, showResult) => `<div class="overview"><h2>${titre}</h2><div class="table-scroll"><table>
    <thead><tr><th>Candidat</th><th>Parti</th><th>${showResult ? "Résultat" : "Statut"}</th><th>Programme</th><th class="num">Propositions</th><th>Affaires judiciaires</th></tr></thead>
    <tbody>${rows.map((c) => `<tr>
      <td><button type="button" class="link" data-pick="${esc(keyOf(c))}">${esc(c.nom)}</button></td>
      <td>${esc(c.parti || "")}</td>
      <td>${esc(showResult ? c.resultat || "" : STATUT[c.statut_candidature] || "")}</td>
      <td>${programmeLine(c)}</td>
      <td class="num">${c.propositions.length}</td>
      <td>${affairesSummary(c)}</td></tr>`).join("")}</tbody></table></div></div>`;
  const y2027 = DATA.candidats.filter((c) => c.annee === 2027);
  const y2022 = DATA.candidats.filter((c) => c.annee === 2022);
  $("#overview").innerHTML = `<p class="hint">Cliquez sur un nom pour l'ajouter au comparatif.</p>`
    + table("Tous les candidats 2027", y2027, false) + (y2022.length ? table("Programmes de 2022", y2022, true) : "")
    + `<p class="presomption">${PRESOMPTION}</p>`;
}

function render() {
  renderSelection();
  renderPicker();
  renderThemes();
  renderCompare();
  writeHash();
}

/* ---------- interactions ---------- */
function toggle(k) {
  const i = state.selected.indexOf(k);
  if (i >= 0) state.selected.splice(i, 1);
  else state.selected.push(k);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-pick],[data-remove],[data-theme]");
  if (!t) return;
  if (t.dataset.pick) {
    const fromPicker = t.classList.contains("picker-item");
    toggle(t.dataset.pick);
    // Dès que deux candidats sont choisis, on referme la liste pour laisser la place au comparatif.
    if (fromPicker && state.selected.length >= 2) setPicker(false);
    render();
    if (!fromPicker || state.selected.length >= 2) $("#compare").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (t.dataset.remove) {
    toggle(t.dataset.remove);
    render();
  } else if (t.dataset.theme) {
    const id = t.dataset.theme;
    state.themes.has(id) ? state.themes.delete(id) : state.themes.add(id);
    render();
  }
});

async function init() {
  $("#open-picker").addEventListener("click", () => setPicker($("#picker").hidden));
  $("#picker-search").addEventListener("input", renderPicker);
  $("#all-themes").addEventListener("click", () => { state.themes.clear(); render(); });
  let timer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.query = e.target.value.trim(); renderCompare(); writeHash(); }, 150);
  });

  try {
    const res = await fetch("data/programmes.json");
    DATA = await res.json();
  } catch (err) {
    $("#overview").innerHTML = `<p class="empty">Impossible de charger les données (${esc(err.message)}). Servez le site via HTTP, par exemple : python3 -m http.server</p>`;
    return;
  }
  BY_KEY = new Map(DATA.candidats.map((c) => [keyOf(c), c]));
  $("#data-date").textContent = `Données mises à jour le ${fmtDate(DATA.genere_le)}.`;
  readHash();
  $("#search").value = state.query;
  renderOverview();
  render();
}

init();
