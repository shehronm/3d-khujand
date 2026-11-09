/* Partner logos (feature 2, Figma 5601:19337). Two columns of logo cells under the copy:
   every few seconds the left column snaps down one cell and, a beat later, the right one
   snaps up one cell, so the two slide past each other. Each column's logos repeat, and
   once a column has moved a whole set it jumps back by a set, which looks the same, so it
   runs forever. It rests while it is off screen or the tab is hidden. The logos show in one
   grey (ag-gray/600: a copy of each logo's shape, over it); hovering one shows its own colours.
   Markup: .intlogos in index.html. Styles: .intlogos* in styles.css.
   Settings live in STEP (window.AGIntLogos.config). */
(function () {
  const box = document.querySelector('.intlogos');
  if (!box || box.hidden) return;
  // Rails: each column's logos ({ name, src, h }: h its display height in px), in order down
  // the column, come from data-logo-columns (see static/homepage/_statement.html.erb)
  const COLUMNS = JSON.parse(box.dataset.logoColumns || '{}');
  const LEFT = COLUMNS.left || [];
  const RIGHT = COLUMNS.right || [];

  const STEP = {
    every: 2600,                              // ms from one step to the next
    duration: 450,                            // ms a step takes
    easing: 'cubic-bezier(0.8, 0, 0.15, 1)',  // a snap: slow to go, quick through, long settle
    lag: 120                                  // ms the right column follows the left by
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // the block's top on desktop: 24px under the column's copy, which grows and shrinks with
  // the column's width (styles.css --intlogos-top; stacked, the block is in the flow instead)
  const copy = box.parentElement && box.parentElement.querySelector('.feature__copy');
  function place() { if (copy) box.style.setProperty('--intlogos-top', (copy.offsetTop + copy.offsetHeight + 24) + 'px'); }
  place();
  if (copy && 'ResizeObserver' in window) new ResizeObserver(place).observe(copy);

  // dir: +1 moves the column down, -1 up. pitch: px from one cell to the next. top: where
  // the first cell sits at rest; the same for both, so their border lines line up across:
  // the top row starts on the block's top
  const columns = [
    { el: box.querySelector('.intlogos__col--left .intlogos__track'), logos: LEFT, pitch: 87, dir: 1, top: 0 },
    { el: box.querySelector('.intlogos__col--right .intlogos__track'), logos: RIGHT, pitch: 87, dir: -1, top: 0 }
  ];
  columns.forEach(col => {
    col.set = col.logos.length * col.pitch;
    // three sets, so the window is always covered wherever the column is in its loop
    for (let k = 0; k < 3; k++) col.logos.forEach(logo => {
      const cell = document.createElement('div');
      cell.className = 'intlogos__cell';
      const img = document.createElement('img');
      img.src = logo.src;
      img.alt = logo.name || '';
      img.style.height = logo.h + 'px';
      // the logo in its colours, and over it the same shape in grey (a mask of it), which goes on hover
      const wrap = document.createElement('span');
      wrap.className = 'intlogos__logo';
      const mono = document.createElement('span');
      mono.className = 'intlogos__mono';
      mono.style.setProperty('--logo', 'url("' + logo.src + '")');
      wrap.append(img, mono);
      cell.appendChild(wrap);
      col.el.appendChild(cell);
    });
    // a column moving down starts a set higher, so cells are ready above; at rest it shows
    // the Figma order, its first logo `top` px down
    col.el.style.top = (col.dir > 0 ? col.top - col.set : col.top) + 'px';
    col.offset = col.dir > 0 ? col.set : 0;
    col.el.style.transform = 'translateY(' + col.offset + 'px)';
  });

  function step(col) {
    let from = col.offset, to = from + col.dir * col.pitch;
    // a whole set moved: jump back by one (it looks identical) before the step
    if (col.dir > 0 && to > col.set) { from -= col.set; to -= col.set; }
    if (col.dir < 0 && to < -col.set) { from += col.set; to += col.set; }
    col.offset = to;
    const a = col.el.animate([{ transform: 'translateY(' + from + 'px)' }, { transform: 'translateY(' + to + 'px)' }],
      { duration: STEP.duration, easing: STEP.easing, fill: 'forwards' });
    a.finished.then(() => { col.el.style.transform = 'translateY(' + to + 'px)'; a.cancel(); }, () => {});
  }

  let onScreen = false;
  new IntersectionObserver(entries => { onScreen = entries[entries.length - 1].isIntersecting; }, { rootMargin: '120px' }).observe(box);
  function tick() {
    if (onScreen && !document.hidden && !reduce.matches) {
      step(columns[0]);
      setTimeout(() => step(columns[1]), STEP.lag);
    }
    setTimeout(tick, Math.max(STEP.duration + STEP.lag + 100, STEP.every));
  }
  setTimeout(tick, STEP.every);

  window.AGIntLogos = { config: STEP, columns: columns, step: () => { step(columns[0]); setTimeout(() => step(columns[1]), STEP.lag); } };
})();
