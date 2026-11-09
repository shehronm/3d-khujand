/* SquaresPattern runtime — grid with pens tracing circle-and-bridge chains, template shapes, exits and growth.
   Supplied as-is by the AccessGrid design team. The hero instance is created in squares-steps.js (archived
   explorations in archive/explorations/ use it too). Site-specific edit: frame() idles while the mount is
   collapsed (narrow viewports). The mount is collapsed to height 0 (visibility hidden) rather than display:none,
   so it stays laid out and the runtime's path measurements remain valid. Note: this build defaults `mode` to 'l'
   (template shapes); configs that want the older free-walking pens set `mode: 'walk'`. */

// squares pattern runtime. SquaresPattern(container, options) draws the pattern into the container and
// animates it. returns an api: update(partial), play(), pause(), resume(), toggle(), stop(), exportSvg(), destroy().
window.SquaresPattern = function (container, options) {
  const NS = 'http://www.w3.org/2000/svg';
  const DEFAULTS = {
    size: 160, lineWidth: 2, dash: 6, gap: 2, gridStyle: 'dashed', gridColor: '#D9D9DE',
    circleSize: 64, circleWidth: 2, neck: 35, curve: 70,
    strokeStyle: 'dashed', color: '#D9D9DE', colors: null, colorMix: 'pen', cellLen: 6, cellGap: 2, cellShape: 'square', taper: 0, fade: 0,
    loop: true, pens: 3, length: 3, speed: 400, trail: 350, fullTrail: false, showDots: true,
    mode: 'l', hold: 800, pauseNext: 400, exit: 'blur', exitDur: 900, next: 'anywhere',
    grow: false, growFrom: 'edges', growEvery: 0.8, growMax: 24, growStart: 6, growFull: 'stay', growHold: 4,
    hover: true, hoverRadius: 140, hoverColor: '#0A7AFF', swell: 120, linger: 500,
    flicker: false, flickerAmount: 20, flickerTrigger: 'random', flickerDir: 'top', flickerMode: 'outline', flickerStyle: 'blink', flickerFill: 10, flickerStroke: 100, flickerColor: '#0A7AFF', flickerDur: 600,
    cells: [[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[2,3]],
    origin: { x: -2.5, y: -2 }, center: true, autoplay: true,
    artboard: null, maxScale: Infinity, frame: false, guides: false,   // artboard: { w, h } in px
    backdrop: null, backdropOpacity: 100                                // backdrop: { kind: 'html'|'image', src }
  };
  const c = Object.assign({}, DEFAULTS, options || {});
  const GEOMETRY = ['size', 'lineWidth', 'dash', 'gap', 'gridStyle', 'gridColor', 'circleSize', 'circleWidth', 'neck', 'curve', 'cells', 'origin', 'center', 'artboard', 'maxScale', 'frame', 'guides'];
  // a design placed behind the grid at the artboard's size (tool only; never exported)
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop'; backdrop.hidden = true;
  container.insertBefore(backdrop, container.firstChild);
  function renderBackdrop() {
    backdrop.replaceChildren();
    const b = c.backdrop;
    backdrop.hidden = !(b && c.artboard);
    if (backdrop.hidden) return;
    backdrop.style.width = view.aw + 'px'; backdrop.style.height = view.ah + 'px';
    backdrop.style.transform = `translate(${fmt(view.ox)}px, ${fmt(view.oy)}px) scale(${fmt(view.s)})`;
    backdrop.style.opacity = c.backdropOpacity / 100;
    if (b.kind === 'image') { const img = document.createElement('img'); img.src = b.src; backdrop.appendChild(img); }
    else {
      const fr = document.createElement('iframe');
      fr.setAttribute('sandbox', '');                        // no scripts, no navigation, no forms
      fr.setAttribute('scrolling', 'no');
      fr.style.width = view.aw + 'px'; fr.style.height = view.ah + 'px';
      fr.srcdoc = b.src;
      backdrop.appendChild(fr);
    }
  }

  // ---------- helpers ----------
  const key = (col, row) => `${col},${row}`;
  const parse = k => k.split(',').map(Number);
  const fmt = v => Math.round(v * 1000) / 1000;
  const f = p => `${fmt(p[0])} ${fmt(p[1])}`;
  const bez = (p, q, r) => `C${f(p)} ${f(q)} ${f(r)}`;
  const hexRgb = h => h[0] === '#' ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : (h.match(/\d+/g) || [0, 0, 0]).map(Number);
  const mixHex = (p, q, t) => { const A = hexRgb(p), B = hexRgb(q); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  // the stroke colours in play, and a colour part-way along them (0 at the head, 1 at the tail)
  const palette = () => (c.colors && c.colors.length ? c.colors : [c.color]);
  function trailColor(t) {
    const P = palette(); if (P.length === 1) return P[0];
    const x = Math.min(1, Math.max(0, t)) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(x));
    return mixHex(P[i], P[i + 1], x - i);
  }
  function el(name, attrs, cls) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (cls) n.setAttribute('class', cls);
    return n;
  }
  let cellSet = new Set();
  // how many squares fit in the artboard
  const gridSize = () => c.artboard ? { cols: Math.max(1, Math.floor(c.artboard.w / c.size)), rows: Math.max(1, Math.floor(c.artboard.h / c.size)) } : null;
  const spawned = new Map();                                  // key -> expiry time (0 = never)
  const syncCells = () => {
    cellSet = new Set(c.cells.map(x => Array.isArray(x) ? key(x[0], x[1]) : x));
    for (const k of spawned.keys()) cellSet.add(k);
    const gs = gridSize();
    if (gs) for (const k of [...cellSet]) { const [col, row] = parse(k); if (col < 0 || row < 0 || col >= gs.cols || row >= gs.rows) cellSet.delete(k); }
  };
  syncCells();
  const has = (col, row) => cellSet.has(key(col, row));

  // ---------- svg ----------
  const svg = el('svg', { xmlns: NS });
  svg.style.cssText = 'display:block;width:100%;height:100%;';
  const style = el('style');
  style.textContent = `
.sq-edge{fill:none;stroke-linecap:butt}
.sq-ring,.sq-neck,.sq-cell{fill:none;stroke:var(--pen)}
.sq-cell.filled{fill:var(--pen);stroke:none}
.sq-head{fill:var(--pen)}
.sq-nodots .sq-head{visibility:hidden}
.sq-fx,.sq-flick{pointer-events:none}
.sq-in{animation:sqIn .5s ease-out both}
.sq-out{animation:sqOut .5s ease-in both;pointer-events:none}
@keyframes sqOut{to{opacity:0}}
.sq-shape{transition:opacity var(--exit,.9s) ease,filter var(--exit,.9s) ease,transform var(--exit,.9s) cubic-bezier(.4,0,.2,1);transform-box:fill-box;transform-origin:center}
.sq-exit-fade{opacity:0}
.sq-exit-blur{opacity:0;filter:blur(8px)}
.sq-exit-shrink{opacity:0;transform:scale(.7)}
.sq-exit-lift{opacity:0;transform:translateY(-14px)}
.sq-head{transition:opacity .35s ease}
@media (prefers-reduced-motion:reduce){.sq-shape,.sq-head{transition-duration:.01s}}
@keyframes sqIn{from{opacity:0}to{opacity:1}}
.sq-flick{animation:sqFlick var(--dur,600ms) ease-out both}
.sq-flick.breathe{animation:sqBreathe var(--dur,600ms) ease-in-out both}
@keyframes sqFlick{0%{opacity:0}15%{opacity:1}35%{opacity:.15}55%{opacity:1}100%{opacity:0}}
@keyframes sqBreathe{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.sq-flick{animation-duration:.01s}}`;
  const defs = el('defs'), gRoot = el('g'), gFrame = el('g'), gPreview = el('g'), gEdges = el('g'), gFlick = el('g'), gL = el('g'), gFx = el('g', {}, 'sq-fx');
  gRoot.append(gFrame, gPreview, gEdges, gFlick, gL, gFx);
  svg.append(style, defs, gRoot);
  container.insertBefore(svg, container.firstChild);
  let W = 0, H = 0;
  // the view: the artboard (or the whole container) placed and scaled inside the container
  const view = { s: 1, ox: 0, oy: 0, aw: 0, ah: 0 };
  function fitView() {
    if (c.artboard) {
      view.aw = c.artboard.w; view.ah = c.artboard.h;
      view.s = Math.min(W / view.aw, H / view.ah, c.maxScale);
      view.ox = (W - view.aw * view.s) / 2; view.oy = (H - view.ah * view.s) / 2;
    } else { view.aw = W; view.ah = H; view.s = 1; view.ox = 0; view.oy = 0; }
    gRoot.setAttribute('transform', `translate(${fmt(view.ox)} ${fmt(view.oy)}) scale(${fmt(view.s)})`);
    renderBackdrop();
  }
  const toLocal = (clientX, clientY) => { const b = container.getBoundingClientRect(); return [(clientX - b.left - view.ox) / view.s, (clientY - b.top - view.oy) / view.s]; };

  // ---------- geometry ----------
  function bbox() {
    if (!cellSet.size) return null;
    let c0 = Infinity, r0 = Infinity, c1 = -Infinity, r1 = -Infinity;
    for (const k of cellSet) { const [col, row] = parse(k); c0 = Math.min(c0, col); r0 = Math.min(r0, row); c1 = Math.max(c1, col); r1 = Math.max(r1, row); }
    return { c0, r0, c1, r1 };
  }
  function originPx() {
    const snap = (c.lineWidth % 2 === 0) ? 0 : 0.5;
    const gs = gridSize();
    if (gs) return { x: Math.round((view.aw - gs.cols * c.size) / 2) + snap, y: Math.round((view.ah - gs.rows * c.size) / 2) + snap };
    let o = c.origin;
    if (c.center) { const b = bbox(); o = b ? { x: -(b.c0 + b.c1 + 1) / 2, y: -(b.r0 + b.r1 + 1) / 2 } : { x: 0, y: 0 }; }
    return { x: Math.round(W / 2 + o.x * c.size) + snap, y: Math.round(H / 2 + o.y * c.size) + snap };
  }
  const radius = () => c.circleSize / 2;
  const centre = (col, row, o = originPx()) => [o.x + col * c.size + c.size / 2, o.y + row * c.size + c.size / 2];
  function edgeSet() {
    const set = new Set();
    for (const k of cellSet) { const [col, row] = parse(k); set.add(`h,${col},${row}`); set.add(`h,${col},${row + 1}`); set.add(`v,${col},${row}`); set.add(`v,${col + 1},${row}`); }
    return set;
  }
  function fitDashes(len, dash, gap) {
    let n = Math.max(1, Math.round((len + gap) / (dash + gap)));
    while (n > 1 && (len - n * dash) / (n - 1) < 1) n--;
    if (n === 1) return { dash: len, gap: 0 };
    return { dash, gap: (len - n * dash) / (n - 1) };
  }
  const dashStr = d => `${fmt(d.dash)} ${fmt(d.gap)}`;
  const edgeDash = () => dashStr(fitDashes(c.size, c.dash, c.gap));
  function circleDash(r) {
    const C = 2 * Math.PI * r, n = Math.max(1, Math.round(C / (c.dash + c.gap))), gap = C / n - c.dash;
    return { array: `${fmt(c.dash)} ${fmt(Math.max(0, gap))}`, offset: fmt(c.dash / 2) };
  }
  const neckDash = sideLen => dashStr(fitDashes(sideLen, c.dash, c.gap));
  // a full turn from a point, anticlockwise on screen: the direction a pen arrives in off a bridge
  function fullCircle(o, r, from) {
    const anti = [2 * o[0] - from[0], 2 * o[1] - from[1]];
    return `A${r} ${r} 0 0 0 ${f(anti)} A${r} ${r} 0 0 0 ${f(from)}`;
  }
  // bridge between circle centres: two concave curves tangent to both circles. sides[i] = { pts, d, rev }
  const measure = el('path', {});
  function neckPath(ax, ay, bx, by, r) {
    const dx = bx - ax, dy = by - ay, D = Math.hypot(dx, dy);
    const u = [dx / D, dy / D], v = [-u[1], u[0]];
    const w = r * c.neck / 100;
    let th = c.curve * Math.PI / 180;
    th = Math.max(th, Math.asin(Math.min(1, (w + 1) / r)));
    const st = Math.sin(th), ct = Math.cos(th);
    const L = D / 2 - r * ct;
    const h1 = Math.min(0.3 * L, 0.9 * (r * st - w) / ct), h2 = 0.5 * L;
    const pt = (o, p, q) => [o[0] + p * u[0] + q * v[0], o[1] + p * u[1] + q * v[1]];
    const sides = [1, -1].map(sg => {
      const P1 = pt([ax, ay], r * ct, sg * r * st), c1 = pt(P1, h1 * st, -sg * h1 * ct);
      const M = pt([ax, ay], D / 2, sg * w), c2 = pt(M, -h2, 0), c3 = pt(M, h2, 0);
      const P2 = pt([bx, by], -r * ct, sg * r * st), c4 = pt(P2, -h1 * st, -sg * h1 * ct);
      return { pts: [P1, c1, c2, M, c3, c4, P2], d: `M${f(P1)} ${bez(c1, c2, M)} ${bez(c3, c4, P2)}`, rev: `${bez(c4, c3, M)} ${bez(c2, c1, P1)}` };
    });
    measure.setAttribute('d', sides[0].d); svg.appendChild(measure);
    const sideLen = measure.getTotalLength(); measure.remove();
    return { sides, sideLen };
  }
  let maskId = 0;
  function makeMask(d, width) {
    const id = 'sqm' + (++maskId) + '-' + Math.random().toString(36).slice(2, 6);
    const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -1e5, y: -1e5, width: 2e5, height: 2e5 });
    const path = el('path', { d, pathLength: 1, fill: 'none', stroke: '#fff', 'stroke-width': width, 'stroke-dasharray': '0 1', 'stroke-dashoffset': 0 });
    mask.appendChild(path); defs.appendChild(mask);
    return { id, mask, path };
  }
  const setWindow = (path, a, b) => { path.setAttribute('stroke-dasharray', `${fmt(Math.max(0, b - a))} 1`); path.setAttribute('stroke-dashoffset', fmt(-a)); };

  // ---------- static grid ----------
  function render() {
    const wasPlaying = anim.playing, wasPaused = anim.paused;
    stop();
    syncCells();
    fitView();
    const o = originPx(), S = c.size;
    gEdges.replaceChildren(); edgeEls.clear(); gFrame.replaceChildren();
    if (c.artboard && c.frame) gFrame.appendChild(el('rect', { x: 0, y: 0, width: view.aw, height: view.ah, fill: c.backdrop ? 'none' : '#fff', stroke: '#DBDBDF', 'stroke-width': 1 / view.s }));
    const gs = gridSize();
    if (gs && c.guides) for (let col = 0; col < gs.cols; col++) for (let row = 0; row < gs.rows; row++)
      gFrame.appendChild(el('rect', { x: o.x + col * S, y: o.y + row * S, width: S, height: S, fill: 'none', stroke: '#EEEEF0', 'stroke-width': 1 / view.s }));
    svg.style.setProperty('--pen', palette()[0]);
    svg.classList.toggle('sq-nodots', !c.showDots);
    drawEdges();
    if (wasPlaying) { play(); if (wasPaused) pause(); }
  }
  // the square outlines, one line per unique edge. edges that are new since last time fade in
  const edgeEls = new Map();
  function drawEdges(animate) {
    const o = originPx(), S = c.size, dashArr = edgeDash(), want = edgeSet();
    for (const [e, line] of edgeEls) if (!want.has(e)) { edgeEls.delete(e); if (animate) { line.classList.add('sq-out'); line.addEventListener('animationend', () => line.remove()); } else line.remove(); }
    for (const e of want) {
      if (edgeEls.has(e)) continue;
      const [t, col, row] = e.split(','); const x = o.x + col * S, y = o.y + row * S;
      const line = t === 'h' ? el('line', { x1: x, y1: y, x2: x + S, y2: y }) : el('line', { x1: x, y1: y, x2: x, y2: y + S });
      line.setAttribute('class', 'sq-edge' + (animate ? ' sq-in' : ''));
      line.setAttribute('stroke', c.gridColor);
      line.setAttribute('stroke-width', c.lineWidth);
      if (c.gridStyle === 'dashed') line.setAttribute('stroke-dasharray', dashArr);
      gEdges.appendChild(line); edgeEls.set(e, line);
    }
  }
  // cells changed while running: redraw edges and drop any pen shape that used a removed square
  function applyCells() {
    syncCells(); drawEdges(true);
    for (const pen of anim.pens) {
      const stale = sh => sh && !sh.shape.cells.every(k => cellSet.has(k));
      pen.olds = pen.olds.filter(o => { if (!stale(o.sh)) return true; unclaim(o.sh.shape); dropShape(o.sh); return false; });
      if (stale(pen.shape)) { unclaim(pen.shape.shape); dropShape(pen.shape); pen.shape = null; pen.phase = 'draw'; pen.at = null; pen.head.setAttribute('display', 'none'); pen.waitUntil = performance.now(); }
    }
  }

  // ---------- chains ----------
  function pickShape(pen) {
    const free = k => cellSet.has(k) && (!anim.claimed.has(k) || anim.claimed.get(k).pen === pen);
    let first;
    if (pen.at) first = parse(pen.at);
    else { const starts = [...cellSet].filter(free); if (!starts.length) return null; first = parse(starts[Math.floor(Math.random() * starts.length)]); }
    const target = 2 + Math.floor(Math.random() * Math.max(1, c.length - 1));
    const chain = [first], used = new Set([key(...first)]);
    while (chain.length < target) {
      const [col, row] = chain[chain.length - 1];
      const next = [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]].filter(([x, y]) => free(key(x, y)) && !used.has(key(x, y)));
      if (!next.length) break;
      const n = next[Math.floor(Math.random() * next.length)];
      chain.push(n); used.add(key(...n));
    }
    if (chain.length < 2 && cellSet.size > 1) return null;
    return { chain, cells: [...used], id: [...used].join('|'), pen };
  }

  // shape templates as chains of squares. each is tried in every rotation and reflection, and from
  // either end, so an l comes up in all eight of its poses
  const TEMPLATES = {
    l: [[0, 0], [1, 0], [1, 1]],
    longl: [[0, 0], [1, 0], [2, 0], [2, 1]],
    z: [[0, 0], [1, 0], [1, 1], [2, 1]],
    u: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]],
    line: [[0, 0], [1, 0], [2, 0]]
  };
  const POSES = (() => {
    const out = [];
    for (const r of [0, 1, 2, 3]) for (const m of [1, -1]) out.push(([x, y]) => { for (let i = 0; i < r; i++) [x, y] = [-y, x]; return [x * m, y]; });
    return out;
  })();
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function pickTemplate(pen) {
    const free = k => cellSet.has(k) && (!anim.claimed.has(k) || anim.claimed.get(k).pen === pen);
    const names = c.mode === 'mix' ? shuffle(Object.keys(TEMPLATES)) : [TEMPLATES[c.mode] ? c.mode : 'l'];
    const anchors = pen.at ? [parse(pen.at)] : shuffle([...cellSet].filter(free).map(parse));
    let repeat = null;
    for (const name of names) {
      const base = TEMPLATES[name];
      const variants = [];
      for (const pose of POSES) { const t = base.map(pose); variants.push(t, t.slice().reverse()); }
      shuffle(variants);
      for (const anchor of anchors) for (const v of variants) {
        const chain = v.map(([x, y]) => [anchor[0] + x - v[0][0], anchor[1] + y - v[0][1]]);
        const cells = chain.map(q => key(...q));
        if (!cells.every(free)) continue;
        const pick = { chain, cells, id: cells.join('|'), pen };
        if (pick.id === pen.lastId) { repeat = pick; continue; }
        return pick;
      }
    }
    if (repeat) return repeat;
    // nothing fits from here: step to a neighbour so the pen can try again from there
    if (pen.at) { const [cx, cy] = parse(pen.at); for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) { const n = [cx + dx, cy + dy]; if (free(key(...n))) { const cells = [pen.at, key(...n)]; return { chain: [[cx, cy], n], cells, id: cells.join('|'), pen }; } } }
    return null;
  }

  // the geometry and the pen's route as segments. every segment knows its length, how to place the
  // head along it, and what it reveals. full circle on arrival at every square, then straight on.
  function buildShape(shape, startPt, color, fullFirst, complete) {
    const o = originPx(), r = radius(), d = circleDash(r);
    const P = shape.chain.map(cr => centre(...cr, o));
    const g = el('g', {}, 'sq-shape');
    g.style.setProperty('--pen', color);
    const segs = [], masks = [], helpers = [];
    const mw = c.circleWidth + 2;
    const style = c.strokeStyle, cells = style === 'cells';
    const helper = dd => { const h = el('path', { d: dd }); defs.appendChild(h); helpers.push(h); return h; };
    // taper and fade on a single stroke: the mask is a stack of bands along the route, each a little
    // narrower and fainter toward the tail. with neither, one band does the job
    const bands = (c.taper > 0 || c.fade > 0) ? 12 : 1;
    function seg(dd, len, make) {
      if (cells) { segs.push({ len, grey: [], head: helper(dd) }); return; }
      const m = makeMask(dd, mw); masks.push(m);
      const paths = [m.path];
      for (let i = 1; i < bands; i++) { const pth = m.path.cloneNode(false); m.mask.appendChild(pth); paths.push(pth); }
      const elc = make(m); g.appendChild(elc);
      const sg = { len, grey: paths, head: m.path, el: elc, q: 0, base: mw };
      const hl = m.path.getTotalLength(), pts = [];
      for (let i = 0; i <= 10; i++) { const pt = m.path.getPointAtLength(hl * i / 10); pts.push([pt.x, pt.y]); }
      sg.pts = pts; segs.push(sg);
    }
    const ringAttrs = (O, m) => {
      const at = { cx: O[0], cy: O[1], r, 'stroke-width': c.circleWidth, mask: `url(#${m.id})` };
      if (style === 'dashed') { at['stroke-dasharray'] = d.array; at['stroke-dashoffset'] = d.offset; }
      return at;
    };
    const circleSeg = (O, start) => seg(`M${f(start)} ${fullCircle(O, r, start)}`, 2 * Math.PI * r, m => el('circle', ringAttrs(O, m), 'sq-ring'));
    // one side of a bridge, in the pen's direction of travel. nothing is drawn that the dot didn't draw
    function sideSeg(n, sd, reversed) {
      const dd = reversed ? `M${f(sd.pts[6])} ${sd.rev}` : sd.d;
      seg(dd, n.sideLen, m => { const at = { d: sd.d, 'stroke-width': c.circleWidth, mask: `url(#${m.id})` }; if (style === 'dashed') at['stroke-dasharray'] = neckDash(n.sideLen); return el('path', at, 'sq-neck'); });
    }
    const bridgeSeg = n => sideSeg(n, n.sides[0], false);
    function arcSeg(O, from, to) {
      const a1 = Math.atan2(from[1] - O[1], from[0] - O[0]), a2 = Math.atan2(to[1] - O[1], to[0] - O[0]);
      let ang = a1 - a2; while (ang < 0) ang += 2 * Math.PI; while (ang >= 2 * Math.PI) ang -= 2 * Math.PI;
      if (ang < 1e-4) return;
      seg(`M${f(from)} A${r} ${r} 0 ${ang > Math.PI ? 1 : 0} 0 ${f(to)}`, ang * r, m => el('circle', ringAttrs(O, m), 'sq-ring'));
    }
    const bridges = P.slice(1).map((Q, i) => neckPath(...P[i], ...Q, r));
    const arrivals = [];                                  // where the pen enters each square, for footsteps
    const arrive = i => arrivals.push({ seg: segs.length, cell: key(...shape.chain[i]), fired: false });
    if (!bridges.length) { arrive(0); circleSeg(P[0], startPt || [P[0][0], P[0][1] - r]); }
    else if (startPt && !fullFirst) arcSeg(P[0], startPt, bridges[0].sides[0].pts[0]);
    else if (startPt) { arrive(0); circleSeg(P[0], startPt); arcSeg(P[0], startPt, bridges[0].sides[0].pts[0]); }
    else { arrive(0); circleSeg(P[0], bridges[0].sides[0].pts[0]); }
    for (let i = 0; i < bridges.length; i++) {
      const n = bridges[i], s0 = n.sides[0];
      bridgeSeg(n);
      arrive(i + 1);
      circleSeg(P[i + 1], s0.pts[6]);
      if (i + 1 < bridges.length) arcSeg(P[i + 1], s0.pts[6], bridges[i + 1].sides[0].pts[0]);
    }
    // a complete shape: come back along the other side of every bridge, ending on the first circle
    if (complete && bridges.length) {
      const nb = bridges.length, lastB = bridges[nb - 1];
      arcSeg(P[nb], lastB.sides[0].pts[6], lastB.sides[1].pts[6]);
      for (let i = nb - 1; i >= 0; i--) {
        const n = bridges[i];
        sideSeg(n, n.sides[1], true);
        if (i > 0) arcSeg(P[i], n.sides[1].pts[0], bridges[i - 1].sides[1].pts[6]);
      }
    }
    let acc = 0;
    for (const sg of segs) { sg.s0 = acc; acc += sg.len; sg.s1 = acc; }
    arrivals.forEach(ar => { ar.dist = segs[ar.seg] ? segs[ar.seg].s0 : 0; });
    const cellEls = [];
    if (cells) {
      const kind = c.cellShape, glyph = !(kind === 'square' || kind === 'round'), step = c.cellLen + c.cellGap;
      for (let c0 = 0; c0 < acc; c0 += step) {
        const e = el('path', { 'stroke-width': c.circleWidth, 'stroke-linecap': kind === 'round' ? 'round' : 'butt', display: 'none' }, 'sq-cell' + (glyph && kind !== 'ring' ? ' filled' : ''));
        g.appendChild(e);
        cellEls.push({ c0, c1: Math.min(acc, c0 + c.cellLen), el: e, kind, q: 0, px: 0, py: 0 });
      }
    }
    gL.appendChild(g);
    return { shape, segs, len: acc, g, masks, helpers, cells: cellEls, P, arrivals, color };
  }
  function dropShape(sh) { if (!sh) return; sh.g.remove(); sh.masks.forEach(m => m.mask.remove()); sh.helpers.forEach(h => h.remove()); }

  // ---------- hover ----------
  const hov = { mx: -1e9, my: -1e9, target: 0, hi: 0, dt: 16 };
  const falloff = (d, R) => { if (d >= R) return 0; const q = 1 - d / R; return q * q * (3 - 2 * q); };
  const cursorAt = (x, y) => hov.hi > 0.001 && c.hover ? hov.hi * falloff(Math.hypot(x - hov.mx, y - hov.my), c.hoverRadius) : 0;
  function settle(cur, target) {
    if (target > cur) return cur + (target - cur) * 0.35;
    const k = c.linger > 0 ? Math.min(1, hov.dt / c.linger * 3) : 1;
    return cur + (target - cur) * k;
  }
  const hoverStroke = (base, q) => q > 0.01 ? mixHex(base, c.hoverColor, Math.min(1, q)) : null;
  const hoverWidth = (w, q) => w * (1 + c.swell / 100 * Math.min(1, q));
  function hoverSegs(sh) {
    for (const sg of sh.segs) {
      if (!sg.el) continue;
      let best = 0;
      if (hov.hi > 0.001 && c.hover) for (const [x, y] of sg.pts) { const q = cursorAt(x, y); if (q > best) best = q; }
      sg.q = settle(sg.q, best);
      if (sg.q < 0.005) { if (sg.hot) { sg.el.style.stroke = ''; sg.el.setAttribute('stroke-width', c.circleWidth); sg.swell = 1; sg.hot = false; } continue; }
      sg.hot = true;
      sg.swell = 1 + c.swell / 100 * Math.min(1, sg.q);
      sg.el.style.stroke = hoverStroke(sh.color, sg.q); sg.el.setAttribute('stroke-width', fmt(c.circleWidth * sg.swell));
    }
  }
  function onPointerMove(ev) { [hov.mx, hov.my] = toLocal(ev.clientX, ev.clientY); hov.target = 1; }
  function onPointerLeave() { hov.target = 0; }
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerleave', onPointerLeave);

  // ---------- painting ----------
  function routePt(sh, dist) {
    dist = Math.min(sh.len, Math.max(0, dist));
    const sg = sh.segs.find(g => dist <= g.s1) || sh.segs[sh.segs.length - 1];
    return sg.head.getPointAtLength(Math.min(1, (dist - sg.s0) / sg.len) * sg.head.getTotalLength());
  }
  // show the part of the route between distances a and b
  function paint(sh, a, b) {
    const span = Math.max(1, b - a), w = c.circleWidth, taper = c.taper / 100, fade = c.fade / 100;
    if (!sh.cells.length) {
      for (const sg of sh.segs) {
        const n = sg.grey.length, sw = sg.swell || 1;
        for (let i = 0; i < n; i++) {
          // band i covers the slice of the trail from t=i/n (head) to (i+1)/n (tail)
          const b0 = b - span * i / n, a0 = Math.max(a, b - span * (i + 1) / n);
          const la = Math.min(1, Math.max(0, (a0 - sg.s0) / sg.len)), lb = Math.min(1, Math.max(0, (b0 - sg.s0) / sg.len));
          const m = sg.grey[i]; setWindow(m, la, lb);
          if (n > 1) { const t = (i + 0.5) / n; m.setAttribute('stroke-opacity', fmt(1 - fade * t)); m.setAttribute('stroke-width', fmt(Math.max(0.3, (w * (1 - taper * t) + 2) * sw))); }
          else if (sw !== 1 || m.hasAttribute('data-sw')) { m.setAttribute('stroke-width', fmt((w + 2) * sw)); m.setAttribute('data-sw', 1); }
        }
      }
      return;
    }
    const trailMix = c.colorMix === 'trail' && palette().length > 1;
    for (const cl of sh.cells) {
      const glyph = !(cl.kind === 'square' || cl.kind === 'round');
      let dd, t;
      const mid = (cl.c0 + cl.c1) / 2;
      cl.q = settle(cl.q, (mid >= a && mid <= b) ? cursorAt(cl.px, cl.py) : 0);
      const q = cl.q;
      if (glyph) {
        if (mid < a || mid > b) { cl.el.setAttribute('display', 'none'); continue; }
        t = (b - mid) / span;
        const size = hoverWidth(Math.max(0.5, c.cellLen * (1 - taper * t)), q), h = size / 2;
        const pt = routePt(sh, mid); cl.px = pt.x; cl.py = pt.y;
        if (cl.kind === 'dot' || cl.kind === 'ring') dd = `M${fmt(pt.x - h)} ${fmt(pt.y)} a${fmt(h)} ${fmt(h)} 0 1 0 ${fmt(size)} 0 a${fmt(h)} ${fmt(h)} 0 1 0 ${fmt(-size)} 0`;
        else {
          const p1 = routePt(sh, Math.max(0, mid - 1)), p2 = routePt(sh, Math.min(sh.len, mid + 1));
          const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) + (cl.kind === 'diamond' ? Math.PI / 4 : 0);
          const ux = Math.cos(ang) * h, uy = Math.sin(ang) * h;
          const pts = [[pt.x + ux - uy, pt.y + uy + ux], [pt.x + ux + uy, pt.y + uy - ux], [pt.x - ux + uy, pt.y - uy - ux], [pt.x - ux - uy, pt.y - uy + ux]];
          dd = pts.map((q2, i) => (i ? 'L' : 'M') + fmt(q2[0]) + ' ' + fmt(q2[1])).join(' ') + 'Z';
        }
        cl.el.setAttribute('stroke-width', fmt(hoverWidth(w, q)));
      } else {
        const c0 = Math.max(cl.c0, a), c1 = Math.min(cl.c1, b);
        if (c1 - c0 < 0.5) { cl.el.setAttribute('display', 'none'); continue; }
        const n = Math.max(2, Math.ceil((c1 - c0) / 4) + 1);
        dd = '';
        for (let i = 0; i < n; i++) { const pt = routePt(sh, c0 + (c1 - c0) * i / (n - 1)); dd += (i ? ' L' : 'M') + fmt(pt.x) + ' ' + fmt(pt.y); if (i === Math.floor(n / 2)) { cl.px = pt.x; cl.py = pt.y; } }
        t = (b - (c0 + c1) / 2) / span;
        cl.el.setAttribute('stroke-width', fmt(hoverWidth(Math.max(0.3, w * (1 - taper * t)), q)));
      }
      cl.el.setAttribute('d', dd);
      cl.el.setAttribute('opacity', fmt(1 - fade * t));
      const base = trailMix ? trailColor(t) : sh.color;
      const col = hoverStroke(base, q) || (trailMix ? base : null);
      const prop = glyph && cl.kind !== 'ring' ? 'fill' : 'stroke';
      if (col) { cl.el.style[prop] = col; cl.hot = true; }
      else if (cl.hot) { cl.el.style.fill = ''; cl.el.style.stroke = ''; cl.hot = false; }
      cl.el.removeAttribute('display');
    }
  }

  // ---------- pens ----------
  const anim = { playing: false, paused: false, pausedAt: 0, raf: 0, pens: [], claimed: new Map(), last: 0 };
  function makePen(delay) {
    const head = el('circle', { r: c.circleWidth + 1.5, display: 'none' }, 'sq-head');
    gFx.appendChild(head);
    return { head, shape: null, olds: [], lastId: null, at: null, t0: 0, waitUntil: performance.now() + delay, done: false, hq: 0, phase: 'draw', jit: 0.85 + Math.random() * 0.3 };
  }
  function retirePen(pen) {
    dropShape(pen.shape); pen.olds.forEach(o => dropShape(o.sh));
    for (const [k, sh] of anim.claimed) if (sh.pen === pen) anim.claimed.delete(k);
    pen.head.remove();
  }
  const claim = shape => shape.cells.forEach(k => anim.claimed.set(k, shape));
  const unclaim = shape => shape.cells.forEach(k => { if (anim.claimed.get(k) === shape) anim.claimed.delete(k); });
  const headPos = pen => [+pen.head.getAttribute('cx'), +pen.head.getAttribute('cy')];
  function headAt(pen, dist) { const pt = routePt(pen.shape, dist); pen.head.setAttribute('cx', fmt(pt.x)); pen.head.setAttribute('cy', fmt(pt.y)); }
  const shapeMode = () => c.mode !== 'walk';
  function startNext(pen, now) {
    const shapes = shapeMode();
    if (shapes && c.next === 'anywhere') pen.at = null;
    const picked = shapes ? pickTemplate(pen) : pickShape(pen);
    if (!picked) { pen.waitUntil = now + 250; return; }
    pen.lastId = picked.id;
    claim(picked);
    const P = palette();
    const color = c.colorMix === 'chain' ? P[Math.floor(Math.random() * P.length)] : c.colorMix === 'trail' ? P[0] : P[anim.pens.indexOf(pen) % P.length];
    pen.color = color; pen.head.style.fill = color;
    pen.phase = 'draw';
    // the pen carries on from where it is only if it's standing on the shape's first square
    const standing = !pen.head.hasAttribute('display') && pen.head.style.opacity !== '0' && pen.at === picked.cells[0];
    const sh = buildShape(picked, standing ? headPos(pen) : null, color, shapes, shapes);
    paint(sh, 0, 0);
    if (!standing) {
      const start = sh.segs[0].head.getPointAtLength(0);
      pen.head.setAttribute('cx', fmt(start.x)); pen.head.setAttribute('cy', fmt(start.y));
      pen.head.style.opacity = '0'; pen.head.removeAttribute('display');
      void pen.head.getBoundingClientRect(); pen.head.style.opacity = '1';
    }
    pen.at = shapes ? key(...picked.chain[0]) : key(...picked.chain[picked.chain.length - 1]);
    pen.shape = sh; pen.t0 = now;
  }
  // the shape leaves. fades take the pen with them; reverse and wipe keep it on the grid
  function beginExit(pen, now) {
    const sh = pen.shape, ex = c.exit;
    if (ex === 'reverse' || ex === 'wipe') { pen.phase = ex; pen.t0 = now; return; }
    pen.phase = 'exit'; pen.waitUntil = now + c.exitDur;
    sh.g.style.setProperty('--exit', c.exitDur + 'ms');
    sh.g.classList.add('sq-exit-' + ex);
    pen.head.style.opacity = '0';
  }
  function finishShape(pen, now, atCell) {
    unclaim(pen.shape.shape); dropShape(pen.shape); pen.shape = null;
    pen.at = atCell; pen.waitUntil = now + c.pauseNext * pen.jit;
    pen.jit = 0.85 + Math.random() * 0.3;                  // a little timing drift, so pens never fall into step
  }
  function frame(now) {
    anim.raf = 0;
    if (!anim.playing) return;
    if (!container.clientHeight) { anim.last = 0; return; } // site: idle while this exploration is hidden; render() restarts on show
    hov.dt = anim.last ? Math.min(50, now - anim.last) : 16; anim.last = now;
    hov.hi = settle(hov.hi, hov.target);
    let alive = false;
    for (const pen of anim.pens) {
      if (pen.done) continue;
      alive = true;
      pen.olds = pen.olds.filter(o => {
        const a = o.a0 + (now - o.t0) / 1000 * c.speed;
        paint(o.sh, a, o.sh.len); hoverSegs(o.sh);
        if (a < o.sh.len) return true;
        unclaim(o.sh.shape); dropShape(o.sh); return false;
      });
      if (!pen.shape) { if (now >= pen.waitUntil && cellSet.size >= (c.grow ? c.growStart : 1)) startNext(pen, now); continue; }
      const sh = pen.shape, L = sh.len;
      let d = (now - pen.t0) / 1000 * c.speed;
      let a, b;
      if (shapeMode()) {
        // a gentle ease in and out over the whole stroke, keeping the same average speed
        const dur = L / c.speed * 1000, t = Math.min(1, (now - pen.t0) / dur);
        d = t >= 1 ? L : L * (0.5 - 0.5 * Math.cos(Math.PI * t));
        // draw the whole shape, hold, leave by the chosen exit, pause, pick the next
        const chain = sh.shape.chain, firstCell = key(...chain[0]), lastCell = key(...chain[chain.length - 1]);
        a = 0;
        if (pen.phase === 'draw') { b = Math.min(d, L); if (d >= L) { pen.phase = 'hold'; pen.waitUntil = now + c.hold * pen.jit; } }
        else if (pen.phase === 'hold') { b = L; if (now >= pen.waitUntil) { if (!c.loop) { pen.done = true; continue; } beginExit(pen, now); } }
        else if (pen.phase === 'reverse') { b = Math.max(0, L - d); if (b <= 0) { finishShape(pen, now, firstCell); continue; } }
        else if (pen.phase === 'wipe') { b = L; a = Math.min(L, d); if (a >= L) { finishShape(pen, now, firstCell); continue; } }
        else { b = L; if (now >= pen.waitUntil) { finishShape(pen, now, firstCell); continue; } }
      } else {
        b = Math.min(d, L);
        const trail = c.fullTrail ? Math.max(c.trail, L) : c.trail;
        a = c.loop ? Math.max(0, d - trail) : 0;
      }
      paint(sh, a, b);
      headAt(pen, b);
      hoverSegs(sh);
      if (c.flicker && c.flickerTrigger === 'footsteps') for (const ar of sh.arrivals) if (!ar.fired && ar.dist <= b) { ar.fired = true; flickCell(ar.cell); }
      pen.hq = settle(pen.hq, cursorAt(...headPos(pen)));
      if (pen.hq > 0.01) { pen.head.style.fill = hoverStroke(pen.color, pen.hq); pen.head.setAttribute('r', fmt(hoverWidth(c.circleWidth + 1.5, pen.hq))); pen.hot = true; }
      else if (pen.hot) { pen.head.style.fill = pen.color; pen.head.setAttribute('r', c.circleWidth + 1.5); pen.hot = false; }
      if (shapeMode() || b < L) continue;
      if (!c.loop) { pen.done = true; continue; }
      pen.olds.push({ sh, a0: a, t0: now });
      pen.shape = null;
      startNext(pen, now);
    }
    if (!alive) { anim.playing = false; notify(); return; }
    anim.raf = requestAnimationFrame(frame);
  }
  function play() {
    if (anim.playing) stop();
    anim.playing = true; anim.paused = false; anim.last = 0;
    syncPens(); notify();
    anim.raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = 0;
    anim.playing = false; anim.paused = false;
    anim.pens.forEach(retirePen); anim.pens = []; anim.claimed.clear();
    notify();
  }
  function pause() {
    if (!anim.playing || anim.paused) return;
    if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = 0;
    anim.paused = true; anim.pausedAt = performance.now(); notify();
  }
  function resume() {
    if (!anim.playing || !anim.paused) return;
    const shift = performance.now() - anim.pausedAt;
    for (const pen of anim.pens) { pen.t0 += shift; pen.waitUntil += shift; pen.olds.forEach(o => { o.t0 += shift; }); }
    anim.paused = false; anim.last = 0; notify();
    anim.raf = requestAnimationFrame(frame);
  }
  const toggle = () => { if (!anim.playing) play(); else if (anim.paused) resume(); else pause(); };
  // pens start spread evenly across one cycle of draw, hold, exit and pause
  function cycleMs() {
    const r = radius(), side = Math.max(10, c.size - 2 * r) * 1.15;
    const route = 3 * 2 * Math.PI * r + 4 * side;
    return route / c.speed * 1000 + c.hold + (c.exit === 'reverse' || c.exit === 'wipe' ? route / c.speed * 1000 : c.exitDur) + c.pauseNext;
  }
  function syncPens() {
    if (!anim.playing) return;
    const step = shapeMode() ? cycleMs() / Math.max(1, c.pens) : 500;
    while (anim.pens.length < c.pens) anim.pens.push(makePen(anim.pens.length * step));
    while (anim.pens.length > c.pens) retirePen(anim.pens.pop());
  }
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn());

  // ---------- flicker ----------
  let flickTimer = 0;
  function scheduleFlicker() {
    clearTimeout(flickTimer); flickTimer = 0;
    if (!c.flicker || !cellSet.size || c.flickerAmount <= 0 || c.flickerTrigger === 'footsteps') return;
    const spread = c.flickerTrigger === 'ripple' || c.flickerTrigger === 'sweep';
    let wait;
    if (spread) wait = (1500 + (100 - c.flickerAmount) * 40) * (0.7 + Math.random() * 0.6);
    else wait = 1000 / Math.max(0.05, c.flickerAmount / 100 * cellSet.size) * (0.5 + Math.random());
    flickTimer = setTimeout(() => { c.flickerTrigger === 'ripple' ? ripple() : c.flickerTrigger === 'sweep' ? sweep() : flickRandom(); scheduleFlicker(); }, wait);
  }
  const randomCell = () => { const keys = [...cellSet]; return keys.length ? keys[Math.floor(Math.random() * keys.length)] : null; };
  function flickRandom() { const k = randomCell(); if (k) flickCell(k); }
  // blinks spread outward from a random square, one step per quarter of the duration
  function ripple() {
    const k0 = randomCell(); if (!k0) return;
    const [c0, r0] = parse(k0), step = c.flickerDur * 0.25;
    for (const k of cellSet) { const [col, row] = parse(k); flickCell(k, (Math.abs(col - c0) + Math.abs(row - r0)) * step); }
  }
  // blinks stagger across the pattern from one edge, a row or column per quarter of the duration
  function sweep() {
    const b = bbox(); if (!b) return;
    let dir = c.flickerDir;
    if (dir === 'random') dir = ['top', 'bottom', 'left', 'right'][Math.floor(Math.random() * 4)];
    const step = c.flickerDur * 0.25;
    for (const k of cellSet) {
      const [col, row] = parse(k);
      const idx = dir === 'top' ? row - b.r0 : dir === 'bottom' ? b.r1 - row : dir === 'left' ? col - b.c0 : b.c1 - col;
      flickCell(k, idx * step);
    }
  }
  function flickCell(k, delay = 0) {
    const [col, row] = parse(k);
    const o = originPx(), S = c.size, x = o.x + col * S, y = o.y + row * S;
    const g = el('g', {}, 'sq-flick' + (c.flickerStyle === 'breathe' ? ' breathe' : ''));
    g.style.setProperty('--dur', c.flickerDur + 'ms');
    if (delay) g.style.animationDelay = delay + 'ms';
    const mode = c.flickerMode;
    if (mode === 'fill' || mode === 'both') g.appendChild(el('rect', { x, y, width: S, height: S, fill: c.flickerColor, opacity: c.flickerFill / 100 }));
    if (mode === 'outline' || mode === 'both') {
      const r = el('rect', { x, y, width: S, height: S, fill: 'none', stroke: c.flickerColor, 'stroke-width': c.lineWidth, opacity: c.flickerStroke / 100 });
      if (c.gridStyle === 'dashed') r.setAttribute('stroke-dasharray', edgeDash());
      g.appendChild(r);
    }
    if (mode === 'corners') {
      const t = Math.max(6, Math.min(14, S * 0.06));
      let d = '';
      for (const [cx, cy] of [[x, y], [x + S, y], [x, y + S], [x + S, y + S]]) d += `M${fmt(cx - t)} ${fmt(cy)}H${fmt(cx + t)}M${fmt(cx)} ${fmt(cy - t)}V${fmt(cy + t)}`;
      g.appendChild(el('path', { d, fill: 'none', stroke: c.flickerColor, 'stroke-width': c.lineWidth, opacity: c.flickerStroke / 100 }));
    }
    g.addEventListener('animationend', () => g.remove());
    gFlick.appendChild(g);
  }

  // a random layout: `count` squares grown as a few connected clusters, so shapes always fit
  function randomCells(count) {
    const gs = gridSize();
    const cols = gs ? gs.cols : 6, rows = gs ? gs.rows : 4;
    count = Math.min(count, cols * rows);
    const chosen = new Set(), list = [];
    const add = (x, y) => { const k = key(x, y); if (!chosen.has(k)) { chosen.add(k); list.push([x, y]); } };
    const seeds = Math.max(1, Math.min(4, Math.round(count / 7)));
    for (let i = 0; i < seeds; i++) add(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows));
    let guard = 0;
    while (chosen.size < count && guard++ < 5000) {
      const [x, y] = list[Math.floor(Math.random() * list.length)];
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) add(nx, ny);
    }
    return list;
  }

  // ---------- growth ----------
  // squares are added one at a time into empty slots and never taken away
  let growTimer = 0, growFullAt = 0;
  function scheduleGrow() {
    clearTimeout(growTimer); growTimer = 0;
    if (!c.grow) { if (spawned.size) { spawned.clear(); applyCells(); } return; }
    growTimer = setTimeout(() => { growTick(); scheduleGrow(); }, Math.max(60, c.growEvery * 1000 * (0.75 + Math.random() * 0.5)));
  }
  function slotBounds() {
    const gs = gridSize(), b = bbox();
    if (gs) return { c0: 0, r0: 0, c1: gs.cols - 1, r1: gs.rows - 1 };
    return b ? { c0: b.c0 - 1, r0: b.r0 - 1, c1: b.c1 + 1, r1: b.r1 + 1 } : { c0: 0, r0: 0, c1: 2, r1: 2 };
  }
  const neighbours = k => { const [x, y] = parse(k); return [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]; };
  function growTick() {
    if (cellSet.size >= c.growMax) {
      if (c.growFull !== 'restart') return;
      if (!growFullAt) growFullAt = performance.now();
      if (performance.now() - growFullAt >= c.growHold * 1000) restartGrowth();
      return;
    }
    growFullAt = 0;
    const B = slotBounds(), free = [];
    for (let col = B.c0; col <= B.c1; col++) for (let row = B.r0; row <= B.r1; row++) { const k = key(col, row); if (!cellSet.has(k)) free.push(k); }
    if (!free.length) return;
    const touching = free.filter(k => neighbours(k).some(n => cellSet.has(n)));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    let k = null;
    const mode = cellSet.size ? c.growFrom : 'random';
    if (mode === 'edges') k = pick(touching.length ? touching : free);
    else if (mode === 'random') k = pick(free);
    else if (mode === 'shapes') {
      const busy = new Set([...anim.claimed.keys()]);
      const near = touching.filter(k => neighbours(k).some(n => busy.has(n)));
      k = pick(near.length ? near : touching.length ? touching : free);
    } else if (mode === 'left' || mode === 'top') {
      const pool = touching.length ? touching : free, axis = mode === 'left' ? 0 : 1;
      const best = Math.min(...pool.map(q => parse(q)[axis]));
      k = pick(pool.filter(q => parse(q)[axis] === best));
    } else if (mode === 'centre') {
      const cx = (B.c0 + B.c1) / 2, cy = (B.r0 + B.r1) / 2, pool = touching.length ? touching : free;
      const dist = q => { const [x, y] = parse(q); return Math.hypot(x - cx, y - cy); };
      const best = Math.min(...pool.map(dist));
      k = pick(pool.filter(q => dist(q) <= best + 0.01));
    }
    if (!k) return;
    spawned.set(k, 0); applyCells();
  }
  // fade every shape and spawned square out, then grow again from the seed squares
  function restartGrowth() {
    growFullAt = 0;
    for (const pen of anim.pens) if (pen.shape) { pen.shape.g.style.setProperty('--exit', '500ms'); pen.shape.g.classList.add('sq-exit-fade'); pen.head.style.opacity = '0'; }
    clearTimeout(growTimer); growTimer = 0;
    setTimeout(() => { spawned.clear(); applyCells(); scheduleGrow(); }, 520);
  }

  // ---------- export ----------
  function exportSvg() {
    const b = bbox(); if (!b) return '';
    const S = c.size, pad = Math.max(c.lineWidth, c.circleWidth) + 8, snap = (c.lineWidth % 2 === 0) ? 0 : 0.5, rad = radius();
    let o, w, h;
    if (c.artboard) { o = originPx(); w = c.artboard.w; h = c.artboard.h; }
    else { o = { x: pad - b.c0 * S + snap, y: pad - b.r0 * S + snap }; w = (b.c1 - b.c0 + 1) * S + pad * 2; h = (b.r1 - b.r0 + 1) * S + pad * 2; }
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">\n`;
    out += `  <g stroke="${c.gridColor}" stroke-width="${c.lineWidth}"${c.gridStyle === 'dashed' ? ` stroke-dasharray="${edgeDash()}"` : ''}>\n`;
    for (const e of edgeSet()) {
      const [t, col, row] = e.split(','); const x = o.x + col * S, y = o.y + row * S;
      out += t === 'h' ? `    <line x1="${x}" y1="${y}" x2="${x + S}" y2="${y}"/>\n` : `    <line x1="${x}" y1="${y}" x2="${x}" y2="${y + S}"/>\n`;
    }
    out += `  </g>\n`;
    for (const pen of anim.pens) {
      const sh = pen.shape; if (!sh) continue;
      const d = circleDash(rad), st = c.strokeStyle;
      const glyph = st === 'cells' && !(c.cellShape === 'square' || c.cellShape === 'round');
      const cellAttr = st === 'cells' ? (glyph ? ` stroke-dasharray="0.01 ${c.cellLen + c.cellGap}" stroke-linecap="round"` : ` stroke-dasharray="${c.cellLen} ${c.cellGap}"${c.cellShape === 'round' ? ' stroke-linecap="round"' : ''}`) : '';
      out += `  <g stroke="${sh.color || palette()[0]}" stroke-width="${c.circleWidth}"${cellAttr}>\n`;
      const P = sh.shape.chain.map(cr => centre(...cr, o));
      for (const [cx, cy] of P) out += `    <circle cx="${cx}" cy="${cy}" r="${rad}"${st === 'dashed' ? ` stroke-dasharray="${d.array}" stroke-dashoffset="${d.offset}"` : ''}/>\n`;
      for (let i = 1; i < P.length; i++) { const n = neckPath(...P[i - 1], ...P[i], rad); out += `    <path d="${n.sides[0].d}"${st === 'dashed' ? ` stroke-dasharray="${neckDash(n.sideLen)}"` : ''}/>\n`; }
      out += `  </g>\n`;
    }
    return out + `</svg>\n`;
  }

  // ---------- api ----------
  function update(partial) {
    Object.assign(c, partial);
    const keys = Object.keys(partial);
    const geo = keys.some(k => GEOMETRY.includes(k) && k !== 'cells');
    if (geo) render();
    else if ('cells' in partial) applyCells();
    else {
      svg.style.setProperty('--pen', palette()[0]);
      if ('color' in partial || 'colors' in partial || 'colorMix' in partial) {
        const P = palette();
        anim.pens.forEach((pen, i) => {
          if (c.colorMix !== 'chain') { pen.color = c.colorMix === 'trail' ? P[0] : P[i % P.length]; pen.head.style.fill = pen.color; }
          for (const sh of [pen.shape, ...pen.olds.map(o => o.sh)]) if (sh) { if (c.colorMix !== 'chain') sh.color = pen.color; sh.g.style.setProperty('--pen', sh.color); }
        });
      }
    }
    if ('pens' in partial) syncPens();
    if ('showDots' in partial) svg.classList.toggle('sq-nodots', !c.showDots);
    if ('backdrop' in partial || 'backdropOpacity' in partial) { if ('backdrop' in partial) render(); else backdrop.style.opacity = c.backdropOpacity / 100; }
    if (keys.some(k => k.startsWith('flicker'))) scheduleFlicker();
    if (keys.some(k => k.startsWith('grow'))) { growFullAt = 0; scheduleGrow(); }
    if ('mode' in partial) for (const pen of anim.pens) if (pen.shape) { unclaim(pen.shape.shape); dropShape(pen.shape); pen.shape = null; pen.phase = 'draw'; pen.waitUntil = performance.now(); }
  }
  const ro = new ResizeObserver(() => { const b = container.getBoundingClientRect(); W = b.width; H = b.height; render(); });
  ro.observe(container);
  const boot = () => { const b = container.getBoundingClientRect(); W = b.width; H = b.height; render(); if (c.autoplay) play(); scheduleFlicker(); scheduleGrow(); };
  boot();
  return {
    svg, config: c, layers: { preview: gPreview },
    update, play, pause, resume, toggle, stop, exportSvg, originPx, edgeDash, bbox, gridSize, toLocal, randomCells, get view() { return view; },
    get playing() { return anim.playing; }, get paused() { return anim.paused; }, get pens() { return anim.pens; }, get cellSet() { return cellSet; }, get spawned() { return spawned; },
    onChange(fn) { listeners.push(fn); },
    destroy() { stop(); clearTimeout(flickTimer); clearTimeout(growTimer); ro.disconnect(); container.removeEventListener('pointermove', onPointerMove); container.removeEventListener('pointerleave', onPointerLeave); svg.remove(); backdrop.remove(); }
  };
};
