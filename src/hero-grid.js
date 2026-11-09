/* Hero grid. A pattern of dashed 80px squares sits to the left of the phone and out past its
   right from page load (Figma 5520:16705: twenty-nine squares, eight columns by six rows,
   the middle ones behind the phone). As the phone lands, one circular pulse of the same
   squares runs out from behind it and fades, a few of them flashing a faint fill. Only once
   it has gone do pens start tracing L shapes through the pattern (the squares runtime,
   squares-runtime.js, as in the earlier hero).
   Styles: .hero__grid, .hero__pens. Settings live in GRID (window.AGHeroGrid.config). */
(function () {
  const hero = document.querySelector('.hero');
  const device = hero && hero.querySelector('.hero__device');
  if (!device) return;

  const GRID = {
    size: 80,        // cell size, px
    radius: 7.5,     // how far the pulse travels, in cells from the centre cell
    lead: 200,       // ms before the phone's tap that the pulse starts
    from: 2,         // cells from the centre where the ring starts: the phone's edge, so the pulse
                     // is already showing as the phone lands (nearer squares are hidden behind it)
    rings: 1,        // how many rings go out
    gap: 480,        // ms between rings, if more than one
    step: 120,       // ms a ring takes to travel one cell outward
    life: 420,       // ms a square takes to appear and fade as a ring passes
    peakAt: 0.3,     // share of that life where the square is brightest
    fade: 0.75,      // how much dimmer the ring is at the circle's edge than at the centre (0 = none)
    centreY: 258,    // the pulse's centre, px down from the phone's top (middle of its visible part)
    fillChance: 0.3, // share of the pulse's squares that also flash a fill as the ring passes
    fillOpacity: [0.01, 0.05], // …in black, each at a random opacity in this range
    // the pattern that is always there, as [column, row] from the centre cell (column 0 is
    // under the middle of the phone; −2…1 are behind it; rows count down).
    // Figma 5520:16705, its eight columns mapped to −4…3 and its six rows to −3…2
    keep: [
      [-5, -3], [-4, -3], [-3, -3], [0, -3], [1, -3], [2, -3],
      [-5, -2], [-4, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2],
      [-5, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
      [-5, 0], [-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
      [-5, 1], [-4, 1], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
      [-4, 2], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2]
    ],
    keepOpacity: 1,     // how strong the pattern's squares are
    // once the pens are running the pattern keeps changing: every so often a square is drawn
    // in beside it, from a corner that touches another square, or one is drawn back out
    shift: false,
    shiftEvery: [2200, 3800], // ms between changes, a random wait in this range
    shiftDraw: 800,           // ms a square takes to draw in or out
    shiftSpan: 3,             // how many squares more or fewer than the Figma pattern it may drift
    pensDelay: 250,     // ms after the pulse has left before the pens start
    // the pens (squares runtime settings): dashed circle-and-bridge shapes in the grid grey
    pens: {
      size: 80, lineWidth: 1.25, gridStyle: 'dashed', gridColor: 'transparent',
      dash: 4, gap: 4,
      circleSize: 40, circleWidth: 1.25, neck: 35, curve: 70,
      strokeStyle: 'dashed', color: '#0060FF', colors: ['#0060FF', '#285DF5'], colorMix: 'pen',
      loop: true, pens: 3, length: 3, speed: 340, trail: 380, fullTrail: false, showDots: true,
      mode: 'l',
      hold: 800, pauseNext: 400, exit: 'wipe', exitDur: 900, next: 'anywhere',
      grow: false, hover: false, flicker: false, center: true, autoplay: false, frame: false
    }
  };
  const defaults = JSON.parse(JSON.stringify(GRID));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'hero__grid');
  svg.setAttribute('aria-hidden', 'true');
  hero.appendChild(svg);
  const pensBox = document.createElement('div');
  pensBox.className = 'hero__pens';
  pensBox.setAttribute('aria-hidden', 'true');
  hero.appendChild(pensBox);
  let pens = null, pensTimer = 0, shiftTimer = 0;
  let heroOnScreen = true, shiftLayout = null;
  let live = [], base = 0, bounds = null, penCells = []; // the pattern as it stands, and what the pens may use
  const cellEls = new Map();

  // Extract unique horizontal and vertical edges so dashes flow without overlapping duplicates
  function getUniqueEdges(cells) {
    const horiz = new Map();
    const vert = new Map();
    const S = GRID.size;

    cells.forEach(([c, r]) => {
      // Top horizontal edge
      const hk1 = c + ',' + r;
      if (!horiz.has(hk1)) horiz.set(hk1, { c, r, x1: c * S + 0.5, y1: r * S + 0.5, x2: (c + 1) * S + 0.5, y2: r * S + 0.5 });

      // Bottom horizontal edge
      const hk2 = c + ',' + (r + 1);
      if (!horiz.has(hk2)) horiz.set(hk2, { c, r: r + 1, x1: c * S + 0.5, y1: (r + 1) * S + 0.5, x2: (c + 1) * S + 0.5, y2: (r + 1) * S + 0.5 });

      // Left vertical edge
      const vk1 = c + ',' + r;
      if (!vert.has(vk1)) vert.set(vk1, { c, r, x1: c * S + 0.5, y1: r * S + 0.5, x2: c * S + 0.5, y2: (r + 1) * S + 0.5 });

      // Right vertical edge
      const vk2 = (c + 1) + ',' + r;
      if (!vert.has(vk2)) vert.set(vk2, { c: c + 1, r, x1: (c + 1) * S + 0.5, y1: r * S + 0.5, x2: (c + 1) * S + 0.5, y2: (r + 1) * S + 0.5 });
    });

    return { horiz: Array.from(horiz.values()), vert: Array.from(vert.values()) };
  }

  // Each edge moves in its assigned direction: down, left, right, or up
  function createEdge(edge, isVertical) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', edge.x1);
    line.setAttribute('y1', edge.y1);
    line.setAttribute('x2', edge.x2);
    line.setAttribute('y2', edge.y2);

    const speeds = ['3.2s', '3.8s', '4.4s', '5.2s', '6.0s'];
    let dirClass = '';
    let speed = '4s';

    if (!isVertical) {
      // Horizontal edge: right or left
      const goRight = (edge.r + Math.abs(edge.c)) % 2 === 0;
      dirClass = goRight ? 'hero__edge--right' : 'hero__edge--left';
      speed = speeds[Math.abs(edge.c * 3 + edge.r * 7) % speeds.length];
    } else {
      // Vertical edge: down or up
      const goDown = (edge.c + Math.abs(edge.r)) % 2 === 0;
      dirClass = goDown ? 'hero__edge--down' : 'hero__edge--up';
      speed = speeds[Math.abs(edge.c * 7 + edge.r * 3) % speeds.length];
    }

    line.setAttribute('class', 'hero__edge ' + dirClass);
    line.style.setProperty('--speed', speed);
    if (edge.r < 0) line.setAttribute('data-up', '');
    return line;
  }

  function cellPath(c, r) {
    const S = GRID.size, x = c * S + 0.5, y = r * S + 0.5;
    const cell = document.createElementNS(NS, 'path');
    cell.setAttribute('d', `M${x} ${y}h${S}M${x} ${y + S}h${S}M${x} ${y}v${S}M${x + S} ${y}v${S}`);
    cell.setAttribute('class', 'hero__cell');
    if (r < 0) cell.setAttribute('data-up', '');
    return cell;
  }

  function fillRect(c, r) {
    const S = GRID.size, rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', c * S + 0.5); rect.setAttribute('y', r * S + 0.5);
    rect.setAttribute('width', S); rect.setAttribute('height', S);
    rect.setAttribute('class', 'hero__fill');
    const o = GRID.fillOpacity, lo = Array.isArray(o) ? o[0] : o, hi = Array.isArray(o) ? o[1] : o;
    rect.setAttribute('fill-opacity', (lo + Math.random() * (hi - lo)).toFixed(3));
    if (r < 0) rect.setAttribute('data-up', '');
    return rect;
  }

  // Draw the moving dashed edges across the kept cells
  function drawPattern(keep) {
    svg.querySelectorAll('.hero__edges-group, .hero__edge').forEach(el => el.remove());
    cellEls.clear();
    live = keep.map(k => k.slice());

    const { horiz, vert } = getUniqueEdges(keep);
    const gEdges = document.createElementNS(NS, 'g');
    gEdges.setAttribute('class', 'hero__edges-group');

    horiz.forEach(edge => {
      const el = createEdge(edge, false);
      gEdges.appendChild(el);
    });
    vert.forEach(edge => {
      const el = createEdge(edge, true);
      gEdges.appendChild(el);
    });

    svg.appendChild(gEdges);
  }
  // ---- the pattern shifting: squares drawn in and out ----
  // a square shows if its middle is clear of the phone
  function shows(layout, c) {
    const S = GRID.size, h = hero.getBoundingClientRect(), p = device.getBoundingClientRect();
    const mid = layout.x0 + c * S + S / 2;
    return mid <= p.left - h.left || mid >= p.right - h.left;
  }
  // the corners of a square ([dx, dy], 0 or 1) that touch another square of the pattern
  function touching(c, r, has) {
    return [[0, 0], [1, 0], [0, 1], [1, 1]].filter(([dx, dy]) => {
      const cs = [c - 1 + dx, c + dx], rs = [r - 1 + dy, r + dy];
      return cs.some(cc => rs.some(rr => (cc !== c || rr !== r) && has.has(cc + ',' + rr)));
    });
  }
  // draws a square's outline out from a corner, both ways round to the opposite one (or
  // back again): a mask of two solid strokes uncovers the dashed square beneath
  function sweep(cell, c, r, corner, out) {
    const S = GRID.size, x = c * S + 0.5, y = r * S + 0.5;
    const sx = x + corner[0] * S, sy = y + corner[1] * S, ex = corner[0] ? -S : S, ey = corner[1] ? -S : S;
    const mask = document.createElementNS(NS, 'mask'), id = 'hg' + Math.random().toString(36).slice(2, 9);
    mask.setAttribute('id', id); mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', x - 4); mask.setAttribute('y', y - 4); mask.setAttribute('width', S + 8); mask.setAttribute('height', S + 8);
    const runs = [`M${sx} ${sy}h${ex}v${ey}`, `M${sx} ${sy}v${ey}h${ex}`].map(d => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('pathLength', 1);
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', 5);
      p.setAttribute('stroke-dasharray', '1 2'); p.setAttribute('stroke-dashoffset', out ? 0 : 1);
      mask.appendChild(p);
      return p.animate([{ strokeDashoffset: out ? 0 : 1 }, { strokeDashoffset: out ? 1 : 0 }],
        { duration: GRID.shiftDraw, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
    });
    svg.appendChild(mask);
    cell.setAttribute('mask', `url(#${id})`);
    return runs[0].finished.then(() => { mask.remove(); if (!out) cell.removeAttribute('mask'); }, () => {});
  }
  // squares a pen is drawing on, or has left a shape on
  function busy() {
    const used = new Set();
    if (pens) pens.pens.forEach(p => [p.shape].concat(p.olds.map(o => o.sh)).forEach(sh => { if (sh) sh.shape.cells.forEach(k => used.add(k)); }));
    return used;
  }
  const pick = list => list[Math.floor(Math.random() * list.length)];
  function shift(layout) {
    const S = GRID.size, has = new Set(live.map(k => k.join(',')));
    const seen = live.filter(([c]) => shows(layout, c)).length;
    const inside = (c, r) => c >= bounds.c0 && c <= bounds.c1 && r >= bounds.r0 && r <= bounds.r1 &&
      (c + 1) * S <= layout.edge && layout.x0 + c * S >= layout.copyRight + 8 && shows(layout, c);
    const adds = [];
    for (let r = bounds.r0; r <= bounds.r1; r++) for (let c = bounds.c0; c <= bounds.c1; c++) {
      if (has.has(c + ',' + r) || !inside(c, r)) continue;
      const corners = touching(c, r, has);
      if (corners.length) adds.push([c, r, corners]);
    }
    const used = busy();
    const drops = live.filter(([c, r]) => {
      if (!shows(layout, c) || used.has(c + ',' + r)) return false;
      // the pens' stage is fitted to the squares they use: never take the last one on a side
      const rest = penCells.filter(k => k[0] !== c || k[1] !== r);
      return ['0', '1'].every(i => Math.min(...rest.map(k => k[i])) === Math.min(...penCells.map(k => k[i])) &&
        Math.max(...rest.map(k => k[i])) === Math.max(...penCells.map(k => k[i])));
    }).map(([c, r]) => { has.delete(c + ',' + r); const corners = touching(c, r, has); has.add(c + ',' + r); return [c, r, corners]; })
      .filter(d => d[2].length);
    let add = Math.random() < 0.5;
    if (seen >= base + GRID.shiftSpan || !adds.length) add = false;
    if (seen <= base - GRID.shiftSpan || !drops.length) add = true;
    if (add && adds.length) {
      const [c, r, corners] = pick(adds), cell = cellPath(c, r);
      cell.style.opacity = GRID.keepOpacity;
      svg.appendChild(cell); cellEls.set(c + ',' + r, cell); live.push([c, r]);
      const mine = pens;
      sweep(cell, c, r, pick(corners), false).then(() => {     // drawn: the pens may use it
        if (pens !== mine || !pens) return;
        penCells.push([c, r]); pens.update({ cells: penCells.slice() });
      });
    } else if (!add && drops.length) {
      const [c, r, corners] = pick(drops), k = c + ',' + r, cell = cellEls.get(k);
      live = live.filter(q => q[0] !== c || q[1] !== r); cellEls.delete(k);
      penCells = penCells.filter(q => q[0] !== c || q[1] !== r);
      if (pens) pens.update({ cells: penCells.slice() });      // off the pens' list before it goes
      sweep(cell, c, r, pick(corners), true).then(() => cell.remove());
    }
  }
  function startShift(layout) {
    shiftLayout = layout;
    clearTimeout(shiftTimer);
    if (!GRID.shift || reduce.matches) return;
    const [lo, hi] = GRID.shiftEvery;
    const tick = () => { if (!document.hidden && heroOnScreen) shift(layout); shiftTimer = setTimeout(tick, lo + Math.random() * (hi - lo)); };
    shiftTimer = setTimeout(tick, lo + Math.random() * (hi - lo));
  }

  // the squares that stay, for this layout: none when the phone is stacked under the copy;
  // otherwise those inside the page rule and clear of the copy on the left
  function kept(layout) {
    if (layout.stacked) return [];
    const S = GRID.size;
    // Inside page rule edge and clear of upper nav bar
    return GRID.keep.filter(([c, r]) => (c + 1) * S <= layout.edge && layout.y0 + r * S >= 40);
  }

  function stopPens() {
    clearTimeout(pensTimer); pensTimer = 0;
    clearTimeout(shiftTimer); shiftTimer = 0;
    if (pens) { pens.destroy(); pens = null; }
    pensBox.replaceChildren();
  }
  // the pens' stage covers exactly the kept squares' bounding box; the runtime centres that
  // box in its container, so its grid lands on ours
  function startPens(layout, cells, delay) {
    stopPens();
    // only the squares that show: a pen drawing behind the phone would never be seen
    cells = cells.filter(([c]) => shows(layout, c));
    if (!cells.length || reduce.matches || !window.SquaresPattern) return;
    const S = GRID.size;
    const cs = cells.map(k => k[0]), rs = cells.map(k => k[1]);
    const c0 = Math.min(...cs), c1 = Math.max(...cs), r0 = Math.min(...rs), r1 = Math.max(...rs);
    pensBox.style.left = layout.x0 + c0 * S + 'px';
    pensBox.style.top = layout.y0 + r0 * S + 'px';
    pensBox.style.width = (c1 - c0 + 1) * S + 'px';
    pensBox.style.height = (r1 - r0 + 1) * S + 'px';
    penCells = cells.map(k => k.slice()); base = cells.length;
    bounds = { c0: c0, c1: c1, r0: r0, r1: r1 };
    pensTimer = setTimeout(() => {
      svg.querySelectorAll('[data-pulse]').forEach(el => el.remove()); // the pulse has gone: clear its squares
      pens = window.SquaresPattern(pensBox, Object.assign({}, GRID.pens, { cells: penCells.slice() }));
      pens.play();
      if (!heroOnScreen) pens.pause();
      startShift(layout);
    }, Math.max(0, delay));
  }

  // The pattern is drawn at once. The phone taps `wait` ms from now, and the ring leaves
  // `lead` ms ahead of that: every other square in the circle lights as it passes and
  // fades, and some flash a fill. The pens follow once the ring has gone.
  function play(wait) {
    const S = GRID.size, R = GRID.radius, n = Math.ceil(R);
    svg.setAttribute('width', S);
    svg.setAttribute('height', S);
    const layout = place();
    const keep = kept(layout), isKept = new Set(keep.map(k => k.join(',')));
    stopPens();
    drawPattern(keep);
    if (reduce.matches) return;                  // the pattern, still: no pulse, no pens
    const start = Math.max(0, (wait || 0) - GRID.lead);
    for (let r = -n; r <= n; r++) {
      for (let c = -n; c <= n; c++) {
        const d = Math.hypot(c, r);
        if (d > R) continue;                     // outside the circle
        if ((c + 1) * S > layout.edge) continue; // past the page rule
        const peak = 1 - GRID.fade * (d / R);
        const parts = [];
        if (Math.random() < GRID.fillChance) parts.push([fillRect(c, r), 1]);
        if (!isKept.has(c + ',' + r)) parts.push([cellPath(c, r), peak]); // the pattern's own squares are already lit
        parts.forEach(([el, top]) => {
          el.setAttribute('data-pulse', '');
          svg.insertBefore(el, svg.firstChild);  // under the pattern
          for (let i = 0; i < GRID.rings; i++) {
            el.animate(
              [{ opacity: 0 }, { opacity: top, offset: GRID.peakAt }, { opacity: 0 }],
              { delay: start + i * GRID.gap + Math.max(0, d - GRID.from) * GRID.step, duration: GRID.life, easing: 'ease-out' }
            );
          }
        });
      }
    }
    const gone = start + (GRID.rings - 1) * GRID.gap + Math.max(0, R - GRID.from) * GRID.step + GRID.life;
    startPens(layout, keep, gone + GRID.pensDelay);
  }

  // after a resize: the pattern at rest, with the pens running
  function settle(layout, keep) {
    drawPattern(keep);
    startPens(layout, keep, 0);
  }

  // The centre cell sits under the middle of the phone: on grid lines counted up from the
  // hero's bottom edge in whole cells, and across so that a grid line falls on the right
  // page rule (at lg, 1024–1279px, where the phone is centred in the room beside the copy,
  // on the phone's middle exactly instead). `edge` is how far right of the centre cell's
  // left edge the squares may run.
  const lg = window.AGBreakpoints.range('lg', 'xl'); // 1024–1279px (bp.js)
  function place() {
    const S = GRID.size;
    const h = hero.getBoundingClientRect(), d = device.getBoundingClientRect();
    const stacked = getComputedStyle(device).position !== 'absolute';
    const cy = d.top - h.top + GRID.centreY;
    let x0 = Math.round(d.left - h.left + d.width / 2 - S / 2), edge = Infinity;
    if (!stacked) {
      // Rails: the hero's page box is .hero__inner (Tailwind's .container means something else here)
      const box = hero.querySelector('.hero__inner').getBoundingClientRect();
      const ruleX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rule-x')) || 88;
      const rule = Math.round(box.right - h.left - ruleX); // the right page rule
      if (!lg.matches) x0 = rule - S * Math.round((rule - x0) / S);
      edge = rule - x0;
    }
    const y0 = Math.round(h.height - S * Math.ceil((h.height - cy) / S));
    svg.style.left = x0 + 'px';
    svg.style.top = y0 + 'px';
    // stacked layout: the copy is above the phone, so nothing is drawn above the centre row
    svg.classList.toggle('hero__grid--stacked', stacked);
    const lede = hero.querySelector('.hero__lede');
    const copyRight = lede ? lede.getBoundingClientRect().right - h.left : 0;
    return { x0: x0, y0: y0, edge: edge, stacked: stacked, copyRight: copyRight };
  }

  // after a resize (or the fonts landing) the grid may have moved: redraw it at rest
  let resizeTimer = 0, width = window.innerWidth;
  function relayout() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (svg.getAnimations({ subtree: true }).some(a => a.playState === 'running')) { place(); return; } // mid-pulse: leave it
      const layout = place(); settle(layout, kept(layout));
    }, 160);
  }

  // the pens and the shifting pattern rest while the hero is scrolled away
  new IntersectionObserver(entries => {
    heroOnScreen = entries[entries.length - 1].isIntersecting;
    if (!pens) return;
    if (heroOnScreen) pens.resume(); else pens.pause();
  }, { rootMargin: '120px' }).observe(hero);

  // the setting can change mid-visit: on, the pens and the shifting stop and the pattern
  // rests; off, they start again from the pattern at rest
  if (reduce.addEventListener) reduce.addEventListener('change', () => {
    const layout = place(); settle(layout, kept(layout));
  });

  window.AGHeroGrid = { config: GRID, defaults: defaults, play: play };
  play(window.AGPhone ? window.AGPhone.tapIn() : 1000); // starts as the phone taps
  window.addEventListener('resize', () => { if (window.innerWidth !== width) { width = window.innerWidth; relayout(); } });
})();
