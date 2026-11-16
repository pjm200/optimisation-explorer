/* Optimisation Explorer — energy system pages: economic dispatch (LP + duals), storage scheduling (24 h LP), unit commitment (MILP) */
(function () {
'use strict';
const OV = window.OV, C = OV.col, F = OV.fmt, P = OV.P;
const money = v => '£' + F(v, 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* ================= 12. Economic dispatch ================= */
OV.page({ id: 'dispatch', group: 'Energy systems', title: 'Economic dispatch and the price of power', nav: 'Dispatch & prices', render(root) {
  OV.head(root, { kicker: 'Energy · Linear programming', title: 'Economic dispatch: where the power price comes from', lead: 'Which power stations should run right now? Meeting demand at least cost is a textbook [[LP|lp]]. Its solution is the [[merit order|merit]] every trader knows, and its [[dual variable|dualvar]] on the supply = demand constraint is the [[electricity price|smp]]. Duality is not abstract here: it is the market.' });
  const p = { demand: 30, wind: 8, solar: 3, gas: 30, co2: 50 }, VOLL = 6000;
  const G = [
    { name: 'Wind', col: '#34d399', cap: () => p.wind, cost: () => 0, ef: 0 },
    { name: 'Solar', col: '#fbbf24', cap: () => p.solar, cost: () => 0, ef: 0 },
    { name: 'Nuclear', col: '#a78bfa', cap: () => 5, cost: () => 12, ef: 0 },
    { name: 'Gas CCGT', col: '#4cc9f0', cap: () => 16, cost: () => p.gas / .5 + .37 * p.co2 + 3, ef: .37 },
    { name: 'Coal', col: '#9aa5b8', cap: () => 6, cost: () => 33 + .9 * p.co2 + 5, ef: .9 },
    { name: 'Gas peaker', col: '#fb923c', cap: () => 5, cost: () => p.gas / .35 + .55 * p.co2 + 6, ef: .55 }
  ];
  const g = OV.h(`<div class="grid2"><div class="card glow"><h3>The merit order · drag the white demand line</h3><div class="cv"></div>
      <div class="legend"><span><i style="background:rgba(255,255,255,.8)"></i>running</span><span><i style="background:rgba(255,255,255,.18)"></i>available, not needed</span><span><i style="background:rgba(251,191,36,.4)"></i><span class="term" data-term="rent">inframarginal rent</span> (dual of capacity)</span></div></div>
    <div class="stack"><div class="card"><h3>System conditions</h3><div class="sl"></div></div>
      <div class="card"><div class="kp kpis"></div></div>
      <div class="card"><h3>The LP solution, primal and dual</h3><div class="tb tabwrap"></div></div></div></div>`);
  root.appendChild(g);
  const W = 680, H = 440, cv = OV.canvas(g.querySelector('.cv'), W, H), ctx = cv.ctx, L = 56, R = 18, T = 26, B = 44, XM = 60;
  const X = v => L + v / XM * (W - L - R); let ymax = 160, yT = 160, sol = null, order = [], dsp = G.map(() => ({ x0: 0, w: 0, c: 0, out: 0 })), lamD = 0, dD = p.demand, drag = false;
  const Y = v => T + (1 - Math.min(v, ymax * 1.02) / ymax) * (H - T - B);
  const sliders = {};
  function solve() {
    const c = G.map(q => q.cost()).concat([VOLL]), ub = G.map(q => q.cap()).concat([null]);
    sol = OV.solveLP({ c, A: [c.map(() => 1)], sense: ['='], b: [p.demand], ub });
    sol.cost = c; sol.cap = ub; sol.lam = sol.y[0]; sol.mu = sol.ubDual.map(v => Math.max(0, -v));
    order = G.map((_, i) => i).sort((a, b) => c[a] - c[b] || a - b);
    let x0 = 0; order.forEach(i => { sol['x0_' + i] = x0; x0 += ub[i]; }); sol.total = x0;
    yT = Math.max(120, Math.max(...G.map(q => q.cost())) * 1.3);
    const em = G.reduce((s, q, i) => s + q.ef * sol.x[i], 0), served = p.demand - sol.x[6], mi = order.find(i => sol.x[i] > 1e-6 && sol.x[i] < ub[i] - 1e-6);
    const marg = sol.x[6] > 1e-6 ? 'Load shedding' : mi != null ? G[mi].name : (G[order.filter(i => sol.x[i] > 1e-6).pop()] || {}).name;
    g.querySelector('.kp').innerHTML = `<div class="kpi"><small><span class="term" data-term="smp">System price</span></small><b style="color:${C.amber}">£${F(sol.lam, 1)}</b><span> /MWh</span></div><div class="kpi"><small>Total cost</small><b>£${F(sol.obj, 0)}k</b><span> /h</span></div>
      <div class="kpi"><small><span class="term" data-term="marginal">Marginal unit</span></small><b style="font-size:.95rem">${marg}</b></div><div class="kpi"><small>Carbon intensity</small><b>${F(served > 0 ? em / served * 1000 : 0, 0)}</b><span> g/kWh</span></div>`;
    let h = `<table class="plain"><tr><th>Unit</th><th><span class="term" data-term="mc">Marginal cost</span></th><th>Capacity</th><th>Output</th><th><span class="term" data-term="rent">Rent</span></th></tr>`;
    order.forEach(i => { h += `<tr><td><span class="sw" style="background:${G[i].col}"></span>${G[i].name}</td><td>£${F(c[i], 1)}</td><td>${F(ub[i], 1)}</td><td style="color:${sol.x[i] > 1e-6 ? '#fff' : C.dim}">${F(sol.x[i], 1)}</td><td style="color:${C.amber}">${sol.mu[i] > 1e-6 ? '£' + F(sol.mu[i], 1) : '–'}</td></tr>`; });
    if (sol.x[6] > 1e-6) h += `<tr><td><span class="sw" style="background:${C.red}"></span>Unserved demand</td><td>£${VOLL}</td><td>∞</td><td style="color:${C.red}">${F(sol.x[6], 1)}</td><td>–</td></tr>`;
    const dualObj = sol.lam * p.demand - G.reduce((s, q, i) => s + sol.mu[i] * ub[i], 0);
    h += `</table><p class="hint">${P(`[[Strong duality|strong]], checked live: primal cost Σ c·p = <b style="color:#fff">${F(sol.obj, 1)}</b>; dual value λ·D − Σ μ·P̄ = ${F(sol.lam, 1)}×${F(p.demand, 1)} − ${F(sol.lam * p.demand - dualObj, 1)} = <b style="color:#fff">${F(dualObj, 1)}</b>. Units: GW × £/MWh = £k per hour.`)}</p>`;
    g.querySelector('.tb').innerHTML = h;
  }
  const S = g.querySelector('.sl'), mk = (k, o) => sliders[k] = OV.slider(S, Object.assign({ value: p[k], onInput: v => { p[k] = v; solve(); } }, o));
  mk('demand', { label: 'Demand D (GW)', term: 'rhs', min: 8, max: 58, step: .5 }); mk('wind', { label: 'Wind available (GW)', min: 0, max: 15, step: .5 }); mk('solar', { label: 'Solar available (GW)', min: 0, max: 10, step: .5 });
  mk('gas', { label: 'Gas price (£/MWh th)', term: 'mc', min: 10, max: 80, step: 1 }); mk('co2', { label: 'Carbon price (£/t)', term: 'mc', min: 0, max: 150, step: 5 });
  cv.c.addEventListener('pointerdown', e => { const q = OV.mouse(cv.c, e); if (Math.abs(q[0] - X(p.demand)) < 16) { drag = true; cv.c.setPointerCapture(e.pointerId); } });
  cv.c.addEventListener('pointermove', e => { const q = OV.mouse(cv.c, e); cv.c.style.cursor = drag || Math.abs(q[0] - X(p.demand)) < 16 ? 'ew-resize' : ''; if (drag) { p.demand = OV.clamp(Math.round((q[0] - L) / (W - L - R) * XM * 2) / 2, 8, 58); sliders.demand.value = p.demand; solve(); } });
  cv.c.addEventListener('pointerup', () => { drag = false; });
  solve();
  OV.onTick((t, dt) => {
    const k = 1 - Math.pow(.001, dt); ymax += (yT - ymax) * k; dD += (p.demand - dD) * k; lamD += (Math.min(sol.lam, 1e4) - lamD) * k;
    G.forEach((q, i) => { const d = dsp[i]; d.x0 += (sol['x0_' + i] - d.x0) * k; d.w += (sol.cap[i] - d.w) * k; d.c += (sol.cost[i] - d.c) * k; d.out += (sol.x[i] - d.out) * k; });
    ctx.clearRect(0, 0, W, H); ctx.font = '11px Consolas, monospace'; ctx.lineWidth = 1;
    for (let v = 0; v <= ymax; v += ymax > 260 ? 50 : 20) { ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v)); ctx.stroke(); ctx.fillStyle = C.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('£' + v, L - 7, Y(v)); }
    for (let v = 0; v <= XM; v += 10) { ctx.fillStyle = C.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(v, X(v), H - B + 7); }
    ctx.fillStyle = '#c2cbe0'; ctx.font = '11px Inter, Segoe UI, sans-serif'; ctx.fillText('cumulative capacity, GW (cheapest first)', L + (W - L - R) / 2, H - 18); ctx.save(); ctx.translate(13, T + (H - T - B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('marginal cost, £/MWh', 0, 0); ctx.restore();
    const lamY = Y(lamD), y0 = Y(0); let rentLab = null;
    G.forEach((q, i) => { const d = dsp[i]; if (d.w < .02) return; const xa = X(d.x0), xb = X(d.x0 + d.w), xo = X(d.x0 + Math.max(0, d.out)), top = Math.min(Y(d.c), y0 - 5);
      ctx.fillStyle = OV.rgba(q.col, .16); ctx.fillRect(xa, top, xb - xa, y0 - top); ctx.fillStyle = OV.rgba(q.col, .85); ctx.fillRect(xa, top, xo - xa, y0 - top);
      ctx.strokeStyle = q.col; ctx.lineWidth = 1.3; ctx.strokeRect(xa, top, xb - xa, y0 - top);
      if (lamY < top - 1 && xo - xa > 1) { ctx.fillStyle = 'rgba(251,191,36,.16)'; ctx.fillRect(xa, lamY, xo - xa, top - lamY); if (!rentLab || xo - xa > rentLab[2]) rentLab = [(xa + xo) / 2, (lamY + top) / 2, xo - xa, top - lamY]; }
      if (xb - xa > 26) { ctx.save(); ctx.fillStyle = '#fff'; ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const ly = Math.max(T + 26, top - 16); if (xb - xa > 58) { ctx.fillText(q.name, (xa + xb) / 2, ly); ctx.fillStyle = q.col; ctx.fillText('£' + F(d.c, 0), (xa + xb) / 2, ly + 13); } else { ctx.translate((xa + xb) / 2 + 4, top - 6); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(q.name + ' £' + F(d.c, 0), 0, 0); } ctx.restore(); } });
    if (rentLab && rentLab[2] > 90 && rentLab[3] > 18) { ctx.fillStyle = C.amber; ctx.font = 'italic 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('rent = λ − cost', rentLab[0], rentLab[1]); }
    const dx = X(dD); ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(L, Math.max(T, lamY)); ctx.lineTo(dx, Math.max(T, lamY)); ctx.stroke(); ctx.setLineDash([]);
    OV.label(ctx, sol.lam > ymax ? `λ = £${F(sol.lam, 0)} (value of lost load): demand cannot be met` : `price λ = £${F(sol.lam, 1)}`, L + 8, Math.max(T + 12, lamY - 13), C.amber, 'left');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(dx, T - 4); ctx.lineTo(dx, y0); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx, T - 4, 6, 0, 7); ctx.fill(); OV.label(ctx, `demand ${F(p.demand, 1)} GW`, OV.clamp(dx + 12, L, W - R - 110), T + 4, '#fff', 'left');
    OV.glowDot(ctx, dx, Math.max(T, lamY), 5, C.amber, t);
  });
  root.appendChild(OV.h('<h2>The model behind the picture</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card"><h3 class="c-cyan">Primal · the operator chooses outputs</h3>${OV.math(['{min|min}  Σ_[g] {c_[g]|mc} {p_[g]|var}', 'Σ_[g] {p_[g]|var} = {D|balance}      <span class="w">price</span> {λ|smp}', '0 ≤ {p_[g]|var} ≤ {P̄_[g]|rhs}      <span class="w">price</span> {μ_[g]|rent}'], 'sm')}
      <p>${P('One [[variable|var]] per generator, one [[power balance|balance]] constraint, one capacity limit each. The optimal solution fills the stack from the cheap end: at most one unit, the [[marginal generator|marginal]], is part-loaded.')}</p></div>
    <div class="card"><h3 class="c-violet">Dual · the market chooses prices</h3>${OV.math(['{max|max}  {λ|smp}{D|balance} − Σ_[g] {μ_[g]|rent} {P̄_[g]|rhs}', '{λ|smp} − {μ_[g]|rent} ≤ {c_[g]|mc}', '{μ_[g]|rent} ≥ 0'], 'sm')}
      <p>${P('The dual finds the price $λ$ that maximises what consumers pay minus what generators keep as [[rent|rent]]. Its constraint says no plant can earn more than price minus cost. [[Complementary slackness|cs]] gives the market rules: a unit with spare capacity earns no rent ($μ = 0$); a unit that is running must have $λ − μ = c$.')}</p></div></div>`));
  OV.ideas(root, [
    ['Price = a shadow price', 'Raise demand by 1 MW and the cheapest way to serve it costs $λ$. That sensitivity is the [[shadow price|shadow]] of the balance constraint. Real markets with network limits compute one such price per node: locational marginal prices.'],
    ['Fuel switching, live', 'Raise the carbon price and coal overtakes gas in the stack; the blocks swap places. The LP re-sorts the [[merit order|merit]] automatically because only the [[coefficients|coef]] changed, not the structure.'],
    ['Scarcity pricing', 'Push demand past total capacity. The only "generator" left is [[lost load|voll]], and the price jumps to its value. Zero-cost wind pushes the whole stack right and lowers the price: the merit-order effect.']
  ]);
} });

/* ================= 13. Storage scheduling ================= */
OV.page({ id: 'storage', group: 'Energy systems', title: 'Scheduling storage over a day', nav: 'Load, generation & storage', render(root) {
  OV.head(root, { kicker: 'Energy · Multi-period LP', title: 'A day in the life of a battery', lead: 'Add a store and the hours of the day stop being independent: energy charged at noon can be released at 6 pm. The [[state of charge|soc]] links every hour to the next, so all 24 must be optimised together. Nobody tells the battery when to charge; [[arbitrage|arbitrage]] emerges from the LP on its own.' });
  const N = 24, p = { P: 25, dur: 4, eff: 88, solar: 70, gas: 70, gasCap: 60 }, PK = 180, PKCAP = 50, VOLL = 3000, WEAR = 2;
  const load = [52, 48, 46, 45, 47, 54, 66, 78, 84, 82, 78, 76, 75, 74, 75, 79, 88, 100, 105, 101, 92, 80, 68, 58], load0 = load.slice();
  const sunShape = h => h > 6 && h < 19 ? Math.pow(Math.sin(Math.PI * (h - 6) / 13), 1.4) : 0;
  const g = OV.h(`<div class="grid2"><div class="card glow"><h3>Optimal schedule · drag the white load curve</h3><div class="cv"></div><div class="ro hint" style="min-height:2.6em"></div>
      <div class="legend"><span><i style="background:#fbbf24"></i>solar</span><span><i style="background:#4cc9f0"></i>gas</span><span><i style="background:#fb923c"></i>peaker</span><span><i style="background:#34d399"></i>battery discharge</span><span><i style="background:#a78bfa"></i>battery charging</span><span><i style="background:#fb7185"></i>unserved</span></div></div>
    <div class="stack"><div class="card"><h3>The system</h3><div class="sl"></div><div class="row mt"><span class="bt"></span></div></div>
      <div class="card"><div class="kp kpis"></div><p class="hint ins"></p></div>
      <div class="card"><h3>What the solver just did</h3><p class="alg"></p></div></div></div>`);
  root.appendChild(g);
  const W = 720, H = 600, cv = OV.canvas(g.querySelector('.cv'), W, H), ctx = cv.ctx, L = 50, R = 14, A = { t: 18, h: 300 }, Bp = { t: 352, h: 86 }, Cp = { t: 474, h: 96 };
  const bw = (W - L - R) / N, X = h => L + h * bw; let sol = null, dirty = true, hover = -1, drag = -1, yMax = 130;
  function solve() {
    const n = N * 7, E = p.P * p.dur, e = Math.sqrt(p.eff / 100), sun = [...Array(N)].map((_, h) => p.solar * sunShape(h));
    const c = new Array(n).fill(0), ub = new Array(n).fill(null), Am = [], sense = [], b = [];
    for (let t = 0; t < N; t++) {
      const o = t * 7; c[o] = p.gas; c[o + 1] = PK; c[o + 3] = WEAR; c[o + 6] = VOLL;
      ub[o] = p.gasCap; ub[o + 1] = PKCAP; ub[o + 2] = p.P; ub[o + 3] = p.P; ub[o + 4] = E; ub[o + 5] = sun[t];
      const r = new Array(n).fill(0); r[o] = 1; r[o + 1] = 1; r[o + 2] = -1; r[o + 3] = 1; r[o + 5] = -1; r[o + 6] = 1; Am.push(r); sense.push('='); b.push(load[t] - sun[t]);
    }
    for (let t = 0; t < N; t++) { const o = t * 7, pr = ((t + N - 1) % N) * 7, r = new Array(n).fill(0); r[o + 4] = 1; r[pr + 4] -= 1; r[o + 2] = -e; r[o + 3] = 1 / e; Am.push(r); sense.push('='); b.push(0); }
    const t0 = performance.now(), res = OV.solveLP({ c, A: Am, sense, b, ub }), ms = performance.now() - t0;
    if (res.status !== 'optimal') { sol = null; return; }
    const col = k => [...Array(N)].map((_, t) => Math.max(0, res.x[t * 7 + k]));
    sol = { gas: col(0), pk: col(1), ch: col(2), dis: col(3), soc: col(4), curt: col(5), shed: col(6), price: res.y.slice(0, N), sun, E, cost: res.obj, ms, iters: res.iters, m: res.m, n: res.n };
    let base = 0; for (let t = 0; t < N; t++) { let r = Math.max(0, load[t] - sun[t]); const a = Math.min(r, p.gasCap); r -= a; const q = Math.min(r, PKCAP); r -= q; base += a * p.gas + q * PK + r * VOLL; }
    const curt = sol.curt.reduce((a, v) => a + v, 0), disT = sol.dis.reduce((a, v) => a + v, 0), chT = sol.ch.reduce((a, v) => a + v, 0);
    let pc = 0, pd = 0; for (let t = 0; t < N; t++) { pc += sol.price[t] * sol.ch[t]; pd += sol.price[t] * sol.dis[t]; }
    g.querySelector('.kp').innerHTML = `<div class="kpi"><small>Daily cost</small><b>${money(sol.cost)}</b></div><div class="kpi"><small>Without battery</small><b style="color:${C.dim}">${money(base)}</b></div><div class="kpi"><small>Battery saves</small><b style="color:${C.green}">${money(Math.max(0, base - sol.cost))}</b></div>
      <div class="kpi"><small>Peak price</small><b style="color:${C.amber}">£${F(Math.max(...sol.price), 0)}</b></div><div class="kpi"><small><span class="term" data-term="curtail">Curtailed</span></small><b>${F(curt, 0)}</b><span> MWh</span></div><div class="kpi"><small>Cycles</small><b>${F(E > 0 ? disT / E : 0, 2)}</b></div>`;
    g.querySelector('.ins').innerHTML = chT > 1 ? P(`The battery bought at an average <b style="color:#fff">£${F(pc / chT, 0)}</b>/MWh and sold at <b style="color:#fff">£${F(pd / disT, 0)}</b>/MWh. It only cycles when the sell price exceeds buy price ÷ [[efficiency|eff]] (÷ ${F(p.eff / 100, 2)}) plus wear: that condition is [[complementary slackness|cs]] at work. Notice how it also flattens the price curve it profits from.`) : 'The battery is idle: no price spread in this day is wide enough to pay for its losses. Add solar, raise the gas price or reshape the load.';
    g.querySelector('.alg').innerHTML = P(`Built an [[LP|lp]] with <b style="color:#fff">${sol.n} variables</b> (7 per hour) and <b style="color:#fff">${sol.m} constraints</b>, then solved it with the same [[simplex|simplex]] method you watched earlier: <b style="color:#fff">${sol.iters} pivots in ${F(sol.ms, 0)} ms</b>, in your browser. The hourly prices are not an input: they are the [[dual variables|dualvar]] of the 24 [[balance|balance]] constraints, read from the final tableau.`);
  }
  const S = g.querySelector('.sl'), mk = (k, o) => OV.slider(S, Object.assign({ value: p[k], onInput: v => { p[k] = v; dirty = true; } }, o));
  mk('P', { label: 'Battery power (MW)', min: 0, max: 60, step: 1 }); mk('dur', { label: 'Duration (hours)', term: 'soc', min: 1, max: 8, step: .5 }); mk('eff', { label: 'Round-trip efficiency', term: 'eff', min: 50, max: 100, step: 1, fmt: v => v + '%' });
  mk('solar', { label: 'Solar capacity (MW)', min: 0, max: 160, step: 5 }); mk('gas', { label: 'Gas cost (£/MWh)', term: 'mc', min: 20, max: 170, step: 5 }); mk('gasCap', { label: 'Gas capacity (MW)', min: 20, max: 110, step: 5 });
  OV.button(g.querySelector('.bt'), 'Reset load shape', () => { load0.forEach((v, i) => load[i] = v); dirty = true; });
  OV.button(g.querySelector('.bt'), 'Evening spike', () => { load0.forEach((v, i) => load[i] = v + (i >= 17 && i <= 20 ? 35 : 0)); dirty = true; });
  OV.button(g.querySelector('.bt'), 'Flat load', () => { load.fill(72); dirty = true; });
  const YA = v => A.t + A.h * (1 - (v + 30) / (yMax + 30));
  cv.c.addEventListener('pointerdown', e => { const q = OV.mouse(cv.c, e), h = Math.floor((q[0] - L) / bw); if (h >= 0 && h < N && q[1] < A.t + A.h && Math.abs(q[1] - YA(load[h])) < 26) { drag = h; cv.c.setPointerCapture(e.pointerId); } });
  cv.c.addEventListener('pointermove', e => { const q = OV.mouse(cv.c, e), h = OV.clamp(Math.floor((q[0] - L) / bw), 0, N - 1); hover = q[0] >= L ? h : -1; if (drag >= 0) { load[h] = OV.clamp(Math.round((1 - (q[1] - A.t) / A.h) * (yMax + 30) - 30), 10, 150); dirty = true; } cv.c.style.cursor = drag >= 0 ? 'grabbing' : (q[1] < A.t + A.h && hover >= 0 && Math.abs(q[1] - YA(load[hover])) < 26 ? 'grab' : ''); });
  cv.c.addEventListener('pointerup', () => { drag = -1; }); cv.c.addEventListener('pointerleave', () => { if (drag < 0) hover = -1; });
  const ro = g.querySelector('.ro');
  OV.onTick(() => {
    if (dirty) { dirty = false; solve(); }
    ctx.clearRect(0, 0, W, H); if (!sol) { ctx.fillStyle = C.red; ctx.fillText('Model infeasible', 80, 80); return; }
    yMax = Math.max(130, ...load) + 10;
    const panel = (q, title) => { ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.roundRect(L, q.t, W - L - R, q.h, 6); ctx.fill(); ctx.fillStyle = '#c2cbe0'; ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(title, L, q.t - 4); };
    const axis = (q, lo, hi, step, f) => { ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { const y = q.t + q.h * (1 - (v - lo) / (hi - lo)); ctx.strokeStyle = v === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.fillStyle = C.dim; ctx.fillText(f ? f(v) : v, L - 6, y); } };
    panel(A, 'Power (MW)'); axis(A, -30, yMax, 30);
    for (let t = 0; t < N; t++) {
      let y = 0; const x = X(t) + 1.5, w = bw - 3, seg = (v, col) => { if (v < .01) return; const ya = YA(y + v), yb = YA(y); ctx.fillStyle = col; ctx.fillRect(x, ya, w, yb - ya); y += v; };
      seg(sol.sun[t] - sol.curt[t], '#fbbf24'); seg(sol.gas[t], '#4cc9f0'); seg(sol.pk[t], '#fb923c'); seg(sol.dis[t], '#34d399'); seg(sol.shed[t], '#fb7185');
      if (sol.curt[t] > .01) { ctx.strokeStyle = 'rgba(251,191,36,.7)'; ctx.setLineDash([3, 3]); ctx.strokeRect(x + .5, YA(y + sol.curt[t]), w - 1, YA(y) - YA(y + sol.curt[t])); ctx.setLineDash([]); }
      if (sol.ch[t] > .01) { ctx.fillStyle = '#a78bfa'; ctx.fillRect(x, YA(0), w, YA(-sol.ch[t]) - YA(0)); }
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; ctx.beginPath(); load.forEach((v, t) => { const x = X(t) + bw / 2, y = YA(v); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.shadowBlur = 0;
    load.forEach((v, t) => { ctx.fillStyle = t === drag || t === hover ? C.amber : '#fff'; ctx.beginPath(); ctx.arc(X(t) + bw / 2, YA(v), t === drag || t === hover ? 5 : 3, 0, 7); ctx.fill(); });
    panel(Bp, `Battery state of charge (MWh of ${F(sol.E, 0)})`); axis(Bp, 0, Math.max(1, sol.E), Math.max(1, sol.E) / 2, v => F(v, 0));
    ctx.beginPath(); ctx.moveTo(X(0), Bp.t + Bp.h); for (let t = 0; t < N; t++) { const y = Bp.t + Bp.h * (1 - (sol.E > 0 ? sol.soc[t] / sol.E : 0)); ctx.lineTo(X(t) + bw / 2, y); } ctx.lineTo(X(N - 1) + bw / 2, Bp.t + Bp.h); ctx.closePath();
    const gr = ctx.createLinearGradient(0, Bp.t, 0, Bp.t + Bp.h); gr.addColorStop(0, 'rgba(52,211,153,.75)'); gr.addColorStop(1, 'rgba(52,211,153,.08)'); ctx.fillStyle = gr; ctx.fill();
    const pm = Math.min(Math.max(...sol.price, 100) * 1.15, 320); panel(Cp, 'Marginal price λ (£/MWh) = dual of each hour\'s balance constraint'); axis(Cp, 0, pm, pm > 200 ? 100 : 50, v => '£' + v);
    ctx.strokeStyle = C.amber; ctx.lineWidth = 2.2; ctx.beginPath(); for (let t = 0; t < N; t++) { const y = Cp.t + Cp.h * (1 - Math.min(sol.price[t], pm) / pm); t ? ctx.lineTo(X(t), y) : ctx.moveTo(X(t), y); ctx.lineTo(X(t + 1), y); } ctx.stroke();
    for (let t = 0; t < N; t++) if (sol.price[t] > pm) { ctx.fillStyle = C.red; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'center'; ctx.fillText('£' + F(sol.price[t], 0), X(t) + bw / 2, Cp.t + 9); }
    ctx.fillStyle = C.dim; ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (let t = 0; t < N; t += 3) ctx.fillText(String(t).padStart(2, '0') + ':00', X(t) + bw / 2, Cp.t + Cp.h + 6);
    if (hover >= 0) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(X(hover), A.t, bw, Cp.t + Cp.h - A.t); const t = hover;
      ro.innerHTML = `<b style="color:#fff">${String(t).padStart(2, '0')}:00</b> · load ${F(load[t], 0)} · solar ${F(sol.sun[t] - sol.curt[t], 0)}${sol.curt[t] > .5 ? ` (+${F(sol.curt[t], 0)} curtailed)` : ''} · gas ${F(sol.gas[t], 0)} · peaker ${F(sol.pk[t], 0)} · battery ${sol.dis[t] > .01 ? '+' + F(sol.dis[t], 0) : sol.ch[t] > .01 ? '−' + F(sol.ch[t], 0) : '0'} MW · stored ${F(sol.soc[t], 0)} MWh · <span style="color:${C.amber}">price £${F(sol.price[t], 0)}</span>`; }
    else if (ro.dataset.h !== 'x') { ro.dataset.h = 'x'; ro.innerHTML = 'Hover an hour for the numbers. Drag any white dot to reshape demand: the whole day is re-optimised instantly.'; }
    if (hover >= 0) ro.dataset.h = '';
  });
  root.appendChild(OV.h('<h2>The model</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math([
    '{min|min}  Σ_[t] ( {c_[gas]|mc}{g_[t]|var} + {c_[peak]|mc}{k_[t]|var} + {VOLL|voll}·{u_[t]|var} )',
    '{g_[t]|var} + {k_[t]|var} + {solar_[t]|rhs} − {w_[t]|curtail} + {d_[t]|var} − {h_[t]|var} + {u_[t]|var} = {load_[t]|balance}',
    '{e_[t]|soc} = {e_[t−1]|soc} + {η|eff}{h_[t]|var} − {d_[t]|var} / {η|eff}',
    '0 ≤ {h_[t]|var}, {d_[t]|var} ≤ {P|rhs},    0 ≤ {e_[t]|soc} ≤ {E|rhs}'], 'sm left')}
    <p class="hint">g gas · k peaker · h charge · d discharge · e stored energy · w curtailed solar · u unserved load. The last hour wraps round to the first, so the battery ends the day as full as it began.</p></div>
    <div class="card"><h3>What to notice</h3><ol class="steps"><li>${P('The [[state of charge|soc]] equation is the only thing connecting the hours. Delete it and the problem falls apart into 24 separate [[dispatch|dispatch]] problems.')}</li>
      <li>${P('Set efficiency to 100%: the battery flattens prices completely wherever it is not at a power or energy limit. Lower it, and a price spread of 1/[[η|eff]] survives.')}</li>
      <li>${P('Shrink the gas capacity until the peaker and then [[lost load|voll]] appear. The price spikes, and the battery\'s value jumps: this is how storage earns scarcity revenue.')}</li>
      <li>${P('Raise solar until it is [[curtailed|curtail]]. The midday price drops to zero: free energy that the battery soaks up until its energy limit binds.')}</li></ol></div></div>`));
  OV.ideas(root, [
    ['Time-coupling', 'Storage, ramp limits and hydro reservoirs all link periods together. That is what turns hourly dispatch into large multi-period models, the natural territory of [[interior-point|ipm]] solvers.'],
    ['Prices from duals, again', 'Each hour\'s price is the [[shadow price|shadow]] of that hour\'s balance. The battery is paid the spread between them, and at the optimum its marginal profit is exactly zero: any more cycling would lose money.'],
    ['From here to real models', 'Real scheduling adds forecasts, networks, reserve and uncertainty, but the skeleton is this LP. Add on/off decisions for the thermal plant and it becomes a [[MILP|milp]]: the next page.']
  ]);
} });

/* ================= 14. Unit commitment ================= */
OV.page({ id: 'uc', group: 'Energy systems', title: 'Unit commitment: when on/off matters', nav: 'Unit commitment (MILP)', render(root) {
  OV.head(root, { kicker: 'Energy · Mixed-integer programming', title: 'Unit commitment: the LP wants 37% of a power station', lead: 'Thermal units cannot run at any level: they are off, or somewhere between [[minimum stable generation|pmin]] and full output, and starting one costs money. Those on/off choices are [[binary variables|binary]], which makes [[unit commitment|uc]] a [[MILP|milp]]. Watch [[branch and bound|bnb]] close the [[gap|mipgap]] on a real scheduling problem.' });
  const U = [{ name: 'Large CCGT', col: '#4cc9f0', pmin: 180, pmax: 400, mc: 48, nl: 2500, su: 30000 }, { name: 'Mid CCGT', col: '#a78bfa', pmin: 100, pmax: 250, mc: 62, nl: 1500, su: 12000 }, { name: 'Peaker', col: '#fb923c', pmin: 20, pmax: 120, mc: 110, nl: 300, su: 1500 }];
  const Tn = 8, HRS = 3, D0 = [330, 300, 420, 600, 560, 520, 690, 480], W0 = [120, 140, 90, 60, 40, 70, 100, 130], VOLL = 3000, nV = 11, p = { dem: 100, wind: 100, su: 100, pmin: 100 };
  const g = OV.h(`<div class="grid2"><div class="card glow"><div class="row mb"><h3 style="margin:0;flex:1">Schedule · eight 3-hour blocks</h3><span class="vw"></span></div><div class="cv"></div>
      <div class="legend"><span><i style="background:#34d399"></i>wind used</span>${U.map(u => `<span><i style="background:${u.col}"></i>${u.name}</span>`).join('')}<span><i style="background:#fb7185"></i>unserved</span></div>
      <div class="pl row mt"></div></div>
    <div class="stack"><div class="card"><h3>What is happening</h3><div class="narr"></div></div>
      <div class="card"><h3>Bound and incumbent · closing the <span class="term" data-term="mipgap">MIP gap</span></h3><div class="ch"></div><div class="kp kpis" style="margin-top:10px"></div></div>
      <div class="card"><h3>The day</h3><div class="sl"></div></div></div></div>`);
  root.appendChild(g);
  const W = 700, H = 470, cv = OV.canvas(g.querySelector('.cv'), W, H), ctx = cv.ctx, cc = OV.canvas(g.querySelector('.ch'), 460, 190), narr = g.querySelector('.narr'), kp = g.querySelector('.kp');
  let S = null, viewMode = 'int';
  const dem = () => D0.map(v => v * p.dem / 100), wind = () => W0.map(v => v * p.wind / 100);
  function lpFor(fix) {
    const n = Tn * nV, c = new Array(n).fill(0), lb = new Array(n).fill(0), ub = new Array(n).fill(null), A = [], sense = [], b = [], D = dem(), Wd = wind();
    const row = () => new Array(n).fill(0);
    for (let t = 0; t < Tn; t++) {
      const o = t * nV, bal = row();
      U.forEach((u, k) => { c[o + k] = u.mc * HRS; c[o + 3 + k] = u.nl * HRS; c[o + 6 + k] = u.su * p.su / 100; ub[o + 3 + k] = 1; bal[o + k] = 1;
        const r1 = row(); r1[o + k] = 1; r1[o + 3 + k] = -u.pmax; A.push(r1); sense.push('<='); b.push(0);
        const r2 = row(); r2[o + k] = 1; r2[o + 3 + k] = -u.pmin * p.pmin / 100; A.push(r2); sense.push('>='); b.push(0);
        const r3 = row(); r3[o + 6 + k] = 1; r3[o + 3 + k] = -1; if (t > 0) r3[o - nV + 3 + k] = 1; A.push(r3); sense.push('>='); b.push(0);
        const f = fix[t * 3 + k]; if (f === 0) ub[o + 3 + k] = 0; if (f === 1) lb[o + 3 + k] = 1; });
      c[o + 9] = VOLL * HRS; ub[o + 10] = Wd[t]; bal[o + 9] = 1; bal[o + 10] = -1; A.push(bal); sense.push('='); b.push(D[t] - Wd[t]);
    }
    return OV.solveLP({ c, A, sense, b, lb, ub });
  }
  const uOf = x => { const u = []; for (let t = 0; t < Tn; t++) for (let k = 0; k < 3; k++) u.push(x[t * nV + 3 + k]); return u; };
  function start() {
    S = { open: [], inc: null, hist: [], nodes: 0, lps: 0, done: false, root: null, cpu: 0, last: 0, status: 'run' };
    const r = lpFor({}); S.lps++;
    if (r.status !== 'optimal') { S.done = true; S.status = 'infeasible'; narr.innerHTML = 'The relaxation is infeasible.'; return; }
    S.root = r; S.open.push({ fix: {}, bound: r.obj, sol: r }); S.rootObj = r.obj;
    narr.innerHTML = P(`<span class="tag">Root relaxation</span><br>First, pretend units can be partly on. The [[LP relaxation|relax]] costs <b>${money(r.obj)}</b> and is the best any real schedule could hope for: a lower [[bound|bound]]. Switch the view to "LP relaxation" to see the fractional commitments it relies on.`);
  }
  function tryInc(x, obj) { if (!S.inc || obj < S.inc.obj - 1e-6) { S.inc = { x, obj }; return true; } return false; }
  function heuristic(sol, fix) {
    const u = uOf(sol.x);
    for (const thr of [.5, 1e-6]) { const f = {}; u.forEach((v, i) => f[i] = fix[i] != null ? fix[i] : (v > thr ? 1 : 0)); const r = lpFor(f); S.lps++; if (r.status === 'optimal') tryInc(r.x, r.obj); }
  }
  function stepBB() {
    if (!S.open.length) { S.done = true; S.status = 'optimal'; return; }
    let k = 0; for (let i = 1; i < S.open.length; i++) if (S.open[i].bound < S.open[k].bound) k = i;
    const nd = S.open.splice(k, 1)[0]; S.nodes++;
    const tol = S.inc ? Math.abs(S.inc.obj) * 1e-5 : 0;
    if (S.inc && nd.bound >= S.inc.obj - tol) return;
    const sol = nd.sol || lpFor(nd.fix); if (!nd.sol) S.lps++;
    if (sol.status !== 'optimal' || (S.inc && sol.obj >= S.inc.obj - tol)) return;
    const u = uOf(sol.x); let bi = -1, bd = 1e-6; u.forEach((v, i) => { const d = Math.min(v, 1 - v); if (d > bd) { bd = d; bi = i; } });
    if (bi < 0) { tryInc(sol.x, sol.obj); return; }
    if (S.nodes <= 3 || S.nodes % 6 === 0) heuristic(sol, nd.fix);
    for (const v of [1, 0]) { const f = Object.assign({}, nd.fix); f[bi] = v; S.open.push({ fix: f, bound: sol.obj }); }
  }
  const bound = () => { let b = S.inc ? S.inc.obj : Infinity; S.open.forEach(n => { if (n.bound < b) b = n.bound; }); return b; };
  OV.seg(g.querySelector('.vw'), [['int', 'Integer schedule'], ['lp', 'LP relaxation', 'The root LP, where a unit may be 37% on. Cheaper, but physically impossible.']], 'int', v => { viewMode = v; });
  const Sl = g.querySelector('.sl'), mk = (k, o) => OV.slider(Sl, Object.assign({ value: p[k], fmt: v => v + '%', onInput: v => { p[k] = v; start(); } }, o));
  mk('dem', { label: 'Demand level', term: 'rhs', min: 50, max: 125, step: 1 }); mk('wind', { label: 'Wind level', min: 0, max: 300, step: 5 }); mk('su', { label: 'Start-up costs', term: 'startup', min: 0, max: 400, step: 10 }); mk('pmin', { label: 'Minimum stable gen.', term: 'pmin', min: 0, max: 150, step: 5 });
  OV.button(g.querySelector('.pl'), '↻ Solve again', () => start(), 'primary');
  g.querySelector('.pl').appendChild(OV.h('<span class="hint">Changing any slider re-solves from scratch. Set minimum stable generation and start-up costs to 0% and the problem becomes almost an LP: the tree collapses.</span>'));
  start();
  OV.onTick((t) => {
    if (S && !S.done && t - S.last >= Math.max(0, .16 - S.nodes * .004)) {
      S.last = t; const per = 1 + Math.floor(S.nodes / 40), tBeg = performance.now(), tEnd = tBeg + 12;
      for (let i = 0; i < per && !S.done && performance.now() < tEnd; i++) { stepBB(); if (S.nodes >= 4000) { S.done = true; S.status = 'limit'; } }
      S.cpu += performance.now() - tBeg;
      const b = S.done && S.status === 'optimal' && S.inc ? S.inc.obj : bound(); S.hist.push({ b: isFinite(b) ? b : null, i: S.inc ? S.inc.obj : null }); S.bound = b;
      const gap = S.inc && isFinite(b) ? Math.max(0, (S.inc.obj - b) / S.inc.obj * 100) : null;
      kp.innerHTML = `<div class="kpi"><small>Nodes</small><b>${S.nodes}</b></div><div class="kpi"><small>LPs solved</small><b>${S.lps}</b></div><div class="kpi"><small><span class="term" data-term="incumbent">Incumbent</span></small><b style="color:${C.green}">${S.inc ? money(S.inc.obj) : '–'}</b></div><div class="kpi"><small><span class="term" data-term="bound">Best bound</span></small><b style="color:${C.violet}">${isFinite(b) ? money(b) : '–'}</b></div><div class="kpi"><small>Gap</small><b style="color:${C.amber}">${gap == null ? '∞' : F(gap, 2) + '%'}</b></div>`;
      if (S.done) { const ms = S.cpu, extra = S.inc ? (S.inc.obj - S.rootObj) / S.rootObj * 100 : 0;
        narr.innerHTML = P(S.status === 'optimal' && S.inc ? `<span class="tag">Proven optimal</span><br>Bound and incumbent have met after <b>${S.nodes} nodes</b> and <b>${S.lps} LP solves</b> (${F(ms, 0)} ms of computing, slowed down here so you can watch). The best real schedule costs <b>${money(S.inc.obj)}</b>, which is <b>${F(extra, 1)}%</b> more than the fractional [[LP relaxation|relax]] pretended: the price of indivisibility. Each LP here has ${S.root.n} variables and ${S.root.m} constraints.` : S.inc ? `<span class="tag">Node limit</span><br>Stopped after ${S.nodes} nodes with a remaining [[gap|mipgap]] of ${F(gap, 2)}%. The incumbent is feasible and within that percentage of optimal: often good enough in practice.` : '<span class="tag">No schedule</span><br>No feasible integer schedule was found.'); }
      else if (S.nodes > 1) narr.innerHTML = P(`<span class="tag">Branching</span><br>Fixing fractional units on or off, one at a time. Each fix creates two child LPs; the [[best bound|bound]] rises as optimistic branches are ruled out, and the [[incumbent|incumbent]] falls as better real schedules are found. ${S.open.length} nodes are waiting.`);
    }
    /* convergence chart */
    if (S) OV.chart(cc.ctx, 460, 190, [{ d: S.hist.map(h => h.i), c: C.green, name: 'incumbent (best real schedule)', step: true }, { d: S.hist.map(h => h.b), c: C.violet, name: 'best bound', step: true }], { fmt: v => '£' + F(v / 1000, 0) + 'k', xLabel: 'time →' });
    /* schedule */
    ctx.clearRect(0, 0, W, H);
    const src = viewMode === 'lp' ? S && S.root : S && S.inc; const L = 52, R = 14, T0 = 22, PH = 280, bw = (W - L - R) / Tn, D = dem(), Wd = wind(), ym = Math.max(760, ...D) * 1.08, Y = v => T0 + PH * (1 - v / ym);
    ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.roundRect(L, T0, W - L - R, PH, 6); ctx.fill(); ctx.font = '10px Consolas, monospace';
    for (let v = 0; v <= ym; v += 200) { ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v)); ctx.stroke(); ctx.fillStyle = C.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(v, L - 6, Y(v)); }
    ctx.fillStyle = '#c2cbe0'; ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('MW', L, T0 - 5);
    const x = src ? (src.x) : null, cy = T0 + PH + 44, ch = 30;
    for (let tt = 0; tt < Tn; tt++) {
      const xa = L + tt * bw + 5, w = bw - 10, o = tt * nV; let y = 0;
      const seg = (v, col, a = 1) => { if (v < .5) return; ctx.fillStyle = OV.rgba(col, a); ctx.fillRect(xa, Y(y + v), w, Y(y) - Y(y + v)); y += v; };
      if (x) { seg(Wd[tt] - x[o + 10], '#34d399'); U.forEach((u, k) => seg(x[o + k], u.col)); seg(x[o + 9], '#fb7185'); }
      ctx.fillStyle = C.dim; ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(tt * 3).padStart(2, '0') + '–' + String(tt * 3 + 3).padStart(2, '0') + 'h', xa + w / 2, T0 + PH + 6);
      U.forEach((u, k) => { const uv = x ? OV.clamp(x[o + 3 + k], 0, 1) : 0, yy = cy + k * (ch + 6), frac = uv > 1e-4 && uv < 1 - 1e-4;
        ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.roundRect(xa, yy, w, ch, 5); ctx.fill();
        if (uv > 1e-4) { ctx.fillStyle = OV.rgba(u.col, frac ? .45 : .9); ctx.beginPath(); ctx.roundRect(xa, yy + ch * (1 - uv), w, ch * uv, 5); ctx.fill(); }
        if (frac) { ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.roundRect(xa, yy, w, ch, 5); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = uv > .5 ? '#06121c' : (frac ? '#fff' : C.dim); ctx.font = '600 10px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(frac ? F(uv * 100, 0) + '% on' : uv > .5 ? 'ON' : 'off', xa + w / 2, yy + ch / 2);
        if (x && x[o + 6 + k] > .01) { ctx.fillStyle = C.amber; ctx.font = '10px Inter, Segoe UI, sans-serif'; ctx.fillText('▲', xa + 8, yy + 8); } });
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); D.forEach((v, tt) => { const xa = L + tt * bw; tt ? ctx.lineTo(xa, Y(v)) : ctx.moveTo(xa, Y(v)); ctx.lineTo(xa + bw, Y(v)); }); ctx.stroke();
    OV.label(ctx, 'demand', L + 34, Y(D[0]) - 14, '#fff', 'center');
    ctx.fillStyle = '#c2cbe0'; ctx.font = '600 11px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(viewMode === 'lp' ? 'Commitment in the LP relaxation (dashed red = fractional, impossible in reality)' : 'Commitment u (▲ = start-up)', L, cy - 5);
    if (!src) { ctx.fillStyle = C.dim; ctx.textAlign = 'center'; ctx.fillText('searching for a first feasible schedule…', W / 2, T0 + PH / 2); }
  });
  root.appendChild(OV.h('<h2>The model</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math([
    '{min|min}  Σ_[g,t] ( {c_[g]|mc}{p_[g,t]|var} + {f_[g]|noload}{u_[g,t]|binary} + {s_[g]|startup}{v_[g,t]|var} )',
    'Σ_[g] {p_[g,t]|var} + {wind_[t]|rhs} − {w_[t]|curtail} = {D_[t]|balance}',
    '{P_[g]^[min]|pmin}{u_[g,t]|binary} ≤ {p_[g,t]|var} ≤ {P_[g]^[max]|rhs}{u_[g,t]|binary}',
    '{v_[g,t]|var} ≥ {u_[g,t]|binary} − {u_[g,t−1]|binary},     {u_[g,t] ∈ &#123;0, 1&#125;|binary}'], 'sm left')}
    <p class="hint">p output · u on/off · v start-up indicator · f no-load cost · s start-up cost. Remove "u ∈ {0, 1}" and you have the LP relaxation.</p></div>
    <div class="card"><h3>Why the relaxation cheats</h3><p>${P('With $u$ allowed to be fractional, the LP switches a unit "37% on": it pays 37% of the [[no-load|noload]] and [[start-up cost|startup]] and escapes the [[minimum generation|pmin]] limit. That is cheaper than anything physically possible, which is exactly why it is a valid lower [[bound|bound]]. Branch and bound forces each fractional $u$ to 0 or 1 in turn until no cheating is left.')}</p>
      <p>${P('Commercial solvers add [[cuts|cut]], presolve and heuristics to do this for thousands of units over hundreds of periods. The curves they print while solving are the two you see above.')}</p></div></div>`));
  OV.ideas(root, [
    ['Indivisibility has a price', 'The gap between the root relaxation and the optimal schedule is the cost of lumpiness. Raise start-up costs or minimum generation and it widens; the tree grows with it.'],
    ['A gap you can trust', 'Stop early and the [[MIP gap|mipgap]] still tells you the worst case: "this schedule is within 0.4% of the best possible". No heuristic can make that promise. It is [[duality|dual]] doing the work.'],
    ['No clean prices', 'With binaries the problem is no longer [[convex|convex]], so there is no single price that supports the optimal schedule. That is why real markets need side payments (uplift) for start-up and no-load costs.']
  ]);
} });
})();
