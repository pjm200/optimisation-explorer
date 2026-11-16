/* Optimisation Explorer — reference: searchable glossary and a one-page summary */
(function () {
'use strict';
const OV = window.OV, P = OV.P;

OV.page({ id: 'glossary', group: 'Reference', title: 'Glossary and cheat sheet', nav: 'Glossary', render(root) {
  OV.head(root, { kicker: 'Reference', title: 'Glossary and cheat sheet', lead: 'Every term used in this guide, in one place. These are the same definitions that appear when you hover a dotted word or a symbol in a formula.' });
  root.appendChild(OV.h(`<div class="card" style="margin-bottom:18px"><h3>The whole story in six lines</h3><ol class="steps">
    <li>${P('An optimisation problem = [[variables|var]] + an [[objective|obj]] + [[constraints|con]]. If all are linear it is an [[LP|lp]], and its [[feasible region|region]] is a convex polygon whose best point is a [[corner|vertex]].')}</li>
    <li>${P('Every LP has a [[dual|dual]] that prices its constraints. [[Weak duality|weak]] makes the dual a bound; [[strong duality|strong]] makes the bound exact. The difference is the [[duality gap|gap]].')}</li>
    <li>${P('[[Simplex|simplex]] walks from corner to corner; [[interior-point methods|ipm]] follow the [[central path|central]] through the middle. Both end with zero gap and both deliver [[shadow prices|shadow]].')}</li>
    <li>${P('Require [[whole numbers|integer]] and convexity is lost. [[Branch and bound|bnb]] recovers a proof by solving a tree of LP [[relaxations|relax]]; [[cuts|cut]] tighten them. Progress is measured by the [[MIP gap|mipgap]].')}</li>
    <li>${P('On non-convex landscapes, [[heuristics|heuristic]] such as [[simulated annealing|sa]] and [[particle swarms|pso]] find good answers but can prove nothing.')}</li>
    <li>${P('In power systems: [[dispatch|dispatch]] is an LP whose dual is the [[price|smp]]; storage couples time through the [[state of charge|soc]]; [[unit commitment|uc]] adds [[binaries|binary]] and becomes a [[MILP|milp]].')}</li></ol></div>`));
  const inp = OV.h('<input class="search" type="search" placeholder="Search terms…" aria-label="Search glossary">'), host = OV.h('<div></div>');
  root.appendChild(inp); root.appendChild(host);
  const draw = () => {
    const q = inp.value.trim().toLowerCase(), groups = {};
    Object.keys(OV.terms).forEach(k => { const t = OV.terms[k]; if (q && !(t.t + ' ' + t.d).toLowerCase().includes(q)) return; (groups[t.g] = groups[t.g] || []).push(t); });
    host.innerHTML = Object.keys(groups).map(gn => `<h2>${gn}</h2><div class="gloss">${groups[gn].sort((a, b) => a.t.localeCompare(b.t)).map(t => `<div class="card"><b>${t.t}</b><p>${t.d}</p></div>`).join('')}</div>`).join('') || '<p class="hint">No matching terms.</p>';
  };
  inp.addEventListener('input', draw); draw();
} });
})();
