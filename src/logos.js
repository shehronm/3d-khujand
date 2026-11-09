/* Logo cloud swaps, the way clerk.com's logo cloud moves. Every few seconds half the
   cells change their logo one after another, in a zigzag across the two rows (top-left,
   then second row second column, then top middle, and so on). The grid is two rows of
   five, or of four at md and lg (768–1279px, where the last two cells sit out: styles.css), or
   two by two on phones (under 768px: the first four cells only). In each cell the logo
   slides up and out while the next one slides up into its place, on a slow-in, fast,
   long-settle curve; a mask fades them in and out near the cell's middle, so you only
   ever see the one in the centre. Rounds alternate between that zigzag and the other
   half. No logo is ever on the grid twice: a cell only takes one that no showing cell has
   and that isn't still leaving another, so a round changes as many cells as there are
   logos to spare, taking turns round its zigzag. Settings live in LOGO
   (window.AGLogos.config). */
(function () {
  // Rails: the logos ({ key, name, src, w, h }) come from the grid's data-logos, set in
  // static/homepage/_proof.html.erb, since the asset pipeline fingerprints the file names
  var logoGrid = document.querySelector('.proof__grid');
  var LOGOS = logoGrid ? JSON.parse(logoGrid.dataset.logos || '[]') : [];
  var LOGO = {
    every: 3600,                           // ms from one round to the next
    stagger: 100,                          // ms between one cell and the next in a round
    duration: 1000,                        // ms a change takes
    easing: 'cubic-bezier(0.8, 0, 0.15, 1)', // clerk.com's curve: slow to leave, quick through, long settle
    travel: 56,                            // px each logo moves: one slot
    solid: 16,                             // px either side of the cell's middle where a logo is fully visible
    clear: 40,                             // px either side where it has faded to nothing
    alternate: true                        // rounds take turns: the zigzag, then the other five cells
  };
  // the cells in the order they change, as indexes into the grid, for five columns and for
  // four: the zigzag from the top-left, and its mirror for the alternate rounds
  var ORDERS = {
    5: [[0, 6, 2, 8, 4], [5, 1, 7, 3, 9]],
    4: [[0, 5, 2, 7], [4, 1, 6, 3]],
    2: [[0, 3], [1, 2]]                   // phones (under 768px): two by two, corner to corner
  };
  var BP = window.AGBreakpoints; // bp.js
  var four = BP.range('md', 'xl'); // 768–1279px
  var two = BP.range(null, 'md');  // under 768px
  function cols() { return two.matches ? 2 : four.matches ? 4 : 5; } // the grid's columns, for the order and the cells that show

  var cells = Array.prototype.slice.call(document.querySelectorAll('.proof__cell'));
  if (!cells.length) return;
  var grid = cells[0].parentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  // swaps rest while the logo strip is scrolled away
  var onScreen = true;
  var strip = document.querySelector('.proof');
  if (strip) new IntersectionObserver(function (entries) {
    onScreen = entries[entries.length - 1].isIntersecting;
  }, { rootMargin: '120px' }).observe(strip);

  // each cell's logo goes into a masked slot, where the old and new logos stack while they pass
  cells.forEach(function (cell) {
    var img = cell.querySelector('.proof__logo');
    var m = img && /proof__logo--([\w-]+)/.exec(img.className); // keys can have hyphens (lenel-s2)
    cell.dataset.logo = m ? m[1] : '';
    var slot = document.createElement('span');
    slot.className = 'proof__slot';
    var wrap = cell.querySelector('.proof__logo-wrap');
    if (wrap) slot.appendChild(wrap);
    cell.appendChild(slot);
  });
  function applyMask() {
    grid.style.setProperty('--logo-solid', LOGO.solid + 'px');
    grid.style.setProperty('--logo-clear', Math.max(LOGO.solid + 1, LOGO.clear) + 'px');
  }
  applyMask();

  function build(logo) {
    var wrap = document.createElement('span');
    wrap.className = 'proof__logo-wrap';
    var img = document.createElement('img');
    img.className = 'proof__logo proof__logo--' + logo.key;
    img.src = logo.src; img.width = logo.w; img.height = logo.h; img.alt = '';
    wrap.appendChild(img);
    return wrap;
  }
  LOGOS.forEach(function (l) { var i = new Image(); i.src = l.src; }); // ready before the first change

  // how many cells show: two rows of the grid's columns; the rest sit out
  function shown() { return Math.min(cells.length, cols() * 2); }
  // the logos free to come in: none a showing cell has (the changing one's included) or one
  // still sliding out of a cell, so no logo is ever on the grid twice
  var leaving = {};
  function unused() {
    var on = cells.slice(0, shown()).map(function (cell) { return cell.dataset.logo; });
    return LOGOS.filter(function (l) { return on.indexOf(l.key) < 0 && !leaving[l.key]; });
  }
  function pick() { var pool = unused(); return pool[Math.floor(Math.random() * pool.length)]; }

  function swap(index) {
    var cell = cells[index];
    if (!cell) return;
    var slot = cell.querySelector('.proof__slot');
    var wraps = slot.querySelectorAll('.proof__logo-wrap');
    if (wraps.length !== 1) return; // still changing
    var old = wraps[0], logo = pick();
    if (!logo) return; // none to spare
    var next = build(logo), gone = cell.dataset.logo;
    leaving[gone] = true; // not for another cell until it's out of this one
    slot.appendChild(next);
    cell.dataset.logo = logo.key;
    cell.setAttribute('aria-label', logo.name);
    var timing = { duration: LOGO.duration, easing: LOGO.easing };
    var leave, enter;
    if (reduce.matches) {
      // no movement: a short crossfade
      leave = [{ opacity: 1 }, { opacity: 0 }]; enter = [{ opacity: 0 }, { opacity: 1 }];
      timing = { duration: 300, easing: 'ease' };
    } else {
      leave = [{ transform: 'translateY(0)' }, { transform: 'translateY(' + -LOGO.travel + 'px)' }];
      enter = [{ transform: 'translateY(' + LOGO.travel + 'px)' }, { transform: 'translateY(0)' }];
    }
    var out = function () { old.remove(); delete leaving[gone]; };
    old.animate(leave, Object.assign({ fill: 'forwards' }, timing)).finished.then(out, out);
    next.animate(enter, timing);
  }

  // a round changes as many of its cells as there are logos to spare (with ten showing, the
  // three left over), carrying on round its zigzag next time, so every cell gets its turn
  var turn = 0, from = {};
  function round() {
    if (document.hidden || !onScreen) return;
    var c = cols(), orders = ORDERS[c], o = LOGO.alternate ? turn % orders.length : 0;
    var order = orders[o].filter(function (i) { return i < shown(); });
    turn++;
    var n = Math.min(order.length, unused().length), at = from[c + ':' + o] || 0;
    from[c + ':' + o] = (at + n) % order.length;
    for (var k = 0; k < n; k++) (function (index, k) {
      window.setTimeout(function () { swap(index); }, k * LOGO.stagger);
    })(order[(at + k) % order.length], k);
  }

  // a wider layout brings back cells that sat out, and one may have a logo another cell has
  // taken since: it changes straight away to one that isn't showing
  function dedupe() {
    var seen = {};
    cells.slice(0, shown()).forEach(function (cell) {
      if (seen[cell.dataset.logo]) {
        var logo = pick();
        if (!logo) return;
        var slot = cell.querySelector('.proof__slot');
        slot.textContent = '';
        slot.appendChild(build(logo));
        cell.dataset.logo = logo.key;
        cell.setAttribute('aria-label', logo.name);
      }
      seen[cell.dataset.logo] = true;
    });
  }
  [four, two].forEach(function (mq) { if (mq.addEventListener) mq.addEventListener('change', dedupe); });
  dedupe();

  // self-rescheduling, so a changed interval takes effect on the next round
  (function loop() { window.setTimeout(function () { round(); loop(); }, Math.max(600, LOGO.every)); })();

  window.AGLogos = {
    swap: swap, round: round, cells: cells, applyMask: applyMask,
    config: LOGO, defaults: JSON.parse(JSON.stringify(LOGO))
  };
})();
