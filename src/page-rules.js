/* Page rules: the rows where they turn, measured from the page as laid out. styles.css works
   them out for the 1440 layout (.page-rules: --rules-turn, --rules-dash, --rules-end), but
   below 1024 the hero, the logos and the features grow with their content, so here they're
   taken from the sections themselves, and again whenever the page's size changes:
   - --rules-dash: the dashed line along the foot of the logos (.proof's last row);
   - --rules-turn: 25px above it, where the outer pair turns out (the logo grid's foot);
   - --rules-end: the dashed line along the foot of the features (.statement's last row),
     where the inner pair turns out.
   Markup: .page-rules in index.html. Styles: .page-rules in styles.css. */
(function () {
  const rules = document.querySelector('.page-rules');
  const proof = document.querySelector('.proof'), statement = document.querySelector('.statement');
  if (!rules || !proof || !statement) return;

  // reading layout only, and writing to the overlay (which nothing observed depends on), so
  // it's safe to run straight from the observer
  function measure() {
    const top = rules.getBoundingClientRect().top; // the overlay's top: the page's
    const dash = Math.round(proof.getBoundingClientRect().bottom - top) - 1;
    const end = Math.round(statement.getBoundingClientRect().bottom - top) - 1;
    rules.style.setProperty('--rules-turn', dash - 25 + 'px');
    rules.style.setProperty('--rules-dash', dash + 'px');
    rules.style.setProperty('--rules-end', end + 'px');
  }

  measure();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(measure);
    [document.body, document.querySelector('.hero'), proof, statement].forEach(el => { if (el) ro.observe(el); });
  } else {
    addEventListener('resize', measure);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
