/* Breakpoints helper (Tailwind's defaults), as Access Grid's bp.js: range(from, to) gives a
   MediaQueryList for [from, to), up(bp) for >= bp, down(bp) for < bp. hero-grid.js reads it. */
(function () {
  const BP = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
  const px = k => (typeof k === 'number' ? k : BP[k]);
  window.AGBreakpoints = {
    values: BP,
    up: k => window.matchMedia(`(min-width: ${px(k)}px)`),
    down: k => window.matchMedia(`(max-width: ${px(k) - 0.02}px)`),
    range: (a, b) => window.matchMedia(`(min-width: ${px(a)}px) and (max-width: ${px(b) - 0.02}px)`)
  };
})();
