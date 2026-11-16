/* Optimisation Explorer — heuristics on a non-convex landscape: simulated annealing, gradient descent, particle swarm; plus the Lab */
(function () {
'use strict';
const OV = window.OV, C = OV.col, F = OV.fmt, P = OV.P;
const NAMES = { sa: 'Simulated annealing', gd: 'Gradient descent', pso: 'Particle swarm' };

OV.mountTerrain = (root, cfg) => {
  const g = OV.h(`<div class="grid2"><div class="card glow"><div class="row mb"><h3 style="margin:0;flex:1">${cfg.algos.length > 1 ? 'Algorithm' : 'Landscape · sculpt it, then optimise'}</h3><span class="algo"></span></div>
      <div class="row mb"><span class="mode"></span><span class="tool"></span><span class="tg"></span></div><div class="cv"></div><div class="pl"></div>
      <p class="hint"><span class="pill">click</span> add a valley or hill · <span class="pill">drag ▽ △</span> move it · <span class="pill">scroll</span> over one to deepen · <span class="pill">shift+scroll</span> widen · <span class="pill">double-click</span> delete · dark = low cost (good)</p></div>
    <div class="stack"><div class="card"><h3>What is happening</h3><div class="narr"></div></div>
      <div class="card"><h3 class="cht"></h3><div class="ch"></div><div class="ch2" style="margin-top:8px"></div><div class="kp kpis" style="margin-top:10px"></div></div>
      <div class="card"><h3>Landscape &amp; settings</h3><div class="row pre"></div><div class="par" style="margin-top:10px"></div><div class="row mt race"></div><div class="rt"></div></div></div></div>`);
  root.appendChild(g);
  const st = { algo: cfg.algos[0], seed: 7, sa: { T0: 2, alpha: .992, iters: 900, step: .9 }, gd: { lr: .25, mom: 0, iters: 160 }, pso: { n: 24, w: .72, c1: 1.4, c2: 1.4, iters: 70 }, run: null };
  const narr = g.querySelector('.narr'), par = g.querySelector('.par'), kp = g.querySelector('.kp'), cht = g.querySelector('.cht');
  const T = new OV.Terrain(g.querySelector('.cv'), { preset: cfg.preset || 'rugged', onChange: () => recompute() });
  const player = new OV.Player(g.querySelector('.pl'), { onStep: (i, s) => { if (s) narr.innerHTML = s.msg; }, onPlay: () => { if (player.pos === 0 && st.algo !== 'gd') { st.seed++; const p = player.playing; recompute(); player.playing = p; } } });
  const c1 = OV.canvas(g.querySelector('.ch'), 460, 170), c2 = OV.canvas(g.querySelector('.ch2'), 460, 110);
  function recompute() {
    const a = st.algo, o = Object.assign({ seed: st.seed }, st[a]);
    st.run = OV.heur[a](T, o); T.run = st.run; player.load(st.run.steps, a === 'sa' ? 45 : a === 'gd' ? 10 : 7);
    narr.innerHTML = st.run.steps[0].msg;
  }
  function buildPar() {
    par.innerHTML = ''; const a = st.algo, p = st[a], S = (o) => OV.slider(par, Object.assign({ onInput: v => { p[o.k] = v; recompute(); } }, o, { value: p[o.k] }));
    cht.innerHTML = a === 'sa' ? 'Cost and <span class="term" data-term="temp">temperature</span> over time' : a === 'gd' ? 'Cost over iterations' : 'Swarm best and spread';
    g.querySelector('.ch2').style.display = a === 'sa' ? '' : 'none';
    if (a === 'sa') { S({ k: 'T0', label: 'Start temperature T₀', term: 'temp', min: .05, max: 6, step: .05 }); S({ k: 'alpha', label: 'Cooling rate α', term: 'cooling', min: .95, max: .999, step: .001, fmt: v => v.toFixed(3) }); S({ k: 'iters', label: 'Iterations', min: 100, max: 3000, step: 50 }); S({ k: 'step', label: 'Move size', min: .1, max: 2.5, step: .05 }); }
    if (a === 'gd') { S({ k: 'lr', label: 'Step size η', term: 'lr', min: .01, max: 1.5, step: .01 }); S({ k: 'mom', label: 'Momentum β', term: 'momentum', min: 0, max: .95, step: .05 }); S({ k: 'iters', label: 'Max iterations', min: 20, max: 400, step: 10 }); }
    if (a === 'pso') { S({ k: 'n', label: 'Particles', term: 'pso', min: 3, max: 60, step: 1 }); S({ k: 'w', label: 'Inertia w', term: 'inertia', min: .1, max: 1, step: .02 }); S({ k: 'c1', label: 'Pull to own best c₁', min: 0, max: 3, step: .1 }); S({ k: 'c2', label: 'Pull to swarm best c₂', min: 0, max: 3, step: .1 }); S({ k: 'iters', label: 'Iterations', min: 20, max: 200, step: 5 }); }
  }
  const tick = OV.onTick((t, dt) => {
    player.tick(dt); T.cur = { i: player.i, frac: player.frac }; T.draw(t, dt);
    const S = st.run.steps, cur = player.pos, s = player.step, a = st.algo;
    if (a === 'sa') {
      OV.chart(c1.ctx, 460, 170, [{ d: S.map(q => q.f), c: C.pink, name: 'current cost', w: 1.3 }, { d: S.map(q => q.bf), c: C.amber, name: 'best so far' }, { d: S.map(q => q.T), c: C.cyan, name: 'temperature', right: true, dash: [4, 3], w: 1.5 }], { cursor: cur, xLabel: 'iteration' });
      const ctx = c2.ctx, W = 460, H = 110, L = 46, R = 12, Tp = 20, B = 20; ctx.clearRect(0, 0, W, H);
      ctx.font = '11px Inter, Segoe UI, sans-serif'; ctx.fillStyle = '#c2cbe0'; ctx.textAlign = 'left'; ctx.fillText(`chance of accepting an uphill move of size Δ, at T = ${F(s.T, 3)}`, L, 10);
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.strokeRect(L, Tp, W - L - R, H - Tp - B); ctx.beginPath(); ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
      for (let k = 0; k <= 100; k++) { const d = k / 100 * 3, y = Tp + (1 - Math.exp(-d / s.T)) * (H - Tp - B), x = L + k / 100 * (W - L - R); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      ctx.fillStyle = '#93a0bb'; ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'right'; ctx.fillText('100%', L - 6, Tp + 4); ctx.fillText('0%', L - 6, H - B); ctx.textAlign = 'center'; ctx.fillText('Δ = 0', L, H - 6); ctx.fillText('Δ = 3', W - R - 12, H - 6);
    } else if (a === 'gd') OV.chart(c1.ctx, 460, 170, [{ d: S.map(q => q.f), c: C.cyan, name: 'cost' }], { cursor: cur, xLabel: 'iteration' });
    else OV.chart(c1.ctx, 460, 170, [{ d: S.map(q => q.bf), c: C.amber, name: 'swarm best cost', step: true }, { d: S.map((q, i) => i ? q.spread : null), c: C.cyan, name: 'spread', right: true, dash: [4, 3], w: 1.5 }], { cursor: cur, xLabel: 'iteration' });
    if (st._i !== player.i || st._r !== st.run) { st._i = player.i; st._r = st.run; const gap = s.bf - T.fmin;
      kp.innerHTML = `<div class="kpi"><small>Best found</small><b style="color:${C.amber}">${F(s.bf, 3)}</b></div><div class="kpi"><small>Global minimum</small><b>${T.showGlobal ? F(T.fmin, 3) : '?'}</b></div><div class="kpi"><small>Verdict</small><b style="font-size:.9rem;color:${gap < .03 ? C.green : C.dim}">${player.pos < player.end ? 'searching…' : gap < .03 ? 'global ✓' : 'local only'}</b></div>`; }
  });
  if (cfg.algos.length > 1) OV.seg(g.querySelector('.algo'), cfg.algos.map(a => [a, NAMES[a]]), st.algo, a => { st.algo = a; buildPar(); recompute(); });
  OV.seg(g.querySelector('.mode'), [['2d', 'Map'], ['3d', '3-D surface', 'Drag to rotate. Switch back to Map to edit.']], '2d', v => { T.mode = v; T.spin = true; });
  OV.seg(g.querySelector('.tool'), [['valley', '▽ valley'], ['hill', '△ hill']], 'valley', v => { T.tool = v; });
  OV.button(g.querySelector('.tg'), 'Reveal global minimum', b => { T.showGlobal = !T.showGlobal; b.classList.toggle('on', T.showGlobal); st._i = -1; });
  const pre = g.querySelector('.pre'); Object.keys(OV.terrains).forEach(k => OV.button(pre, OV.terrains[k].name, () => { T.load(k); recompute(); }));
  OV.button(pre, 'Flat', () => { T.bumps = []; T.ripple = 0; T.rebuild(); recompute(); });
  if (cfg.race) OV.button(g.querySelector('.race'), '⚑ Race all three from this start', () => {
    const rows = ['sa', 'gd', 'pso'].map(a => { const r = OV.heur[a](T, Object.assign({ seed: st.seed + 1 }, st[a])); return [NAMES[a], r.bf, a === 'pso' ? st.pso.n * st.pso.iters : r.steps.length - 1]; }), best = Math.min(...rows.map(r => r[1]));
    g.querySelector('.rt').innerHTML = `<table class="plain cmp" style="margin-top:10px"><tr><th>Method</th><th>Best cost</th><th>Gap to global</th><th>Evaluations</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td class="${r[1] <= best + 1e-9 ? 'win' : ''}">${F(r[1], 3)}</td><td>${F(r[1] - T.fmin, 3)}</td><td>${r[2]}</td></tr>`).join('')}</table><p class="hint">None of these can <i>prove</i> its answer is best: there is no bound, so no gap to report. Contrast with the exact methods.</p>`;
  });
  buildPar(); recompute();
  return { destroy() { OV.ticks.delete(tick); } };
};

/* ================= 8. Simulated annealing ================= */
OV.page({ id: 'sa', group: 'Heuristics for rugged landscapes', title: 'Simulated annealing', nav: 'Simulated annealing', render(root) {
  OV.head(root, { kicker: 'Heuristics · Simulated annealing', title: 'Simulated annealing: accept getting worse', lead: 'Leave the flat-sided world of LPs and the guarantee that [[local|local]] means [[global|global]] disappears. A search that only ever goes downhill stops in the first valley it finds. [[Simulated annealing|sa]] escapes by sometimes stepping <i>uphill</i>, often while it is hot and almost never once it has cooled.' });
  OV.mountTerrain(root, { algos: ['sa'], preset: 'rugged' });
  root.appendChild(OV.h('<h2>The rule</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math(['{P(accept)|boltz} = 1   if {Δ|obj} ≤ 0', '{P(accept)|boltz} = e^[−{Δ|obj} / {T|temp}]   if Δ &gt; 0', '{T|temp} ← {α|cooling} · {T|temp}'], 'sm')}</div>
    <div class="card"><p>${P('Propose a random nearby point and measure the change in cost $Δ$. Improvements are always taken. A worsening is taken with the [[Metropolis probability|boltz]], which depends on how bad the move is and how hot the system is. After every step the [[temperature|temp]] is multiplied by the [[cooling rate|cooling]] $α$.')}</p><p>${P('The name comes from metallurgy: cool a metal slowly and its atoms find a low-energy crystal; quench it and they freeze in disorder. Try a fast cooling rate (0.95) on the Rugged landscape and watch it freeze in the wrong valley.')}</p></div></div>`));
  OV.ideas(root, [
    ['Explore, then exploit', 'Early on the walker roams the whole map ([[exploration|explore]]). As it cools it commits to a region and polishes. Tuning is the art of spending the right amount of time in each phase.'],
    ['No certificate', 'Unlike simplex or branch and bound, there is no [[bound|bound]] and so no [[gap|gap]]. You get an answer, possibly excellent, with no proof of how good it is. Run it twice and you may get two different answers.'],
    ['When it earns its place', 'When the landscape is non-convex, discontinuous or only available as a black-box simulation: wind-farm layout, network reconfiguration, maintenance scheduling. If a problem can be written as an LP or MILP, exact methods usually win.']
  ]);
} });

/* ================= 9. Gradient descent ================= */
OV.page({ id: 'gd', group: 'Heuristics for rugged landscapes', title: 'Gradient descent', nav: 'Gradient descent', render(root) {
  OV.head(root, { kicker: 'Heuristics · Gradient descent', title: 'Gradient descent: follow the slope', lead: 'The simplest idea in continuous optimisation: measure the [[gradient|gradient]] and step downhill. On a [[convex|convex]] bowl it is unbeatable. On a rugged landscape it rolls into whichever valley is nearest and stays there. Drag the start point around and see which starts reach the [[global minimum|global]].' });
  OV.mountTerrain(root, { algos: ['gd'], preset: 'twin' });
  root.appendChild(OV.h('<h2>The update</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math(['{x|var}_[k+1] = {x|var}_[k] − {η|lr} {∇f(x_[k])|gradient}', '<span class="w">with momentum</span> {v|momentum} ← {β|momentum}{v|momentum} − {η|lr}{∇f|gradient},   {x|var} ← {x|var} + {v|momentum}'], 'sm')}</div>
    <div class="card"><p>${P('The [[step size|lr]] $η$ decides everything. Too small and it crawls. Too large and it overshoots the valley floor and bounces, or flies off entirely: push it past 1 on the Egg-box landscape. [[Momentum|momentum]] remembers the previous step, which damps zig-zagging and can coast through small dips.')}</p></div></div>`));
  OV.ideas(root, [
    ['Basins of attraction', 'Every start point belongs to exactly one valley. The landscape is carved into basins, and plain gradient descent can never leave the one it starts in. Multi-start (many random starts) is the cheap fix.'],
    ['The link to interior point', 'The [[Newton step|newton]] used by [[interior-point methods|ipm]] is gradient descent\'s smarter sibling: it uses curvature as well as slope. On the convex barrier problem it converges in a handful of steps.'],
    ['Why convexity is prized', 'If the problem is [[convex|convex]], the nearest valley is the only valley. That is why modellers work so hard to keep energy models linear or convex: it turns "a good answer" into "the answer".']
  ]);
} });

/* ================= 10. Particle swarm ================= */
OV.page({ id: 'pso', group: 'Heuristics for rugged landscapes', title: 'Particle swarm optimisation', nav: 'Particle swarm', render(root) {
  OV.head(root, { kicker: 'Heuristics · Particle swarm', title: 'Particle swarm: search as a team', lead: 'Instead of one walker, release a flock. Each particle in a [[swarm|pso]] remembers the best place it has seen and hears about the best place <i>anyone</i> has seen. Pulled between the two, with some [[inertia|inertia]], the swarm sweeps the landscape and then collapses onto the most promising valley.' });
  OV.mountTerrain(root, { algos: ['pso'], preset: 'trap' });
  root.appendChild(OV.h('<h2>The update</h2>'));
  root.appendChild(OV.h(`<div class="grid2 even"><div class="card">${OV.math(['{v|momentum} ← {w|inertia}{v|momentum} + {c₁r₁|explore}({p|local} − {x|var}) + {c₂r₂|explore}({g|global} − {x|var})', '{x|var} ← {x|var} + {v|momentum}'], 'sm')}
      <p class="hint" style="text-align:center">p = this particle's best position · g = the swarm's best position · r₁, r₂ = random numbers in [0, 1]</p></div>
    <div class="card"><p>${P('Three forces: keep going ([[inertia|inertia]]), return to my own best find, and join the crowd. Raise the social pull $c₂$ and the swarm converges fast but may all rush to a [[local optimum|local]]. Raise inertia or the personal pull $c₁$ and it explores longer. No gradients are needed, only cost evaluations.')}</p></div></div>`));
  OV.ideas(root, [
    ['Population methods', 'Genetic algorithms, differential evolution and particle swarms all keep many candidates alive at once. Diversity is their defence against local optima; the price is many more function evaluations.'],
    ['Embarrassingly parallel', 'Each particle can be evaluated independently. When one evaluation is an expensive simulation (a full power-flow study, say), that is a real practical advantage.'],
    ['Still no guarantee', 'Like [[simulated annealing|sa]], a swarm returns a good answer with no proof. On the Deceptive landscape, try 6 particles, then 40: more scouts make it more likely someone stumbles on the narrow deep valley.']
  ]);
} });

/* ================= 11. The Lab ================= */
OV.page({ id: 'lab', group: 'Playground', title: 'The Lab: any landscape, any algorithm', nav: 'The Lab', render(root) {
  OV.head(root, { kicker: 'Playground', title: 'The Lab', lead: 'Build your own landscape, pick an algorithm, press <b>Optimise</b>. Use the linear world for the exact methods, which come with proofs, and the rugged world for the [[heuristics|heuristic]], which come without.' });
  const bar = OV.h('<div class="row mb"></div>'), host = OV.h('<div></div>'); root.appendChild(bar); root.appendChild(host);
  let cur = null;
  const show = k => { if (cur && cur.destroy) cur.destroy(); host.innerHTML = '';
    cur = k === 'lp' ? OV.mountLP(host, { algos: ['simplex', 'ipm', 'bnb', 'bnc'], preset: 'polygon' }) : OV.mountTerrain(host, { algos: ['sa', 'gd', 'pso'], preset: 'rugged', race: true }); };
  OV.seg(bar, [['lp', 'Linear landscape · simplex, interior point, branch &amp; bound, branch &amp; cut'], ['nl', 'Rugged landscape · annealing, gradient descent, swarm']], 'lp', show);
  show('lp');
  root.appendChild(OV.h('<h2>Which method when?</h2>'));
  root.appendChild(OV.h(`<div class="card"><div class="tabwrap"><table class="plain"><tr><th>Method</th><th style="text-align:left">Works on</th><th style="text-align:left">Guarantee</th><th style="text-align:left">Strength</th><th style="text-align:left">Weakness</th></tr>
    <tr><td>Simplex</td><td style="text-align:left">LP</td><td style="text-align:left;color:${C.green}">global optimum + prices</td><td style="text-align:left">warm starts, exact vertex</td><td style="text-align:left">can be slow on huge LPs</td></tr>
    <tr><td>Interior point</td><td style="text-align:left">LP, convex</td><td style="text-align:left;color:${C.green}">global optimum to a tolerance</td><td style="text-align:left">scales to millions of variables</td><td style="text-align:left">no warm start, needs crossover</td></tr>
    <tr><td>Branch &amp; bound</td><td style="text-align:left">MILP</td><td style="text-align:left;color:${C.green}">global optimum, or a proven gap</td><td style="text-align:left">handles on/off decisions</td><td style="text-align:left">tree can explode</td></tr>
    <tr><td>Branch &amp; cut</td><td style="text-align:left">MILP</td><td style="text-align:left;color:${C.green}">global optimum, or a proven gap</td><td style="text-align:left">far smaller trees</td><td style="text-align:left">each node costs more</td></tr>
    <tr><td>Gradient descent</td><td style="text-align:left">smooth functions</td><td style="text-align:left;color:${C.amber}">local optimum only</td><td style="text-align:left">cheap, scales enormously</td><td style="text-align:left">trapped by the nearest valley</td></tr>
    <tr><td>Simulated annealing</td><td style="text-align:left">anything you can evaluate</td><td style="text-align:left;color:${C.red}">none</td><td style="text-align:left">escapes local optima, simple</td><td style="text-align:left">slow, needs tuning</td></tr>
    <tr><td>Particle swarm</td><td style="text-align:left">anything you can evaluate</td><td style="text-align:left;color:${C.red}">none</td><td style="text-align:left">parallel, no gradients</td><td style="text-align:left">many evaluations</td></tr></table></div></div>`));
} });
})();
