/* =====================================================================
   DISH ART – top-down food illustrations drawn on canvas.
   Every recipe has a scene in ART below. A real photo (recipe.photo.src
   or an uploaded one) always wins over the drawing.
   ===================================================================== */
const DishArt = (() => {
  const S = 720;                       // drawing units (canvas is S × S)
  let g = null, rnd = Math.random, ROT = 0;

  /* ---------- random & colour helpers ---------- */
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const R = (a, b) => a + (b - a) * rnd();
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const TAU = Math.PI * 2;
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; }
  const light = (h, t) => mix(h, '#ffffff', t);
  const dark = (h, t) => mix(h, '#000000', t);
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  /* ---------- paths & painting ---------- */
  function circleP(x, y, r) { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; }
  function ellP(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; }
  function rrectP(x, y, w, h, r) {
    const p = new Path2D(), l = x - w / 2, t = y - h / 2; r = Math.min(r, w / 2, h / 2);
    p.moveTo(l + r, t); p.arcTo(l + w, t, l + w, t + h, r); p.arcTo(l + w, t + h, l, t + h, r); p.arcTo(l, t + h, l, t, r); p.arcTo(l, t, l + w, t, r); p.closePath();
    return p;
  }
  function blobP(x, y, r, irr = 0.15, n = 9, sx = 1, sy = 1, rot = 0) {
    const pts = [];
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + R(-0.15, 0.15), rr = r * (1 + R(-irr, irr));
      const px = Math.cos(a) * rr * sx, py = Math.sin(a) * rr * sy;
      pts.push([x + px * c - py * s, y + px * s + py * c]);
    }
    const p = new Path2D(), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m = mid(pts[n - 1], pts[0]); p.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) { const q = pts[i], nx = pts[(i + 1) % n], mm = mid(q, nx); p.quadraticCurveTo(q[0], q[1], mm[0], mm[1]); }
    p.closePath();
    return p;
  }
  function put(path, fill, o = {}) {
    const a = o.shadow === undefined ? 0.2 : o.shadow;
    if (a) {
      const sx = o.sx === undefined ? 2.5 : o.sx, sy = o.sy === undefined ? 3.5 : o.sy;
      const c = Math.cos(-ROT), s = Math.sin(-ROT);
      g.save(); g.translate(sx * c - sy * s, sx * s + sy * c);
      g.fillStyle = `rgba(55,35,15,${a})`; g.fill(path); g.restore();
    }
    g.fillStyle = fill; g.fill(path);
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(path); }
  }
  function at(x, y, rot, fn) { g.save(); g.translate(x, y); g.rotate(rot); const prev = ROT; ROT += rot; fn(); ROT = prev; g.restore(); }
  function radial(x, y, r, c0, c1, hx = -0.35, hy = -0.4) {
    const gr = g.createRadialGradient(x + hx * r, y + hy * r, r * 0.05, x, y, r * 1.05);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr;
  }
  function linear(x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  function gloss(x, y, rx, ry, a = 0.35, rot = -0.6) { g.fillStyle = `rgba(255,255,255,${a})`; g.fill(ellP(x, y, rx, ry, rot)); }
  function strokeCurve(pts, color, lw, alpha = 1) {
    g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke(); g.restore();
  }

  /* ---------- regions ---------- */
  // circle: {x,y,r}; sector: {x,y,r0,r1,a0,a1}; band: {x,y,w,h,rot} (rectangle)
  function sample(reg) {
    if (reg.a0 !== undefined) {
      const a = R(reg.a0, reg.a1), rr = Math.sqrt(R(reg.r0 * reg.r0 / (reg.r1 * reg.r1), 1)) * reg.r1;
      return [reg.x + Math.cos(a) * rr, reg.y + Math.sin(a) * rr];
    }
    if (reg.w !== undefined) {
      const u = R(-reg.w / 2, reg.w / 2), v = R(-reg.h / 2, reg.h / 2), c = Math.cos(reg.rot || 0), s = Math.sin(reg.rot || 0);
      return [reg.x + u * c - v * s, reg.y + u * s + v * c];
    }
    const a = R(0, TAU), rr = Math.sqrt(rnd()) * reg.r;
    return [reg.x + Math.cos(a) * rr, reg.y + Math.sin(a) * rr];
  }
  function area(reg) {
    if (reg.a0 !== undefined) return (reg.a1 - reg.a0) / 2 * (reg.r1 * reg.r1 - reg.r0 * reg.r0);
    if (reg.w !== undefined) return reg.w * reg.h;
    return Math.PI * reg.r * reg.r;
  }
  /** Places n items of a type with a minimum gap; when the region is full it stops. */
  function scatter(type, reg, n, size, gap = 1.6, opts = {}) {
    const pts = [], min = size * gap;
    for (let tries = 0; pts.length < n && tries < n * 40; tries++) {
      const p = sample(reg);
      if (pts.every(q => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 > min * min)) pts.push(p);
    }
    pts.forEach(p => ITEM[type](p[0], p[1], size * R(0.85, 1.15), opts.rot !== undefined ? opts.rot + R(-0.3, 0.3) : R(0, TAU), opts));
    return pts;
  }
  /** Covers a region densely (items may overlap). */
  function cover(type, reg, size, density = 1, opts = {}) {
    const n = Math.round(area(reg) / (size * size * 2.2) * density);
    for (let i = 0; i < n; i++) { const p = sample(reg); ITEM[type](p[0], p[1], size * R(0.8, 1.2), R(0, TAU), opts); }
  }
  function dust(color, reg, n, size = 1.4, alpha = 0.85) {
    g.save(); g.globalAlpha = alpha; g.fillStyle = color;
    for (let i = 0; i < n; i++) { const p = sample(reg); g.fill(ellP(p[0], p[1], size * R(0.6, 1.3), size * R(0.5, 1), R(0, TAU))); }
    g.restore();
  }
  /** Thin wavy lines across a circular region, like honey or dressing. */
  function drizzle(color, reg, lw = 4, alpha = 0.9, lines = 2) {
    const r = reg.r || 100, dir = R(-0.9, -0.5);
    const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
    for (let k = 0; k < lines; k++) {
      const off = (k - (lines - 1) / 2) * r * 0.35, freq = R(5, 8), amp = r * R(0.1, 0.16), ph = R(0, TAU), pts = [];
      for (let i = 0; i <= 40; i++) { const t = -1 + i / 20, w = Math.sin(t * freq + ph) * amp; pts.push([reg.x + ux * t * r * 0.9 + nx * (off + w), reg.y + uy * t * r * 0.9 + ny * (off + w)]); }
      strokeCurve(pts.map(p => [p[0] + 1.5, p[1] + 2.5]), 'rgba(55,35,15,0.12)', lw, 1);
      strokeCurve(pts, color, lw * R(0.8, 1.1), alpha);
      strokeCurve(pts.map(p => [p[0] - lw * 0.15, p[1] - lw * 0.2]), 'rgba(255,255,255,0.35)', lw * 0.28, 1);
    }
  }
  /** A soft cream or oil swirl on top of a sauce. */
  function swirl(color, x, y, r, lw = 6, alpha = 0.8, turns = 1.2) {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * TAU * turns, rr = r * (0.25 + 0.75 * t) * R(0.92, 1.08); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85]); }
    strokeCurve(pts, color, lw, alpha * 0.55);
    strokeCurve(pts, color, lw * 0.45, alpha);
  }

  /* ---------- single ingredients ---------- */
  function leafShape(len, wid) {
    const p = new Path2D();
    p.moveTo(-len / 2, 0);
    p.bezierCurveTo(-len / 4, -wid, len / 4, -wid * 0.85, len / 2, 0);
    p.bezierCurveTo(len / 4, wid * 0.85, -len / 4, wid, -len / 2, 0);
    p.closePath();
    return p;
  }
  function leaf(x, y, len, wid, rot, col, o = {}) {
    at(x, y, rot, () => {
      const p = leafShape(len, wid);
      put(p, linear(-len / 2, -wid, len / 2, wid, [[0, light(col, 0.18)], [1, dark(col, 0.18)]]), { shadow: o.shadow === undefined ? 0.22 : o.shadow, sx: 2, sy: 3 });
      g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = Math.max(1, wid * 0.12); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-len / 2 + 2, 0); g.quadraticCurveTo(0, -wid * 0.12, len / 2 - 3, 0); g.stroke();
      if (o.veins !== false) {
        g.strokeStyle = rgba('#ffffff', 0.16); g.lineWidth = 1;
        for (let i = 1; i < 4; i++) { const t = -len / 2 + i * len / 4; g.beginPath(); g.moveTo(t, 0); g.lineTo(t + len * 0.12, -wid * 0.55); g.moveTo(t, 0); g.lineTo(t + len * 0.12, wid * 0.55); g.stroke(); }
      }
      if (o.shine) gloss(-len * 0.1, -wid * 0.3, len * 0.18, wid * 0.18, 0.18, 0);
    });
  }
  const ITEM = {
    spinach: (x, y, s, r) => leaf(x, y, s * 2.3, s * 0.95, r, pick(['#3E7B2C', '#4C8A33', '#36702A', '#5A9A3C']), { shine: true }),
    wilted: (x, y, s, r) => { const p = blobP(x, y, s, 0.35, 7, 1.3, 0.8, r); put(p, radial(x, y, s, '#4F7D33', '#2B4F1F'), { shadow: 0.18 }); g.strokeStyle = rgba('#ffffff', 0.15); g.lineWidth = 1; g.stroke(p); },
    lettuce: (x, y, s, r) => { const c = pick(['#8DBE4E', '#9FCB5C', '#79AE42', '#B5D77A', '#6FA63E']); leaf(x, y, s * 2.7, s * 1.15, r, c); },
    rocket: (x, y, s, r) => leaf(x, y, s * 2.6, s * 0.6, r, pick(['#4E8A2E', '#5C9A36', '#457F29'])),
    basil: (x, y, s, r) => leaf(x, y, s * 1.7, s * 0.95, r, pick(['#2F7D32', '#3B8E3A']), { shine: true }),
    herb: (x, y, s, r) => { const c = pick(['#3F8A35', '#4E9A3C', '#2F7A2E']); for (let i = 0; i < 3; i++) { const a = r + i * TAU / 3; put(blobP(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.42, 0.25, 6), c, { shadow: 0.15, sx: 1, sy: 1.5 }); } },
    chives: (x, y, s) => { g.strokeStyle = pick(['#4F8F2F', '#5FA03A', '#3E7F27']); g.lineWidth = s * 0.55; g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke(); },
    springOnion: (x, y, s) => { g.lineWidth = s * 0.45; g.strokeStyle = rgba('#3c2814', 0.15); g.beginPath(); g.arc(x + 1, y + 1.5, s, 0, TAU); g.stroke(); g.strokeStyle = pick(['#7DAF45', '#8CBF52', '#E3EFC7']); g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke(); },
    cherry: (x, y, s, r) => {
      put(circleP(x, y, s), radial(x, y, s, '#E8503C', '#A9261C'), { shadow: 0.22 });
      g.fillStyle = radial(x, y, s * 0.8, '#EF6A55', '#D63E2E'); g.fill(circleP(x, y, s * 0.8));
      for (let i = 0; i < 3; i++) {
        const a = r + i * TAU / 3, cx = x + Math.cos(a) * s * 0.38, cy = y + Math.sin(a) * s * 0.38;
        g.fillStyle = 'rgba(250,185,160,0.75)'; g.fill(ellP(cx, cy, s * 0.24, s * 0.17, a));
        g.fillStyle = '#F4D78A'; g.fill(circleP(cx, cy, s * 0.06)); g.fill(circleP(cx + s * 0.08, cy - s * 0.04, s * 0.05));
      }
      g.fillStyle = '#F39A85'; g.fill(circleP(x, y, s * 0.16));
      gloss(x - s * 0.45, y - s * 0.5, s * 0.25, s * 0.12, 0.35);
    },
    tomatoWedge: (x, y, s, r) => at(x, y, r, () => {
      const p = new Path2D(); p.moveTo(-s * 0.2, 0); p.arc(-s * 0.2, 0, s * 1.5, -0.45, 0.45); p.closePath();
      put(p, linear(0, -s, s, s, [[0, '#EA5A44'], [1, '#C33522']]), { shadow: 0.22 });
      g.strokeStyle = '#A9261C'; g.lineWidth = s * 0.22; g.beginPath(); g.arc(-s * 0.2, 0, s * 1.4, -0.43, 0.43); g.stroke();
      g.fillStyle = 'rgba(248,190,160,0.7)'; g.fill(ellP(s * 0.55, 0, s * 0.4, s * 0.18, 0));
      g.fillStyle = '#F2D27C'; for (let i = 0; i < 4; i++) g.fill(circleP(s * (0.3 + i * 0.16), R(-s * 0.08, s * 0.08), s * 0.05));
    }),
    cucumber: (x, y, s, r, o) => at(x, y, r, () => {
      const p = new Path2D(); if (o && o.half) { p.arc(0, 0, s, 0, Math.PI); p.closePath(); } else p.arc(0, 0, s, 0, TAU);
      put(p, '#2F6B2C', { shadow: 0.22 });
      const q = new Path2D(); if (o && o.half) { q.arc(0, 0, s * 0.86, 0, Math.PI); q.closePath(); } else q.arc(0, 0, s * 0.86, 0, TAU);
      g.fillStyle = radial(0, 0, s * 0.86, '#EEF5D2', '#BFD98A', 0, 0); g.fill(q);
      g.fillStyle = 'rgba(250,252,235,0.9)';
      const n = o && o.half ? 4 : 7;
      for (let i = 0; i < n; i++) { const a = (o && o.half ? (i + 0.5) / n * Math.PI : i / n * TAU); g.fill(ellP(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, s * 0.13, s * 0.07, a)); }
    }),
    avocado: (x, y, s, r) => at(x, y, r, () => {
      const len = s * 2.8, wid = s * 0.62;
      const p = new Path2D(); p.moveTo(-len / 2, 0); p.quadraticCurveTo(0, -wid * 2.1, len / 2, 0); p.quadraticCurveTo(0, -wid * 0.6, -len / 2, 0); p.closePath();
      put(p, linear(0, -wid, 0, 0, [[0, '#7FAF3E'], [0.35, '#BCD66A'], [1, '#E3EA9C']]), { shadow: 0.22, sx: 2, sy: 3 });
      g.strokeStyle = '#2F4A1A'; g.lineWidth = s * 0.16; g.beginPath(); g.moveTo(-len / 2, 0); g.quadraticCurveTo(0, -wid * 2.1, len / 2, 0); g.stroke();
    }),
    avocadoFan: (x, y, s, r) => { for (let i = 0; i < 5; i++) ITEM.avocado(x + Math.cos(r) * (i - 2) * s * 0.45, y + Math.sin(r) * (i - 2) * s * 0.45, s, r + Math.PI / 2 + (i - 2) * 0.06); },
    mash: (x, y, s) => { put(blobP(x, y, s, 0.12, 10), radial(x, y, s, '#C7DD7C', '#93B848'), { shadow: 0.15 }); for (let i = 0; i < s * 0.9; i++) { const p = sample({ x, y, r: s * 0.85 }); g.fillStyle = pick(['rgba(110,150,50,0.35)', 'rgba(220,235,150,0.5)']); g.fill(circleP(p[0], p[1], R(1.2, 3))); } },
    pepperStrip: (x, y, s, r) => { const c = pick(['#D23A27', '#D9452C', '#E7B023']); const pts = [[x - Math.cos(r) * s * 1.4, y - Math.sin(r) * s * 1.4], [x + Math.cos(r + 0.5) * s * 0.3, y + Math.sin(r + 0.5) * s * 0.3], [x + Math.cos(r) * s * 1.4, y + Math.sin(r) * s * 1.4]]; strokeCurve(pts.map(p => [p[0] + 2, p[1] + 3]), 'rgba(55,35,15,0.2)', s * 0.5); strokeCurve(pts, c, s * 0.5); strokeCurve(pts, 'rgba(255,255,255,0.3)', s * 0.14); },
    onionRing: (x, y, s, r) => { g.lineWidth = s * 0.22; g.strokeStyle = 'rgba(55,35,15,0.14)'; g.beginPath(); g.ellipse(x + 1.5, y + 2, s, s * 0.8, r, 0, rnd() < 0.4 ? Math.PI : TAU); g.stroke(); g.strokeStyle = '#9C4A8E'; g.beginPath(); g.ellipse(x, y, s, s * 0.8, r, 0, rnd() < 0.4 ? Math.PI : TAU); g.stroke(); g.lineWidth = s * 0.08; g.strokeStyle = '#EED6EA'; g.beginPath(); g.ellipse(x, y, s * 0.88, s * 0.7, r, 0, TAU); g.stroke(); },
    shred: (x, y, s, r, o) => { const c = pick(o && o.colors ? o.colors : ['#7E2C72', '#93408A', '#A8569E']); const pts = [[x - Math.cos(r) * s * 1.3, y - Math.sin(r) * s * 1.3], [x + Math.cos(r + 1.2) * s * 0.4, y + Math.sin(r + 1.2) * s * 0.4], [x + Math.cos(r) * s * 1.3, y + Math.sin(r) * s * 1.3]]; strokeCurve(pts.map(p => [p[0] + 1.5, p[1] + 2]), 'rgba(55,35,15,0.15)', s * 0.22); strokeCurve(pts, c, s * 0.22); },
    broccoli: (x, y, s, r) => {
      at(x, y, r, () => { put(rrectP(s * 0.55, 0, s * 1.0, s * 0.45, s * 0.2), '#B6CF7A', { shadow: 0.2 }); });
      for (let i = 0; i < 9; i++) { const a = R(0, TAU), d = Math.sqrt(rnd()) * s * 0.6; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d, pr = s * R(0.28, 0.38); put(circleP(px, py, pr), radial(px, py, pr, pick(['#6E9E42', '#5B8F3B']), pick(['#33592A', '#3D6B2A'])), { shadow: 0.18, sx: 1.5, sy: 2 }); }
      g.fillStyle = 'rgba(190,220,140,0.45)'; for (let i = 0; i < 10; i++) { const p = sample({ x, y, r: s * 0.7 }); g.fill(circleP(p[0], p[1], 1.4)); }
    },
    mushroom: (x, y, s, r, o) => at(x, y, r, () => {
      const cap = o && o.cooked ? ['#B48555', '#7E5530'] : ['#D9BC94', '#A9835A'];
      const p = new Path2D(); p.moveTo(-s, 0); p.ellipse(0, 0, s, s * 0.78, 0, Math.PI, TAU); p.lineTo(s * 0.32, 0); p.lineTo(s * 0.32, s * 0.8); p.quadraticCurveTo(0, s * 0.95, -s * 0.32, s * 0.8); p.lineTo(-s * 0.32, 0); p.closePath();
      put(p, linear(0, -s, 0, s, [[0, cap[0]], [0.55, light(cap[0], 0.25)], [1, light(cap[0], 0.45)]]), { shadow: 0.22 });
      g.strokeStyle = cap[1]; g.lineWidth = s * 0.12; g.beginPath(); g.ellipse(0, 0, s * 0.94, s * 0.72, 0, Math.PI + 0.1, TAU - 0.1); g.stroke();
      g.strokeStyle = rgba('#6a4a2a', 0.35); g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * s * 0.08, -s * 0.05); g.lineTo(i * s * 0.25, -s * 0.55); g.stroke(); }
    }),
    potato: (x, y, s, r) => at(x, y, r, () => {
      const p = new Path2D(); p.moveTo(-s * 1.35, s * 0.15); p.quadraticCurveTo(-s * 0.2, -s * 0.85, s * 1.35, -s * 0.15); p.quadraticCurveTo(s * 0.4, s * 0.85, -s * 1.35, s * 0.15); p.closePath();
      put(p, linear(0, -s * 0.8, 0, s * 0.8, [[0, '#F6D88E'], [0.55, '#E9B95C'], [1, '#B8772A']]), { shadow: 0.3, sx: 3, sy: 5 });
      g.strokeStyle = '#8E5520'; g.lineWidth = s * 0.2; g.beginPath(); g.moveTo(-s * 1.3, s * 0.18); g.quadraticCurveTo(s * 0.4, s * 0.82, s * 1.3, -s * 0.12); g.stroke();
      g.fillStyle = 'rgba(150,80,25,0.4)'; for (let i = 0; i < 7; i++) g.fill(circleP(R(-s, s), R(-s * 0.3, s * 0.3), R(1.2, 2.6)));
      gloss(-s * 0.3, -s * 0.25, s * 0.55, s * 0.1, 0.3, -0.25);
    }),
    sweetPotato: (x, y, s, r) => { at(x, y, r, () => { put(rrectP(0, 0, s * 1.15, s * 1.15, s * 0.3), linear(-s, -s, s, s, [[0, '#F6A853'], [1, '#D46E24']]), { shadow: 0.25, stroke: 'rgba(150,70,20,0.55)', lw: s * 0.12 }); gloss(-s * 0.2, -s * 0.25, s * 0.3, s * 0.1, 0.3, 0); }); },
    lemon: (x, y, s, r, o) => at(x, y, r, () => {
      const col = o && o.lime ? ['#7DB83A', '#B9DA74'] : ['#F2C61F', '#F8E479'];
      const p = new Path2D(); p.moveTo(0, 0); p.arc(0, 0, s * 1.4, -0.55, 0.55); p.closePath();
      put(p, col[1], { shadow: 0.22 });
      g.strokeStyle = col[0]; g.lineWidth = s * 0.24; g.beginPath(); g.arc(0, 0, s * 1.3, -0.52, 0.52); g.stroke();
      g.strokeStyle = 'rgba(255,250,225,0.95)'; g.lineWidth = s * 0.08; g.beginPath(); g.arc(0, 0, s * 1.15, -0.5, 0.5); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.6); g.lineWidth = 1.2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(s * 0.1, 0); g.lineTo(Math.cos(i * 0.3) * s * 1.05, Math.sin(i * 0.3) * s * 1.05); g.stroke(); }
    }),
    olive: (x, y, s, r) => { put(ellP(x, y, s, s * 0.75, r), radial(x, y, s, '#5A4252', '#1E141B'), { shadow: 0.25 }); gloss(x - s * 0.3, y - s * 0.3, s * 0.3, s * 0.14, 0.4, r - 0.4); },
    banana: (x, y, s) => { put(circleP(x, y, s), radial(x, y, s, '#FBF2CF', '#E8D594'), { shadow: 0.2, stroke: '#E0C987', lw: s * 0.08 }); g.fillStyle = 'rgba(170,140,85,0.75)'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.fill(circleP(x + Math.cos(a) * s * 0.28, y + Math.sin(a) * s * 0.28, s * 0.06)); } g.fillStyle = 'rgba(200,175,120,0.6)'; g.fill(circleP(x, y, s * 0.1)); },
    blueberry: (x, y, s) => { put(circleP(x, y, s), radial(x, y, s, '#5B6AAE', '#232B57'), { shadow: 0.25, sx: 2, sy: 3 }); g.fillStyle = 'rgba(200,210,240,0.22)'; g.fill(circleP(x - s * 0.15, y - s * 0.15, s * 0.75)); g.strokeStyle = '#1C2348'; g.lineWidth = 1.4; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.moveTo(x - s * 0.25, y - s * 0.25); g.lineTo(x - s * 0.25 + Math.cos(a) * s * 0.22, y - s * 0.25 + Math.sin(a) * s * 0.22); g.stroke(); } },
    raspberry: (x, y, s) => { put(circleP(x, y, s), '#B52440', { shadow: 0.22 }); for (let ring = 0; ring < 2; ring++) { const n = ring ? 5 : 10, rr = ring ? s * 0.35 : s * 0.72; for (let i = 0; i < n; i++) { const a = i / n * TAU + ring * 0.3, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; g.fillStyle = radial(px, py, s * 0.3, '#EC5C76', '#BE2843'); g.fill(circleP(px, py, s * 0.3)); } } g.fillStyle = '#7A1328'; g.fill(circleP(x, y, s * 0.16)); },
    mango: (x, y, s, r) => at(x, y, r, () => { put(rrectP(0, 0, s * 1.15, s * 1.15, s * 0.28), linear(-s, -s, s, s, [[0, '#FBC24A'], [1, '#EE951C']]), { shadow: 0.22 }); gloss(-s * 0.2, -s * 0.25, s * 0.32, s * 0.1, 0.4, 0); }),
    edamame: (x, y, s, r) => { put(ellP(x, y, s, s * 0.72, r), radial(x, y, s, '#A6D27A', '#5E9A3E'), { shadow: 0.22 }); gloss(x - s * 0.3, y - s * 0.25, s * 0.3, s * 0.12, 0.35, r - 0.5); },
    chickpea: (x, y, s, r) => { put(circleP(x, y, s), radial(x, y, s, '#F0D6A1', '#C49D5E'), { shadow: 0.25 }); g.strokeStyle = 'rgba(150,110,55,0.6)'; g.lineWidth = 1.3; g.beginPath(); g.arc(x, y, s * 0.55, r, r + 1.6); g.stroke(); gloss(x - s * 0.35, y - s * 0.35, s * 0.25, s * 0.12, 0.3); },
    bean: (x, y, s, r, o) => { const c = o && o.color === 'white' ? ['#F6EEDB', '#D6C7A6'] : o && o.color === 'kidney' ? ['#A33A3C', '#5A171B'] : ['#4A4244', '#151213']; put(ellP(x, y, s * 1.1, s * 0.68, r), radial(x, y, s, c[0], c[1]), { shadow: 0.25 }); gloss(x - s * 0.3, y - s * 0.22, s * 0.35, s * 0.1, o && o.color === 'white' ? 0.5 : 0.3, r); },
    tofu: (x, y, s, r) => at(x, y, r, () => { put(rrectP(0, 0, s * 1.2, s * 1.2, s * 0.22), linear(-s, -s, s, s, [[0, '#F8EED3'], [1, '#E1C98F']]), { shadow: 0.25, stroke: 'rgba(205,150,60,0.8)', lw: s * 0.16 }); }),
    crumble: (x, y, s, r, o) => { const c = pick(o && o.colors ? o.colors : ['#F7D774', '#F2C94C', '#FAE29B', '#EFC14A']); put(blobP(x, y, s, 0.3, 7, 1, 0.85, r), radial(x, y, s, light(c, 0.3), dark(c, 0.08)), { shadow: 0.16, sx: 1.5, sy: 2 }); },
    friedEgg: (x, y, s) => { put(blobP(x, y, s, 0.12, 10), radial(x, y, s, '#FFFFFF', '#EFE7D6'), { shadow: 0.22, stroke: 'rgba(225,190,130,0.8)', lw: 2 }); const yx = x + R(-s * 0.15, s * 0.15), yy = y + R(-s * 0.15, s * 0.15); put(circleP(yx, yy, s * 0.4), radial(yx, yy, s * 0.4, '#FFD45A', '#E58A0C'), { shadow: 0.2, sx: 1.5, sy: 2 }); gloss(yx - s * 0.13, yy - s * 0.15, s * 0.12, s * 0.07, 0.6); },
    eggHalf: (x, y, s, r) => { put(ellP(x, y, s, s * 0.74, r), radial(x, y, s, '#FFFFFF', '#E9E2D2'), { shadow: 0.22 }); g.fillStyle = radial(x, y, s * 0.45, '#F8D45A', '#E8A923'); g.fill(blobP(x, y, s * 0.44, 0.1, 8)); },
    feta: (x, y, s, r) => at(x, y, r, () => { put(rrectP(0, 0, s * 1.2, s * 1.1, s * 0.15), linear(-s, -s, s, s, [[0, '#FFFDF6'], [1, '#E7E0CF']]), { shadow: 0.22 }); g.fillStyle = 'rgba(200,190,165,0.4)'; for (let i = 0; i < 4; i++) g.fill(circleP(R(-s * 0.5, s * 0.5), R(-s * 0.45, s * 0.45), 1.2)); }),
    parmesan: (x, y, s, r) => { const p = blobP(x, y, s, 0.4, 5, 1.6, 0.6, r); put(p, rgba('#F2E2AE', 0.97), { shadow: 0.16, stroke: 'rgba(255,248,220,0.9)', lw: 1 }); },
    mozzarella: (x, y, s, r) => { put(blobP(x, y, s, 0.25, 9, 1, 1, r), radial(x, y, s, '#FFFDF5', '#EFE2C4'), { shadow: 0.18 }); g.fillStyle = 'rgba(205,140,60,0.45)'; for (let i = 0; i < 3; i++) g.fill(circleP(x + R(-s * 0.5, s * 0.5), y + R(-s * 0.5, s * 0.5), R(2, 4))); },
    crouton: (x, y, s, r) => at(x, y, r, () => { put(rrectP(0, 0, s * 1.2, s * 1.1, s * 0.25), linear(-s, -s, s, s, [[0, '#EDBB6A'], [1, '#B97A33']]), { shadow: 0.25 }); g.fillStyle = 'rgba(120,70,25,0.35)'; for (let i = 0; i < 5; i++) g.fill(circleP(R(-s * 0.5, s * 0.5), R(-s * 0.45, s * 0.45), 1.3)); }),
    chickenSlice: (x, y, s, r) => at(x, y, r, () => {
      const p = rrectP(0, 0, s * 0.95, s * 2.6, s * 0.42);
      put(p, linear(-s * 0.5, 0, s * 0.5, 0, [[0, '#A8641F'], [0.2, '#E9C487'], [0.5, '#F5E3C2'], [0.8, '#E3B873'], [1, '#9A5A1C']]), { shadow: 0.28, sx: 3, sy: 4 });
      g.strokeStyle = '#A8692C'; g.lineWidth = s * 0.14; g.stroke(p);
      g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = s * 0.12; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-s * 0.48, i * s * 0.7 - s * 0.15); g.lineTo(-s * 0.3, i * s * 0.7 + s * 0.15); g.stroke(); }
    }),
    roastChicken: (x, y, s, r) => { const p = blobP(x, y, s, 0.14, 10, 1.4, 0.95, r); put(p, radial(x, y, s * 1.3, '#E5A04E', '#7A3E14'), { shadow: 0.32, sx: 5, sy: 7, stroke: 'rgba(95,45,15,0.7)', lw: s * 0.07 }); g.fillStyle = 'rgba(255,215,150,0.35)'; for (let i = 0; i < 6; i++) { const q = sample({ x: x - s * 0.2, y: y - s * 0.2, r: s * 0.55 }); g.fill(blobP(q[0], q[1], R(4, 9), 0.4, 6)); } g.fillStyle = 'rgba(100,45,15,0.4)'; for (let i = 0; i < 12; i++) { const q = sample({ x, y, r: s * 0.85 }); g.fill(ellP(q[0], q[1], R(2, 6), R(1.5, 3.5), R(0, TAU))); } g.fillStyle = 'rgba(60,105,40,0.8)'; for (let i = 0; i < 10; i++) { const q = sample({ x, y, r: s * 0.8 }); g.fill(ellP(q[0], q[1], 3, 1.2, R(0, TAU))); } gloss(x - s * 0.35, y - s * 0.35, s * 0.5, s * 0.14, 0.3, r - 0.4); },
    salmon: (x, y, s, r) => at(x, y, r, () => { put(rrectP(0, 0, s * 1.25, s * 1.15, s * 0.22), linear(-s, -s, s, s, [[0, '#F99A6B'], [1, '#E0673C']]), { shadow: 0.24 }); g.strokeStyle = 'rgba(255,225,205,0.9)'; g.lineWidth = s * 0.1; g.beginPath(); g.moveTo(-s * 0.6, -s * 0.2); g.quadraticCurveTo(0, -s * 0.45, s * 0.6, -s * 0.15); g.moveTo(-s * 0.6, s * 0.25); g.quadraticCurveTo(0, 0, s * 0.6, s * 0.3); g.stroke(); gloss(-s * 0.25, -s * 0.3, s * 0.3, s * 0.08, 0.35, 0); }),
    tuna: (x, y, s, r) => { put(blobP(x, y, s, 0.35, 7, 1.3, 0.8, r), radial(x, y, s, '#DDBCA2', '#B08467'), { shadow: 0.2 }); g.strokeStyle = 'rgba(240,215,195,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.5, y - s * 0.2); g.stroke(); },
    steakSlice: (x, y, s, r) => at(x, y, r, () => {
      const p = rrectP(0, 0, s * 1.25, s * 3.6, s * 0.35);
      put(p, linear(-s * 0.62, 0, s * 0.62, 0, [[0, '#5E2C17'], [0.14, '#8E4A33'], [0.3, '#C9655B'], [0.5, '#DB7E72'], [0.7, '#C9655B'], [0.86, '#8E4A33'], [1, '#5E2C17']]), { shadow: 0.3, sx: 4, sy: 5 });
      g.strokeStyle = '#3E1D0E'; g.lineWidth = s * 0.14; g.stroke(p);
      gloss(-s * 0.15, -s * 0.9, s * 0.15, s * 0.7, 0.16, 0);
    }),
    steakEnd: (x, y, s, r) => at(x, y, r, () => {
      const p = rrectP(0, 0, s * 2.6, s * 3.6, s * 0.7);
      put(p, radial(0, 0, s * 2.2, '#8A4A26', '#4A2312'), { shadow: 0.32, sx: 5, sy: 7 });
      g.strokeStyle = 'rgba(30,14,6,0.7)'; g.lineWidth = s * 0.22; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-s * 1.1, i * s * 0.7 - s * 0.35); g.lineTo(s * 1.1, i * s * 0.7 + s * 0.35); g.stroke(); }
      gloss(-s * 0.5, -s * 0.9, s * 0.6, s * 0.18, 0.18, -0.4);
    }),
    mince: (x, y, s, r) => { put(blobP(x, y, s, 0.4, 6, 1, 1, r), pick(['#7A3F25', '#64321D', '#8B4A2C']), { shadow: 0.18, sx: 1, sy: 1.5 }); },
    granola: (x, y, s, r) => { put(blobP(x, y, s, 0.35, 7, 1.2, 0.9, r), radial(x, y, s, '#CF9A55', '#8A5A28'), { shadow: 0.22 }); g.fillStyle = 'rgba(240,215,165,0.9)'; for (let i = 0; i < 3; i++) g.fill(ellP(x + R(-s * 0.5, s * 0.5), y + R(-s * 0.4, s * 0.4), s * 0.28, s * 0.16, R(0, TAU))); },
    walnut: (x, y, s, r) => { put(blobP(x, y, s, 0.25, 8, 1.2, 0.9, r), radial(x, y, s, '#B07A45', '#6E4422'), { shadow: 0.24 }); g.strokeStyle = 'rgba(80,45,20,0.6)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + R(-s * 0.3, s * 0.3), y + R(-s * 0.3, s * 0.3), s * 0.35, R(0, TAU), R(0, TAU)); g.stroke(); } },
    coconut: (x, y, s, r) => { g.lineCap = 'round'; g.lineWidth = s * 0.35; g.strokeStyle = 'rgba(60,40,20,0.15)'; g.beginPath(); g.arc(x + 1.5, y + 2, s, r, r + 1.6); g.stroke(); g.strokeStyle = '#FCFBF6'; g.beginPath(); g.arc(x, y, s, r, r + 1.6); g.stroke(); },
    garlic: (x, y, s, r) => { put(blobP(x, y, s, 0.08, 8, 0.75, 1.1, r), radial(x, y, s, '#FFFBF0', '#E2D6BC'), { shadow: 0.22 }); g.strokeStyle = 'rgba(190,170,130,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x + s * 0.2, y, x, y + s); g.stroke(); },
    onionWedge: (x, y, s, r) => at(x, y, r, () => { for (let i = 0; i < 3; i++) { const rr = s * (1.4 - i * 0.35); const p = new Path2D(); p.moveTo(0, 0); p.arc(0, 0, rr, -0.6, 0.6); p.closePath(); put(p, i % 2 ? '#F3E3C2' : '#D9A86A', { shadow: i ? 0 : 0.25 }); } g.fillStyle = 'rgba(90,45,15,0.45)'; g.fill(circleP(s * 1.2, -s * 0.2, s * 0.18)); }),
    rice: (x, y, s, r) => { g.fillStyle = pick(['#FFFFFF', '#F6F1E6', '#EEE7D7']); g.fill(ellP(x, y, s, s * 0.42, r)); g.strokeStyle = 'rgba(120,100,70,0.12)'; g.lineWidth = 0.8; g.stroke(ellP(x, y, s, s * 0.42, r)); },
    quinoa: (x, y, s) => { const c = rnd() < 0.08 ? '#B86B4A' : pick(['#F1E2C0', '#E6D0A0', '#F7EBD2']); g.fillStyle = c; g.fill(circleP(x, y, s)); g.strokeStyle = 'rgba(160,130,80,0.35)'; g.lineWidth = 0.7; g.stroke(circleP(x, y, s * 0.75)); },
    oat: (x, y, s, r) => { g.fillStyle = pick(['#F1E3C2', '#E5D0A5', '#F7EDD6']); g.fill(ellP(x, y, s, s * 0.65, r)); g.strokeStyle = 'rgba(160,130,80,0.25)'; g.lineWidth = 0.8; g.stroke(ellP(x, y, s, s * 0.65, r)); },
    curd: (x, y, s, r) => { const c = pick(['#F7D774', '#F2C94C', '#FAE29B', '#F4CF5E']); put(blobP(x, y, s, 0.3, 7, 1.15, 0.85, r), radial(x, y, s, light(c, 0.35), dark(c, 0.06)), { shadow: 0.12, sx: 1.5, sy: 2 }); },
    nori: (x, y, s, r) => at(x, y, r, () => put(rrectP(0, 0, s * 3.2, s * 0.45, s * 0.1), '#1E2D24', { shadow: 0.2 })),
    chilliRing: (x, y, s) => { g.lineWidth = s * 0.3; g.strokeStyle = '#C8261C'; g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke(); g.fillStyle = '#F2D9A0'; g.fill(circleP(x + s * 0.2, y, s * 0.12)); g.fill(circleP(x - s * 0.2, y + s * 0.1, s * 0.12)); },
    honeyDrop: (x, y, s) => { g.fillStyle = 'rgba(224,160,30,0.75)'; g.fill(blobP(x, y, s, 0.2, 7)); },
  };

  /* ---------- composite pieces ---------- */
  function pancakeStack(x, y, r) {
    for (let i = 2; i >= 0; i--) {
      const ox = x + i * 7, oy = y + i * 9;
      put(blobP(ox, oy, r, 0.03, 12), radial(ox, oy, r, '#EDB56A', '#A9662A', -0.1, -0.1), { shadow: i === 2 ? 0.3 : 0.15, sx: 4, sy: 6 });
    }
    g.fillStyle = radial(x, y, r * 0.85, '#F3C57E', '#D99446', 0, 0); g.fill(circleP(x, y, r * 0.86));
    g.fillStyle = 'rgba(255,230,180,0.45)'; for (let i = 0; i < 18; i++) { const p = sample({ x, y, r: r * 0.75 }); g.fill(circleP(p[0], p[1], R(2, 5))); }
  }
  function toast(x, y, w, h, rot) {
    at(x, y, rot, () => {
      const p = new Path2D(); p.moveTo(-w / 2, h / 2 - 10); p.lineTo(-w / 2, -h / 4); p.bezierCurveTo(-w / 2 - 14, -h / 2 - 4, -w / 6, -h / 2 - 18, 0, -h / 2 - 8); p.bezierCurveTo(w / 6, -h / 2 - 18, w / 2 + 14, -h / 2 - 4, w / 2, -h / 4); p.lineTo(w / 2, h / 2 - 10); p.quadraticCurveTo(w / 2, h / 2, w / 2 - 10, h / 2); p.lineTo(-w / 2 + 10, h / 2); p.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 10); p.closePath();
      put(p, radial(0, 0, w * 0.6, '#E9CB8E', '#D3A866', -0.2, -0.2), { shadow: 0.3, sx: 5, sy: 7, stroke: '#9E6630', lw: 9 });
      g.fillStyle = 'rgba(170,120,60,0.35)'; for (let i = 0; i < 30; i++) g.fill(ellP(R(-w * 0.4, w * 0.4), R(-h * 0.35, h * 0.4), R(1, 3), R(1, 2), R(0, TAU)));
    });
  }
  function wrapHalf(x, y, len, wid, rot) {
    at(x, y, rot, () => {
      put(rrectP(0, 0, len, wid, wid / 2), linear(0, -wid / 2, 0, wid / 2, [[0, '#F3DEAE'], [0.6, '#E7C88C'], [1, '#D4AD6C']]), { shadow: 0.3, sx: 5, sy: 7 });
      g.fillStyle = 'rgba(180,120,50,0.35)'; for (let i = 0; i < 14; i++) g.fill(ellP(R(-len * 0.4, len * 0.3), R(-wid * 0.35, wid * 0.35), R(2, 5), R(1.5, 3), R(0, TAU)));
      const ex = len / 2 - wid * 0.18;
      const rings = ['#EED6A2', '#E3CB9C', '#4F8E36', '#EE8A2B', '#D63A2C', '#E3CB9C', '#5E9A3C'];
      rings.forEach((c, i) => { g.fillStyle = c; g.fill(ellP(ex, 0, wid * 0.32 * (1 - i * 0.12), wid * 0.48 * (1 - i * 0.12), 0)); });
    });
  }
  function taco(x, y, len, wid, rot, fill) {
    at(x, y, rot, () => {
      put(rrectP(0, 0, len, wid, wid / 2), linear(0, -wid / 2, 0, wid / 2, [[0, '#F0D59C'], [1, '#D9B470']]), { shadow: 0.3, sx: 5, sy: 7 });
      g.fillStyle = 'rgba(170,110,45,0.35)'; for (let i = 0; i < 12; i++) g.fill(ellP(R(-len * 0.45, len * 0.45), R(-wid * 0.45, wid * 0.45), R(2, 4), R(1.5, 3), R(0, TAU)));
      fill({ x: 0, y: 0, w: len * 0.8, h: wid * 0.55, rot: 0 });
    });
  }
  function pizza(x, y, r) {
    put(blobP(x, y, r, 0.02, 14), radial(x, y, r, '#E8B86E', '#B47836', 0, 0), { shadow: 0.3, sx: 6, sy: 8 });
    g.fillStyle = 'rgba(110,60,25,0.35)'; for (let i = 0; i < 26; i++) { const a = R(0, TAU), d = r * R(0.88, 0.97); g.fill(ellP(x + Math.cos(a) * d, y + Math.sin(a) * d, R(2, 6), R(1.5, 3), a)); }
    g.fillStyle = radial(x, y, r * 0.86, '#D2492F', '#A72F1D', 0, 0); g.fill(blobP(x, y, r * 0.85, 0.03, 14));
  }

  /* ---------- vessels ---------- */
  const CX = 360, CY = 352;
  function vesselShadow(path, blur = 50, ox = 22, oy = 30, a = 0.32) {
    g.save(); g.shadowColor = `rgba(70,48,25,${a})`; g.shadowBlur = blur; g.shadowOffsetX = ox; g.shadowOffsetY = oy;
    g.fillStyle = '#F7F4EE'; g.fill(path); g.restore();
  }
  function bowl(tone = 'white') {
    const Rb = 296, cols = tone === 'stone' ? ['#F1EBE1', '#D5CBBB', '#E8E0D3', '#CFC4B2'] : ['#FFFFFF', '#E6E0D5', '#F5F1E9', '#DCD4C6'];
    const outer = circleP(CX, CY, Rb);
    vesselShadow(outer);
    g.fillStyle = radial(CX, CY, Rb, cols[0], cols[1]); g.fill(outer);
    if (tone === 'stone') { g.fillStyle = 'rgba(90,70,50,0.35)'; for (let i = 0; i < 120; i++) { const p = sample({ x: CX, y: CY, r: Rb - 4 }); g.fill(circleP(p[0], p[1], R(0.6, 1.6))); } }
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.stroke(circleP(CX, CY, Rb - 6));
    const r = Rb * 0.86;
    g.fillStyle = radial(CX + 24, CY + 24, r, cols[2], cols[3], 0, 0); g.fill(circleP(CX, CY, r));
    return { x: CX, y: CY, r: Rb * 0.82, clip: Rb * 0.845, kind: 'bowl' };
  }
  function plate() {
    const Rp = 318, outer = circleP(CX, CY, Rp);
    vesselShadow(outer, 46, 18, 26, 0.28);
    g.fillStyle = radial(CX, CY, Rp, '#FFFFFF', '#E8E2D7'); g.fill(outer);
    g.strokeStyle = 'rgba(205,195,178,0.6)'; g.lineWidth = 2.5; g.stroke(circleP(CX, CY, Rp * 0.74));
    g.fillStyle = radial(CX, CY, Rp * 0.74, '#FBF9F4', '#F1ECE3', 0.1, 0.1); g.fill(circleP(CX, CY, Rp * 0.735));
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke(circleP(CX, CY, Rp - 5));
    return { x: CX, y: CY, r: Rp * 0.7, kind: 'plate' };
  }
  function skillet() {
    const x = 335, y = 330, Rk = 262;
    at(x, y, 0.78, () => { const h = rrectP(Rk + 70, 0, 180, 48, 22); vesselShadow(h, 30, 14, 20, 0.3); g.fillStyle = linear(0, -24, 0, 24, [[0, '#4A4846'], [1, '#1B1A19']]); g.fill(h); g.fillStyle = '#F0E9DD'; g.fill(circleP(Rk + 130, 0, 9)); });
    const outer = circleP(x, y, Rk);
    vesselShadow(outer, 46, 20, 28, 0.35);
    g.fillStyle = radial(x, y, Rk, '#55524F', '#1C1B1A'); g.fill(outer);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.stroke(circleP(x, y, Rk - 4));
    g.fillStyle = '#242322'; g.fill(circleP(x, y, Rk * 0.9));
    return { x, y, r: Rk * 0.87, clip: Rk * 0.895, kind: 'skillet' };
  }
  function board(w = 600, h = 470, rot = -0.05) {
    at(CX, CY, rot, () => {
      const p = rrectP(0, 0, w, h, 34);
      vesselShadow(p, 44, 18, 26, 0.3);
      g.fillStyle = linear(-w / 2, -h / 2, w / 2, h / 2, [[0, '#E2B985'], [1, '#C08F57']]); g.fill(p);
      g.save(); g.clip(p);
      for (let i = 0; i < 22; i++) { const yy = -h / 2 + i * h / 21 + R(-6, 6); strokeCurve([[-w / 2, yy], [-w / 6, yy + R(-8, 8)], [w / 6, yy + R(-8, 8)], [w / 2, yy + R(-6, 6)]], 'rgba(150,100,50,0.22)', R(1, 2.2)); }
      g.restore();
      g.strokeStyle = 'rgba(255,235,200,0.6)'; g.lineWidth = 3; g.stroke(rrectP(0, 0, w - 6, h - 6, 31));
    });
    return { x: CX, y: CY, w, h, rot, r: Math.min(w, h) / 2, kind: 'board' };
  }
  function tray() {
    const w = 640, h = 500;
    const outer = rrectP(CX, CY, w, h, 44);
    vesselShadow(outer, 44, 18, 26, 0.32);
    g.fillStyle = linear(0, CY - h / 2, 0, CY + h / 2, [[0, '#5C6066'], [1, '#33363A']]); g.fill(outer);
    g.fillStyle = '#2C2F33'; g.fill(rrectP(CX, CY, w - 30, h - 30, 32));
    const inner = rrectP(CX, CY, w - 56, h - 56, 22);
    g.fillStyle = linear(0, CY - h / 2, 0, CY + h / 2, [[0, '#F3ECDD'], [1, '#E3D8C2']]); g.fill(inner);
    g.save(); g.clip(inner); for (let i = 0; i < 14; i++) strokeCurve([[R(CX - 300, CX + 300), R(CY - 230, CY + 230)], [R(CX - 300, CX + 300), R(CY - 230, CY + 230)]], 'rgba(160,130,90,0.18)', 1.2); g.restore();
    return { x: CX, y: CY, w: w - 90, h: h - 90, r: 220, kind: 'tray' };
  }
  /* ---------- seamless textures for grains (fast to fill large areas) ---------- */
  const TEXSPEC = {
    rice:    { bg: '#F2ECDF', item: 'rice', size: 5.2, n: 760 },
    quinoa:  { bg: '#E1CB9B', item: 'quinoa', size: 3.8, n: 1250 },
    oats:    { bg: '#E7D4AC', item: 'oat', size: 7, n: 430 },
    risotto: { bg: '#E9D9B2', item: 'rice', size: 5.6, n: 520, wash: 'rgba(240,226,190,0.45)' },
    mince:   { bg: '#7A321D', item: 'mince', size: 7, n: 260 },
  };
  const TEX = {};
  function tex(kind) {
    if (TEX[kind]) return TEX[kind];
    const t = document.createElement('canvas'); t.width = t.height = 200;
    const keep = [g, rnd, ROT]; g = t.getContext('2d'); rnd = seeded('tex-' + kind); ROT = 0;
    const sp = TEXSPEC[kind];
    g.fillStyle = sp.bg; g.fillRect(0, 0, 200, 200);
    for (let i = 0; i < sp.n; i++) {
      const x = R(0, 200), y = R(0, 200), s = sp.size * R(0.8, 1.2), r = R(0, TAU), m = s * 2;
      [-200, 0, 200].forEach(dx => [-200, 0, 200].forEach(dy => {
        const px = x + dx, py = y + dy;
        if (px > -m && px < 200 + m && py > -m && py < 200 + m) ITEM[sp.item](px, py, s, r, {});
      }));
    }
    if (sp.wash) { g.fillStyle = sp.wash; g.fillRect(0, 0, 200, 200); }
    TEX[kind] = t; [g, rnd, ROT] = keep;
    return t;
  }
  function texFill(kind, reg) { g.save(); g.fillStyle = g.createPattern(tex(kind), 'repeat'); g.fill(circleP(reg.x, reg.y, reg.r)); g.restore(); }
  function base(v, c0, c1) {
    g.fillStyle = radial(v.x, v.y, v.clip || v.r, c0, c1, -0.1, -0.1);
    g.fill(circleP(v.x, v.y, (v.clip || v.r) + 2));
  }
  function inBowl(v, fn) { g.save(); g.clip(circleP(v.x, v.y, v.clip || v.r)); fn(); const sh = g.createRadialGradient(v.x + v.r * 0.12, v.y + v.r * 0.14, v.r * 0.55, v.x, v.y, (v.clip || v.r) * 1.02); sh.addColorStop(0, 'rgba(60,40,20,0)'); sh.addColorStop(1, 'rgba(60,40,20,0.28)'); g.fillStyle = sh; g.fillRect(0, 0, S, S); g.restore(); }
  const C = (v, k = 1, dx = 0, dy = 0) => ({ x: v.x + dx * v.r, y: v.y + dy * v.r, r: v.r * k });
  const SEC = (v, i, n, r0 = 0.32, r1 = 1.05, start = -Math.PI / 2) => { const a0 = start + i * TAU / n, a1 = a0 + TAU / n; return { x: v.x, y: v.y, r0: v.r * r0, r1: v.r * r1, a0: a0 + 0.06, a1: a1 - 0.06 }; };
  const MID = (v, i, n, rr = 0.66, start = -Math.PI / 2) => { const a = start + (i + 0.5) * TAU / n; return [v.x + Math.cos(a) * v.r * rr, v.y + Math.sin(a) * v.r * rr, a]; };

  /* ---------- scenes ---------- */
  const ART = {
    'scrambled-eggs': () => { const v = plate(); cover('curd', C(v, 0.74, -0.03, 0.02), 30, 1.5); scatter('curd', C(v, 0.6, -0.03), 20, 34, 1.1); scatter('chives', C(v, 0.72), 80, 3.6, 2.2); dust('#2A2420', C(v, 0.65), 55, 1.5); },
    'yogurt-bowl': () => { const v = bowl(); inBowl(v, () => { base(v, '#FFFEFA', '#ECE6D9'); swirl('rgba(222,212,192,0.9)', v.x - v.r * 0.3, v.y + v.r * 0.15, v.r * 0.45, 9, 0.6); const reg = { x: v.x, y: v.y, r0: v.r * 0.05, r1: v.r * 1.0, a0: -1.3, a1: 1.3 }; scatter('raspberry', reg, 11, 24, 1.8); scatter('blueberry', reg, 30, 17, 1.6); drizzle('#E0A01C', C(v, 0.55, -0.45, -0.1), 5, 0.9, 2); ITEM.basil(v.x - v.r * 0.02, v.y - v.r * 0.62, 20, -0.7); ITEM.basil(v.x + v.r * 0.14, v.y - v.r * 0.68, 17, 0.3); }); },
    'avocado-toast': () => { const v = board(); toast(v.x - 135, v.y + 5, 245, 290, -0.12); toast(v.x + 128, v.y - 10, 245, 290, 0.1); [[v.x - 136, v.y + 16, -0.12], [v.x + 128, v.y + 2, 0.1]].forEach(([x, y]) => { ITEM.mash(x, y, 108); scatter('herb', { x, y, r: 70 }, 6, 6, 2.5); dust('#C8321F', { x, y, r: 90 }, 55, 2); dust('#FFFFFF', { x, y, r: 90 }, 22, 1.8); }); ITEM.lemon(v.x + 220, v.y + 170, 40, 2.6); },
    'oat-porridge': () => { const v = bowl('stone'); inBowl(v, () => { texFill('oats', C(v, 1.08)); swirl('rgba(255,250,235,0.7)', v.x + v.r * 0.3, v.y + v.r * 0.3, v.r * 0.35, 8, 0.6); for (let i = 0; i < 6; i++) ITEM.banana(v.x - v.r * 0.62 + i * v.r * 0.24, v.y - v.r * 0.3 + i * v.r * 0.09 + Math.sin(i) * 6, 34); scatter('blueberry', C(v, 0.32, 0.35, 0.35), 7, 16, 1.7); scatter('walnut', C(v, 0.3, -0.35, 0.4), 3, 18, 2); dust('#8B5A2B', C(v, 0.8, 0.1, 0.2), 90, 2, 0.6); drizzle('#E0A01C', C(v, 0.6, 0.05, 0.15), 4, 0.85, 2); }); },
    'smoothie-bowl': () => { const v = bowl(); inBowl(v, () => { base(v, '#A1457C', '#6B2350'); swirl('rgba(205,120,170,0.35)', v.x, v.y, v.r * 0.75, 14, 0.5); const band = dx => ({ x: v.x + dx * v.r, y: v.y, w: v.r * 0.34, h: v.r * 2.1, rot: 0.3 }); for (let i = 0; i < 5; i++) ITEM.banana(v.x - v.r * 0.55 + Math.sin(0.3) * (i - 2) * -v.r * 0.35, v.y + Math.cos(0.3) * (i - 2) * v.r * 0.35, 34); scatter('blueberry', band(-0.05), 12, 18, 1.6); scatter('raspberry', band(-0.05), 5, 23, 2); cover('granola', band(0.48), 20, 1.4); scatter('coconut', C(v, 0.95), 16, 13, 1.6); dust('#1E1A18', C(v, 0.95), 70, 1.8); }); },
    'shakshuka': () => { const v = skillet(); inBowl(v, () => { base(v, '#C9452C', '#8E2817'); dust('#7A2214', C(v, 1), 110, 3, 0.5); for (let i = 0; i < 9; i++) { const p = sample(C(v, 0.9)); gloss(p[0], p[1], R(10, 20), R(3, 6), 0.12, R(0, TAU)); } scatter('pepperStrip', C(v, 0.95), 11, 26, 2); ITEM.friedEgg(v.x - v.r * 0.3, v.y - v.r * 0.2, 84); ITEM.friedEgg(v.x + v.r * 0.3, v.y + v.r * 0.27, 80); scatter('feta', C(v, 0.9), 7, 11, 2.5); scatter('herb', C(v, 0.95), 32, 8, 2); dust('#9E2A16', C(v, 0.9), 50, 1.8); }); },
    'banana-pancakes': () => { const v = plate(); pancakeStack(v.x - 8, v.y - 10, v.r * 0.86); for (let i = 0; i < 4; i++) ITEM.banana(v.x - 75 + i * 42, v.y - 55 + i * 8, 30); scatter('blueberry', C(v, 0.34, 0.05, 0.3), 10, 15, 1.7); scatter('raspberry', C(v, 0.3, 0.3, 0.05), 4, 20, 2.1); drizzle('#D98E12', C(v, 0.6, 0, 0.05), 5, 0.8, 2); dust('#8B5A2B', C(v, 0.6), 35, 1.8, 0.6); },
    'tofu-scramble': () => { const v = plate(); cover('crumble', C(v, 0.58, -0.22, 0.02), 21, 1.8, { colors: ['#F3D66F', '#EBC659', '#F7E39A', '#E8C24E'] }); cover('wilted', C(v, 0.38, 0.45, -0.25), 30, 1.6); scatter('cherry', C(v, 0.4, 0.42, 0.38), 5, 28, 1.8); scatter('springOnion', C(v, 0.8), 24, 7, 2); dust('#2A2420', C(v, 0.6, -0.2), 40, 1.5); },
    'pasta-pomodoro': () => { const v = bowl(); inBowl(v, () => { base(v, '#EBCB8A', '#C9A15C'); for (let i = 0; i < 80; i++) { const a0 = R(0, TAU), rr = R(0.12, 1.02) * v.r, pts = []; for (let k = 0; k < 6; k++) { const a = a0 + k * 0.35, q = rr + R(-14, 14); pts.push([v.x + Math.cos(a) * q, v.y + Math.sin(a) * q]); } strokeCurve(pts.map(p => [p[0] + 1.5, p[1] + 2]), 'rgba(120,80,30,0.25)', 8); strokeCurve(pts, pick(['#F3D79A', '#EBCB83', '#F6DFA8']), 7); } put(blobP(v.x + 8, v.y + 4, v.r * 0.5, 0.18, 10), radial(v.x, v.y, v.r * 0.5, '#D6482E', '#A42E1B'), { shadow: 0.25, sx: 4, sy: 6 }); for (let i = 0; i < 7; i++) { const p = sample(C(v, 0.4, 0.03, 0.02)); gloss(p[0], p[1], R(6, 13), R(2, 4), 0.2, R(0, TAU)); } ITEM.basil(v.x - 25, v.y - 35, 34, -0.5); ITEM.basil(v.x + 38, v.y - 14, 30, 0.6); ITEM.basil(v.x + 5, v.y + 38, 27, 2.2); scatter('parmesan', C(v, 0.55), 10, 13, 2); }); },
    'chickpea-curry': () => { const v = bowl('stone'); inBowl(v, () => { base(v, '#E0923A', '#B4601F'); swirl('rgba(250,238,215,0.85)', v.x - v.r * 0.15, v.y + v.r * 0.15, v.r * 0.45, 10, 0.75); for (let i = 0; i < 7; i++) { const p = sample(C(v, 0.9)); gloss(p[0], p[1], R(8, 18), R(3, 5), 0.15, R(0, TAU)); } scatter('chickpea', C(v, 1.0), 34, 22, 1.65); scatter('wilted', C(v, 0.85), 7, 28, 2.4); scatter('herb', C(v, 0.7), 28, 8, 1.9); dust('#9E2A16', C(v, 0.8), 40, 1.8); }); },
    'greek-salad': () => { const v = bowl(); inBowl(v, () => { base(v, '#E3D3AE', '#B79E72'); scatter('tomatoWedge', C(v, 1.05), 18, 36, 1.35); scatter('cucumber', C(v, 1.05), 18, 34, 1.35, { half: true }); scatter('onionRing', C(v, 0.95), 10, 22, 1.8); scatter('olive', C(v, 0.95), 13, 18, 2); at(v.x + 5, v.y, -0.25, () => { put(rrectP(0, 0, 210, 145, 12), linear(-100, -70, 100, 70, [[0, '#FFFDF6'], [1, '#E5DDCB']]), { shadow: 0.32, sx: 6, sy: 8 }); g.fillStyle = 'rgba(200,190,165,0.45)'; for (let i = 0; i < 26; i++) g.fill(circleP(R(-95, 95), R(-65, 65), R(1, 2.6))); }); dust('#5E7A2E', C(v, 0.28), 80, 2, 0.9); drizzle('rgba(215,180,60,0.55)', C(v, 0.6), 4, 0.6, 2); }); },
    'quinoa-bowl': () => { const v = bowl(); inBowl(v, () => { texFill('quinoa', C(v, 1.08)); const sec = i => SEC(v, i, 5, 0.3, 1.05); scatter('chickpea', sec(0), 34, 21, 1.45); { const [x, y, a] = MID(v, 1, 5, 0.62); ITEM.avocadoFan(x, y, 40, a); } scatter('cucumber', sec(2), 10, 30, 1.35); scatter('cherry', sec(3), 9, 27, 1.5); cover('shred', sec(4), 20, 2.2); drizzle('rgba(240,225,190,0.95)', C(v, 0.6), 5, 0.95, 2); dust('#F6EBD0', C(v, 0.9), 50, 2); scatter('herb', C(v, 0.28), 8, 8, 1.8); }); },
    'tuna-bean-salad': () => { const v = bowl(); inBowl(v, () => { base(v, '#5C8A35', '#36581F'); cover('rocket', C(v, 1.08), 20, 2.2); scatter('bean', C(v, 0.95), 26, 19, 1.6, { color: 'white' }); cover('tuna', C(v, 0.4, 0.05, -0.05), 24, 1.8); scatter('cherry', C(v, 0.9), 8, 26, 2); scatter('onionRing', C(v, 0.85), 8, 18, 2.1); ITEM.lemon(v.x + v.r * 0.62, v.y + v.r * 0.45, 40, 2.4); dust('#2A2420', C(v, 0.7), 50, 1.5); }); },
    'lentil-soup': () => { const v = bowl('stone'); inBowl(v, () => { base(v, '#E8963F', '#BC6421'); for (let i = 0; i < 12; i++) { const p = sample(C(v, 0.9)); gloss(p[0], p[1], R(10, 22), R(3, 6), 0.12, R(0, TAU)); } swirl('rgba(245,205,95,0.8)', v.x - 10, v.y, v.r * 0.4, 8, 0.85); scatter('herb', C(v, 0.42, 0.02, -0.05), 22, 9, 1.8); dust('#8E2A14', C(v, 0.55), 55, 2); ITEM.lemon(v.x + v.r * 0.55, v.y + v.r * 0.5, 44, 2.5); }); },
    'hummus-wrap': () => { const v = board(); wrapHalf(v.x - 70, v.y - 50, 320, 140, -0.35); wrapHalf(v.x + 80, v.y + 70, 320, 140, 2.85); const hb = { x: v.x + 205, y: v.y - 140 }; vesselShadow(circleP(hb.x, hb.y, 66), 18, 6, 9, 0.3); g.fillStyle = radial(hb.x, hb.y, 66, '#FFFFFF', '#E3DCD0'); g.fill(circleP(hb.x, hb.y, 66)); g.fillStyle = radial(hb.x, hb.y, 54, '#EAD3A6', '#CDAE76', 0, 0); g.fill(circleP(hb.x, hb.y, 54)); swirl('rgba(255,245,220,0.8)', hb.x, hb.y, 34, 6, 0.8); dust('#B5402A', { x: hb.x, y: hb.y, r: 32 }, 30, 1.7); scatter('shred', { x: v.x - 200, y: v.y + 150, r: 55 }, 10, 15, 0.8, { colors: ['#EE8A2B', '#F39C3A'] }); ITEM.spinach(v.x + 225, v.y + 150, 22, 0.5); ITEM.spinach(v.x + 250, v.y + 120, 18, 1.4); },
    'chicken-caesar': () => { const v = bowl(); inBowl(v, () => { base(v, '#8DBE4E', '#5E8A2F'); cover('lettuce', C(v, 1.08), 24, 2.2); scatter('crouton', C(v, 0.95), 12, 24, 1.9); for (let i = 0; i < 6; i++) ITEM.chickenSlice(v.x - 115 + i * 44, v.y - 45 + i * 16, 48, 0.25); scatter('parmesan', C(v, 0.95), 14, 19, 1.5); drizzle('rgba(250,246,234,0.95)', C(v, 0.6), 4.5, 0.9, 2); ITEM.lemon(v.x + v.r * 0.6, v.y + v.r * 0.5, 38, 2.6); dust('#2A2420', C(v, 0.8), 50, 1.5); }); },
    'chicken-traybake': () => { const v = tray(); const reg = { x: v.x, y: v.y, w: v.w, h: v.h, rot: 0 }; scatter('potato', reg, 14, 50, 1.25); [[-165, -85], [60, -100], [-50, 100], [170, 75]].forEach(([dx, dy], i) => ITEM.roastChicken(v.x + dx, v.y + dy, 66, i * 0.8 + 0.3)); scatter('onionWedge', reg, 5, 30, 2.2); scatter('garlic', reg, 6, 15, 2.5); scatter('herb', reg, 40, 8, 2); dust('#A63A1C', reg, 70, 2, 0.6); },
    'salmon-poke': () => { const v = bowl(); inBowl(v, () => { texFill('rice', C(v, 1.08)); const sec = i => SEC(v, i, 5, 0.32, 1.05); scatter('salmon', sec(0), 12, 29, 1.4); { const [x, y, a] = MID(v, 1, 5, 0.62); ITEM.avocadoFan(x, y, 40, a); } scatter('cucumber', sec(2), 10, 29, 1.35); scatter('edamame', sec(3), 24, 18, 1.4); scatter('mango', sec(4), 10, 27, 1.4); scatter('nori', C(v, 0.22), 3, 16, 1.4); scatter('springOnion', C(v, 0.3), 12, 7, 1.8); dust('#F3E6C4', C(v, 0.95), 50, 2.2); dust('#2A2622', C(v, 0.95), 26, 2); }); },
    'tofu-stir-fry': () => { const v = bowl('stone'); inBowl(v, () => { texFill('rice', C(v, 1.08)); const reg = { x: v.x + v.r * 0.28, y: v.y + v.r * 0.05, r: v.r * 0.82 }; put(blobP(reg.x, reg.y, reg.r * 0.95, 0.1, 12), radial(reg.x, reg.y, reg.r, '#9A5A2A', '#6B3A18'), { shadow: 0.2 }); scatter('broccoli', reg, 7, 38, 1.6); scatter('tofu', reg, 11, 25, 1.5); scatter('pepperStrip', reg, 9, 22, 1.4); for (let i = 0; i < 8; i++) { const p = sample(reg); gloss(p[0], p[1], R(6, 12), R(2, 4), 0.25, R(0, TAU)); } dust('#F3E6C4', C(v, 0.9), 60, 2.2); scatter('springOnion', C(v, 0.75, 0.2), 14, 7, 1.8); }); },
    'chilli-con-carne': () => { const v = bowl('stone'); inBowl(v, () => { texFill('mince', C(v, 1.08)); scatter('bean', C(v, 1.0), 24, 18, 1.7, { color: 'kidney' }); scatter('pepperStrip', C(v, 0.9), 5, 18, 2.5); const dx = v.x + v.r * 0.16, dy = v.y + v.r * 0.1; put(blobP(dx, dy, 70, 0.15, 9), radial(dx, dy, 70, '#FFFFFF', '#EDE6D8'), { shadow: 0.28, sx: 4, sy: 6 }); swirl('rgba(220,210,195,0.8)', dx, dy, 44, 4, 0.8); scatter('herb', C(v, 0.7), 22, 9, 1.9); scatter('chilliRing', C(v, 0.75), 7, 9, 2.6); }); },
    'mushroom-risotto': () => { const v = bowl(); inBowl(v, () => { texFill('risotto', C(v, 1.08)); for (let i = 0; i < 10; i++) { const p = sample(C(v, 0.9)); gloss(p[0], p[1], R(10, 22), R(3, 6), 0.2, R(0, TAU)); } scatter('mushroom', C(v, 0.95), 13, 36, 1.45, { cooked: true }); scatter('parmesan', C(v, 0.9), 11, 15, 1.8); scatter('herb', C(v, 0.85), 30, 8, 1.8); dust('#2A2420', C(v, 0.75), 55, 1.5); }); },
    'sweet-potato-tacos': () => { const v = plate(); const fill = reg => { scatter('shred', reg, 14, 18, 0.8); scatter('bean', reg, 12, 12, 1.5); scatter('sweetPotato', reg, 9, 20, 1.5); scatter('avocado', reg, 3, 18, 2.6); scatter('herb', reg, 9, 7, 1.8); dust('#FFFFFF', reg, 20, 2); }; taco(v.x - 8, v.y - 82, 420, 175, -0.12, fill); taco(v.x + 10, v.y + 92, 420, 175, 0.08, fill); ITEM.lemon(v.x + v.r * 0.82, v.y - v.r * 0.62, 36, 2.4, { lime: true }); },
    'steak-mushrooms': () => { const v = plate(); ITEM.steakEnd(v.x - 120, v.y - 70, 40, 0.35); for (let i = 0; i < 5; i++) ITEM.steakSlice(v.x - 40 + i * 36, v.y - 35 + i * 10, 40, 0.35 + i * 0.05); scatter('mushroom', C(v, 0.42, 0.45, 0.35), 8, 32, 1.4, { cooked: true }); cover('wilted', C(v, 0.34, -0.45, 0.45), 28, 1.8); scatter('garlic', C(v, 0.35, 0.55, -0.4), 4, 15, 2.2); dust('#2A2420', C(v, 0.75), 50, 1.6); dust('#FFFFFF', C(v, 0.45, -0.1, -0.1), 22, 2); },
    'flatbread-pizza': () => { const v = board(600, 520, 0.04); pizza(v.x, v.y, 236); scatter('mozzarella', { x: v.x, y: v.y, r: 178 }, 11, 40, 1.7); scatter('basil', { x: v.x, y: v.y, r: 170 }, 8, 26, 2.2); dust('#5E7A2E', { x: v.x, y: v.y, r: 185 }, 60, 1.8); g.strokeStyle = 'rgba(90,45,20,0.3)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + 0.3; g.beginPath(); g.moveTo(v.x - Math.cos(a) * 232, v.y - Math.sin(a) * 232); g.lineTo(v.x + Math.cos(a) * 232, v.y + Math.sin(a) * 232); g.stroke(); } },
    '_plate': () => { plate(); },
    '_bowl': () => { bowl(); },
  };

  /* ---------- finishing & export ---------- */
  let noise = null;
  function grain() {
    if (!noise) {
      const n = document.createElement('canvas'); n.width = n.height = 128;
      const x = n.getContext('2d'), d = x.createImageData(128, 128), r0 = seeded('grain');
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r0() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      x.putImageData(d, 0, 0); noise = n;
    }
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.045; g.fillStyle = g.createPattern(noise, 'repeat'); g.fillRect(0, 0, S, S);
    g.globalAlpha = 1; const l = g.createLinearGradient(0, 0, S, S); l.addColorStop(0, 'rgba(255,255,255,0.07)'); l.addColorStop(1, 'rgba(40,25,10,0.07)'); g.fillStyle = l; g.fillRect(0, 0, S, S);
    g.restore();
  }
  /** Draws a dish onto a new canvas. bg = background colour or null for transparent. */
  // One shared canvas for every dish: iPhones stop drawing when too many canvases are alive at once.
  let shared = null;
  function paint(id, px = S, bg = null) {
    if (!shared) shared = document.createElement('canvas');
    const c = shared; c.width = c.height = px;
    g = c.getContext('2d');
    if (!g) throw new Error('Canvas is not available');
    rnd = seeded(id); ROT = 0;
    g.scale(px / S, px / S);
    (ART[id] || ART._plate)();
    grain();
    if (bg) { g.save(); g.globalCompositeOperation = 'destination-over'; g.fillStyle = bg; g.fillRect(0, 0, S, S); g.restore(); }
    g = null;
    return c;
  }
  /** Draws a dish and returns it as a data: URL (works everywhere, including sandboxed previews). */
  function render(id, px, bg, type, quality) {
    const c = paint(id, px, bg);
    const url = c.toDataURL(type, quality);
    c.width = c.height = 1;   // free the pixels straight away
    return url;
  }
  const has = id => !!ART[id];
  return { paint, render, has };
})();
