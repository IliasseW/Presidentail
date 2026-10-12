"use strict";

/* Graphe des liens : personnes (candidats, personnalités) et organisations (gouvernements, partis…).
   Les liens « parcours » relient une personne à une organisation ; les liens « relation » relient deux personnes. */

const FAMILLES = [
  { id: "gouvernement", libelle: "Gouvernements", test: (l) => l.nature === "parcours" && l.type === "gouvernement" },
  { id: "parti", libelle: "Partis et mouvements", test: (l) => l.nature === "parcours" && (l.type === "parti" || l.type === "mouvement" || l.type === "autre") },
  { id: "election", libelle: "Alliances et élections", test: (l) => l.nature === "parcours" && (l.type === "alliance" || l.type === "election") },
  { id: "soutien", libelle: "Soutiens et collaborations", test: (l) => l.nature === "relation" && ["collaborateur", "soutien", "famille"].includes(l.type) },
  { id: "nomination", libelle: "Nominations et successions", test: (l) => l.nature === "relation" && ["nomination", "succession"].includes(l.type) },
  { id: "conflit", libelle: "Ruptures et rivalités", test: (l) => l.nature === "relation" && ["rupture", "rival"].includes(l.type) },
];
const RELATION = {
  collaborateur: "Collaboration", soutien: "Soutien", famille: "Famille politique",
  nomination: "Nomination", succession: "Succession", rupture: "Rupture", rival: "Rivalité",
};
const ORG_TYPE = { gouvernement: "Gouvernement", parti: "Parti", mouvement: "Mouvement", alliance: "Alliance", election: "Élection" };

const state = { familles: new Set(FAMILLES.map((f) => f.id)), selected: null, path: null, visible: new Set() };
let DATA, NODES, LINKS, BY_ID, sim, zoom, svg, gLinks, gNodes, gLabels;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yr = (d) => (d ? String(d).slice(0, 4) : "");
const periode = (l) => (l.debut || l.fin ? `${yr(l.debut) || "?"}–${l.fin ? yr(l.fin) : "…"}` : yr(l.date));
const kind = (n) => (n.genre === "organisation" ? (n.type === "gouvernement" ? "gouv" : "org") : n.genre === "candidat" ? "cand" : "perso");
const radius = (n) => ({ cand: 9, perso: 6, gouv: 7, org: 7 }[kind(n)]);
const famille = (l) => FAMILLES.find((f) => f.test(l))?.id || "parti";
const otherEnd = (l, id) => (l.source.id === id ? l.target : l.source);

function linkLabel(l) {
  if (l.nature === "relation") return `${RELATION[l.type] || l.type}${l.date ? ` (${yr(l.date)})` : ""} — ${l.description || ""}`;
  return `${l.role || "Membre"}${periode(l) ? ` (${periode(l)})` : ""}`;
}

/* ---------- filtres et visibilité ---------- */
function visibleLinks() {
  return LINKS.filter((l) => state.familles.has(famille(l)));
}
function visibleNodeIds(links) {
  const ids = new Set();
  links.forEach((l) => { ids.add(l.source.id); ids.add(l.target.id); });
  return ids;
}

function renderFilters() {
  $("#filters").innerHTML = FAMILLES.map((f) =>
    `<button type="button" class="chip" data-famille="${f.id}" aria-pressed="${state.familles.has(f.id)}">${f.libelle}</button>`).join("");
}

function renderLegend() {
  $("#legend").innerHTML = `
    <li><svg width="16" height="16"><circle cx="8" cy="8" r="6" class="n-cand"/></svg>Candidat 2027</li>
    <li><svg width="16" height="16"><circle cx="8" cy="8" r="5" class="n-perso"/></svg>Autre personnalité</li>
    <li><svg width="16" height="16"><rect x="2" y="2" width="12" height="12" rx="2" class="n-gouv"/></svg>Gouvernement</li>
    <li><svg width="16" height="16"><path d="M8 1 L15 8 L8 15 L1 8 Z" class="n-org"/></svg>Parti, alliance, élection</li>
    <li><svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" class="l-relation"/></svg>Soutien, collaboration</li>
    <li><svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" class="l-relation l-nomination"/></svg>Nomination, succession</li>
    <li><svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" class="l-relation l-conflit"/></svg>Rupture, rivalité</li>`;
}

/* ---------- dessin ---------- */
function shape(sel) {
  sel.each(function (d) {
    const g = d3.select(this);
    g.selectAll("*").remove();
    const r = radius(d), k = kind(d);
    if (k === "gouv") g.append("rect").attr("x", -r).attr("y", -r).attr("width", 2 * r).attr("height", 2 * r).attr("rx", 2);
    else if (k === "org") g.append("path").attr("d", `M0 ${-r - 1} L${r + 1} 0 L0 ${r + 1} L${-r - 1} 0 Z`);
    else g.append("circle").attr("r", r);
    g.attr("class", `node n-${k}`);
  });
}

function draw() {
  const links = visibleLinks();
  const ids = visibleNodeIds(links);
  const nodes = NODES.filter((n) => ids.has(n.id) || n.id === state.selected);

  gLinks.selectAll("line").data(links, (l) => l.key).join("line")
    .attr("class", (l) => `link ${l.nature === "relation" ? `l-relation l-${famille(l)}` : "l-parcours"}`)
    .on("mouseenter", (e, l) => showTip(e, `<strong>${esc(l.source.nom)} — ${esc(l.target.nom)}</strong><br>${esc(linkLabel(l))}`))
    .on("mouseleave", hideTip);

  gNodes.selectAll("g").data(nodes, (n) => n.id).join((enter) => enter.append("g").call(shape)
      .call(d3.drag().on("start", dragStart).on("drag", dragged).on("end", dragEnd)))
    .on("click", (e, n) => { e.stopPropagation(); select(n.id); })
    .on("mouseenter", (e, n) => showTip(e, `<strong>${esc(n.nom)}</strong><br>${esc(nodeKindLabel(n))}`))
    .on("mouseleave", hideTip);

  state.visible = new Set(nodes.map((n) => n.id));
  sim.nodes(nodes);
  sim.force("link").links(links);
  sim.alpha(0.6).restart();
  applyHighlight();
  $("#graph").setAttribute("aria-label", `Graphe : ${nodes.length} nœuds et ${links.length} liens affichés`);
}

function tick() {
  gLinks.selectAll("line").attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y).attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
  gNodes.selectAll("g").attr("transform", (n) => `translate(${n.x},${n.y})`);
  gLabels.selectAll("text").attr("x", (n) => n.x).attr("y", (n) => n.y);
}

function dragStart(e, n) { if (!e.active) sim.alphaTarget(0.2).restart(); n.fx = n.x; n.fy = n.y; }
function dragged(e, n) { n.fx = e.x; n.fy = e.y; }
function dragEnd(e, n) { if (!e.active) sim.alphaTarget(0); n.fx = null; n.fy = null; }

/* ---------- mise en évidence ---------- */
function applyHighlight() {
  const focus = new Set(), focusLinks = new Set();
  if (state.path) {
    state.path.nodes.forEach((id) => focus.add(id));
    state.path.links.forEach((l) => focusLinks.add(l.key));
  } else if (state.selected) {
    focus.add(state.selected);
    visibleLinks().forEach((l) => {
      if (l.source.id === state.selected || l.target.id === state.selected) {
        focus.add(l.source.id); focus.add(l.target.id); focusLinks.add(l.key);
      }
    });
  }
  const on = focus.size > 0;
  gNodes.selectAll("g").classed("dim", (n) => on && !focus.has(n.id)).classed("selected", (n) => n.id === state.selected);
  gLinks.selectAll("line").classed("dim", (l) => on && !focusLinks.has(l.key)).classed("hl", (l) => focusLinks.has(l.key));
  // Les noms des personnalités n'apparaissent que lorsqu'elles sont en évidence.
  gLabels.selectAll("text")
    .data(NODES.filter((n) => state.visible.has(n.id) && (n.genre !== "personnalite" || focus.has(n.id))), (n) => n.id)
    .join("text").attr("class", (n) => `label label-${kind(n)}`).attr("dy", (n) => radius(n) + 11).text((n) => n.nom)
    .attr("x", (n) => n.x).attr("y", (n) => n.y)
    .classed("dim", (n) => on && !focus.has(n.id));
}

/* ---------- panneau de détail ---------- */
function nodeKindLabel(n) {
  if (n.genre === "organisation") {
    const t = ORG_TYPE[n.type] || "Organisation";
    return n.debut ? `${t} (${yr(n.debut)}–${n.fin ? yr(n.fin) : "…"})` : t;
  }
  if (n.genre === "candidat") return `Candidat 2027${n.parti ? ` · ${n.parti}` : ""}`;
  return n.description || "Personnalité";
}

const nodeLink = (n) => `<button type="button" class="link" data-select="${esc(n.id)}">${esc(n.nom)}</button>`;
const srcLink = (l) => (l.source_url ? ` <a href="${esc(l.source_url)}" target="_blank" rel="noopener" class="src">source</a>` : "");
const byDate = (a, b) => String(a.debut || a.date || "").localeCompare(String(b.debut || b.date || ""));

function renderPanel() {
  const p = $("#panel");
  if (state.path) return renderPath();
  const n = BY_ID.get(state.selected);
  if (!n) {
    p.innerHTML = `<h2>Mode d'emploi</h2>
      <p>Cliquez sur un nœud pour afficher son parcours et ses liens. Faites glisser pour déplacer, molette ou pincement pour zoomer.</p>
      <p>Pour savoir ce qui relie deux personnes, remplissez « Relier deux personnes » : le chemin le plus court s'affiche, étape par étape.</p>
      <p class="hint">${DATA.noeuds.filter((x) => x.genre === "candidat").length} candidats, ${DATA.noeuds.filter((x) => x.genre === "personnalite").length} autres personnalités, ${DATA.noeuds.filter((x) => x.genre === "organisation").length} organisations, ${LINKS.length} liens.</p>`;
    return;
  }
  const links = LINKS.filter((l) => l.source.id === n.id || l.target.id === n.id);
  let html = `<h2>${esc(n.nom)}</h2><p class="hint">${esc(nodeKindLabel(n))}</p>`;
  if (n.genre === "candidat") html += `<p><a href="index.html#c=${esc(n.id)}@2027">Voir son programme dans le comparateur</a></p>`;
  if (n.genre === "organisation") {
    const membres = links.filter((l) => l.nature === "parcours").sort(byDate);
    html += `<h3>Membres recensés (${membres.length})</h3><ul class="panel-list">${membres.map((l) =>
      `<li>${nodeLink(l.source)} — ${esc(l.role || "Membre")}${periode(l) ? ` <span class="hint">(${periode(l)})</span>` : ""}${srcLink(l)}</li>`).join("")}</ul>`;
  } else {
    const parcours = links.filter((l) => l.nature === "parcours").sort(byDate);
    const relations = links.filter((l) => l.nature === "relation").sort(byDate);
    if (parcours.length) html += `<h3>Parcours</h3><ul class="panel-list">${parcours.map((l) =>
      `<li>${esc(l.role || "Membre")} — ${nodeLink(l.target)}${periode(l) ? ` <span class="hint">(${periode(l)})</span>` : ""}${srcLink(l)}</li>`).join("")}</ul>`;
    if (relations.length) html += `<h3>Liens directs</h3><ul class="panel-list">${relations.map((l) =>
      `<li><span class="rel-type">${esc(RELATION[l.type] || l.type)}</span> ${nodeLink(otherEnd(l, n.id))}${l.date ? ` <span class="hint">(${yr(l.date)})</span>` : ""}<br>${esc(l.description || "")}${srcLink(l)}</li>`).join("")}</ul>`;
    if (!links.length) html += `<p class="empty">Aucun lien recensé pour l'instant.</p>`;
  }
  p.innerHTML = html;
}

function renderPath() {
  const { nodes, links } = state.path;
  const steps = links.map((l, i) => {
    const a = BY_ID.get(nodes[i]), b = BY_ID.get(nodes[i + 1]);
    return `<li>${nodeLink(a)} → ${nodeLink(b)}<br><span class="hint">${esc(linkLabel(l))}</span>${srcLink(l)}</li>`;
  }).join("");
  $("#panel").innerHTML = `<h2>${esc(BY_ID.get(nodes[0]).nom)} ↔ ${esc(BY_ID.get(nodes.at(-1)).nom)}</h2>
    <p class="hint">${links.length} étape${links.length > 1 ? "s" : ""} avec les liens affichés.</p>
    <ol class="panel-list path-steps">${steps}</ol>
    <button type="button" class="btn btn-ghost btn-small" id="clear-path">Effacer le chemin</button>`;
}

/* ---------- chemin le plus court (parcours en largeur) ---------- */
function shortestPath(from, to) {
  const adj = new Map();
  visibleLinks().forEach((l) => {
    [[l.source.id, l.target.id], [l.target.id, l.source.id]].forEach(([a, b]) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push([b, l]);
    });
  });
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const [nxt, l] of adj.get(cur) || []) {
      if (!prev.has(nxt)) { prev.set(nxt, [cur, l]); queue.push(nxt); }
    }
  }
  if (!prev.has(to)) return null;
  const nodes = [to], links = [];
  for (let cur = to; prev.get(cur); cur = prev.get(cur)[0]) {
    links.unshift(prev.get(cur)[1]);
    nodes.unshift(prev.get(cur)[0]);
  }
  return { nodes, links };
}

function findByName(v) {
  const q = v.trim().toLowerCase();
  return NODES.find((n) => n.nom.toLowerCase() === q) || NODES.find((n) => n.nom.toLowerCase().includes(q));
}

/* ---------- interactions ---------- */
function select(id) {
  state.path = null;
  state.selected = state.selected === id ? null : id;
  draw();
  renderPanel();
  if (state.selected) focusOn(BY_ID.get(id));
}

function focusOn(n) {
  if (n?.x == null) return;
  const { width, height } = svg.node().getBoundingClientRect();
  const k = Math.max(d3.zoomTransform(svg.node()).k, 1.1);
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(width / 2 - k * n.x, height / 2 - k * n.y).scale(k));
}

const tip = () => $("#tooltip");
function showTip(e, html) {
  const box = $(".graph-box").getBoundingClientRect();
  tip().innerHTML = html;
  tip().hidden = false;
  const x = Math.min(e.clientX - box.left + 12, box.width - 260);
  tip().style.left = `${Math.max(4, x)}px`;
  tip().style.top = `${e.clientY - box.top + 12}px`;
}
function hideTip() { tip().hidden = true; }

async function init() {
  try {
    DATA = await (await fetch("data/reseau.json")).json();
  } catch (err) {
    $("#panel").innerHTML = `<p class="empty">Impossible de charger les données (${esc(err.message)}). Servez le site via HTTP, par exemple : python3 -m http.server</p>`;
    return;
  }
  NODES = DATA.noeuds.map((n) => ({ ...n }));
  BY_ID = new Map(NODES.map((n) => [n.id, n]));
  LINKS = DATA.liens.filter((l) => BY_ID.has(l.source) && BY_ID.has(l.cible))
    .map((l, i) => ({ ...l, key: i, source: BY_ID.get(l.source), target: BY_ID.get(l.cible) }));
  $("#data-date").textContent = `Données mises à jour le ${new Date(DATA.genere_le + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`;
  $("#people").innerHTML = NODES.filter((n) => n.genre !== "organisation").sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((n) => `<option value="${esc(n.nom)}"></option>`).join("");

  svg = d3.select("#graph");
  const root = svg.append("g");
  gLinks = root.append("g");
  gNodes = root.append("g");
  gLabels = root.append("g");
  zoom = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (e) => root.attr("transform", e.transform));
  svg.call(zoom).on("click", () => { if (state.selected || state.path) { state.selected = null; state.path = null; draw(); renderPanel(); } });

  const { width, height } = svg.node().getBoundingClientRect();
  sim = d3.forceSimulation()
    .force("link", d3.forceLink().id((n) => n.id).distance((l) => (l.nature === "relation" ? 90 : 55)).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-230))
    .force("collide", d3.forceCollide((n) => radius(n) + 6))
    .force("x", d3.forceX(width / 2).strength(0.04))
    .force("y", d3.forceY(height / 2).strength(0.06))
    .on("tick", tick);

  $("#zoom-in").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1.4));
  $("#zoom-out").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1 / 1.4));
  $("#reset").addEventListener("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-famille]");
    if (!b) return;
    const id = b.dataset.famille;
    state.familles.has(id) ? state.familles.delete(id) : state.familles.add(id);
    if (state.path) state.path = null;
    renderFilters(); draw(); renderPanel();
  });
  $("#panel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-select]");
    if (b) select(b.dataset.select);
    if (e.target.id === "clear-path") { state.path = null; draw(); renderPanel(); }
  });
  $("#path-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = findByName($("#from").value), b = findByName($("#to").value);
    if (!a || !b) { $("#panel").innerHTML = `<p class="empty">Choisissez deux noms dans la liste proposée.</p>`; return; }
    const path = shortestPath(a.id, b.id);
    if (!path) {
      state.path = null;
      $("#panel").innerHTML = `<h2>${esc(a.nom)} ↔ ${esc(b.nom)}</h2><p class="empty">Aucun chemin avec les liens affichés. Activez d'autres types de liens.</p>`;
      return;
    }
    state.selected = null;
    state.path = path;
    draw(); renderPanel();
  });

  renderFilters();
  renderLegend();
  draw();
  renderPanel();
  // reseau.html#<slug> ouvre directement la fiche d'une personne (lien depuis le comparateur).
  const start = decodeURIComponent(location.hash.slice(1));
  if (BY_ID.has(start)) setTimeout(() => select(start), 900);
}

init();
