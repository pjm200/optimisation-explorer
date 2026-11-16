/* Optimisation Explorer — exact algorithms on the LP landscape: simplex, interior point, branch & bound, branch & cut */
(function () {
'use strict';
const OV = window.OV, LP = OV.LP, C = OV.col, F = OV.fmt, P = OV.P;
const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const NAMES = { simplex: 'Simplex', ipm: 'Interior point', bnb: 'Branch & bound', bnc: 'Branch & cut' };
const STAT = { open: ['#93a0bb', 'open'], active: [C.cyan, 'being solved'], branched: ['#5b8def', 'branched'], integer: [C.green, 'integer (incumbent)'], infeasible: [C.red, 'infeasible'], pruned: [C.amber, 'pruned by bound'] };
const bcons = nd => { const r = []; for (let j = 0; j < 2; j++) { const a = j ? [0, 1] : [1, 0]; if (nd.lo[j] > 0) r.push({ a, b: nd.lo[j], sense: '>=' }); if (isFinite(nd.hi[j])) r.push({ a, b: nd.hi[j], sense: '<=' }); } return r; };

/* Mount an LP landscape + player + algorithm-specific side panel.  cfg: {algos:[..], preset, presets:[..]} */
OV.mountLP = (root, cfg) => {
  const g = OV.h(`<div class="grid2"><div class="card glow"><div class="row mb"><h3 style="margin:0;flex:1">${cfg.algos.length > 1 ? 'Algorithm' : 'Landscape · reshape it, then optimise'}</h3><span class="algo"></span></div><div class="cv"></div><div class="pl"></div>
      <p class="hint"><span class="pill">drag lines</span> <span class="pill">drag handles ○</span> <span class="pill">drag the amber arrow</span> <span class="xh"></span></p></div>
    <div class="stack"><div class="card"><h3>What is happening</h3><div class="narr"></div></div>
      <div class="card side"></div>
      <div class="card"><h3>Landscape &amp; settings</h3><div class="row pre"></div><div class="par" style="margin-top:10px"></div></div></div></div>`);
  root.appendChild(g);
  const st = { algo: cfg.algos[0], prob: OV.cloneProb(OV.presets[cfg.preset]), run: null, cp: null, sigma: .5, strategy: 'best', rounds: 1, hull: false, polys: [], plain: null };
  const narr = g.querySelector('.narr'), side = g.querySelector('.side'), par = g.querySelector('.par'), xh = g.querySelector('.xh');
  const view = new OV.LPView(g.querySelector('.cv'), { prob: st.prob, showOpt: false, startDrag: true, onChange: () => recompute() });
  let sideDraw = null, heat = null, heatKey = '';
  const player = new OV.Player(g.querySelector('.pl'), { onStep: (i, s) => { if (s) narr.innerHTML = s.msg; stepChanged(i, s); } });
  const isInt = () => st.algo === 'bnb' || st.algo === 'bnc';

  function recompute() {
    const a = st.algo; view.prob = st.prob; view.integer = isInt(); view.dim = isInt(); view.refresh();
    if (a === 'simplex') { view.start = null; st.run = LP.simplexSteps(st.prob); player.load(st.run.steps, 1.0); }
    else if (a === 'ipm') {
      const I = LP.ineqs(st.prob); if (!view.start || !I.G.every(k => k.b - (k.a[0] * view.start[0] + k.a[1] * view.start[1]) > 1e-6)) { const ip = LP.interiorPoint(st.prob, view.o.range), z = LP.region(st.prob, null, view.o.range), ox = view.sol.status === 'optimal' ? view.sol.x : [0, 0]; let far = null, fd = -1; z.forEach(q => { const d = Math.hypot(q[0] - ox[0], q[1] - ox[1]); if (d > fd) { fd = d; far = q; } }); view.start = ip && far ? [far[0] + .22 * (ip[0] - far[0]), far[1] + .22 * (ip[1] - far[1])] : ip; }
      st.run = LP.barrierSteps(st.prob, view.start, { sigma: st.sigma }); st.cp = LP.centralPath(st.prob, view.o.range); heatKey = ''; player.load(st.run.steps, 3.2);
    } else {
      view.start = null; st.run = LP.bnbSteps(st.prob, { strategy: st.strategy, cuts: a === 'bnc', cutRounds: st.rounds });
      st.plain = a === 'bnc' ? LP.bnbSteps(st.prob, { strategy: st.strategy }) : null; st.hullPts = LP.intHull(st.prob, 12); player.load(st.run.steps, .9);
    }
    const s0 = player.step; if (s0) narr.innerHTML = s0.msg; stepChanged(0, s0); extra();
  }
  function stepChanged(i, s) {
    if (!s) return;
    if (st.algo === 'simplex') tableau(s);
    if (isInt()) st.polys = s.nodes.filter(n => n.status !== 'branched' && n.status !== 'infeasible').map(n => ({ n, poly: LP.region(st.prob, s.cuts.concat(bcons(n)), view.o.range) }));
  }
  function extra() {
    const ex = side.querySelector('.extra'); if (!ex) return;
    if (st.algo === 'bnc' && st.plain) ex.innerHTML = `With cuts: <b style="color:${C.pink}">${st.run.nodes.length} nodes</b>, ${st.run.cuts.length} cut${st.run.cuts.length === 1 ? '' : 's'}. Plain branch &amp; bound on the same landscape: <b>${st.plain.nodes.length} nodes</b>.`;
  }

  /* ----- side panels ----- */
  function tableau(s) {
    const box = side.querySelector('.tabwrap'); if (!box) return; if (!s.T) { box.innerHTML = ''; return; }
    const m = s.T.length, N = 2 + m, vn = LP.vname;
    let h = `<table class="tab"><tr><th data-term="basic" class="t">basis</th>`; for (let j = 0; j < N; j++) h += `<th>${vn(j)}</th>`; h += `<th data-term="rhs" class="t">value</th><th data-term="ratio" class="t">ratio</th></tr>`;
    s.T.forEach((row, i) => { h += `<tr class="${i === s.leave ? 'lev' : ''}"><td>${vn(s.basis[i])}</td>`; for (let j = 0; j < N; j++) h += `<td class="${j === s.enter ? (i === s.leave ? 'piv' : 'ent') : ''}">${F(row[j])}</td>`; h += `<td>${F(row[N])}</td><td>${s.ratios[i] == null ? '–' : F(s.ratios[i])}</td></tr>`; });
    h += `<tr class="objrow"><td data-term="reduced" class="t">reduced cost</td>`; for (let j = 0; j < N; j++) h += `<td class="${s.r[j] > 1e-7 ? 'pos' : ''} ${j === s.enter ? 'ent' : ''}">${F(s.r[j])}</td>`; h += `<td>z = ${F(s.obj)}</td><td></td></tr></table>`;
    box.innerHTML = h;
  }
  function buildSide() {
    const a = st.algo; sideDraw = null; par.innerHTML = ''; xh.innerHTML = '';
    if (a === 'simplex') {
      side.innerHTML = `<h3>The <span class="term" data-term="tableau">tableau</span> at this vertex</h3><div class="tabwrap"></div><div class="legend"><span><i style="background:rgba(52,211,153,.5)"></i>entering column</span><span><i style="background:rgba(251,113,133,.5)"></i>leaving row</span><span><i style="background:rgba(251,191,36,.7)"></i>pivot element</span></div>`;
    } else if (a === 'ipm') {
      side.innerHTML = `<h3>Primal and dual closing in · the <span class="term" data-term="gap">duality gap</span></h3><div class="ch1"></div><div class="ch2" style="margin-top:8px"></div>`;
      const c1 = OV.canvas(side.querySelector('.ch1'), 460, 170), c2 = OV.canvas(side.querySelector('.ch2'), 460, 130);
      sideDraw = () => { const S = st.run.steps; if (!S[0] || S[0].x == null) return; const cur = player.pos;
        OV.chart(c1.ctx, 460, 170, [{ d: S.map(s => s.obj), c: C.cyan, name: 'primal objective' }, { d: S.map((s, i) => i < 4 ? null : s.dualObj), c: C.violet, name: 'dual estimate' }], { cursor: cur, xLabel: 'iteration' });
        OV.chart(c2.ctx, 460, 130, [{ d: S.map(s => s.gap), c: C.amber, name: 'gap ≈ m·μ (log scale)' }], { cursor: cur, log: true }); };
      OV.slider(par, { label: 'μ shrink factor σ', term: 'mu', min: .1, max: .9, step: .05, value: st.sigma, onInput: v => { st.sigma = v; recompute(); } });
      xh.innerHTML = '<span class="pill">drag the white start point</span>';
    } else {
      side.innerHTML = `<h3>The search tree</h3><div class="tr"></div><div class="legend">${Object.keys(STAT).map(k => `<span><i class="dot" style="background:${STAT[k][0]}"></i>${STAT[k][1]}</span>`).join('')}</div>
        <h3 style="margin-top:16px">Bound vs incumbent · the <span class="term" data-term="mipgap">MIP gap</span></h3><div class="ch"></div><div class="kp kpis" style="margin-top:8px"></div><p class="hint extra"></p>`;
      const tc = OV.canvas(side.querySelector('.tr'), 460, 280), cc = OV.canvas(side.querySelector('.ch'), 460, 130), kp = side.querySelector('.kp'); let lastI = -1;
      sideDraw = t => { const S = st.run.steps, s = player.step; if (!s) return; drawTree(tc.ctx, 460, 280, s, t);
        OV.chart(cc.ctx, 460, 130, [{ d: S.map(q => q.bound), c: C.violet, name: 'best bound', step: true }, { d: S.map(q => q.inc ? q.inc.obj : null), c: C.green, name: 'incumbent', step: true }], { cursor: player.i, xLabel: 'step' });
        if (player.i !== lastI) { lastI = player.i; const gap = s.inc && s.bound != null ? Math.abs(s.bound - s.inc.obj) / Math.max(1e-9, Math.abs(s.inc.obj)) * 100 : null;
          kp.innerHTML = `<div class="kpi"><small>Nodes</small><b>${s.nodes.length}</b></div><div class="kpi"><small>LPs solved</small><b>${s.nLP}</b></div><div class="kpi"><small>Incumbent</small><b style="color:${C.green}">${s.inc ? F(s.inc.obj) : '–'}</b></div><div class="kpi"><small>Best bound</small><b style="color:${C.violet}">${s.bound != null ? F(s.bound) : '–'}</b></div><div class="kpi"><small>Gap</small><b style="color:${C.amber}">${gap == null ? '∞' : F(gap, 1) + '%'}</b></div>`; } };
      const r = OV.h('<div class="row"></div>'); par.appendChild(r);
      OV.seg(r, [['best', 'Best-bound first', 'Always expand the open node with the most promising bound. Fewest nodes, more memory.'], ['depth', 'Depth first', 'Dive down one branch to find an incumbent quickly. Less memory, often more nodes.']], st.strategy, v => { st.strategy = v; recompute(); });
      OV.button(r, 'Show integer hull', b => { st.hull = !st.hull; b.classList.toggle('on', st.hull); }, st.hull ? 'on' : '');
      if (a === 'bnc') OV.slider(par, { label: 'Cut rounds per node', term: 'cut', min: 1, max: 3, step: 1, value: st.rounds, onInput: v => { st.rounds = v; recompute(); } });
    }
  }
  function drawTree(ctx, W, H, s, t) {
    ctx.clearRect(0, 0, W, H); const N = s.nodes, kids = N.map(() => []); N.forEach(n => { if (n.parent >= 0) kids[n.parent].push(n.id); });
    const X = new Array(N.length); let leaf = 0, maxD = 0;
    (function lay(id) { maxD = Math.max(maxD, N[id].depth); if (!kids[id].length) { X[id] = leaf++; return; } kids[id].forEach(lay); X[id] = kids[id].reduce((a, k) => a + X[k], 0) / kids[id].length; })(0);
    const r = N.length > 30 ? 7 : N.length > 16 ? 9 : 12, px = id => 26 + (leaf <= 1 ? .5 : X[id] / (leaf - 1)) * (W - 52), py = id => 22 + (maxD ? N[id].depth / maxD : 0) * (H - 58);
    N.forEach(n => { if (n.parent < 0) return; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px(n.parent), py(n.parent)); ctx.lineTo(px(n.id), py(n.id)); ctx.stroke();
      if (N.length <= 15) { ctx.font = '10px Cambria, Georgia, serif'; ctx.fillStyle = '#93a0bb'; ctx.textAlign = 'center'; ctx.fillText(n.label, (px(n.parent) + px(n.id)) / 2 + (px(n.id) < px(n.parent) ? -16 : 16), (py(n.parent) + py(n.id)) / 2); } });
    N.forEach(n => { const x = px(n.id), y = py(n.id), col = STAT[n.status][0], cur = n.id === s.cur;
      if (cur) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4 + 1.5 * Math.sin(t * 6), 0, 7); ctx.stroke(); }
      ctx.fillStyle = n.status === 'open' ? '#0a1020' : OV.rgba(col, n.status === 'branched' ? .35 : .85); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      if (r >= 9) { ctx.fillStyle = '#fff'; ctx.font = '600 9px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.id, x, y + .5); }
      if (n.obj != null && N.length <= 24) { ctx.fillStyle = col; ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(n.status === 'infeasible' ? '' : F(n.obj, 1), x, y + r + 3); } });
  }

  /* ----- canvas overlays ----- */
  view.under = (ctx, v) => {
    if (st.algo !== 'ipm' || !st.run || !st.run.steps[0] || !st.run.steps[0].x || v.poly.length < 3) return;
    const s = player.step, key = player.i + '|' + s.mu, N = 70, I = LP.ineqs(st.prob), R = v.o.range;
    if (key !== heatKey) {
      heatKey = key; heat = heat || document.createElement('canvas'); heat.width = heat.height = N; const hc = heat.getContext('2d'), img = hc.createImageData(N, N), val = new Float64Array(N * N); let mx = -Infinity;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const f = LP.phi(I, [(i + .5) / N * R[0], (1 - (j + .5) / N) * R[1]], s.mu); val[j * N + i] = f; if (f > mx) mx = f; }
      const kap = s.mu * I.G.length * .45 + 1e-9;
      for (let k = 0; k < N * N; k++) { const b = isFinite(val[k]) ? Math.exp((val[k] - mx) / kap) : 0; img.data[4 * k] = 190; img.data[4 * k + 1] = 150; img.data[4 * k + 2] = 255; img.data[4 * k + 3] = 200 * b; }
      hc.putImageData(img, 0, 0);
    }
    ctx.save(); v.path(v.poly); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, v.m.l, v.m.t, v.pw, v.ph); ctx.restore();
  };
  view.overlay = (ctx, v, t) => {
    const S = st.run && st.run.steps; if (!S || !S.length) return; const i = player.i, fr = ease(player.frac), s = S[i], nx = player.next;
    if (st.algo === 'simplex') {
      if (!s.x) return; const pts = S.slice(0, i + 1).map(q => q.x), cur = nx.x ? [OV.lerp(s.x[0], nx.x[0], fr), OV.lerp(s.x[1], nx.x[1], fr)] : s.x;
      v.polyline(pts.concat([cur]), C.amber, 4); pts.forEach(p => { const q = v.px(p); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 7); ctx.fill(); });
      if (s.unbounded) { const L = (t * 3) % 14; v.polyline([s.x, [s.x[0] + s.ray[0] * L, s.x[1] + s.ray[1] * L]], C.red, 3, [8, 6]); }
      v.point(cur, s.final ? C.green : C.amber, 7);
      OV.label(ctx, `z = ${F(OV.lerp(s.obj, nx.obj, fr), 1)}`, OV.clamp(v.px(cur)[0], v.m.l + 40, v.m.l + v.pw - 40), Math.max(v.m.t + 14, v.px(cur)[1] - 24), s.final ? C.green : C.amber, 'center');
    } else if (st.algo === 'ipm') {
      if (!s.x) return;
      if (st.cp) { v.polyline(st.cp.pts.map(q => q.x), 'rgba(255,255,255,.75)', 1.5, [2, 5]); const q = v.px(st.cp.centre); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q[0], q[1] - 6); ctx.lineTo(q[0] + 6, q[1]); ctx.lineTo(q[0], q[1] + 6); ctx.lineTo(q[0] - 6, q[1]); ctx.closePath(); ctx.stroke(); if (i === 0) OV.label(ctx, 'analytic centre → central path', OV.clamp(q[0], v.m.l + 95, v.m.l + v.pw - 95), q[1] + 20, '#fff', 'center'); }
      const pts = S.slice(0, i + 1).map(q => q.x), cur = [OV.lerp(s.x[0], nx.x[0], fr), OV.lerp(s.x[1], nx.x[1], fr)];
      v.polyline(pts.concat([cur]), C.violet, 2.5); pts.forEach(p => { const q = v.px(p); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], 2.6, 0, 7); ctx.fill(); });
      v.point(cur, i === 0 ? '#ffffff' : C.violet, 6.5);
      if (i === 0 && !player.playing) OV.label(ctx, 'start (drag me)', OV.clamp(v.px(cur)[0], v.m.l + 50, v.m.l + v.pw - 50), v.px(cur)[1] - 22, '#fff', 'center');
    } else {
      st.polys.forEach(({ n, poly }) => { if (poly.length < 3) return; const col = STAT[n.status][0], cur = n.id === s.cur; v.path(poly); ctx.fillStyle = OV.rgba(col, cur ? .38 : n.status === 'pruned' ? .1 : .16); ctx.fill(); ctx.strokeStyle = OV.rgba(col, cur ? 1 : .55); ctx.lineWidth = cur ? 2.5 : 1; ctx.stroke(); });
      if (st.hull && st.hullPts && st.hullPts.length > 1) { ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.green; ctx.lineWidth = 2; v.path(st.hullPts); ctx.stroke(); ctx.restore(); }
      s.cuts.forEach(k => v.drawLine(k, C.pink, { dash: [7, 5], w: k === s.cut ? 3 : 1.6, glow: k === s.cut }));
      if (s.before) { const q = v.px(s.before); ctx.strokeStyle = C.red; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q[0] - 6, q[1] - 6); ctx.lineTo(q[0] + 6, q[1] + 6); ctx.moveTo(q[0] + 6, q[1] - 6); ctx.lineTo(q[0] - 6, q[1] + 6); ctx.stroke(); }
      if (s.x) { v.ring(s.x, C.cyan, 10); v.point(s.x, C.cyan, 5); }
      if (s.type === 'node' && s.x) { const n = s.nodes[s.cur]; if (n.status === 'branched') { const j = n.bvar, lo = Math.floor(n.bval), R = v.o.range, a = v.px(j ? [0, lo + 1] : [lo, R[1]]), b = v.px(j ? [R[0], lo] : [lo + 1, 0]); ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.setLineDash([]); } }
      if (s.inc) { const q = v.px(s.inc.x); OV.star(ctx, q[0], q[1], s.type === 'done' ? 12 + 2 * Math.sin(t * 5) : 10, C.green); OV.label(ctx, `incumbent ${F(s.inc.obj)}`, OV.clamp(q[0], v.m.l + 55, v.m.l + v.pw - 55), q[1] + 24, C.green, 'center'); }
    }
  };

  /* ----- controls ----- */
  if (cfg.algos.length > 1) OV.seg(g.querySelector('.algo'), cfg.algos.map(a => [a, NAMES[a]]), st.algo, a => { st.algo = a; buildSide(); recompute(); });
  const pre = g.querySelector('.pre');
  (cfg.presets || Object.keys(OV.presets)).forEach(k => OV.button(pre, OV.presets[k].name, () => { st.prob = OV.cloneProb(OV.presets[k]); view.start = null; recompute(); }));
  const tick = OV.onTick((t, dt) => { player.tick(dt); view.showOpt = !isInt() && player.pos >= player.end && player.pos > 0 && st.run.status === 'optimal' && st.algo === 'ipm'; view.draw(t); sideDraw && sideDraw(t); });
  buildSide(); recompute();
  st.destroy = () => OV.ticks.delete(tick);
  return st;
};

/* ================= 4. Simplex ================= */
OV.page({ id: 'simplex', group: 'Solving LPs exactly', title: 'The simplex algorithm', nav: 'Simplex', render(root) {
  OV.head(root, { kicker: 'Algorithms · Simplex', title: 'Simplex: walk the corners', lead: 'If the best point is always a [[corner|vertex]], just visit corners. The [[simplex algorithm|simplex]] starts at one, looks along the edges leaving it, slides along one that improves the objective, and repeats. When no edge goes uphill, it has arrived.' });
  OV.mountLP(root, { algos: ['simplex'], preset: 'polygon', presets: ['polygon', 'energy', 'mincost', 'degenerate', 'unbounded', 'infeasible'] });
  root.appendChild(OV.h('<h2>How one step works</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card"><ol class="steps">
      <li>${P('Add a [[slack variable|slack]] to every constraint, turning inequalities into equations. A corner is a choice of which variables are zero ([[non-basic|nonbasic]]); the rest form the [[basis|basis]].')}</li>
      <li>${P('Compute the [[reduced cost|reduced]] of each non-basic variable: how fast the objective improves if it grows from zero. Pick one with an improving value: the [[entering variable|entering]].')}</li>
      <li>${P('Run the [[ratio test|ratio]]: as the entering variable grows, which basic variable hits zero first? That is the [[leaving variable|leaving]] and tells you how far you can slide.')}</li>
      <li>${P('[[Pivot|pivot]]: swap them in the basis and rewrite the [[tableau|tableau]]. You are now at the neighbouring corner.')}</li>
      <li>${P('Stop when no reduced cost is improving. The slack columns of the final tableau hold the [[shadow prices|shadow]]: the dual solution, for free.')}</li></ol></div>
    <div class="card"><h3>The two formulas that drive it</h3>
      ${OV.math(['{c̄_[j]|reduced} = {c_[j]|coef} − {c_[B]^[T]|basic}{B^[−1]|basis}{A_[j]|acoef}'], 'sm')}<p class="hint" style="text-align:center">reduced cost of variable <i>j</i>: its own value minus the value of the basic variables it would displace</p>
      ${OV.math(['{θ|ratio} = min { {b̄_[i]|rhs} / {ā_[ie]|pivot} :  ā_[ie] &gt; 0 }'], 'sm')}<p class="hint" style="text-align:center">step length: the first constraint you run into along the chosen edge</p></div></div>`));
  OV.ideas(root, [
    ['Fast in practice, exponential on paper', 'Contrived problems (the Klee–Minty cube) force simplex to visit every one of 2ⁿ corners. Real problems almost never do: the number of pivots typically grows only linearly with the number of constraints.'],
    ['Stalling and cycling', 'At a [[degenerate|degenerate]] corner a pivot can change the basis without moving. Try the Degenerate preset. Anti-cycling rules such as Bland\'s guarantee simplex still terminates.'],
    ['Why solvers still love it', 'Simplex can restart from a previous basis after the problem changes slightly (a "warm start"). That makes the dual simplex the engine inside [[branch and bound|bnb]], where thousands of nearly identical LPs are solved.']
  ]);
} });

/* ================= 5. Interior point ================= */
OV.page({ id: 'ipm', group: 'Solving LPs exactly', title: 'Interior-point methods', nav: 'Interior point', render(root) {
  OV.head(root, { kicker: 'Algorithms · Interior point', title: 'Interior point: cut through the middle', lead: 'Rather than crawling around the boundary, an [[interior-point method|ipm]] tunnels straight through the feasible region. A [[barrier|barrier]] repels it from the walls; as the barrier is gradually switched off, the iterates glide along the [[central path|central]] to the optimum.' });
  OV.mountLP(root, { algos: ['ipm'], preset: 'energy', presets: ['energy', 'polygon', 'mincost', 'degenerate', 'unbounded'] });
  root.appendChild(OV.h('<h2>The idea in one equation</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math(['{max|max}  {c|coef}^[T]{x|var}  +  {μ|mu} {Σ_[i] log( b_[i] − a_[i]^[T]x )|barrier}'], 'sm')}
      <p>${P('The logarithm of each [[slack|slack]] plunges to −∞ at the wall, so the maximiser of this smooth function stays strictly inside. The purple glow in the picture is this function: watch it tighten around the optimum as $μ$ falls. Each iteration is a [[Newton step|newton]] toward its peak.')}</p></div>
    <div class="card">${OV.math(['{s_[i]|slack} · {y_[i]|dualvar} = {μ|mu}     ⇒     {gap|gap} = {m|con} · {μ|mu}'], 'sm')}
      <p>${P('On the central path every slack times its price equals $μ$: a relaxed version of [[complementary slackness|cs]], where the product should be 0. Summing over the $m$ constraints gives the [[duality gap|gap]] exactly. So shrinking $μ$ <i>is</i> closing the gap, and the method knows precisely how close to optimal it is.')}</p></div></div>`));
  OV.ideas(root, [
    ['Few, expensive steps', 'Simplex takes many cheap steps; interior point takes 20 to 60 heavy ones, almost regardless of problem size. Each solves one large linear system. On huge, sparse LPs (a year of hourly dispatch) it usually wins.'],
    ['Provably polynomial', 'Karmarkar showed in 1984 that an interior method solves any LP in polynomial time, something simplex cannot promise. Modern solvers use a primal-dual variant (Mehrotra predictor-corrector) that updates $x$ and $y$ together.'],
    ['It never quite arrives', 'The answer sits a hair inside the region, not on a [[vertex|vertex]]. A [[crossover|crossover]] phase then snaps to an exact corner and recovers a [[basis|basis]], needed for clean [[shadow prices|shadow]] and for warm-starting simplex.']
  ]);
} });

/* ================= 6. Branch & bound ================= */
OV.page({ id: 'bnb', group: 'Integer decisions', title: 'Branch and bound', nav: 'Branch & bound', render(root) {
  OV.head(root, { kicker: 'Algorithms · Integer programming', title: 'Branch and bound: divide, bound, discard', lead: 'You cannot build 2.83 turbines. Require [[whole numbers|integer]] and the feasible set shatters into isolated dots; the corner trick no longer works. [[Branch and bound|bnb]] solves a tree of ordinary LPs instead, using their optima as [[bounds|bound]] to prove most of the tree need never be explored.' });
  OV.mountLP(root, { algos: ['bnb'], preset: 'integer', presets: ['integer', 'knapsack', 'polygon', 'energy', 'degenerate'] });
  root.appendChild(OV.h('<h2>The logic</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card"><ol class="steps">
      <li>${P('Solve the [[LP relaxation|relax]]. If the answer happens to be integer, you are done. Otherwise its value is an optimistic [[bound|bound]].')}</li>
      <li>${P('[[Branch|branch]] on a fractional variable: $x ≤ ⌊v⌋$ in one child, $x ≥ ⌈v⌉$ in the other. The strip in between holds no integer points.')}</li>
      <li>${P('Solve each child. An integer answer becomes the [[incumbent|incumbent]] if it beats the previous one.')}</li>
      <li>${P('[[Prune|prune]] a node if it is infeasible, integer, or its bound is no better than the incumbent.')}</li>
      <li>${P('Stop when no open nodes remain, or when the [[MIP gap|mipgap]] is small enough.')}</li></ol></div>
    <div class="card"><h3>The sandwich</h3>${OV.math(['{incumbent|incumbent}  ≤  {z*|global}  ≤  {best bound|bound}', '{MIP gap|mipgap} = ( bound − incumbent ) / | incumbent |'], 'sm')}
      <p>${P('For a maximisation, any integer solution is a floor and the best relaxation among open nodes is a ceiling. The true optimum is trapped between them. This is the [[duality gap|gap]] idea again: the relaxation plays the role of the dual. When solvers report "gap 0.5%", this is what they mean.')}</p></div></div>`));
  OV.ideas(root, [
    ['Why rounding is not enough', 'Rounding the LP optimum can be infeasible, or feasible but far from best. Toggle <b>Show integer hull</b>: the true integer optimum is a corner of the [[hull|hull]], which may be nowhere near the LP corner.'],
    ['Search order matters', 'Best-bound-first raises the proof fastest; depth-first finds incumbents fastest. Real solvers blend both, and add heuristics to find good incumbents early so that more can be pruned.'],
    ['Hard in theory', 'Integer programming is [[NP-hard|nphard]]: the tree can double with every variable. What makes it work in practice is tight bounds. That is the job of cutting planes, next.']
  ]);
} });

/* ================= 7. Branch & cut ================= */
OV.page({ id: 'bnc', group: 'Integer decisions', title: 'Branch and cut', nav: 'Branch & cut', render(root) {
  OV.head(root, { kicker: 'Algorithms · Integer programming', title: 'Branch and cut: sharpen the relaxation', lead: 'Branching is expensive: every split doubles the work. A [[cutting plane|cut]] is cheaper: one extra constraint that slices off the fractional corner while keeping every integer point. [[Branch and cut|bnc]] adds cuts at each node before branching, shrinking the tree dramatically. It is how every modern MILP solver works.' });
  OV.mountLP(root, { algos: ['bnc'], preset: 'integer', presets: ['integer', 'knapsack', 'polygon', 'energy', 'degenerate'] });
  root.appendChild(OV.h('<h2>What makes a cut valid</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math(['{π^[T]x ≤ π_[0]|cut}   for every integer-feasible {x|integer}', 'but   {π^[T]x* &gt; π_[0]|cut}   at the fractional LP optimum {x*|relax}'], 'sm')}
      <p>${P('A cut removes part of the LP [[feasible region|region]] but none of the integer solutions. The tightest possible cuts are the faces of the [[integer hull|hull]]. In this demo the problem is tiny, so we can compute those faces exactly; real solvers cannot, and instead generate families such as [[Gomory|gomory]], MIR, cover and clique cuts that approximate them.')}</p></div>
    <div class="card"><h3>Why it helps</h3><p>${P('Each cut lowers the [[bound|bound]] toward the true integer optimum. A tighter bound means more nodes are [[pruned|prune]], and the [[MIP gap|mipgap]] closes from the bound side as well as from the incumbent side. Compare the node counts under the tree, then try raising the cut rounds.')}</p>
      <p>${P('The trade-off: every cut makes each LP a little bigger and slower. Solvers add many cuts at the root, fewer deeper in the tree.')}</p></div></div>`));
  OV.ideas(root, [
    ['If we knew the hull…', 'With the full [[integer hull|hull]] as constraints, the LP optimum would already be integer and no branching would be needed. Cuts build just the part of the hull near the optimum.'],
    ['Formulation is everything', 'Two models with the same integer solutions can have very different LP relaxations. A "tight" formulation, whose relaxation hugs the hull, can solve thousands of times faster. This is the craft of MILP modelling.'],
    ['The modern recipe', 'Presolve, root cuts, primal heuristics, then branch and cut with dual simplex warm starts. On the unit commitment page you will watch the same bound and incumbent curves on a real scheduling problem.']
  ]);
} });
})();
