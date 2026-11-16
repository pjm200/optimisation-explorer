/* Optimisation Explorer — foundation pages: anatomy, geometry, duality */
(function () {
'use strict';
const OV = window.OV, LP = OV.LP, C = OV.col, F = OV.fmt, P = OV.P, M = OV.M;
const dot = (a, p) => a[0] * p[0] + a[1] * p[1];

/* live, hoverable statement of a 2-variable LP */
OV.lpMath = (prob, o = {}) => {
  const L = o.labels || ['x₁', 'x₂'], vt = o.varTerm || 'var';
  const lin = (a, tk) => { let s = ''; a.forEach((v, j) => { if (Math.abs(v) < 1e-9) return; const neg = v < 0; s += (s ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + `{${F(Math.abs(v))}|${tk}}{${L[j]}|${vt}}`; }); return s || '0'; };
  const rows = [`<span class="w t" data-term="${prob.sense}">${prob.sense === 'min' ? 'minimise' : 'maximise'}</span>${lin(prob.c, o.cTerm || 'coef')}`];
  prob.cons.forEach((k, i) => rows.push(`<span class="w">${i ? '&nbsp;'.repeat(16) : 'subject to'}</span>${lin(k.a, o.aTerm || 'acoef')} {${k.sense === '>=' ? '≥' : '≤'} ${F(k.b)}|${o.bTerm || 'rhs'}}${k.name ? `<span class="w" style="margin-left:1em;color:${OV.pal[(o.palOffset || 0) + i]}">${k.name}</span>` : ''}`));
  rows.push(`<span class="w">${'&nbsp;'.repeat(16)}</span>{${L[0]}, ${L[1]} ≥ 0|nonneg}`);
  return OV.math(rows, 'left sm');
};

function hero(root) {
  const el = OV.h(`<div class="hero"><div class="over"><div class="kicker">An interactive guide</div><h1>See how optimisation actually works</h1>
    <p>From the geometry of a linear programme to duality, simplex, interior-point, branch &amp; cut and heuristics, ending with the models that schedule power systems. Every page is something you can drag, break and re-solve.</p></div></div>`);
  root.appendChild(el);
  const W = 1200, H = 330, { c, ctx } = OV.canvas(el, W, H); el.insertBefore(c, el.firstChild);
  const cx = W * .74, cy = H * .52, V = [0, .8, 1.7, 2.5, 3.4, 4.3, 5.3].map((a, i) => [cx + Math.cos(a) * (150 + (i % 3) * 22), cy + Math.sin(a) * (105 + (i % 2) * 24)]);
  let prev = 0, trail = [];
  OV.onTick(t => {
    ctx.clearRect(0, 0, W, H);
    const th = t * .32, d = [Math.cos(th), Math.sin(th)]; let lo = Infinity, hi = -Infinity, bi = 0;
    V.forEach((p, i) => { const v = dot(d, p); if (v > hi) { hi = v; bi = i; } lo = Math.min(lo, v); });
    if (bi !== prev) { trail.push({ a: V[prev], b: V[bi], t }); prev = bi; if (trail.length > 4) trail.shift(); }
    const g = ctx.createLinearGradient(cx - d[0] * 170, cy - d[1] * 170, cx + d[0] * 170, cy + d[1] * 170);
    g.addColorStop(0, 'rgba(76,201,240,.03)'); g.addColorStop(1, 'rgba(120,150,255,.5)');
    ctx.beginPath(); V.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(140,210,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1;
    for (let k = 0; k < 14; k++) { const v = lo + (hi - lo) * ((k + (t * .25) % 1) / 14), q = [d[0] * v, d[1] * v]; ctx.beginPath(); ctx.moveTo(q[0] + d[1] * 900, q[1] - d[0] * 900); ctx.lineTo(q[0] - d[1] * 900, q[1] + d[0] * 900); ctx.stroke(); }
    ctx.restore(); ctx.setLineDash([]);
    trail.forEach(s => { const a = Math.max(0, 1 - (t - s.t) / 2.5); ctx.strokeStyle = `rgba(251,191,36,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); ctx.stroke(); });
    V.forEach(p => { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); });
    ctx.strokeStyle = C.amber; ctx.fillStyle = C.amber; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + d[0] * 60, cy + d[1] * 60); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + d[0] * 60, cy + d[1] * 60, 4.5, 0, 7); ctx.fill();
    OV.glowDot(ctx, V[bi][0], V[bi][1], 7, C.amber, t);
  });
}

/* ================= 1. Anatomy ================= */
OV.page({ id: 'anatomy', group: 'Foundations', title: 'Anatomy of an optimisation problem', nav: 'Anatomy of a problem', render(root) {
  hero(root);
  root.appendChild(OV.h(`<p class="lead">${P('Every [[optimisation|opt]] problem has the same three ingredients: [[decision variables|var]] you control, an [[objective|obj]] you want to push as high or as low as possible, and [[constraints|con]] you must respect. When all of them are straight lines, it is a [[linear programme|lp]].')}</p>`));
  const g = OV.h(`<div class="grid2"><div class="card glow"><h3>The landscape · drag the white dot</h3><div class="cv"></div>
      <p class="hint">The shaded shape is the <span class="term" data-term="region">feasible region</span>. Brighter means a better objective. Dashed lines are <span class="term" data-term="iso">iso-objective lines</span>.</p></div>
    <div class="stack">
      <div class="card"><h3>The story</h3><p>${P('You run a small power station with two units and must choose how hard to run each: $x₁$ MW from unit A and $x₂$ MW from unit B. Each MW earns a margin, but both units draw on a shared gas supply, a shared emissions permit and a single grid connection.')}</p>
        <div class="row mt"><div class="sense"></div></div></div>
      <div class="card"><h3>The same thing in maths · hover any symbol</h3><div class="lpm"></div>
        <div class="c1"></div><div class="c2"></div><div class="b0"></div><div class="b1"></div><div class="b2"></div></div>
      <div class="card"><h3>Your guess</h3><div class="guess"></div><div class="row mt"><span class="rev"></span></div></div>
    </div></div>`);
  root.appendChild(g);
  const prob = OV.cloneProb(OV.presets.energy);
  const view = new OV.LPView(g.querySelector('.cv'), { prob, editable: false, probe: [2, 2], showOpt: false, onProbe: () => upd() });
  OV.onTick(t => view.draw(t));
  const lpm = g.querySelector('.lpm'), guess = g.querySelector('.guess');
  const upd = () => {
    view.refresh(); lpm.innerHTML = OV.lpMath(prob);
    const p = view.probe, z = dot(prob.c, p), ok = LP.feasible(prob, p), best = view.sol.status === 'optimal' ? view.sol.obj : null;
    let h = `<div class="kpis"><div class="kpi"><small>Point</small><b>(${F(p[0], 1)}, ${F(p[1], 1)})</b></div><div class="kpi"><small>Objective</small><b style="color:${C.amber}">£${F(z, 0)}</b></div>
      <div class="kpi"><small>Status</small><b style="color:${ok ? C.green : C.red}">${ok ? 'feasible' : 'infeasible'}</b></div></div>`;
    prob.cons.forEach((k, i) => { const use = dot(k.a, p), bad = use > k.b + 1e-9; h += `<div class="conrow"><span style="color:${OV.pal[i]}">${k.name}</span><span class="st" style="color:${bad ? C.red : C.dim}">${F(use, 1)} / ${F(k.b, 1)} ${bad ? '✗ violated' : Math.abs(use - k.b) < .15 ? '● binding' : `slack ${F(k.b - use, 1)}`}</span><div class="bar" style="grid-column:1/3"><i style="width:${OV.clamp(use / k.b * 100, 0, 100)}%;background:${bad ? C.red : OV.pal[i]}"></i></div></div>`; });
    if (best != null && prob.sense === 'max') h += `<p class="hint">${ok ? `You are at <b style="color:#fff">${F(Math.max(0, z / best * 100), 0)}%</b> of the best possible value. ${z > best - .5 ? 'You found it: notice you are sitting on a <span class="term" data-term="vertex">corner</span>.' : 'Can you reach 100%?'}` : 'Outside the feasible region: at least one constraint is broken, so this plan cannot be run.'}</p>`;
    if (prob.sense === 'min') h += `<p class="hint">Minimising with only "≤" limits is too easy: doing nothing (0, 0) costs nothing. Real least-cost problems need a "≥" or "=" requirement, such as <i>supply must meet demand</i>. You will meet those on the energy pages.</p>`;
    guess.innerHTML = h;
  };
  OV.seg(g.querySelector('.sense'), [['max', 'Maximise margin'], ['min', 'Minimise it instead']], 'max', v => { prob.sense = v; upd(); });
  const sl = (cls, label, term, get, set, min, max, step) => OV.slider(g.querySelector(cls), { label, term, min, max, step, value: get(), onInput: v => { set(v); upd(); } });
  sl('.c1', 'Margin of A (£/MW)', 'coef', () => prob.c[0], v => prob.c[0] = v, 5, 80, 1);
  sl('.c2', 'Margin of B (£/MW)', 'coef', () => prob.c[1], v => prob.c[1] = v, 5, 80, 1);
  prob.cons.forEach((k, i) => sl('.b' + i, k.name + ' limit', 'rhs', () => k.b, v => k.b = v, 4, 30, .5));
  OV.button(g.querySelector('.rev'), 'Reveal the optimum', b => { view.showOpt = !view.showOpt; b.classList.toggle('on', view.showOpt); b.textContent = view.showOpt ? 'Hide the optimum' : 'Reveal the optimum'; });
  upd();
  root.appendChild(OV.h(`<h2>The general form</h2>`));
  root.appendChild(OV.h(`<div class="card">${OV.math(['{max|max}  {c|coef}^[T]{x|var}     <span class="w" style="margin-left:1.2em">subject to</span> {A|acoef}{x|var} ≤ {b|rhs},   {x ≥ 0|nonneg}'])}
    <p>${P('Stack the variables into a vector $x$, the objective weights into $c$, the resource use into a matrix $A$ and the limits into $b$. That one line describes everything from a two-unit plant to a continental power market with millions of variables. A [[minimisation|min]] is the same thing with the sign of $c$ flipped.')}</p></div>`));
  OV.ideas(root, [
    ['Variables are the knobs', 'Everything the optimiser may choose. In energy models: generator outputs, battery charging, flows on lines, whether a unit is on.'],
    ['The objective is the score', 'One number summarising how good a plan is. The [[coefficients|coef]] say how much each variable contributes. Usually total cost, to [[minimise|min]].'],
    ['Constraints are the rules', 'Physics, contracts and limits. Together they carve out the [[feasible region|region]]. An optimiser never leaves it; the best plan lies on its edge.']
  ]);
} });

/* ================= 2. Geometry ================= */
OV.page({ id: 'geometry', group: 'Foundations', title: 'The geometry of linear programmes', nav: 'Geometry: the landscape', render(root) {
  OV.head(root, { kicker: 'Foundations · 2', title: 'The landscape is a polygon', lead: 'Each [[constraint|con]] is a straight line that cuts the plane in two. What survives all the cuts is the [[feasible region|region]], a [[convex|convex]] polygon. Because the objective is a flat slope, the best point is always found at a [[corner|vertex]]. Reshape the landscape and watch.' });
  const g = OV.h(`<div class="grid2"><div class="card glow"><h3>Editable landscape</h3><div class="cv"></div>
      <p class="hint"><span class="pill">drag a line</span> to move it · <span class="pill">drag a handle ○</span> to swing it · <span class="pill">drag the amber arrow</span> to change what "better" means</p></div>
    <div class="stack">
      <div class="card"><h3>Try a shape</h3><div class="row pre"></div><div class="row mt ops"></div></div>
      <div class="card"><h3>The problem right now</h3><div class="lpm"></div></div>
      <div class="card"><h3>What the optimum tells you</h3><div class="info"></div></div>
    </div></div>`);
  root.appendChild(g);
  let prob = OV.cloneProb(OV.presets.energy), sweep = null;
  const view = new OV.LPView(g.querySelector('.cv'), { prob, onChange: () => upd() });
  view.overlay = (ctx, v, t) => {
    if (sweep == null) return;
    const d = v.dir(), R = v.o.range, corners = [[0, 0], [R[0], 0], [R[0], R[1]], [0, R[1]]].map(p => dot(d, p)), lo = Math.min(...corners);
    const target = v.sol.status === 'optimal' ? dot(d, v.sol.x) : Math.max(...corners), lvl = OV.lerp(lo, target, OV.clamp((t - sweep) / 2.6, 0, 1));
    const n = [-d[1], d[0]], q = [d[0] * lvl, d[1] * lvl], a = v.px([q[0] - n[0] * 30, q[1] - n[1] * 30]), b = v.px([q[0] + n[0] * 30, q[1] + n[1] * 30]);
    ctx.save(); ctx.strokeStyle = C.amber; ctx.lineWidth = 2.5; ctx.shadowColor = C.amber; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
    OV.label(ctx, `objective = ${F(lvl * Math.hypot(prob.c[0], prob.c[1]) * (prob.sense === 'min' ? -1 : 1), 1)}`, v.m.l + 90, v.m.t + 18, C.amber, 'center');
    if (t - sweep > 5) sweep = null;
  };
  OV.onTick(t => view.draw(t));
  const info = g.querySelector('.info'), lpm = g.querySelector('.lpm');
  const upd = () => {
    lpm.innerHTML = OV.lpMath(prob);
    const s = view.sol;
    if (s.status === 'infeasible') { info.innerHTML = `<p>${P('<b class="c-red">Infeasible.</b> The constraints contradict each other, so the [[feasible region|region]] is empty. No algorithm can help: the model itself must change. Solvers report this rather than returning an answer.')}</p>`; return; }
    if (s.status === 'unbounded') { info.innerHTML = `<p>${P('<b class="c-amber">Unbounded.</b> The region is open in the direction of improvement, so the objective can grow forever. In practice this means a constraint is missing from the model.')}</p>`; return; }
    const sx = LP.simplexSteps(prob), y = sx.y || [], sg = prob.sense === 'min' ? -1 : 1;
    let nb = 0, h = `<div class="kpis"><div class="kpi"><small>Optimal corner</small><b>(${F(s.x[0])}, ${F(s.x[1])})</b></div><div class="kpi"><small>Objective</small><b style="color:${C.amber}">${F(s.obj)}</b></div></div>
      <table class="plain" style="margin-top:10px"><tr><th>Constraint</th><th><span class="term" data-term="slack">Slack</span></th><th>State</th><th><span class="term" data-term="shadow">Shadow price</span></th></tr>`;
    prob.cons.forEach((k, i) => { const sl = Math.abs(k.b - dot(k.a, s.x)), bind = sl < 1e-6; if (bind) nb++; const sp = (y[i] || 0) * sg * (k.sense === '>=' ? -1 : 1); h += `<tr><td><span class="sw" style="background:${OV.pal[i]}"></span>${k.name || OV.conText(k)}</td><td>${F(sl)}</td><td style="color:${bind ? C.amber : C.dim}">${bind ? 'binding' : 'slack'}</td><td>${F(sp)}</td></tr>`; });
    h += '</table>';
    const onAxis = (s.x[0] < 1e-7 ? 1 : 0) + (s.x[1] < 1e-7 ? 1 : 0);
    h += `<p class="hint">${P(nb + onAxis > 2 ? '<b class="c-amber">Degenerate corner:</b> more than two lines pass through the optimum. The [[shadow prices|shadow]] are no longer unique and simplex may stall here. See [[degeneracy|degenerate]].' : 'Only [[binding|binding]] constraints have a non-zero [[shadow price|shadow]]: relaxing a constraint that already has [[slack|slack]] gains nothing. This is the seed of duality, on the next page.')}</p>`;
    info.innerHTML = h;
  };
  const pre = g.querySelector('.pre'), ops = g.querySelector('.ops');
  Object.keys(OV.presets).forEach(k => OV.button(pre, OV.presets[k].name, () => { prob = view.prob = OV.cloneProb(OV.presets[k]); view.changed(); }));
  OV.button(ops, '▶ Sweep the objective', () => { sweep = performance.now() / 1000; }, 'primary');
  OV.button(ops, 'Flip max / min', () => { prob.sense = prob.sense === 'min' ? 'max' : 'min'; view.changed(); });
  OV.button(ops, '＋ constraint', () => { if (prob.cons.length < 6) { const a = Math.random() * 1.2 + .2; prob.cons.push({ a: [Math.cos(a), Math.sin(a)], b: 5 + Math.random() * 4, sense: '<=' }); view.changed(); } });
  OV.button(ops, '− constraint', () => { if (prob.cons.length > 1) { prob.cons.pop(); view.changed(); } });
  upd();
  OV.ideas(root, [
    ['Why a corner?', 'The objective is a tilted plane. Slide an [[iso-objective line|iso]] in the improving direction and the last point it touches is a [[vertex|vertex]] (or a whole edge, if it is parallel to one). So an LP with a million feasible points only has finitely many candidates.'],
    ['Three ways to fail', 'A model can be [[infeasible|infeasible]] (rules contradict), [[unbounded|unbounded]] (a rule is missing) or [[degenerate|degenerate]] (redundant rules meet at a corner). Try the presets: each looks different in the landscape.'],
    ['Convexity is the superpower', 'The region has no dents and the objective no bumps, so any point that is locally best is globally best. That guarantee is what the heuristics later in this guide do <i>not</i> have.']
  ]);
} });

/* ================= 3. Duality ================= */
OV.page({ id: 'duality', group: 'Foundations', title: 'Duality: every problem has a twin', nav: 'Duality & the gap', render(root) {
  OV.head(root, { kicker: 'Foundations · 3', title: 'Duality: every problem has a twin', lead: 'Hidden behind every LP (the [[primal|primal]]) is a second LP (the [[dual|dual]]) built from the very same numbers. One chooses quantities, the other chooses prices. Any feasible answer to one bounds the other, and at the optimum they agree exactly. The distance between them is the [[duality gap|gap]].' });
  const g = OV.h(`<div class="card glow"><div style="display:grid;grid-template-columns:minmax(0,1fr) 150px minmax(0,1fr);gap:14px;align-items:start" class="dgrid">
      <div><h3 class="c-cyan">Primal · choose quantities x</h3><div class="pv"></div><div class="pm"></div></div>
      <div><h3 style="text-align:center">The gap</h3><div class="gv"></div></div>
      <div><h3 class="c-violet">Dual · choose prices y</h3><div class="dv"></div><div class="dm"></div></div>
    </div><div class="row mt"><span class="btns"></span><span class="hint">Drag the white dot in each picture. Primal value can only climb <i>up</i> to the meeting point; dual value can only come <i>down</i> to it.</span></div></div>`);
  root.appendChild(g);
  if (innerWidth < 900) g.querySelector('.dgrid').style.gridTemplateColumns = 'minmax(0,1fr)';
  const prob = OV.cloneProb(OV.presets.energy); prob.cons.splice(1, 1);
  const dual = { sense: 'min', c: [0, 0], cons: [] };
  const mkDual = () => { dual.c = prob.cons.map(k => k.b); dual.cons = [0, 1].map(j => ({ a: [prob.cons[0].a[j], prob.cons[1].a[j]], b: prob.c[j], sense: '>=', name: `worth ≥ margin of x${'₁₂'[j]}` })); };
  mkDual();
  const pv = new OV.LPView(g.querySelector('.pv'), { W: 470, H: 464, prob, editable: false, probe: [2.5, 2], showOpt: false, onProbe: () => upd() });
  const dv = new OV.LPView(g.querySelector('.dv'), { W: 470, H: 464, prob: dual, editable: false, probe: [16, 24], showOpt: false, labels: ['y₁', 'y₂'], range: [50, 50], color: C.violet, palOffset: 2, onProbe: () => upd() });
  const G = OV.canvas(g.querySelector('.gv'), 150, 464);
  let anim = null;
  const fitDual = () => { let mx = 10; dual.cons.forEach(k => { [0, 1].forEach(j => { if (k.a[j] > 1e-9) mx = Math.max(mx, k.b / k.a[j]); }); }); const r = Math.ceil(mx * 1.25 / 10) * 10; dv.o.range = [r, r]; dv.probe = [Math.min(dv.probe[0], r), Math.min(dv.probe[1], r)]; };
  OV.onTick(t => {
    if (anim) { const k = OV.clamp((t - anim.t0) / 1.2, 0, 1), e = 1 - Math.pow(1 - k, 3); pv.probe = [OV.lerp(anim.p0[0], anim.p1[0], e), OV.lerp(anim.p0[1], anim.p1[1], e)]; dv.probe = [OV.lerp(anim.d0[0], anim.d1[0], e), OV.lerp(anim.d0[1], anim.d1[1], e)]; upd(); if (k >= 1) anim = null; }
    pv.draw(t); dv.draw(t);
    /* gap gauge */
    const ctx = G.ctx, W = 150, H = 464, top = 34, bot = H - 46, zs = pv.sol.status === 'optimal' ? pv.sol.obj : 1, zmax = zs * 1.9 || 1, Y = v => bot - OV.clamp(v / zmax, 0, 1) * (bot - top);
    const pz = dot(prob.c, pv.probe), dz = dot(dual.c, dv.probe), pOK = LP.feasible(prob, pv.probe), dOK = LP.feasible(dual, dv.probe);
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.roundRect(52, top, 46, bot - top, 8); ctx.fill();
    const gp = ctx.createLinearGradient(0, bot, 0, top); gp.addColorStop(0, OV.rgba(C.cyan, .25)); gp.addColorStop(1, OV.rgba(C.cyan, .95));
    ctx.fillStyle = pOK ? gp : OV.rgba(C.red, .35); ctx.beginPath(); ctx.roundRect(52, Y(pz), 46, bot - Y(pz), [0, 0, 8, 8]); ctx.fill();
    const gd = ctx.createLinearGradient(0, top, 0, bot); gd.addColorStop(0, OV.rgba(C.violet, .25)); gd.addColorStop(1, OV.rgba(C.violet, .95));
    ctx.fillStyle = dOK ? gd : OV.rgba(C.red, .35); ctx.beginPath(); ctx.roundRect(52, top, 46, Math.max(0, Y(dz) - top), [8, 8, 0, 0]); ctx.fill();
    ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(40, Y(zs)); ctx.lineTo(110, Y(zs)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = C.amber; ctx.fillText('optimum', 128, Y(zs) - 8); ctx.fillText(F(zs, 0), 128, Y(zs) + 8);
    ctx.fillStyle = C.violet; ctx.fillText(`dual bᵀy = ${F(dz, 0)}`, W / 2, 14); if (!dOK) { ctx.fillStyle = C.red; ctx.fillText('(y not feasible)', W / 2, 27); }
    ctx.fillStyle = C.cyan; ctx.fillText(`primal cᵀx = ${F(pz, 0)}`, W / 2, H - 30); if (!pOK) { ctx.fillStyle = C.red; ctx.fillText('(x not feasible)', W / 2, H - 16); }
    if (pOK && dOK) { const mid = (Y(pz) + Y(dz)) / 2; ctx.fillStyle = '#fff'; ctx.font = '700 12px Inter, Segoe UI, sans-serif'; ctx.fillText(dz - pz < .5 ? 'gap = 0' : `gap ${F(dz - pz, 0)}`, 24, mid); if (dz - pz < .5) { ctx.fillStyle = C.green; ctx.fillText('optimal ✓', 24, mid + 15); } }
  });
  const below = OV.h(`<div class="grid2 even" style="margin-top:18px"><div class="stack"><div class="card"><h3>Change the data</h3><div class="sl"></div></div>
      <div class="card"><h3>Reading the dual: a takeover offer</h3><p>${P('A trader offers to buy your gas and your grid capacity outright, at prices $y₁$ and $y₂$ per unit. You will only sell if the resources one MW of each unit consumes are worth at least the margin that MW would have earned: those are the [[dual|dual]] constraints. The trader wants to pay as little as possible: that is the dual objective. The lowest acceptable offer equals your best possible profit: [[strong duality|strong]].')}</p></div></div>
    <div class="stack"><div class="card"><h3>What the optimal prices mean</h3><div class="sp"></div></div>
      <div class="card"><h3>Why the dual is always a ceiling</h3>${OV.math(['{c|coef}^[T]{x|var}  ≤  ({A|acoef}^[T]{y|dualvar})^[T]{x|var}  =  {y|dualvar}^[T]({A|acoef}{x|var})  ≤  {b|rhs}^[T]{y|dualvar}'], 'sm')}
      <p>${P('The first step uses dual feasibility ($A^[T]y ≥ c$), the last uses primal feasibility ($Ax ≤ b$). That is the whole proof of [[weak duality|weak]]. Equality needs both steps to be tight, which is exactly [[complementary slackness|cs]].')}</p></div></div></div>`);
  root.appendChild(below);
  const pm = g.querySelector('.pm'), dm = g.querySelector('.dm'), sp = below.querySelector('.sp');
  const upd = () => {
    const ps = pv.sol, ds = dv.sol; if (ps.status !== 'optimal' || ds.status !== 'optimal') { sp.innerHTML = '<p>No finite optimum for this data.</p>'; return; }
    let h = `<table class="plain"><tr><th>Resource</th><th>Slack at x*</th><th>Price y*</th><th>Slack × price</th><th>+1 unit gives</th></tr>`;
    prob.cons.forEach((k, i) => { const sl = k.b - dot(k.a, ps.x), q = OV.cloneProb(prob); q.cons[i].b += 1; const z1 = LP.solve2D(q); h += `<tr><td><span class="sw" style="background:${OV.pal[i]}"></span>${k.name}</td><td>${F(sl)}</td><td style="color:${C.violet}">${F(ds.x[i])}</td><td>${F(sl * ds.x[i])}</td><td style="color:${C.amber}">+${F(z1.obj - ps.obj)}</td></tr>`; });
    h += `</table><p class="hint">${P('Each price $y*$ is a [[shadow price|shadow]]: add one unit of that resource and the optimal objective rises by exactly that much (last column, re-solved live). And slack × price is always 0: [[complementary slackness|cs]].')}</p>`;
    sp.innerHTML = h;
  };
  const refresh = () => { mkDual(); pv.refresh(); dv.refresh(); fitDual(); dv.refresh(); pm.innerHTML = OV.lpMath(prob); dm.innerHTML = OV.lpMath(dual, { labels: ['y₁', 'y₂'], varTerm: 'dualvar', cTerm: 'rhs', bTerm: 'coef', palOffset: 2 }); upd(); };
  const S = below.querySelector('.sl');
  OV.slider(S, { label: 'Gas supply b₁', term: 'rhs', min: 6, max: 24, step: .5, value: prob.cons[0].b, onInput: v => { prob.cons[0].b = v; refresh(); } });
  OV.slider(S, { label: 'Grid export b₂', term: 'rhs', min: 3, max: 14, step: .5, value: prob.cons[1].b, onInput: v => { prob.cons[1].b = v; refresh(); } });
  OV.slider(S, { label: 'Margin c₁', term: 'coef', min: 10, max: 80, step: 1, value: prob.c[0], onInput: v => { prob.c[0] = v; refresh(); } });
  OV.slider(S, { label: 'Margin c₂', term: 'coef', min: 10, max: 80, step: 1, value: prob.c[1], onInput: v => { prob.c[1] = v; refresh(); } });
  OV.button(g.querySelector('.btns'), '▶ Close the gap', () => { if (pv.sol.status === 'optimal' && dv.sol.status === 'optimal') anim = { t0: performance.now() / 1000, p0: pv.probe, p1: pv.sol.x, d0: dv.probe, d1: dv.sol.x }; }, 'primary');
  OV.button(g.querySelector('.btns'), 'Reset', () => { pv.probe = [2.5, 2]; dv.probe = dv.sol.status === 'optimal' ? [dv.sol.x[0] * 1.4 + 3, dv.sol.x[1] * 1.15 + 2] : [16, 24]; upd(); });
  refresh();
  root.appendChild(OV.h(`<h2>The recipe for building a dual</h2>`));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math(['<span class="w">Primal</span> {max|max} {c|coef}^[T]{x|var}', '{A|acoef}{x|var} ≤ {b|rhs}', '{x|var} ≥ 0'], 'sm')}</div><div class="card">${OV.math(['<span class="w">Dual</span> {min|min} {b|rhs}^[T]{y|dualvar}', '{A|acoef}^[T]{y|dualvar} ≥ {c|coef}', '{y|dualvar} ≥ 0'], 'sm')}</div></div>`));
  root.appendChild(OV.h(`<div class="card" style="margin-top:16px"><ol class="steps"><li>${P('Every primal <b>constraint</b> becomes a dual <b>variable</b> (its price). Every primal variable becomes a dual constraint.')}</li><li>${P('The primal [[right-hand side|rhs]] $b$ becomes the dual objective; the primal objective $c$ becomes the dual right-hand side.')}</li><li>${P('The matrix is transposed, max becomes min, and ≤ becomes ≥.')}</li><li>${P('Take the dual of the dual and you are back where you started.')}</li></ol></div>`));
  OV.ideas(root, [
    ['Bounds without solving', 'Any feasible dual point proves a limit on the primal: [[weak duality|weak]]. If someone hands you a plan and a set of prices with matching values, you can verify optimality by arithmetic alone: a [[certificate|cert]].'],
    ['The gap is your stopping rule', 'Interior-point methods stop when the [[duality gap|gap]] is tiny. Branch and bound stops when the [[MIP gap|mipgap]] is tiny. In both cases you know how far from optimal you could be without knowing the optimum.'],
    ['Prices come for free', 'Solve the primal and the dual prices drop out as a by-product. In electricity markets, the [[shadow price|shadow]] of the supply = demand constraint <i>is</i> the market price. You will see it on the dispatch page.']
  ]);
} });
})();
