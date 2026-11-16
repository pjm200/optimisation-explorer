/* Optimisation Explorer — core: helpers, maths markup, tooltips, controls, player, charts, router */
(function () {
'use strict';
const OV = window.OV = { pages: [], terms: {}, ticks: new Set(), cleanups: [] };

OV.col = { cyan: '#4cc9f0', violet: '#a78bfa', pink: '#f472b6', amber: '#fbbf24', green: '#34d399', red: '#fb7185', orange: '#fb923c', text: '#e8ecf6', dim: '#93a0bb' };
OV.pal = ['#4cc9f0', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#fb923c'];

OV.h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
OV.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
OV.lerp = (a, b, t) => a + (b - a) * t;
OV.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
OV.fmt = (v, d = 2) => {
  if (v == null || isNaN(v)) return '–';
  if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
  let s = (Math.abs(v) < 5e-10 ? 0 : v).toFixed(d);
  if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
  if (s === '-0') s = '0';
  return s.replace('-', '−');
};
OV.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---------- maths markup ----------
   M("max {c|coef}^[T]{x|var}")  ->  hoverable HTML.  {text|termKey}, _[sub], ^[sup]. Single letters become italic. */
OV.M = s => {
  const keys = [];
  s = s.replace(/\{([^|{}]+)\|([^{}]+)\}/g, (m, t, k) => { keys.push(k); return `\u0001${keys.length - 1}\u0002${t}\u0003`; });
  s = s.replace(/<[^>]+>|(?<![A-Za-z&])[A-Za-zα-ωΓ-Ω](?![A-Za-z;])/g, m => m[0] === '<' ? m : `\u0004${m}\u0005`);
  s = s.replace(/([_^])\[([^\]]*)\]/g, (m, o, t) => o === '_' ? `<sub>${t}</sub>` : `<sup>${t}</sup>`);
  s = s.replace(/\u0001(\d+)\u0002([^\u0003]*)\u0003/g, (m, i, t) => `<span class="t" data-term="${keys[+i]}">${t}</span>`);
  return s.replace(/\u0004/g, '<i>').replace(/\u0005/g, '</i>');
};
OV.math = (rows, cls = '') => `<div class="math ${cls}">${[].concat(rows).map(r => `<span class="row">${OV.M(r)}</span>`).join('')}</div>`;
OV.im = s => `<span class="im">${OV.M(s)}</span>`;
/* prose: "a [[feasible region|region]] is ..." and inline maths with $...$ */
OV.P = s => s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '<span class="term" data-term="$2">$1</span>').replace(/\$([^$]+)\$/g, (m, x) => OV.im(x));

/* ---------- tooltips ---------- */
function initTips() {
  const tip = document.getElementById('tip');
  let cur = null;
  const show = (el, e) => {
    cur = el;
    const k = el.dataset.term, T = k && OV.terms[k];
    tip.innerHTML = T ? `<b>${T.t}</b>${T.d}` : (el.dataset.tip || (k ? `<b>${k}</b>` : ''));
    tip.classList.add('on'); move(e);
  };
  const hide = () => { cur = null; tip.classList.remove('on'); };
  const move = e => {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 18;
    if (x + w > innerWidth - 8) x = e.clientX - w - 12;
    if (y + h > innerHeight - 8) y = e.clientY - h - 12;
    tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px';
  };
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-term],[data-tip]'); if (el) show(el, e); else if (cur) hide(); });
  document.addEventListener('mousemove', e => { if (cur) move(e); });
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-term],[data-tip]'); if (el) show(el, e); else hide(); });
  document.addEventListener('scroll', hide, true);
}

/* ---------- canvas ---------- */
OV.canvas = (host, W, H) => {
  const c = document.createElement('canvas'), dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
  c.width = W * dpr; c.height = H * dpr; c.W = W; c.H = H; c.style.aspectRatio = W + ' / ' + H;
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  host.appendChild(c);
  return { c, ctx };
};
OV.mouse = (c, e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.W / r.width, (e.clientY - r.top) * c.H / r.height]; };
OV.glowDot = (ctx, x, y, r, color, t = 0) => {
  const pulse = 1 + 0.25 * Math.sin(t * 4);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4 * pulse);
  g.addColorStop(0, OV.rgba(color, .55)); g.addColorStop(1, OV.rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.4 * pulse, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
};
OV.star = (ctx, x, y, r, color) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; ctx.lineTo(x + q * Math.cos(a), y + q * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
};
OV.label = (ctx, txt, x, y, color = '#fff', align = 'left') => {
  ctx.font = '600 12px Inter, Segoe UI, sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width, x0 = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
  ctx.fillStyle = 'rgba(8,12,24,.82)'; ctx.beginPath(); ctx.roundRect(x0 - 5, y - 10, w + 10, 20, 6); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(txt, x, y + .5);
};

/* ---------- controls ---------- */
OV.slider = (host, o) => {
  const lab = o.term ? `<span class="term" data-term="${o.term}">${o.label}</span>` : o.label;
  const el = OV.h(`<label class="ctrl"><span>${lab}</span><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${o.value}"><span class="ctrl-v"></span></label>`);
  const inp = el.querySelector('input'), out = el.querySelector('.ctrl-v');
  const f = o.fmt || (v => OV.fmt(v));
  const upd = () => { out.textContent = f(+inp.value); };
  inp.addEventListener('input', () => { upd(); o.onInput && o.onInput(+inp.value); });
  upd(); host.appendChild(el);
  return { el, get value() { return +inp.value; }, set value(v) { inp.value = v; upd(); } };
};
OV.button = (host, label, fn, cls = '') => { const b = OV.h(`<button class="btn ${cls}">${label}</button>`); b.addEventListener('click', () => fn(b)); host.appendChild(b); return b; };
OV.seg = (host, opts, value, fn) => {
  const el = OV.h('<div class="seg"></div>');
  opts.forEach(([v, l, tip]) => {
    const b = OV.h(`<button data-v="${v}"${tip ? ` data-tip="${tip}"` : ''}>${l}</button>`);
    if (v === value) b.classList.add('on');
    b.addEventListener('click', () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(v); });
    el.appendChild(b);
  });
  host.appendChild(el);
  return { el, set(v) { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === String(v))); } };
};

/* ---------- step player ---------- */
OV.Player = class {
  constructor(host, o = {}) {
    this.o = o; this.steps = []; this.pos = 0; this.playing = false; this.rate = o.rate || 1.2; this.mult = 1; this._i = -1; this._lab = '';
    const el = this.el = OV.h(`<div class="player">
      <button class="btn icon" data-a="reset" data-tip="Back to the start">⏮</button>
      <button class="btn icon" data-a="back" data-tip="One step back">◀</button>
      <button class="btn primary" data-a="play">▶ Optimise</button>
      <button class="btn icon" data-a="fwd" data-tip="One step forward">▶</button>
      <label class="speed">speed <input type="range" min="-2" max="3" step="0.1" value="0"></label>
      <span class="count"></span></div>`);
    el.addEventListener('click', e => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a, end = Math.max(0, this.steps.length - 1);
      if (a === 'reset') { this.pos = 0; this.playing = false; }
      if (a === 'back') { this.playing = false; this.pos = Math.max(0, Math.ceil(this.pos) - 1); }
      if (a === 'fwd') { this.playing = false; this.pos = Math.min(end, Math.floor(this.pos) + 1); }
      if (a === 'play') { if (this.playing) this.playing = false; else { if (this.pos >= end) this.pos = 0; this.playing = true; o.onPlay && o.onPlay(); } }
    });
    el.querySelector('input').addEventListener('input', e => { this.mult = Math.pow(2, +e.target.value); });
    this.btn = el.querySelector('[data-a=play]'); this.cnt = el.querySelector('.count');
    host.appendChild(el);
  }
  load(steps, rate) { this.steps = steps || []; this.pos = 0; this.playing = false; if (rate) this.rate = rate; this._i = -1; this.sync(); }
  get end() { return Math.max(0, this.steps.length - 1); }
  get i() { return Math.min(Math.floor(this.pos + 1e-9), this.end); }
  get frac() { return this.i >= this.end ? 0 : this.pos - this.i; }
  get step() { return this.steps[this.i]; }
  get next() { return this.steps[Math.min(this.i + 1, this.end)]; }
  play() { this.pos = 0; this.playing = true; }
  tick(dt) {
    if (this.playing) { this.pos += Math.min(dt, .1) * this.rate * this.mult; if (this.pos >= this.end) { this.pos = this.end; this.playing = false; } }
    this.sync();
  }
  sync() {
    const lab = this.playing ? '⏸ Pause' : this.pos <= 0 ? '▶ Optimise' : this.pos >= this.end ? '↻ Replay' : '▶ Resume';
    if (lab !== this._lab) { this.btn.textContent = this._lab = lab; }
    if (this.i !== this._i) { this._i = this.i; this.cnt.textContent = this.steps.length ? `step ${this.i + 1} / ${this.steps.length}` : ''; this.o.onStep && this.o.onStep(this.i, this.step); }
  }
};

/* ---------- small line chart ----------
   series: [{d:[..], c:'#hex', name, step:bool, right:bool, dash:[..]}]   o: {cursor, log, n, yLabel, fmt} */
OV.chart = (ctx, W, H, series, o = {}) => {
  ctx.clearRect(0, 0, W, H);
  const L = 46, R = o.rightAxis ? 44 : 12, T = 22, B = 20, w = W - L - R, h = H - T - B;
  const tf = v => o.log ? Math.log10(Math.max(v, o.logMin || 1e-9)) : v;
  const range = arr => { let lo = Infinity, hi = -Infinity; arr.forEach(s => s.d.forEach(v => { if (v != null && isFinite(v)) { const q = tf(v); lo = Math.min(lo, q); hi = Math.max(hi, q); } })); if (!isFinite(lo)) { lo = 0; hi = 1; } if (hi - lo < 1e-9) { hi += .5; lo -= .5; } return [lo, hi]; };
  const left = series.filter(s => !s.right), right = series.filter(s => s.right);
  let [lo, hi] = range(left); if (o.ymin != null) lo = tf(o.ymin); if (o.ymax != null) hi = tf(o.ymax);
  const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const [rlo, rhi] = right.length ? range(right) : [0, 1];
  const n = o.n || Math.max(2, ...series.map(s => s.d.length));
  const X = i => L + (n <= 1 ? 0 : i / (n - 1)) * w;
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.font = '10px Consolas, monospace'; ctx.fillStyle = '#93a0bb'; ctx.textBaseline = 'middle';
  for (let k = 0; k <= 3; k++) {
    const y = T + h * k / 3, v = hi - (hi - lo) * k / 3;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + w, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(o.fmt ? o.fmt(o.log ? Math.pow(10, v) : v) : (o.log ? '1e' + Math.round(v) : OV.fmt(v, Math.abs(hi - lo) < 5 ? 2 : 0)), L - 6, y);
  }
  series.forEach(s => {
    const a = s.right ? rlo : lo, b = s.right ? rhi + (rhi - rlo) * .08 : hi;
    const Y = v => T + h * (1 - (tf(v) - a) / ((b - a) || 1));
    const upto = o.cursor != null ? Math.min(s.d.length - 1, Math.floor(o.cursor)) : s.d.length - 1;
    ctx.beginPath(); ctx.strokeStyle = s.c; ctx.lineWidth = s.w || 2; ctx.setLineDash(s.dash || []); let started = false, py = 0;
    for (let i = 0; i <= upto; i++) {
      const v = s.d[i]; if (v == null || !isFinite(v)) continue;
      const x = X(i), y = OV.clamp(Y(v), T - 2, T + h + 2);
      if (!started) { ctx.moveTo(x, y); started = true; } else { if (s.step) ctx.lineTo(x, py); ctx.lineTo(x, y); }
      py = y;
    }
    ctx.stroke(); ctx.setLineDash([]);
    if (started && o.cursor != null && s.d[upto] != null && isFinite(s.d[upto])) { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(X(upto), OV.clamp(Y(s.d[upto]), T, T + h), 3.2, 0, 7); ctx.fill(); }
  });
  let lx = L; ctx.textAlign = 'left'; ctx.font = '11px Inter, Segoe UI, sans-serif';
  series.forEach(s => { if (!s.name) return; ctx.fillStyle = s.c; ctx.fillRect(lx, 7, 10, 3); ctx.fillStyle = '#c2cbe0'; ctx.fillText(s.name, lx + 14, 9); lx += ctx.measureText(s.name).width + 30; });
  if (o.xLabel) { ctx.fillStyle = '#93a0bb'; ctx.textAlign = 'right'; ctx.fillText(o.xLabel, L + w, H - 7); }
};

/* ---------- pages & router ---------- */
OV.page = p => OV.pages.push(p);
OV.onTick = fn => { OV.ticks.add(fn); return fn; };
OV.onCleanup = fn => OV.cleanups.push(fn);
OV.head = (root, o) => root.appendChild(OV.h(`<header><div class="kicker">${o.kicker}</div><h1>${o.title}</h1><p class="lead">${OV.P(o.lead)}</p></header>`));
OV.ideas = (root, items) => {
  const g = OV.h('<div class="grid3" style="margin-top:18px"></div>');
  items.forEach(([t, d]) => g.appendChild(OV.h(`<div class="card idea"><b class="t1">${t}</b><p>${OV.P(d)}</p></div>`)));
  root.appendChild(g); return g;
};

function go() {
  const id = (location.hash || '').replace(/^#\/?/, '') || OV.pages[0].id;
  let idx = OV.pages.findIndex(p => p.id === id); if (idx < 0) idx = 0;
  const pg = OV.pages[idx], root = document.getElementById('page');
  OV.ticks.clear(); OV.cleanups.forEach(f => { try { f(); } catch (e) { } }); OV.cleanups = [];
  root.innerHTML = ''; document.body.classList.remove('menu'); window.scrollTo(0, 0);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.id === pg.id));
  document.title = pg.title + ' · Optimisation Explorer';
  try { pg.render(root); } catch (e) { console.error(e); root.appendChild(OV.h(`<div class="card"><b>Something went wrong rendering this page.</b><pre>${e && e.stack || e}</pre></div>`)); }
  window.scrollTo(0, 0);
  const prev = OV.pages[idx - 1], next = OV.pages[idx + 1], pager = document.getElementById('pager');
  pager.innerHTML = (prev ? `<a href="#/${prev.id}"><small>← Previous</small>${prev.title}</a>` : '<span></span>') + (next ? `<a href="#/${next.id}" style="text-align:right"><small>Next →</small>${next.title}</a>` : '<span></span>');
}
let last = 0;
function loop(ts) {
  const t = ts / 1000, dt = last ? t - last : 0.016; last = t;
  if (!document.hidden) OV.ticks.forEach(fn => { try { fn(t, dt); } catch (e) { console.error(e); OV.ticks.delete(fn); } });
  requestAnimationFrame(loop);
}
OV.start = () => {
  const nav = document.getElementById('nav'); let grp = null;
  OV.pages.forEach((p, i) => {
    if (p.group !== grp) { grp = p.group; nav.appendChild(OV.h(`<div class="nav-group">${grp}</div>`)); }
    nav.appendChild(OV.h(`<a href="#/${p.id}" data-id="${p.id}"><span class="n">${i + 1}</span>${p.nav || p.title}</a>`));
  });
  document.getElementById('menuBtn').addEventListener('click', () => document.body.classList.toggle('menu'));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  initTips(); window.addEventListener('hashchange', go); go(); requestAnimationFrame(loop);
};
})();
