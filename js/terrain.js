/* Optimisation Explorer — Terrain: an editable non-convex landscape (2-D map + 3-D surface) and the heuristics that search it */
(function () {
'use strict';
const OV = window.OV, C = OV.col, D = 10;   // domain [0,10]^2, minimise f

OV.terrains = {
  rugged: { name: 'Rugged', ripple: 0, bumps: [[7.4, 7.2, -3.2, 1.0], [2.4, 2.6, -2.0, 1.2], [7.3, 2.5, -1.7, 1.0], [2.6, 7.4, -1.5, 1.1], [5, 5, 1.6, 1.3], [4.6, 8.6, 1.0, .9], [8.8, 5, .9, .8]] },
  bowl: { name: 'Single bowl', ripple: 0, bumps: [[6, 5.5, -2.5, 2.4]] },
  twin: { name: 'Two valleys', ripple: 0, bumps: [[2.7, 5, -1.8, 1.5], [7.5, 5, -2.6, 1.1], [5.2, 5, 1.2, 1.0]] },
  trap: { name: 'Deceptive', ripple: 0, bumps: [[3, 3.2, -1.7, 2.3], [8.3, 8.2, -3.4, .75], [6.2, 6.3, 1.1, 1.0]] },
  eggbox: { name: 'Egg-box', ripple: .55, bumps: [[6.5, 6.5, -2.4, 2.2]] }
};
const STOPS = [[0, [10, 16, 60]], [.2, [20, 60, 140]], [.42, [24, 140, 160]], [.62, [70, 190, 130]], [.8, [233, 196, 106]], [1, [250, 240, 215]]];
const cmap = v => { v = OV.clamp(v, 0, 1); for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) { const a = STOPS[i - 1], b = STOPS[i], t = (v - a[0]) / (b[0] - a[0]); return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t]; } return STOPS[STOPS.length - 1][1]; };

OV.Terrain = class {
  constructor(host, o = {}) {
    this.o = o = Object.assign({ W: 560, H: 554, editable: true }, o);
    const { c, ctx } = OV.canvas(host, o.W, o.H); this.c = c; this.ctx = ctx;
    this.m = { l: 14, r: 14, t: 14, b: 14 }; this.mode = '2d'; this.tool = 'valley'; this.yaw = .7; this.spin = true;
    this.start = o.start || [1.2, 8.6]; this.run = null; this.cur = { i: 0, frac: 0 }; this.showGlobal = false; this.drag = null;
    this.heat = document.createElement('canvas'); this.heat.width = this.heat.height = 128;
    this.load(o.preset || 'rugged');
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    c.addEventListener('pointerup', e => { const d = this.drag; this.drag = null; try { c.releasePointerCapture(e.pointerId); } catch (_) { } if (d && d.type === 'new' && !d.moved) this.add(d.p); });
    c.addEventListener('dblclick', e => { if (this.mode !== '2d' || !this.o.editable) return; const k = this.near(OV.mouse(c, e)); if (k >= 0) { this.bumps.splice(k, 1); this.changed(); } });
    c.addEventListener('wheel', e => { if (this.mode !== '2d' || !this.o.editable) return; const k = this.near(OV.mouse(c, e), 26); if (k < 0) return; e.preventDefault(); const b = this.bumps[k]; if (e.shiftKey) b[3] = OV.clamp(b[3] * (e.deltaY < 0 ? 1.1 : .9), .4, 3.5); else b[2] = OV.clamp(b[2] + (e.deltaY < 0 ? .2 : -.2) * Math.sign(b[2] || 1), -5, 5); this.changed(); }, { passive: false });
  }
  load(name) { const p = OV.terrains[name]; this.bumps = p.bumps.map(b => b.slice()); this.ripple = p.ripple; this.rebuild(); }
  f(x, y) {
    let v = .02 * ((x - 5) * (x - 5) + (y - 5) * (y - 5));
    for (const b of this.bumps) { const dx = x - b[0], dy = y - b[1]; v += b[2] * Math.exp(-(dx * dx + dy * dy) / (2 * b[3] * b[3])); }
    if (this.ripple) v += this.ripple * (2 - Math.cos(2.2 * x) - Math.cos(2.2 * y)) * .5;
    return v;
  }
  grad(x, y) {
    let gx = .04 * (x - 5), gy = .04 * (y - 5);
    for (const b of this.bumps) { const dx = x - b[0], dy = y - b[1], s2 = b[3] * b[3], e = b[2] * Math.exp(-(dx * dx + dy * dy) / (2 * s2)); gx -= e * dx / s2; gy -= e * dy / s2; }
    if (this.ripple) { gx += this.ripple * 1.1 * Math.sin(2.2 * x); gy += this.ripple * 1.1 * Math.sin(2.2 * y); }
    return [gx, gy];
  }
  rebuild() {
    const N = 128, img = this.heat.getContext('2d').createImageData(N, N), vals = new Float32Array(N * N); let lo = Infinity, hi = -Infinity, gm = null;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + .5) / N * D, y = (1 - (j + .5) / N) * D, v = this.f(x, y); vals[j * N + i] = v; if (v < lo) { lo = v; gm = [x, y]; } if (v > hi) hi = v; }
    for (let k = 0; k < 60; k++) { const g = this.grad(gm[0], gm[1]); gm = [OV.clamp(gm[0] - .05 * g[0], 0, D), OV.clamp(gm[1] - .05 * g[1], 0, D)]; }
    this.fmin = Math.min(lo, this.f(gm[0], gm[1])); this.fmax = hi; this.gmin = gm;
    const span = (hi - this.fmin) || 1;
    for (let k = 0; k < N * N; k++) { const z = (vals[k] - this.fmin) / span, c = cmap(z), band = (z * 16) % 1, sh = band < .07 ? .72 : 1; img.data[4 * k] = c[0] * sh; img.data[4 * k + 1] = c[1] * sh; img.data[4 * k + 2] = c[2] * sh; img.data[4 * k + 3] = 255; }
    this.heat.getContext('2d').putImageData(img, 0, 0);
    const M = this.M = 46; this.grid = new Float32Array((M + 1) * (M + 1));
    for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) this.grid[j * (M + 1) + i] = (this.f(i / M * D, j / M * D) - this.fmin) / span;
  }
  changed() { this.rebuild(); this.run = null; this.o.onChange && this.o.onChange(); }
  get pw() { return this.o.W - this.m.l - this.m.r; }
  get ph() { return this.o.H - this.m.t - this.m.b; }
  px(p) { return [this.m.l + p[0] / D * this.pw, this.m.t + (1 - p[1] / D) * this.ph]; }
  inv(q) { return [(q[0] - this.m.l) / this.pw * D, (1 - (q[1] - this.m.t) / this.ph) * D]; }
  near(q, r = 15) { for (let k = 0; k < this.bumps.length; k++) { const s = this.px(this.bumps[k]); if (Math.hypot(s[0] - q[0], s[1] - q[1]) < r) return k; } return -1; }
  add(p) { this.bumps.push([p[0], p[1], this.tool === 'hill' ? 1.6 : -2.0, 1.0]); this.changed(); }
  down(e) {
    const q = OV.mouse(this.c, e); this.c.setPointerCapture(e.pointerId); e.preventDefault();
    if (this.mode === '3d') { this.drag = { type: 'rot', x: q[0] }; this.spin = false; return; }
    const s = this.px(this.start);
    if (Math.hypot(s[0] - q[0], s[1] - q[1]) < 18) { this.drag = { type: 'start' }; return; }
    if (!this.o.editable) return;
    const k = this.near(q); if (k >= 0) { this.drag = { type: 'bump', k }; return; }
    this.drag = { type: 'new', p: this.inv(q), q };
  }
  move(e) {
    const q = OV.mouse(this.c, e), d = this.drag;
    if (!d) { if (this.mode === '2d') { const s = this.px(this.start); this.c.style.cursor = Math.hypot(s[0] - q[0], s[1] - q[1]) < 18 || (this.o.editable && this.near(q) >= 0) ? 'grab' : (this.o.editable ? 'crosshair' : ''); } else this.c.style.cursor = 'ew-resize'; return; }
    const p = this.inv(q), cl = [OV.clamp(p[0], 0, D), OV.clamp(p[1], 0, D)];
    if (d.type === 'rot') { this.yaw += (q[0] - d.x) * .01; d.x = q[0]; }
    else if (d.type === 'start') { this.start = cl; this.run = null; this.o.onChange && this.o.onChange(); }
    else if (d.type === 'bump') { this.bumps[d.k][0] = cl[0]; this.bumps[d.k][1] = cl[1]; this.changed(); }
    else if (d.type === 'new' && Math.hypot(q[0] - d.q[0], q[1] - d.q[1]) > 6) d.moved = true;
  }
  /* 3-D projection of a point on the surface */
  p3(x, y, z) {
    const X = (x - 5) / 5, Y = (y - 5) / 5, cs = Math.cos(this.yaw), sn = Math.sin(this.yaw), xr = X * cs - Y * sn, yr = X * sn + Y * cs, S = this.o.W * .34;
    return [this.o.W / 2 + xr * S, this.o.H * .52 - yr * S * .5 - (z - .45) * S * .95, yr];
  }
  zOf(x, y) { return (this.f(x, y) - this.fmin) / ((this.fmax - this.fmin) || 1); }
  P(p, lift = 0) { return this.mode === '3d' ? this.p3(p[0], p[1], this.zOf(p[0], p[1]) + lift) : this.px(p); }
  draw(t, dt) {
    const ctx = this.ctx, o = this.o; ctx.clearRect(0, 0, o.W, o.H);
    if (this.mode === '3d') { if (this.spin) this.yaw += (dt || 0) * .12; this.draw3d(); }
    else {
      ctx.save(); ctx.beginPath(); ctx.roundRect(this.m.l, this.m.t, this.pw, this.ph, 10); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.heat, this.m.l, this.m.t, this.pw, this.ph);
      ctx.restore();
      if (o.editable) this.bumps.forEach(b => { const q = this.px(b), up = b[2] > 0; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.arc(q[0], q[1], b[3] / D * this.pw, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = up ? 'rgba(30,20,10,.75)' : 'rgba(255,255,255,.85)'; ctx.beginPath(); if (up) { ctx.moveTo(q[0], q[1] - 6); ctx.lineTo(q[0] + 6, q[1] + 5); ctx.lineTo(q[0] - 6, q[1] + 5); } else { ctx.moveTo(q[0], q[1] + 6); ctx.lineTo(q[0] + 6, q[1] - 5); ctx.lineTo(q[0] - 6, q[1] - 5); } ctx.closePath(); ctx.fill(); });
    }
    if (this.showGlobal) { const g = this.P(this.gmin, .02); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(g[0], g[1], 13, 0, 7); ctx.stroke(); ctx.setLineDash([]); OV.label(ctx, `global minimum ${OV.fmt(this.fmin)}`, OV.clamp(g[0], 80, o.W - 80), g[1] - 24, '#fff', 'center'); }
    if (this.run) this.drawRun(t);
    if (!this.run || this.cur.i === 0) { const s = this.P(this.start, .02); OV.glowDot(ctx, s[0], s[1], 6, '#ffffff', t); if (!this.run) OV.label(ctx, 'start (drag me)', OV.clamp(s[0], 60, o.W - 60), s[1] - 22, '#fff', 'center'); }
  }
  draw3d() {
    const ctx = this.ctx, M = this.M, g = this.grid, quads = [];
    const pt = (i, j) => this.p3(i / M * D, j / M * D, g[j * (M + 1) + i]);
    const pts = new Array((M + 1) * (M + 1)); for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) pts[j * (M + 1) + i] = pt(i, j);
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { const a = pts[j * (M + 1) + i], b = pts[j * (M + 1) + i + 1], c = pts[(j + 1) * (M + 1) + i + 1], d = pts[(j + 1) * (M + 1) + i]; quads.push([a[2] + b[2] + c[2] + d[2], i, j, a, b, c, d]); }
    quads.sort((p, q) => q[0] - p[0]);
    for (const q of quads) {
      const i = q[1], j = q[2], z = (g[j * (M + 1) + i] + g[j * (M + 1) + i + 1] + g[(j + 1) * (M + 1) + i] + g[(j + 1) * (M + 1) + i + 1]) / 4;
      const sl = (g[j * (M + 1) + i + 1] - g[j * (M + 1) + i]) * Math.cos(this.yaw + .8) + (g[(j + 1) * (M + 1) + i] - g[j * (M + 1) + i]) * Math.sin(this.yaw + .8);
      const c = cmap(z), sh = OV.clamp(.82 + sl * 9, .5, 1.25), band = (z * 16) % 1 < .07 ? .8 : 1, col = `rgb(${c[0] * sh * band | 0},${c[1] * sh * band | 0},${c[2] * sh * band | 0})`;
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(q[3][0], q[3][1]); ctx.lineTo(q[4][0], q[4][1]); ctx.lineTo(q[5][0], q[5][1]); ctx.lineTo(q[6][0], q[6][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  trail(pts, color, w = 2, fade = true) {
    const ctx = this.ctx; if (pts.length < 2) return; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 1; k < pts.length; k++) { const a = this.P(pts[k - 1], .015), b = this.P(pts[k], .015); ctx.strokeStyle = OV.rgba(color, fade ? .15 + .85 * k / pts.length : 1); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  }
  drawRun(t) {
    const ctx = this.ctx, R = this.run, S = R.steps, i = Math.min(this.cur.i, S.length - 1), fr = this.cur.frac, s = S[i], nx = S[Math.min(i + 1, S.length - 1)];
    const mix = (a, b) => [OV.lerp(a[0], b[0], fr), OV.lerp(a[1], b[1], fr)];
    if (R.type === 'pso') {
      s.P.forEach((p, k) => {
        const tr = []; for (let q = Math.max(0, i - 7); q <= i; q++) tr.push(S[q].P[k]); const cur = mix(p, nx.P[k]); tr.push(cur);
        this.trail(tr, C.cyan, 1.4); const z = this.P(cur, .02); ctx.fillStyle = '#fff'; ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(z[0], z[1], 3.6, 0, 7); ctx.fill(); ctx.stroke();
      });
      const b = this.P(s.best, .03); OV.star(ctx, b[0], b[1], 10, C.amber); return;
    }
    const tr = [], from = R.type === 'sa' ? Math.max(0, i - 260) : 0; for (let q = from; q <= i; q++) tr.push(S[q].x);
    const cur = mix(s.x, nx.x); tr.push(cur);
    this.trail(tr, R.type === 'sa' ? C.pink : C.cyan, 2.2, R.type === 'sa');
    if (R.type === 'sa') {
      if (nx.cand && i < S.length - 1) { const a = this.P(s.x, .02), b = this.P(nx.cand, .02), col = nx.acc === 0 ? C.red : nx.acc === 2 ? C.amber : C.green; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b[0], b[1], 3.5, 0, 7); ctx.fill(); }
      const b = this.P(s.best, .03); OV.star(ctx, b[0], b[1], 9, C.amber);
    }
    if (R.type === 'gd' && i === 0) { /* nothing extra */ }
    const z = this.P(cur, .02); OV.glowDot(ctx, z[0], z[1], 6.5, R.type === 'sa' ? C.pink : C.cyan, t);
  }
};

/* ---------- heuristics: each returns {type, steps:[...]} ---------- */
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
OV.heur = {
  sa(T, o) {
    const r = OV.rng(o.seed || 1), F = OV.fmt, steps = []; let x = T.start.slice(), fx = T.f(x[0], x[1]), best = x.slice(), bf = fx, temp = o.T0, nUp = 0;
    steps.push({ x, f: fx, best, bf, T: temp, msg: `<span class="tag">Start</span><br>Begin at (${F(x[0])}, ${F(x[1])}) with cost ${F(fx)} and temperature T = ${F(temp)}. While it is hot, almost any move is accepted.` });
    for (let k = 1; k <= o.iters; k++) {
      const cand = [OV.clamp(x[0] + gauss(r) * o.step, 0, D), OV.clamp(x[1] + gauss(r) * o.step, 0, D)], fc = T.f(cand[0], cand[1]), dE = fc - fx;
      const p = dE <= 0 ? 1 : Math.exp(-dE / temp), roll = r(); let acc = 0;
      if (dE <= 0) acc = 1; else if (roll < p) { acc = 2; nUp++; }
      if (acc) { x = cand; fx = fc; if (fx < bf) { bf = fx; best = x.slice(); } }
      const msg = `<span class="tag">Iteration ${k} · T = ${F(temp, 3)}</span><br>Proposed move changes cost by Δ = ${dE > 0 ? '+' : ''}${F(dE, 3)}. ` + (dE <= 0 ? '<b class="c-green">Downhill: always accept.</b>' : `Uphill: accept with probability e<sup>−Δ/T</sup> = <b>${F(p, 3)}</b>. Rolled ${F(roll, 2)}: ${acc ? '<b class="c-amber">accepted</b> (escaping a valley)' : '<b class="c-red">rejected</b>'}.`) + ` Best so far ${F(bf, 3)}.`;
      steps.push({ x, cand, acc, p, f: fx, best, bf, T: temp, msg });
      temp *= o.alpha;
    }
    steps[steps.length - 1].msg = `<span class="tag">Frozen</span><br>Temperature is now ${F(temp, 4)}: only downhill moves get through. Best cost found <b>${F(bf, 3)}</b> at (${F(best[0])}, ${F(best[1])}). ${nUp} uphill moves were accepted along the way. Global minimum is ${F(T.fmin, 3)}.`;
    return { type: 'sa', steps, best, bf };
  },
  gd(T, o) {
    const F = OV.fmt, steps = []; let x = T.start.slice(), v = [0, 0], fx = T.f(x[0], x[1]);
    steps.push({ x, f: fx, bf: fx, msg: `<span class="tag">Start</span><br>Begin at (${F(x[0])}, ${F(x[1])}), cost ${F(fx)}. Measure the slope and step downhill.` });
    for (let k = 1; k <= o.iters; k++) {
      const g = T.grad(x[0], x[1]), gn = Math.hypot(g[0], g[1]);
      v = [o.mom * v[0] - o.lr * g[0], o.mom * v[1] - o.lr * g[1]];
      x = [OV.clamp(x[0] + v[0], 0, D), OV.clamp(x[1] + v[1], 0, D)]; fx = T.f(x[0], x[1]);
      steps.push({ x, f: fx, bf: fx, g: gn, msg: `<span class="tag">Iteration ${k}</span><br>Gradient magnitude ${F(gn, 3)}. Step = −(step size)·gradient${o.mom ? ' + momentum·(previous step)' : ''}. Cost is now <b>${F(fx, 3)}</b>.` });
      if (gn < 1e-3 && Math.hypot(v[0], v[1]) < 1e-3) break;
    }
    const gap = fx - T.fmin;
    steps[steps.length - 1].msg = `<span class="tag">Stopped</span><br>The slope is flat: a ${gap < .02 ? '<b class="c-green">global</b>' : '<b class="c-amber">local</b>'} minimum with cost <b>${F(fx, 3)}</b>. ${gap < .02 ? 'This time the start was in the right basin.' : `The global minimum is ${F(T.fmin, 3)}, but gradient descent cannot see over the ridge. Try a different start, or add momentum.`}`;
    return { type: 'gd', steps, best: x, bf: fx };
  },
  pso(T, o) {
    const r = OV.rng(o.seed || 1), F = OV.fmt, steps = [], n = o.n;
    let P = [], V = [], pb = [], pf = [], gb = null, gf = Infinity;
    for (let k = 0; k < n; k++) { const p = [r() * D, r() * D]; P.push(p); V.push([(r() - .5) * 2, (r() - .5) * 2]); pb.push(p.slice()); const f = T.f(p[0], p[1]); pf.push(f); if (f < gf) { gf = f; gb = p.slice(); } }
    steps.push({ P: P.map(p => p.slice()), best: gb.slice(), bf: gf, spread: 0, msg: `<span class="tag">Start</span><br>${n} particles are scattered at random. Each remembers the best place it has visited; all know the best place anyone has found (★).` });
    for (let it = 1; it <= o.iters; it++) {
      for (let k = 0; k < n; k++) {
        for (let j = 0; j < 2; j++) { V[k][j] = o.w * V[k][j] + o.c1 * r() * (pb[k][j] - P[k][j]) + o.c2 * r() * (gb[j] - P[k][j]); V[k][j] = OV.clamp(V[k][j], -2, 2); P[k][j] = OV.clamp(P[k][j] + V[k][j], 0, D); }
        const f = T.f(P[k][0], P[k][1]); if (f < pf[k]) { pf[k] = f; pb[k] = P[k].slice(); } if (f < gf) { gf = f; gb = P[k].slice(); }
      }
      let sp = 0; P.forEach(p => sp += Math.hypot(p[0] - gb[0], p[1] - gb[1]) / n);
      steps.push({ P: P.map(p => p.slice()), best: gb.slice(), bf: gf, spread: sp, msg: `<span class="tag">Iteration ${it}</span><br>Each particle's velocity = inertia × old velocity + pull toward its own best + pull toward the swarm best. Swarm best cost <b>${F(gf, 3)}</b>; average distance from it ${F(sp, 2)}.` });
    }
    const gap = gf - T.fmin;
    steps[steps.length - 1].msg = `<span class="tag">Converged</span><br>The swarm has collapsed onto cost <b>${F(gf, 3)}</b> (global minimum ${F(T.fmin, 3)}). ${gap < .03 ? '<b class="c-green">Found it.</b>' : '<b class="c-amber">It settled in a local valley.</b> More particles or more inertia would explore further.'}`;
    return { type: 'pso', steps, best: gb, bf: gf };
  }
};
})();
