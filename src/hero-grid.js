/* Hero Static Dashed Blueprint Grid.
   - Spans across the entire hero background.
   - Clean, crisp dashed millimeter engineering/blueprint lines.
   - Completely static (no animation loops, no timers, zero CPU overhead).
*/
(function () {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const NS = 'http://www.w3.org/2000/svg';
  const S = 80; // 80px cell size

  // Clean up any legacy or duplicate grid elements
  hero.querySelectorAll('.hero__grid, .hero__pens').forEach(el => el.remove());

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'hero__grid');
  svg.setAttribute('aria-hidden', 'true');

  hero.insertBefore(svg, hero.firstChild);

  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', 'hero__grid-base');
  svg.appendChild(path);

  let width = 0, height = 0, cols = 0, rows = 0;
  let offsetX = 0;

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

    renderGrid();
  }

  function renderGrid() {
    let d = '';

    // Horizontal dashed lines across full hero width
    for (let r = 0; r <= rows; r++) {
      const y = r * S + 0.5;
      d += `M0 ${y}H${width}`;
    }

    // Vertical dashed lines across full hero height
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * S + 0.5;
      if (x <= width) {
        d += `M${x} 0V${height}`;
      }
    }

    path.setAttribute('d', d);
  }

  measure();
  window.addEventListener('resize', measure);

  // Backward compatibility hook for external callers
  window.AGHeroGrid = { play: function () {} };
})();
