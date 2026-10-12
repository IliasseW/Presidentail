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

function highlight(text) {
  const safe = esc(text);
  if (!state.query) return safe;
  const q = state.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${esc(q)})`, "gi"), "<mark>$1</mark>");
}

function matches(p) {
  if (state.themes.size && !state.themes.has(p.theme)) return false;
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
  const h = params.toString();
  history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
}

/* ---------- rendu ---------- */
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
      return `<button type="button" class="picker-item" data-toggle="${esc(k)}" aria-pressed="${on}">
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

function programmeLine(c) {
  const p = c.programme || {};
  const lib = PROGRAMME[p.statut] || "Programme : statut inconnu";
  const head = p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${lib}</a>` : lib;
  return p.titre ? `${head}<span class="prog-title">${esc(p.titre)}</span>` : head;
}

function renderCards() {
  $("#cards").innerHTML = state.selected.map((k) => {
    const c = BY_KEY.get(k);
    const statut = c.annee === 2022 && c.resultat ? c.resultat : STATUT[c.statut_candidature] || c.statut_candidature || "";
    return `<article class="card">
      <h3>${esc(c.nom)} <span class="badge badge-year">${c.annee}</span></h3>
      <p class="meta">${esc(c.parti || "")}</p>
      <dl>
        <dt>Statut</dt><dd>${esc(statut)}${c.date_declaration && c.annee === 2027 ? ` (${fmtDate(c.date_declaration)})` : ""}</dd>
        <dt>Programme</dt><dd>${programmeLine(c)}</dd>
        <dt>Propositions</dt><dd>${c.propositions.length}</dd>
      </dl>
      ${c.annee === 2027 && BY_KEY.has(`${c.slug}@2022`) && !state.selected.includes(`${c.slug}@2022`)
        ? `<button type="button" class="btn btn-ghost btn-small" data-toggle="${esc(c.slug)}@2022">Comparer avec son programme 2022</button>` : ""}
      ${c.notes ? `<details><summary>Notes et incertitudes</summary><p>${esc(c.notes)}</p></details>` : ""}
    </article>`;
  }).join("");
}

function renderResults() {
  const el = $("#results");
  if (!state.selected.length) { el.innerHTML = ""; return; }
  const cols = state.selected.map((k) => BY_KEY.get(k));
  const themes = DATA.themes.filter((t) => !state.themes.size || state.themes.has(t.id));
  const html = themes.map((t) => {
    const perCol = cols.map((c) => c.propositions.filter((p) => p.theme === t.id && matches(p)));
    if (perCol.every((ps) => !ps.length)) return "";
    const grid = cols.map((c, i) => `<div class="col">
        <div class="col-head">${esc(label(c))}</div>
        ${perCol[i].length ? `<ul>${perCol[i].map(renderProp).join("")}</ul>` : `<p class="empty">Aucune proposition recensée sur ce thème.</p>`}
      </div>`).join("");
    return `<section class="theme-section"><h2>${esc(t.libelle)}</h2>
      <div class="theme-scroll"><div class="theme-grid" style="--n: ${cols.length}">${grid}</div></div></section>`;
  }).join("");
  el.innerHTML = html || `<p class="empty">Aucune proposition ne correspond à ces filtres.</p>`;
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

function renderOverview() {
  const table = (titre, rows, showResult) => `<div class="overview"><h2>${titre}</h2><div class="table-scroll"><table>
    <thead><tr><th>Candidat</th><th>Parti</th><th>${showResult ? "Résultat" : "Statut"}</th><th>Programme</th><th class="num">Propositions</th></tr></thead>
    <tbody>${rows.map((c) => `<tr>
      <td><button type="button" data-toggle="${esc(keyOf(c))}">${esc(c.nom)}</button></td>
      <td>${esc(c.parti || "")}</td>
      <td>${esc(showResult ? c.resultat || "" : STATUT[c.statut_candidature] || "")}</td>
      <td>${programmeLine(c)}</td>
      <td class="num">${c.propositions.length}</td></tr>`).join("")}</tbody></table></div></div>`;
  const y2027 = DATA.candidats.filter((c) => c.annee === 2027);
  const y2022 = DATA.candidats.filter((c) => c.annee === 2022);
  $("#overview").innerHTML = table("Tous les candidats 2027", y2027, false) + (y2022.length ? table("Programmes de 2022", y2022, true) : "");
}

function render() {
  renderSelection();
  renderPicker();
  renderThemes();
  renderCards();
  renderResults();
  writeHash();
}

/* ---------- interactions ---------- */
function toggle(k) {
  const i = state.selected.indexOf(k);
  if (i >= 0) state.selected.splice(i, 1);
  else state.selected.push(k);
  render();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-toggle],[data-remove],[data-theme]");
  if (!t) return;
  if (t.dataset.toggle) toggle(t.dataset.toggle);
  else if (t.dataset.remove) toggle(t.dataset.remove);
  else if (t.dataset.theme) {
    const id = t.dataset.theme;
    state.themes.has(id) ? state.themes.delete(id) : state.themes.add(id);
    render();
  }
});

async function init() {
  $("#open-picker").addEventListener("click", () => {
    const p = $("#picker");
    p.hidden = !p.hidden;
    $("#open-picker").textContent = p.hidden ? "Ajouter un candidat" : "Fermer la liste";
    if (!p.hidden) $("#picker-search").focus();
  });
  $("#picker-search").addEventListener("input", renderPicker);
  $("#all-themes").addEventListener("click", () => { state.themes.clear(); render(); });
  let timer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.query = e.target.value.trim(); renderResults(); writeHash(); }, 150);
  });

  try {
    const res = await fetch("data/programmes.json");
    DATA = await res.json();
  } catch (err) {
    $("#results").innerHTML = `<p class="empty">Impossible de charger les données (${esc(err.message)}). Servez le site via HTTP, par exemple : python3 -m http.server</p>`;
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
