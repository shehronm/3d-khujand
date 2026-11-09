/* Hero Awakening 3D Grid Engine.
   - Spans across the entire hero background.
   - Base dashed blueprint grid.
   - Cells randomly 'wake up' in 3D:
     1. Cell lifts up in 3D, revealing a dark black cavity underneath ('видно черное').
     2. A dashed line branches out from its corners and travels along the grid lines.
     3. As the line travels, the dark cavity underneath dissolves away ('черное место исчезает'), and the cell lowers back down.
   - No circular wave pulse.
*/
(function () {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const NS = 'http://www.w3.org/2000/svg';
  const S = 80; // 80px cell size

  hero.querySelectorAll('.hero__grid, .hero__pens').forEach(el => el.remove());

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'hero__grid');
  svg.setAttribute('aria-hidden', 'true');

  hero.insertBefore(svg, hero.firstChild);

  // Group layers
  const gBase = document.createElementNS(NS, 'g');
  gBase.setAttribute('class', 'hero__layer-base');

  const gShadows = document.createElementNS(NS, 'g');
  gShadows.setAttribute('class', 'hero__layer-shadows');

  const gLifts = document.createElementNS(NS, 'g');
  gLifts.setAttribute('class', 'hero__layer-lifts');

  const gFlows = document.createElementNS(NS, 'g');
  gFlows.setAttribute('class', 'hero__layer-flows');

  svg.append(gBase, gShadows, gLifts, gFlows);

  let width = 0, height = 0, cols = 0, rows = 0;
  let offsetX = 0;
  const activeCells = new Set();
  let spawnTimer = 0;
  let isRunning = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function measure() {
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    // Align grid to page rule (var(--rule-x) ~ 88px)
    const ruleX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rule-x')) || 88;
    offsetX = Math.round(ruleX % S);

    cols = Math.ceil(width / S) + 1;
    rows = Math.ceil(height / S) + 1;

    renderBaseGrid();
  }

  function renderBaseGrid() {
    gBase.replaceChildren();
    let d = '';

    // Horizontal lines across full width
    for (let r = 0; r <= rows; r++) {
      const y = r * S + 0.5;
      d += `M0 ${y}H${width}`;
    }

    // Vertical lines across full height
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * S + 0.5;
      if (x <= width) {
        d += `M${x} 0V${height}`;
      }
    }

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'hero__grid-base');
    gBase.appendChild(path);
  }

  // Waking up a cell in 3D:
  // 1. Cell lifts up in 3D, revealing a black cavity underneath ("видно черное")
  // 2. A dashed line starts traveling along the grid
  // 3. As the line moves away, the dark cavity fades out ("черное место исчезает") and cell lowers
  function spawnAwakening() {
    if (!isRunning || document.hidden || cols < 3 || rows < 3 || reduce.matches || activeCells.size >= 3) return;

    // Pick random cell across the hero (avoid window edges)
    const c = Math.floor(1 + Math.random() * (cols - 3));
    const r = Math.floor(1 + Math.random() * (rows - 2));
    const cellKey = `${c},${r}`;

    if (activeCells.has(cellKey)) return;
    activeCells.add(cellKey);

    const x = offsetX + c * S;
    const y = r * S;

    // 1. Black cavity / shadow underneath ("видно черное")
    const shadow = document.createElementNS(NS, 'rect');
    shadow.setAttribute('x', x + 1.5);
    shadow.setAttribute('y', y + 1.5);
    shadow.setAttribute('width', S - 3);
    shadow.setAttribute('height', S - 3);
    shadow.setAttribute('rx', '4');
    shadow.setAttribute('class', 'hero__cell-shadow');
    shadow.style.fill = '#0a0d16';
    gShadows.appendChild(shadow);

    // 2. 3D lifted cell frame ("поднимается вверх")
    const lift = document.createElementNS(NS, 'rect');
    lift.setAttribute('x', x);
    lift.setAttribute('y', y);
    lift.setAttribute('width', S);
    lift.setAttribute('height', S);
    lift.setAttribute('rx', '4');
    lift.setAttribute('class', 'hero__cell-lift');
    gLifts.appendChild(lift);

    // Animate 3D lift & dark shadow appearance, then dissolve ("черное место исчезает")
    shadow.animate([
      { opacity: 0 },
      { opacity: 0.35, offset: 0.28 },
      { opacity: 0.35, offset: 0.55 },
      { opacity: 0, offset: 1.0 }
    ], {
      duration: 3600,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      fill: 'forwards'
    });

    lift.animate([
      { transform: 'translate(0, 0) scale(1)', stroke: '#989dae', fillOpacity: 0 },
      { transform: 'translate(-6px, -10px) scale(1.02)', stroke: '#10131a', fillOpacity: 0.85, offset: 0.30 },
      { transform: 'translate(-6px, -10px) scale(1.02)', stroke: '#10131a', fillOpacity: 0.85, offset: 0.60 },
      { transform: 'translate(0, 0) scale(1)', stroke: '#989dae', fillOpacity: 0, offset: 1.0 }
    ], {
      duration: 3600,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      fill: 'forwards'
    });

    // 3. Traveling dashed line from this cell along grid tracks ("линия двигается")
    // Pick start corner of cell
    const startCorners = [
      { sx: x + S, sy: y },
      { sx: x, sy: y + S },
      { sx: x + S, sy: y + S },
      { sx: x, sy: y }
    ];
    const corner = startCorners[Math.floor(Math.random() * startCorners.length)];

    // Route along grid lines
    const dxSteps = Math.random() < 0.5 ? 2 : 3;
    const dySteps = Math.random() < 0.5 ? 1 : 2;
    const signX = Math.random() < 0.5 ? 1 : -1;
    const signY = Math.random() < 0.5 ? 1 : -1;

    const midX = Math.max(0, Math.min(width, corner.sx + signX * dxSteps * S));
    const endY = Math.max(0, Math.min(height, corner.sy + signY * dySteps * S));

    // PCB / CAD route: horizontal then 90° vertical
    const pathD = `M${corner.sx} ${corner.sy}H${midX}V${endY}`;

    const flowLine = document.createElementNS(NS, 'path');
    flowLine.setAttribute('d', pathD);
    flowLine.setAttribute('class', 'hero__flow-line');

    const accentColor = Math.random() < 0.7 ? '#0060FF' : '#1e222d';
    flowLine.style.stroke = accentColor;
    gFlows.appendChild(flowLine);

    // Glowing head dot
    const head = document.createElementNS(NS, 'circle');
    head.setAttribute('r', '3');
    head.setAttribute('class', 'hero__flow-head');
    head.style.fill = accentColor;
    head.setAttribute('cx', corner.sx);
    head.setAttribute('cy', corner.sy);
    gFlows.appendChild(head);

    const totalLen = flowLine.getTotalLength();
    flowLine.style.strokeDasharray = '5 4';
    flowLine.style.strokeDashoffset = totalLen;

    // Line drawing animation (starts 220ms after lift begins)
    flowLine.animate([
      { strokeDashoffset: totalLen, opacity: 0 },
      { strokeDashoffset: totalLen, opacity: 1, offset: 0.12 },
      { strokeDashoffset: 0, opacity: 1, offset: 0.80 },
      { strokeDashoffset: -25, opacity: 0, offset: 1.0 }
    ], {
      delay: 450,
      duration: 2900,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      fill: 'forwards'
    });

    const startTime = performance.now() + 450;
    const dur = 2900 * 0.80;
    function trackHead(t) {
      const elapsed = t - startTime;
      if (elapsed >= 0 && elapsed <= dur) {
        const p = flowLine.getPointAtLength((elapsed / dur) * totalLen);
        head.setAttribute('cx', p.x);
        head.setAttribute('cy', p.y);
        head.style.opacity = '1';
      } else if (elapsed > dur) {
        head.style.opacity = '0';
        return;
      } else {
        head.style.opacity = '0';
      }
      if (elapsed < 3100) requestAnimationFrame(trackHead);
    }
    requestAnimationFrame(trackHead);

    // Cleanup after animation completes smoothly
    setTimeout(() => {
      shadow.remove();
      lift.remove();
      flowLine.remove();
      head.remove();
      activeCells.delete(cellKey);
    }, 3800);
  }

  function schedule() {
    clearTimeout(spawnTimer);
    if (!isRunning) return;
    spawnAwakening();
    const wait = 1600 + Math.random() * 1000;
    spawnTimer = setTimeout(schedule, wait);
  }

  measure();
  window.addEventListener('resize', measure);

  new IntersectionObserver((entries) => {
    isRunning = entries[entries.length - 1].isIntersecting;
    if (isRunning) schedule();
    else clearTimeout(spawnTimer);
  }, { rootMargin: '100px' }).observe(hero);

  schedule();

  window.AGHeroGrid = { play: function () {} };
})();
