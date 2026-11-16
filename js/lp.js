/* Optimisation Explorer — engines: 2-D LP geometry, simplex with tableau, barrier interior point,
   branch & bound / cut, and a general dense two-phase simplex (with duals) for the energy models. */
(function () {
'use strict';
const OV = window.OV, BIG = 1e4, EPS = 1e-9;
const dot = (a, p) => a[0] * p[0] + a[1] * p[1];
const LP = OV.LP = { BIG };

/* A 2-D problem: {sense:'max'|'min', c:[c1,c2], cons:[{a:[a1,a2], b, sense:'<='|'>=', name}]}, x >= 0 implied */
const le = k => k.sense === '>=' ? { a: [-k.a[0], -k.a[1]], b: -k.b } : { a: k.a, b: k.b };
LP.le = le;

function clip(poly, a, b) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], fp = dot(a, p) - b, fq = dot(a, q) - b;
    if (fp <= EPS) out.push(p);
    if ((fp < -EPS && fq > EPS) || (fp > EPS && fq < -EPS)) { const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}
function dedupe(poly) {
  const out = [];
  poly.forEach(p => { if (!out.some(q => Math.abs(q[0] - p[0]) < 1e-7 && Math.abs(q[1] - p[1]) < 1e-7)) out.push(p); });
  return out;
}
LP.region = (prob, extra, box) => {
  const B = box || [BIG, BIG];
  let poly = [[0, 0], [B[0], 0], [B[0], B[1]], [0, B[1]]];
  for (const k of prob.cons.concat(extra || [])) { const l = le(k); poly = clip(poly, l.a, l.b); if (!poly.length) break; }
  return dedupe(poly);
};
const better = (prob, a, b) => prob.sense === 'min' ? a < b - 1e-9 : a > b + 1e-9;
LP.better = better;
LP.solve2D = (prob, extra) => {
  const poly = LP.region(prob, extra);
  if (!poly.length) return { status: 'infeasible', poly };
  let best = null;
  for (const p of poly) {
    const v = dot(prob.c, p), nrm = p[0] + p[1];
    if (!best || better(prob, v, best.obj) || (Math.abs(v - best.obj) < 1e-9 && nrm < best.nrm)) best = { x: p, obj: v, nrm };
  }
  if (Math.max(best.x[0], best.x[1]) > BIG / 2) return { status: 'unbounded', poly };
  return { status: 'optimal', x: best.x, obj: best.obj, poly };
};
LP.feasible = (prob, p, tol = 1e-7) => p[0] >= -tol && p[1] >= -tol && prob.cons.every(k => { const l = le(k); return dot(l.a, p) <= l.b + tol; });

/* standard form: max c.x, A x <= b, x >= 0 */
function std(prob) {
  const sign = prob.sense === 'min' ? -1 : 1, rows = prob.cons.map(le);
  return { c: [sign * prob.c[0], sign * prob.c[1]], A: rows.map(r => r.a.slice()), b: rows.map(r => r.b), sign };
}
LP.vname = j => j < 2 ? 'x' + '₁₂'[j] : 's' + '₁₂₃₄₅₆₇₈₉'[j - 2];

/* ---------- simplex with full tableau ---------- */
function tableauFor(S, basis) {
  const m = S.A.length, N = 2 + m;
  const T = S.A.map((a, i) => { const r = new Array(N + 1).fill(0); r[0] = a[0]; r[1] = a[1]; r[2 + i] = 1; r[N] = S.b[i]; return r; });
  for (let k = 0; k < m; k++) {
    const col = basis[k]; let p = k;
    for (let r = k + 1; r < m; r++) if (Math.abs(T[r][col]) > Math.abs(T[p][col])) p = r;
    if (Math.abs(T[p][col]) < 1e-10) return null;
    [T[k], T[p]] = [T[p], T[k]];
    const d = T[k][col]; for (let j = 0; j <= N; j++) T[k][j] /= d;
    for (let r = 0; r < m; r++) if (r !== k) { const f = T[r][col]; if (f) for (let j = 0; j <= N; j++) T[r][j] -= f * T[k][j]; }
  }
  return T;
}
function basisAt(S, p) {
  const m = S.A.length, cand = [];
  if (Math.abs(p[0]) < 1e-7) cand.push([0, [1, 0]]);
  if (Math.abs(p[1]) < 1e-7) cand.push([1, [0, 1]]);
  S.A.forEach((a, i) => { if (Math.abs(S.b[i] - dot(a, p)) < 1e-7) cand.push([2 + i, a]); });
  for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
    if (Math.abs(cand[i][1][0] * cand[j][1][1] - cand[i][1][1] * cand[j][1][0]) > 1e-7) {
      const out = [cand[i][0], cand[j][0]], basis = [];
      for (let v = 0; v < 2 + m; v++) if (!out.includes(v)) basis.push(v);
      return basis;
    }
  }
  return null;
}
LP.simplexSteps = prob => {
  const S = std(prob), m = S.A.length, N = 2 + m, sol = LP.solve2D(prob), steps = [], F = OV.fmt, vn = LP.vname;
  if (sol.status === 'infeasible') return { status: 'infeasible', steps: [{ x: null, msg: '<span class="tag">Infeasible</span><br>No point satisfies every constraint, so there is no vertex to start from. Phase I of simplex would report this.' }] };
  let basis, phase1 = false;
  if (S.b.every(v => v >= -1e-9)) basis = S.A.map((_, i) => 2 + i);
  else {
    phase1 = true; let w = null;
    sol.poly.forEach(p => { if (Math.max(p[0], p[1]) < BIG / 2) { const v = dot(S.c, p); if (!w || v < w.v) w = { p, v }; } });
    basis = w && basisAt(S, w.p);
    if (!basis) return { status: 'error', steps: [{ x: null, msg: 'Could not find a starting vertex for this shape. Try nudging a constraint.' }] };
  }
  let T = tableauFor(S, basis);
  if (!T) return { status: 'error', steps: [{ x: null, msg: 'Degenerate starting basis. Try nudging a constraint.' }] };
  let status = 'limit', y = null;
  for (let it = 0; it < 40; it++) {
    const cB = basis.map(j => j < 2 ? S.c[j] : 0), r = [];
    for (let j = 0; j < N; j++) { let z = 0; for (let i = 0; i < m; i++) z += cB[i] * T[i][j]; r.push((j < 2 ? S.c[j] : 0) - z); }
    const x = [0, 0]; basis.forEach((j, i) => { if (j < 2) x[j] = Math.max(0, T[i][N]); });
    const obj = dot(S.c, x) * S.sign;
    let enter = -1, bestR = 1e-7;
    for (let j = 0; j < N; j++) if (!basis.includes(j) && r[j] > bestR) { if (it > 14) { enter = j; break; } bestR = r[j]; enter = j; }
    const base = { x, basis: basis.slice(), T: T.map(q => q.slice()), r, obj, enter: -1, leave: -1, ratios: [] };
    const where = `At vertex <b>(${F(x[0])}, ${F(x[1])})</b>, objective <b>${F(obj)}</b>.`;
    if (enter < 0) {
      y = S.A.map((_, i) => Math.max(0, -r[2 + i]));
      base.final = true; base.y = y;
      base.msg = `<span class="tag">Optimal</span><br>${where} Every reduced cost is ≤ 0: no edge leads uphill, so this vertex is <b>optimal</b>. The reduced costs of the slacks, sign-flipped, are the shadow prices: ${y.map((v, i) => `y${'₁₂₃₄₅₆₇₈₉'[i]} = ${F(v)}`).join(', ')}.`;
      steps.push(base); status = 'optimal'; break;
    }
    let leave = -1, br = Infinity; const ratios = [];
    for (let i = 0; i < m; i++) {
      const v = T[i][enter], q = v > 1e-9 ? Math.max(0, T[i][N]) / v : null; ratios.push(q);
      if (q != null && (q < br - 1e-10 || (Math.abs(q - br) <= 1e-10 && basis[i] < basis[leave]))) { br = q; leave = i; }
    }
    base.enter = enter; base.ratios = ratios;
    const cands = r.map((v, j) => (!basis.includes(j) && v > 1e-7) ? `${vn(j)}: +${F(v)}` : null).filter(Boolean).join(', ');
    if (leave < 0) {
      base.unbounded = true; base.ray = [enter === 0 ? 1 : -(T[basis.indexOf(0)] || [])[enter] || 0, enter === 1 ? 1 : -(T[basis.indexOf(1)] || [])[enter] || 0];
      base.msg = `<span class="tag">Unbounded</span><br>${where} ${vn(enter)} can increase forever: no constraint ever blocks this edge (the ratio test finds no positive entry). The LP is <b>unbounded</b>.`;
      steps.push(base); status = 'unbounded'; break;
    }
    base.leave = leave;
    base.msg = `<span class="tag">Pivot ${it + 1}${it === 0 && phase1 ? ' (after Phase I)' : ''}</span><br>${where} Improving directions (reduced costs): ${cands}. <b class="c-green">${vn(enter)} enters</b>${it > 14 ? ' (Bland\'s rule)' : ' (steepest)'}. Ratio test: the first constraint hit is row ${vn(basis[leave])}, so <b class="c-red">${vn(basis[leave])} leaves</b> after a step of ${F(br)}.${br < 1e-9 ? ' <i>Degenerate pivot: the basis changes but the point does not move.</i>' : ''}`;
    steps.push(base);
    const d = T[leave][enter]; for (let j = 0; j <= N; j++) T[leave][j] /= d;
    for (let i = 0; i < m; i++) if (i !== leave) { const f = T[i][enter]; if (f) for (let j = 0; j <= N; j++) T[i][j] -= f * T[leave][j]; }
    basis[leave] = enter;
  }
  const lastS = steps[steps.length - 1];
  return { status, steps, x: lastS.x, obj: lastS.obj, y, phase1 };
};

/* ---------- barrier (interior-point) in 2-D ---------- */
function ineqs(prob) {
  const S = std(prob), G = S.A.map((a, i) => ({ a, b: S.b[i] }));
  G.push({ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 });
  return { c: S.c, G, sign: S.sign, m: S.A.length };
}
LP.ineqs = ineqs;
const interior = (I, x) => I.G.every(k => k.b - dot(k.a, x) > 1e-9);
LP.phi = (I, x, mu) => { let v = dot(I.c, x); for (const k of I.G) { const s = k.b - dot(k.a, x); if (s <= 0) return -Infinity; v += mu * Math.log(s); } return v; };
function newton(I, x, mu) {
  let g0 = I.c[0], g1 = I.c[1], h0 = 0, h1 = 0, h2 = 0;
  for (const k of I.G) { const s = k.b - dot(k.a, x), w = mu / (s * s); g0 -= mu * k.a[0] / s; g1 -= mu * k.a[1] / s; h0 += w * k.a[0] * k.a[0]; h1 += w * k.a[0] * k.a[1]; h2 += w * k.a[1] * k.a[1]; }
  const det = h0 * h2 - h1 * h1; if (!(Math.abs(det) > 1e-300)) return x;
  const dx = [(h2 * g0 - h1 * g1) / det, (h0 * g1 - h1 * g0) / det];
  let al = 1;
  for (const k of I.G) { const ad = dot(k.a, dx); if (ad > 0) al = Math.min(al, 0.92 * (k.b - dot(k.a, x)) / ad); }
  const f0 = LP.phi(I, x, mu);
  for (let i = 0; i < 30; i++) { const xn = [x[0] + al * dx[0], x[1] + al * dx[1]]; if (LP.phi(I, xn, mu) >= f0 - 1e-12) return xn; al *= .5; }
  return x;
}
LP.interiorPoint = (prob, range) => {
  const poly = LP.region(prob, null, range);
  if (poly.length < 3) return null;
  const p = [0, 0]; poly.forEach(q => { p[0] += q[0] / poly.length; p[1] += q[1] / poly.length; });
  return interior(ineqs(prob), p) ? p : null;
};
LP.centre = (prob, mu, x0, iters = 12) => {   // point on the central path for a given mu
  const I = ineqs(prob); let x = x0; if (!x || !interior(I, x)) return null;
  for (let i = 0; i < iters; i++) x = newton(I, x, mu);
  return x;
};
LP.bounded = prob => LP.region(prob).every(p => Math.max(p[0], p[1]) < BIG / 2);
LP.centralPath = (prob, range) => {
  if (!LP.bounded(prob)) return null;
  const I = ineqs(prob), x0 = LP.interiorPoint(prob, range); if (!x0) return null;
  let x = x0; const I0 = { c: [0, 0], G: I.G };
  for (let i = 0; i < 40; i++) x = newton(I0, x, 1);
  const centre = x, cn = Math.hypot(I.c[0], I.c[1]) || 1, pts = [{ x, mu: Infinity }];
  for (let k = 0; k < 110; k++) { const mu = cn * 60 * Math.pow(.84, k); for (let i = 0; i < 4; i++) x = newton(I, x, mu); pts.push({ x, mu }); }
  return { centre, pts };
};
LP.barrierSteps = (prob, x0, o = {}) => {
  const I = ineqs(prob), F = OV.fmt, sigma = o.sigma || .5, mG = I.G.length, cn = Math.hypot(I.c[0], I.c[1]) || 1;
  if (!x0 || !interior(I, x0)) return { status: 'nostart', steps: [{ x: null, msg: '<span class="tag">No interior</span><br>Interior-point methods need a point strictly inside the feasible region. This region is empty or has no interior.' }] };
  let x = x0.slice(), mu = o.mu0 || cn * 1.5; const steps = [];
  const rec = (phase, msg) => {
    const s = I.G.map(k => k.b - dot(k.a, x)), y = s.map(v => mu / v), obj = dot(I.c, x) * I.sign;
    let dualObj = 0; I.G.forEach((k, i) => dualObj += k.b * y[i]);
    steps.push({ x: x.slice(), mu, obj, dualObj: dualObj * I.sign, gap: mG * mu, y: y.slice(0, I.m), phase, msg });
  };
  rec('start', `<span class="tag">Start</span><br>Begin at an interior point <b>(${F(x[0])}, ${F(x[1])})</b>, safely away from every wall, with a strong barrier μ = ${F(mu)}.`);
  for (let i = 0; i < 3; i++) { x = newton(I, x, mu); rec('centre', `<span class="tag">Centring</span><br>Newton step ${i + 1} at fixed μ = ${F(mu)}: head for the central path, the point that best balances "improve the objective" against "stay away from the walls".`); }
  let status = 'limit';
  for (let k = 0; k < 60; k++) {
    mu *= sigma; for (let q = 0; q < 6; q++) x = newton(I, x, mu);
    if (Math.hypot(x[0], x[1]) > 1e3) { status = 'unbounded'; rec('unb', '<span class="tag">Unbounded</span><br>The iterates are running off to infinity: nothing stops the objective improving. The LP is unbounded.'); break; }
    const gap = mG * mu;
    rec('follow', `<span class="tag">Iteration ${k + 1}</span><br>Shrink the barrier: μ ← ${F(sigma)}·μ = <b>${mu < .01 ? mu.toExponential(1) : F(mu, 3)}</b>, then take Newton steps toward the new centre. The duality gap is about (number of constraints) × μ = <b>${gap < .01 ? gap.toExponential(1) : F(gap, 3)}</b>. Objective ${F(dot(I.c, x) * I.sign, 3)}.`);
    if (gap < 1e-6 * (1 + Math.abs(dot(I.c, x)))) { status = 'optimal'; break; }
  }
  if (status === 'optimal') steps[steps.length - 1].msg += '<br><b>Converged.</b> The gap is below tolerance, so this point is provably within a hair of optimal. A "crossover" step would snap it onto the exact vertex.';
  return { status, steps, x, obj: dot(I.c, x) * I.sign };
};

/* ---------- integer programming: branch & bound / branch & cut ---------- */
LP.intPoints = (prob, lim = 30) => { const pts = []; for (let i = 0; i <= lim; i++) for (let j = 0; j <= lim; j++) if (LP.feasible(prob, [i, j])) pts.push([i, j]); return pts; };
LP.intOpt = (prob, lim = 30) => { let best = null; LP.intPoints(prob, lim).forEach(p => { const v = dot(prob.c, p); if (!best || better(prob, v, best.obj)) best = { x: p, obj: v }; }); return best; };
function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
LP.intHull = (prob, lim = 30) => hull(LP.intPoints(prob, lim));
LP.hullCuts = (prob, lim = 30) => {       // facets of the integer hull, as <= constraints
  const reg = LP.region(prob); if (!reg.length || reg.some(p => Math.max(p[0], p[1]) > lim)) return [];
  const H = LP.intHull(prob, lim), cuts = []; if (H.length < 2) return [];
  for (let i = 0; i < H.length; i++) {
    const p = H[i], q = H[(i + 1) % H.length], n = [q[1] - p[1], -(q[0] - p[0])], len = Math.hypot(n[0], n[1]); if (len < 1e-9) continue;
    cuts.push({ a: [n[0] / len, n[1] / len], b: dot(n, p) / len, sense: '<=', cut: true });
  }
  return cuts;
};
const isFrac = v => Math.abs(v - Math.round(v)) > 1e-6;
LP.bnbSteps = (prob, o = {}) => {
  o = Object.assign({ strategy: 'best', cuts: false, cutRounds: 2, maxNodes: 61 }, o);
  const F = OV.fmt, nodes = [], steps = [], cuts = [], facets = o.cuts ? LP.hullCuts(prob) : [], used = new Set();
  let inc = null, open = [], nLP = 0;
  const mk = (par, lo, hi, label) => { const nd = { id: nodes.length, parent: par ? par.id : -1, lo, hi, label, status: 'open', bound: par ? par.obj : null, depth: par ? par.depth + 1 : 0 }; nodes.push(nd); open.push(nd); return nd; };
  const bcons = nd => { const r = []; for (let j = 0; j < 2; j++) { const a = j ? [0, 1] : [1, 0]; if (nd.lo[j] > 0) r.push({ a, b: nd.lo[j], sense: '>=' }); if (isFinite(nd.hi[j])) r.push({ a, b: nd.hi[j], sense: '<=' }); } return r; };
  const gbound = () => { let b = inc ? inc.obj : null; nodes.forEach(n => { if (n.status === 'open' || n.status === 'active') { const v = n.bound == null ? (n.obj != null ? n.obj : null) : n.bound; if (v != null && (b == null || better(prob, v, b))) b = v; } }); return b; };
  const snap = e => steps.push(Object.assign({ nodes: nodes.map(n => Object.assign({}, n)), cuts: cuts.slice(), inc: inc && Object.assign({}, inc), bound: gbound(), nLP }, e));
  mk(null, [0, 0], [Infinity, Infinity], 'root');
  snap({ type: 'init', cur: 0, msg: `<span class="tag">Start</span><br>Ignore the integer requirement and solve the <b>LP relaxation</b> first. Its optimum is an optimistic bound on any integer solution.` });
  while (open.length) {
    if (nodes.length >= o.maxNodes) { snap({ type: 'limit', cur: -1, msg: '<span class="tag">Node limit</span><br>Stopped at the node limit for this demo. Real solvers stop on a time limit or MIP-gap tolerance in the same way, and report the remaining gap.' }); break; }
    let k = open.length - 1;
    if (o.strategy === 'best') { k = 0; for (let i = 1; i < open.length; i++) if (open[i].bound != null && (open[k].bound == null || better(prob, open[i].bound, open[k].bound))) k = i; }
    const nd = open.splice(k, 1)[0], name = `Node ${nd.id}` + (nd.label !== 'root' ? ` (${nd.label})` : '');
    if (inc && nd.bound != null && !better(prob, nd.bound, inc.obj)) {
      nd.status = 'pruned';
      snap({ type: 'node', cur: nd.id, msg: `<span class="tag">${name}: pruned unsolved</span><br>Its parent's bound (${F(nd.bound)}) is no better than the incumbent (${F(inc.obj)}), so nothing in this branch can win. Discard it without solving anything.` }); continue;
    }
    nd.status = 'active';
    let sol = LP.solve2D(prob, cuts.concat(bcons(nd))); nLP++;
    if (sol.status === 'unbounded') { nd.status = 'pruned'; snap({ type: 'unbounded', cur: nd.id, msg: '<span class="tag">Unbounded</span><br>The relaxation is unbounded, so branch and bound cannot start. Add a constraint to close the region.' }); break; }
    for (let r = 0; o.cuts && r < o.cutRounds && sol.status === 'optimal' && (isFrac(sol.x[0]) || isFrac(sol.x[1])); r++) {
      let bi = -1, bv = 1e-6;
      facets.forEach((f, i) => { if (!used.has(i)) { const v = dot(f.a, sol.x) - f.b; if (v > bv) { bv = v; bi = i; } } });
      if (bi < 0) break;
      const before = sol.x.slice(), bObj = sol.obj; used.add(bi); cuts.push(facets[bi]);
      sol = LP.solve2D(prob, cuts.concat(bcons(nd))); nLP++;
      nd.x = sol.x; nd.obj = sol.obj;
      snap({ type: 'cut', cur: nd.id, x: sol.status === 'optimal' ? sol.x : null, before, cut: facets[bi], msg: `<span class="tag">${name}: add a cut</span><br>The LP optimum (${F(before[0])}, ${F(before[1])}) is fractional. Add a <b class="c-pink">cutting plane</b> that slices it off but keeps every integer point. Re-solving, the bound tightens from ${F(bObj)} to <b>${sol.status === 'optimal' ? F(sol.obj) : 'infeasible'}</b>.` });
    }
    if (sol.status === 'infeasible') { nd.status = 'infeasible'; snap({ type: 'node', cur: nd.id, msg: `<span class="tag">${name}: infeasible</span><br>The branching bounds leave no feasible point. <b class="c-red">Prune</b>: nothing to explore here.` }); continue; }
    nd.x = sol.x; nd.obj = sol.obj;
    const at = `LP optimum <b>(${F(sol.x[0])}, ${F(sol.x[1])})</b>, value <b>${F(sol.obj)}</b>.`;
    if (inc && !better(prob, sol.obj, inc.obj)) { nd.status = 'pruned'; snap({ type: 'node', cur: nd.id, x: sol.x, msg: `<span class="tag">${name}: pruned by bound</span><br>${at} Even this optimistic bound cannot beat the incumbent ${F(inc.obj)}. <b class="c-amber">Prune</b> the whole branch.` }); continue; }
    const f0 = isFrac(sol.x[0]), f1 = isFrac(sol.x[1]);
    if (!f0 && !f1) {
      nd.status = 'integer'; inc = { x: [Math.round(sol.x[0]), Math.round(sol.x[1])], obj: sol.obj, node: nd.id };
      snap({ type: 'node', cur: nd.id, x: sol.x, msg: `<span class="tag">${name}: integer!</span><br>${at} Both variables are whole numbers, so this is a real solution and the <b class="c-green">new incumbent</b>. Any open node with a bound no better than ${F(sol.obj)} can now be pruned.` }); continue;
    }
    const d0 = Math.abs(sol.x[0] - Math.floor(sol.x[0]) - .5), d1 = Math.abs(sol.x[1] - Math.floor(sol.x[1]) - .5);
    const j = f0 && (!f1 || d0 <= d1) ? 0 : 1, v = sol.x[j], xn = 'x' + '₁₂'[j];
    nd.status = 'branched'; nd.bvar = j; nd.bval = v;
    const hi = nd.hi.slice(), lo = nd.lo.slice(); hi[j] = Math.floor(v); lo[j] = Math.ceil(v);
    const up = { lo, hi: nd.hi.slice(), label: `${xn} ≥ ${Math.ceil(v)}` }, dn = { lo: nd.lo.slice(), hi, label: `${xn} ≤ ${Math.floor(v)}` };
    mk(nd, dn.lo, dn.hi, dn.label); mk(nd, up.lo, up.hi, up.label);
    snap({ type: 'node', cur: nd.id, x: sol.x, msg: `<span class="tag">${name}: branch</span><br>${at} ${xn} = ${F(v)} is fractional. <b class="c-cyan">Branch</b>: create two children, one with ${xn} ≤ ${Math.floor(v)} and one with ${xn} ≥ ${Math.ceil(v)}. The strip between them contains no integer points, so nothing is lost.` });
  }
  const last = steps[steps.length - 1];
  if (last.type !== 'limit' && last.type !== 'unbounded') snap({ type: 'done', cur: -1, msg: inc ? `<span class="tag">Done</span><br>No open nodes remain: bound and incumbent have met, so the gap is zero. <b>Optimal integer solution (${inc.x[0]}, ${inc.x[1]})</b> with value <b>${F(inc.obj)}</b>, proven after ${nodes.length} nodes and ${nLP} LP solves.` : '<span class="tag">Done</span><br>Every branch was infeasible: there is no integer solution.' });
  return { steps, nodes, inc, cuts, nLP, status: inc ? 'optimal' : 'infeasible' };
};

/* ---------- general LP: dense two-phase simplex with duals ----------
   min c.x  s.t.  A[i].x (<=|>=|=) b[i],  lb <= x <= ub (lb default 0)
   returns {status, x, obj, y (row duals = d obj / d b), ubDual, iters} */
OV.solveLP = P => {
  const n = P.c.length, lb = P.lb || null, R = [];
  P.A.forEach((a, i) => R.push({ a: a.slice(), s: P.sense[i], b: P.b[i] }));
  const ubRow = new Array(n).fill(-1);
  if (P.ub) P.ub.forEach((u, j) => { if (u != null && isFinite(u)) { const a = new Array(n).fill(0); a[j] = 1; ubRow[j] = R.length; R.push({ a, s: '<=', b: u }); } });
  let c0 = 0;
  if (lb) { R.forEach(r => { let s = 0; for (let j = 0; j < n; j++) if (lb[j]) s += r.a[j] * lb[j]; r.b -= s; }); for (let j = 0; j < n; j++) c0 += P.c[j] * (lb[j] || 0); }
  const m = R.length, sgn = new Array(m).fill(1);
  R.forEach((r, i) => { if ((r.s === '>=' && r.b <= 0) || (r.s === '<=' && r.b < 0) || (r.s === '=' && r.b < 0)) { for (let j = 0; j < n; j++) r.a[j] = -r.a[j]; r.b = -r.b; r.s = r.s === '>=' ? '<=' : r.s === '<=' ? '>=' : '='; sgn[i] = -1; } });
  let ns = 0, na = 0; R.forEach(r => { if (r.s !== '=') ns++; if (r.s !== '<=') na++; });
  const artStart = n + ns, nc = n + ns + na, T = [], basis = new Array(m), idcol = new Array(m);
  let si = n, ai = artStart;
  R.forEach((r, i) => {
    const row = new Float64Array(nc + 1); for (let j = 0; j < n; j++) row[j] = r.a[j]; row[nc] = r.b;
    if (r.s === '<=') { row[si] = 1; basis[i] = si; idcol[i] = si; si++; }
    else { if (r.s === '>=') { row[si] = -1; si++; } row[ai] = 1; basis[i] = ai; idcol[i] = ai; ai++; }
    T.push(row);
  });
  const z2 = new Float64Array(nc + 1), z1 = new Float64Array(nc + 1);
  for (let j = 0; j < n; j++) z2[j] = P.c[j];
  for (let i = 0; i < m; i++) if (basis[i] >= artStart) for (let j = 0; j <= nc; j++) if (j < artStart || j === nc) z1[j] -= T[i][j];
  let iters = 0;
  const pivot = (l, e) => {
    const pr = T[l], d = pr[e]; for (let j = 0; j <= nc; j++) pr[j] /= d;
    for (let i = 0; i < m; i++) if (i !== l) { const f = T[i][e]; if (f !== 0) { const ri = T[i]; for (let j = 0; j <= nc; j++) if (pr[j] !== 0) ri[j] -= f * pr[j]; ri[e] = 0; if (ri[nc] < 0 && ri[nc] > -1e-9) ri[nc] = 0; } }
    for (const z of [z1, z2]) { const f = z[e]; if (f !== 0) { for (let j = 0; j <= nc; j++) if (pr[j] !== 0) z[j] -= f * pr[j]; z[e] = 0; } }
    basis[l] = e; iters++;
  };
  const run = (z, lim) => {
    let stall = 0, bland = false;
    for (let it = 0; it < 20000; it++) {
      let e = -1, best = -1e-9;
      if (bland) { for (let j = 0; j < lim; j++) if (z[j] < -1e-9) { e = j; break; } }
      else for (let j = 0; j < lim; j++) if (z[j] < best) { best = z[j]; e = j; }
      if (e < 0) return 'opt';
      let l = -1, br = Infinity;
      for (let i = 0; i < m; i++) { const v = T[i][e]; if (v > 1e-9) { const q = T[i][nc] / v; if (q < br - 1e-12 || (q < br + 1e-12 && (bland ? basis[i] < basis[l] : v > T[l][e]))) { br = q; l = i; } } }
      if (l < 0) return 'unb';
      if (br < 1e-12) { if (++stall > 40) bland = true; } else { stall = 0; bland = false; }
      pivot(l, e);
    }
    return 'limit';
  };
  if (na) {
    run(z1, nc);
    if (-z1[nc] > 1e-6) return { status: 'infeasible', iters };
    for (let i = 0; i < m; i++) if (basis[i] >= artStart) { let e = -1, bv = 1e-9; for (let j = 0; j < artStart; j++) if (Math.abs(T[i][j]) > bv) { bv = Math.abs(T[i][j]); e = j; } if (e >= 0) pivot(i, e); }
  }
  const st = run(z2, artStart);
  if (st !== 'opt') return { status: st === 'unb' ? 'unbounded' : 'limit', iters };
  const x = new Array(n).fill(0); basis.forEach((j, i) => { if (j < n) x[j] = T[i][nc]; });
  if (lb) for (let j = 0; j < n; j++) x[j] += lb[j] || 0;
  let obj = 0; for (let j = 0; j < n; j++) obj += P.c[j] * x[j];
  const yAll = idcol.map((col, i) => -z2[col] * sgn[i]);
  return { status: 'optimal', x, obj, y: yAll.slice(0, P.A.length), ubDual: ubRow.map(r => r < 0 ? 0 : yAll[r]), iters, m, n };
};
})();
