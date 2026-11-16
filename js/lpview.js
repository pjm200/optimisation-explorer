/* Optimisation Explorer — LPView: an editable 2-D linear-programming landscape on a canvas */
(function () {
'use strict';
const OV = window.OV, LP = OV.LP, C = OV.col;
const dot = (a, p) => a[0] * p[0] + a[1] * p[1];

OV.presets = {
  energy: { name: 'Power plant', sense: 'max', c: [40, 30], cons: [
    { a: [2, 1], b: 14, sense: '<=', name: 'gas supply' }, { a: [1, 3], b: 18, sense: '<=', name: 'emissions cap' }, { a: [1, 1], b: 8, sense: '<=', name: 'grid export' }] },
  polygon: { name: 'Many corners', sense: 'max', c: [2, 3], cons: [
    { a: [-1, 2], b: 10, sense: '<=' }, { a: [1, 3], b: 27, sense: '<=' }, { a: [1, 1], b: 13.5, sense: '<=' }, { a: [3, 1], b: 28, sense: '<=' }, { a: [1, 0], b: 9, sense: '<=' }] },
  integer: { name: 'Fractional corner', sense: 'max', c: [5, 6], cons: [
    { a: [1, 1], b: 7.5, sense: '<=' }, { a: [4, 7], b: 44, sense: '<=' }, { a: [6, 2], b: 37, sense: '<=' }] },
  knapsack: { name: 'Thin wedge', sense: 'max', c: [8, 11], cons: [
    { a: [5, 7], b: 52, sense: '<=' }, { a: [9, 4], b: 60, sense: '<=' }, { a: [-3, 5], b: 19, sense: '<=' }] },
  mincost: { name: 'Min cost (≥)', sense: 'min', c: [3, 2], cons: [
    { a: [1, 1], b: 5, sense: '>=', name: 'demand' }, { a: [1, 3], b: 8, sense: '>=', name: 'reserve' }, { a: [1, 0], b: 8, sense: '<=' }, { a: [0, 1], b: 7, sense: '<=' }] },
  degenerate: { name: 'Degenerate', sense: 'max', c: [3, 2], cons: [
    { a: [1, 1], b: 8, sense: '<=' }, { a: [1, 0], b: 5, sense: '<=' }, { a: [2, 1], b: 13, sense: '<=' }, { a: [0, 1], b: 6, sense: '<=' }] },
  unbounded: { name: 'Unbounded', sense: 'max', c: [1, 1], cons: [
    { a: [-1, 1], b: 3, sense: '<=' }, { a: [1, -2], b: 4, sense: '<=' }] },
  infeasible: { name: 'Infeasible', sense: 'max', c: [2, 3], cons: [
    { a: [1, 1], b: 4, sense: '<=' }, { a: [1, 1], b: 7, sense: '>=' }] }
};
OV.cloneProb = p => ({ sense: p.sense, c: p.c.slice(), cons: p.cons.map(k => ({ a: k.a.slice(), b: k.b, sense: k.sense, name: k.name })) });
OV.conText = (k, labels = ['x₁', 'x₂']) => {
  const F = OV.fmt, parts = [];
  k.a.forEach((v, j) => { if (Math.abs(v) < 1e-9) return; const s = v < 0 ? '−' : (parts.length ? '+' : ''), m = Math.abs(v); parts.push(`${s}${parts.length && s ? ' ' : ''}${Math.abs(m - 1) < 1e-9 ? '' : F(m)}${labels[j]}`); });
  return `${parts.join(' ') || '0'} ${k.sense === '>=' ? '≥' : '≤'} ${F(k.b)}`;
};

OV.LPView = class {
  constructor(host, o) {
    this.o = o = Object.assign({ W: 560, H: 554, range: [10, 10], editable: true, arrow: true, labels: ['x₁', 'x₂'], iso: true, showOpt: true, color: C.cyan }, o);
    this.prob = o.prob; this.m = { l: 46, r: 16, t: 16, b: 40 };
    const { c, ctx } = OV.canvas(host, o.W, o.H); this.c = c; this.ctx = ctx;
    this.integer = !!o.integer; this.showOpt = o.showOpt; this.probe = o.probe || null; this.start = o.start || null;
    this.overlay = null; this.under = null; this.drag = null; this.hover = null; this.dim = false; this.t = 0;
    this.refresh();
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    c.addEventListener('pointerup', e => { this.drag = null; try { c.releasePointerCapture(e.pointerId); } catch (_) { } });
    c.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = null; c.style.cursor = ''; } });
  }
  get pw() { return this.o.W - this.m.l - this.m.r; }
  get ph() { return this.o.H - this.m.t - this.m.b; }
  px(p) { return [this.m.l + p[0] / this.o.range[0] * this.pw, this.m.t + (1 - p[1] / this.o.range[1]) * this.ph]; }
  inv(q) { return [(q[0] - this.m.l) / this.pw * this.o.range[0], (1 - (q[1] - this.m.t) / this.ph) * this.o.range[1]]; }
  refresh() {                      // recompute cached solution after any change
    this.sol = LP.solve2D(this.prob);
    this.poly = LP.region(this.prob, null, this.o.range);
    this.intSol = this.integer ? LP.intOpt(this.prob, Math.max(this.o.range[0], this.o.range[1])) : null;
  }
  changed() { this.refresh(); this.o.onChange && this.o.onChange(); }
  /* segment of a constraint line inside the view box */
  seg(k) {
    const a = k.a, n2 = a[0] * a[0] + a[1] * a[1]; if (n2 < 1e-12) return null;
    const p0 = [a[0] * k.b / n2, a[1] * k.b / n2], d = [-a[1], a[0]], R = this.o.range; let t0 = -1e9, t1 = 1e9;
    for (let j = 0; j < 2; j++) {
      if (Math.abs(d[j]) < 1e-12) { if (p0[j] < -1e-9 || p0[j] > R[j] + 1e-9) return null; }
      else { let ta = (0 - p0[j]) / d[j], tb = (R[j] - p0[j]) / d[j]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
    }
    if (t0 >= t1) return null;
    const at = t => [p0[0] + t * d[0], p0[1] + t * d[1]];
    return [at(t0), at(t1), at(t0 + (t1 - t0) * .14), at(t0 + (t1 - t0) * .86)];
  }
  anchor() {
    const P = this.poly; if (!P || P.length < 3) return [this.o.range[0] * .45, this.o.range[1] * .45];
    const p = [0, 0]; P.forEach(q => { p[0] += q[0] / P.length; p[1] += q[1] / P.length; }); return p;
  }
  dir() { const c = this.prob.c, s = this.prob.sense === 'min' ? -1 : 1, n = Math.hypot(c[0], c[1]) || 1; return [s * c[0] / n, s * c[1] / n]; }
  tip() { const a = this.anchor(), d = this.dir(), L = this.o.range[0] * .17; return [a[0] + d[0] * L, a[1] + d[1] * L]; }
  hit(q) {
    const near = (p, r) => { const s = this.px(p); return Math.hypot(s[0] - q[0], s[1] - q[1]) < r; };
    if (this.probe && near(this.probe, 16)) return { type: 'probe' };
    if (this.start && this.o.startDrag && near(this.start, 16)) return { type: 'start' };
    if (!this.o.editable) return null;
    if (this.o.arrow && near(this.tip(), 15)) return { type: 'obj' };
    for (let i = 0; i < this.prob.cons.length; i++) { const s = this.seg(this.prob.cons[i]); if (!s) continue; if (near(s[2], 13)) return { type: 'handle', i, end: 2, fixed: s[3] }; if (near(s[3], 13)) return { type: 'handle', i, end: 3, fixed: s[2] }; }
    for (let i = 0; i < this.prob.cons.length; i++) {
      const s = this.seg(this.prob.cons[i]); if (!s) continue;
      const A = this.px(s[0]), B = this.px(s[1]), L2 = (B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2;
      const t = OV.clamp(((q[0] - A[0]) * (B[0] - A[0]) + (q[1] - A[1]) * (B[1] - A[1])) / L2, 0, 1);
      if (Math.hypot(A[0] + t * (B[0] - A[0]) - q[0], A[1] + t * (B[1] - A[1]) - q[1]) < 8) return { type: 'line', i };
    }
    return null;
  }
  down(e) {
    const q = OV.mouse(this.c, e), h = this.hit(q); if (!h) return;
    h.last = this.inv(q); this.drag = h; this.c.setPointerCapture(e.pointerId); e.preventDefault();
  }
  move(e) {
    const q = OV.mouse(this.c, e), p = this.inv(q), d = this.drag, R = this.o.range;
    if (!d) { this.hover = this.hit(q); this.c.style.cursor = this.hover ? (this.hover.type === 'line' ? 'move' : 'grab') : ''; return; }
    const cl = [OV.clamp(p[0], 0, R[0]), OV.clamp(p[1], 0, R[1])];
    if (d.type === 'probe') { this.probe = cl; this.o.onProbe && this.o.onProbe(cl); }
    else if (d.type === 'start') { this.start = cl; this.o.onChange && this.o.onChange(); }
    else if (d.type === 'obj') {
      const a = this.anchor(), v = [p[0] - a[0], p[1] - a[1]], n = Math.hypot(v[0], v[1]); if (n < 1e-6) return;
      const mag = Math.hypot(this.prob.c[0], this.prob.c[1]), s = this.prob.sense === 'min' ? -1 : 1;
      this.prob.c = [s * mag * v[0] / n, s * mag * v[1] / n]; this.changed();
    } else if (d.type === 'line') {
      const k = this.prob.cons[d.i]; k.b += dot(k.a, [p[0] - d.last[0], p[1] - d.last[1]]); d.last = p; this.changed();
    } else if (d.type === 'handle') {
      const k = this.prob.cons[d.i], f = d.fixed, v = [p[0] - f[0], p[1] - f[1]], n = Math.hypot(v[0], v[1]); if (n < .3) return;
      let a = [-v[1] / n, v[0] / n]; const mag = Math.hypot(k.a[0], k.a[1]); if (dot(a, k.a) < 0) a = [-a[0], -a[1]];
      k.a = [a[0] * mag, a[1] * mag]; k.b = dot(k.a, f); this.changed();
    }
  }
  path(poly) { const ctx = this.ctx; ctx.beginPath(); poly.forEach((p, i) => { const s = this.px(p); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); }
  clipPlot() { const ctx = this.ctx; ctx.beginPath(); ctx.rect(this.m.l, this.m.t, this.pw, this.ph); ctx.clip(); }
  drawLine(k, color, o = {}) {       // draw any half-plane boundary across the view
    const s = this.seg(k); if (!s) return null; const ctx = this.ctx, A = this.px(s[0]), B = this.px(s[1]);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = o.w || 2; ctx.setLineDash(o.dash || []); if (o.glow) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore(); return s;
  }
  draw(t) {
    const ctx = this.ctx, o = this.o, R = o.range, m = this.m, prob = this.prob, F = OV.fmt; this.t = t;
    ctx.clearRect(0, 0, o.W, o.H);
    ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.roundRect(m.l, m.t, this.pw, this.ph, 8); ctx.fill();
    /* grid + axes */
    ctx.font = '11px Consolas, monospace'; ctx.fillStyle = C.dim; ctx.lineWidth = 1;
    const stepOf = r => { const raw = r / 10, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
    const sx = stepOf(R[0]), sy = stepOf(R[1]);
    for (let v = 0; v <= R[0] + 1e-9; v += sx) { const X = this.px([v, 0])[0]; ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(X, m.t); ctx.lineTo(X, m.t + this.ph); ctx.stroke(); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(F(v), X, m.t + this.ph + 6); }
    for (let v = 0; v <= R[1] + 1e-9; v += sy) { const Y = this.px([0, v])[1]; ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(m.l, Y); ctx.lineTo(m.l + this.pw, Y); ctx.stroke(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(F(v), m.l - 7, Y); }
    ctx.fillStyle = '#c2cbe0'; ctx.font = 'italic 15px Cambria, Georgia, serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(o.labels[0], m.l + this.pw, o.H - 4); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.labels[1], 6, m.t - 2);
    ctx.save(); this.clipPlot();
    /* feasible region, shaded along the improving direction */
    const P = this.poly, d = this.dir();
    if (P.length >= 3) {
      let lo = Infinity, hi = -Infinity, pl = null, ph = null; P.forEach(p => { const v = dot(d, p); if (v < lo) { lo = v; pl = p; } if (v > hi) { hi = v; ph = p; } });
      const A = this.px(pl), Bq = this.px([pl[0] + d[0] * (hi - lo), pl[1] + d[1] * (hi - lo)]);
      const g = ctx.createLinearGradient(A[0], A[1], Bq[0], Bq[1]), a = this.dim ? .35 : 1;
      g.addColorStop(0, OV.rgba(o.color, .05 * a)); g.addColorStop(1, OV.rgba(o.color, .42 * a));
      this.path(P); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OV.rgba(o.color, .5 * a); ctx.lineWidth = 1.2; ctx.stroke();
      /* iso-objective lines */
      if (o.iso && !this.dim) {
        ctx.save(); this.path(P); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
        const span = Math.hypot(R[0], R[1]), n = [-d[1], d[0]];
        for (let i = 1; i < 9; i++) { const v = lo + (hi - lo) * i / 9, c0 = [d[0] * v, d[1] * v], a1 = this.px([c0[0] - n[0] * span, c0[1] - n[1] * span]), b1 = this.px([c0[0] + n[0] * span, c0[1] + n[1] * span]); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (this.under) this.under(ctx, this, t);
    /* constraints */
    const bind = this.sol.status === 'optimal' ? prob.cons.map(k => Math.abs(dot(k.a, this.sol.x) - k.b) < 1e-6) : [];
    prob.cons.forEach((k, i) => {
      const col = OV.pal[(o.palOffset || 0) + i] || OV.pal[i % OV.pal.length], hov = (this.hover && this.hover.i === i) || (this.drag && this.drag.i === i);
      const s = this.drawLine(k, col, { w: hov ? 3.4 : (bind[i] && this.showOpt ? 2.8 : 1.8), glow: hov || (bind[i] && this.showOpt) }); if (!s) return;
      const l = LP.le(k), nl = Math.hypot(l.a[0], l.a[1]), A = this.px(s[0]), B = this.px(s[1]), len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const nx = l.a[0] / nl * this.pw / R[0], ny = -l.a[1] / nl * this.ph / R[1], nn = Math.hypot(nx, ny), ux = nx / nn, uy = ny / nn;
      ctx.strokeStyle = OV.rgba(col, .35); ctx.lineWidth = 1; ctx.beginPath();
      for (let q = 8; q < len; q += 11) { const x = A[0] + (B[0] - A[0]) * q / len, y = A[1] + (B[1] - A[1]) * q / len; ctx.moveTo(x, y); ctx.lineTo(x + ux * 7 + (B[0] - A[0]) / len * 4, y + uy * 7 + (B[1] - A[1]) / len * 4); }
      ctx.stroke();
      if (o.editable) [s[2], s[3]].forEach(hp => { const q = this.px(hp); ctx.fillStyle = '#0a1020'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], 5.5, 0, 7); ctx.fill(); ctx.stroke(); });
      const mid = this.px([(s[2][0] * .2 + s[3][0] * .8), (s[2][1] * .2 + s[3][1] * .8)]);
      if (!o.noConLabels) OV.label(ctx, k.name || OV.conText(k, o.labels), OV.clamp(mid[0] - ux * 16, m.l + 50, m.l + this.pw - 50), OV.clamp(mid[1] - uy * 16, m.t + 14, m.t + this.ph - 14), col, 'center');
    });
    /* integer lattice */
    if (this.integer) for (let i = 0; i <= R[0]; i++) for (let j = 0; j <= R[1]; j++) {
      const ok = LP.feasible(prob, [i, j]), q = this.px([i, j]);
      ctx.fillStyle = ok ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(q[0], q[1], ok ? 3 : 2, 0, 7); ctx.fill();
    }
    if (this.overlay) this.overlay(ctx, this, t);
    /* objective arrow */
    if (o.arrow && P.length >= 3) {
      const a = this.px(this.anchor()), b = this.px(this.tip()), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.strokeStyle = C.amber; ctx.fillStyle = C.amber; ctx.lineWidth = 2.5; ctx.shadowColor = C.amber; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b[0] + 9 * Math.cos(ang), b[1] + 9 * Math.sin(ang)); ctx.lineTo(b[0] + 9 * Math.cos(ang + 2.5), b[1] + 9 * Math.sin(ang + 2.5)); ctx.lineTo(b[0] + 9 * Math.cos(ang - 2.5), b[1] + 9 * Math.sin(ang - 2.5)); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(a[0], a[1], 3, 0, 7); ctx.fill();
      ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(prob.sense === 'min' ? 'cheaper' : 'better', a[0] - 16 * Math.cos(ang), a[1] - 16 * Math.sin(ang) + 4);
    }
    /* optimum */
    if (this.showOpt) {
      if (this.sol.status === 'optimal') {
        const q = this.px(this.sol.x);
        OV.glowDot(ctx, q[0], q[1], 6, C.amber, t);
        OV.label(ctx, `${this.integer ? 'LP ' : ''}optimum  ${F(this.sol.obj)}`, OV.clamp(q[0], m.l + 60, m.l + this.pw - 60), OV.clamp(q[1] - 24, m.t + 14, 1e9), C.amber, 'center');
        if (this.intSol) { const z = this.px(this.intSol.x); OV.star(ctx, z[0], z[1], 10, C.green); OV.label(ctx, `integer optimum  ${F(this.intSol.obj)}`, OV.clamp(z[0], m.l + 70, m.l + this.pw - 70), z[1] + 24, C.green, 'center'); }
      }
    }
    if (this.sol.status !== 'optimal' && !o.noStatus) {
      ctx.font = '700 22px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = this.sol.status === 'infeasible' ? C.red : C.amber;
      ctx.fillText(this.sol.status === 'infeasible' ? 'INFEASIBLE: no point satisfies everything' : 'UNBOUNDED: the objective improves forever', m.l + this.pw / 2, m.t + 34);
    }
    if (this.probe) { const q = this.px(this.probe), ok = LP.feasible(prob, this.probe); OV.glowDot(ctx, q[0], q[1], 7, ok ? '#ffffff' : C.red, t); }
    ctx.restore();
  }
  point(p, color, r = 6) { const q = this.px(p); OV.glowDot(this.ctx, q[0], q[1], r, color, this.t); }
  ring(p, color, r = 9) { const q = this.px(p), ctx = this.ctx; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], r + 2 * Math.sin(this.t * 5), 0, 7); ctx.stroke(); }
  polyline(pts, color, w = 3, dash) { const ctx = this.ctx; if (pts.length < 2) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash || []); ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.beginPath(); pts.forEach((p, i) => { const q = this.px(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.restore(); }
};
})();
