/* Reader search: a multicolour pulse behind the field when it is clicked. Staggered rings
   of a blurred conic gradient expand out from the field's edges and fade, the gradient
   turning as they go; the field lifts a touch and catches a brief brand-blue ring.
   (Not in the second version, .readers--v2, whose field stretches instead.) Under the field,
   the readers' models drift up; typing narrows them to the matches, and hovering one shows
   its photo (below).
   Settings live in PULSE (window.AGReaders.pulse); (its live tuner is in archive/readers-tuner.js) */
(function () {
  var box = document.querySelector('.readers');
  var field = box && box.querySelector('.readers__search');
  // rings live on the feature grid, not in the reader frame: the frame and its column
  // both clip and fade their contents, and a ring has to spill past the field
  var stage = box && box.closest('.features');
  if (!box || !field || !stage) return;

  var PULSE = {
    colors: ['#8EBFFF', '#3275FF', '#599BFF', '#285DF5', '#8EBFFF'], // around the ring, the brand blues 300 to 600 (300, 500, 400, 600); repeat the first to close the loop
    rings: 1,             // how many rings per click
    stagger: 40,          // ms between rings
    duration: 1550,       // ms each ring lives
    easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    peak: 0.2,            // opacity the ring reaches
    peakAt: 0.43,         // share of the run where the peak lands
    blurStart: 1,         // px
    blurEnd: 7.5,         // px, in the ring's own size: × growY (2.65) keeps it within 20px on screen
    growX: 1.05,          // how far the ring spreads sideways (1 = the field's width)
    growY: 2.65,          // …and vertically
    spin: 230,            // degrees the gradient turns over a ring's life
    startAngle: 110,      // where the gradient starts, degrees
    fieldLift: 0,         // px the field rises on click
    fieldRing: 0.15,      // strength of the brief brand-blue flash on the field's ring (0–1)
    glow: false,          // the resting blue glow that drifts behind the field (the Figma "Shadows")
    fieldShadow: true     // the field's own drop shadow
  };
  function applyLook() {
    box.classList.toggle('readers--no-glow', !PULSE.glow);
    box.classList.toggle('readers--flat', !PULSE.fieldShadow);
  }
  applyLook();
  // the drift and the glows rest while the reader frame is scrolled away
  new IntersectionObserver(function (entries) {
    box.classList.toggle('readers--paused', !entries[entries.length - 1].isIntersecting);
  }, { rootMargin: '120px' }).observe(box);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function ring(delay) {
    var el = document.createElement('div');
    el.className = 'readers__pulse';
    el.style.setProperty('--pulse-colors', PULSE.colors.join(', '));
    el.style.setProperty('--pulse-angle', PULSE.startAngle + 'deg');
    var f = field.getBoundingClientRect(), s = stage.getBoundingClientRect();
    el.style.left = (f.left - s.left) + 'px'; el.style.top = (f.top - s.top) + 'px';
    el.style.width = f.width + 'px'; el.style.height = f.height + 'px';
    stage.appendChild(el);                                  // under the field (z 2), over everything else
    var frames = [
      { offset: 0, opacity: 0, transform: 'scale(1, 1)', filter: 'blur(' + PULSE.blurStart + 'px)', '--pulse-angle': PULSE.startAngle + 'deg' },
      { offset: Math.min(0.9, Math.max(0.02, PULSE.peakAt)), opacity: PULSE.peak },
      { offset: 1, opacity: 0, transform: 'scale(' + PULSE.growX + ', ' + PULSE.growY + ')', filter: 'blur(' + PULSE.blurEnd + 'px)', '--pulse-angle': (PULSE.startAngle + PULSE.spin) + 'deg' }
    ];
    var a = el.animate(frames, { delay: delay, duration: PULSE.duration, easing: PULSE.easing, fill: 'both' });
    a.onfinish = function () { el.remove(); };
    return a;
  }
  var fieldAnim = null;
  var v2 = box.classList.contains('readers--v2'); // the second version: its field stretches instead (styles.css)
  function pulse() {
    if (reduce.matches) return;
    for (var i = 0; i < Math.max(1, PULSE.rings | 0); i++) ring(i * PULSE.stagger);
    if (fieldAnim) fieldAnim.cancel();
    var ringColor = 'rgba(50, 117, 255, ' + PULSE.fieldRing.toFixed(2) + ')';
    // the flash rides on top of the field's own ring (which the active state sets), and
    // ends back on it, so there is no snap when the animation is removed
    fieldAnim = field.animate([
      { transform: 'translateY(0)', boxShadow: 'var(--readers-shadow), var(--readers-ring)' },
      { offset: 0.2, transform: 'translateY(' + (-PULSE.fieldLift) + 'px)', boxShadow: 'var(--readers-shadow), 0 0 0 2.5px ' + ringColor },
      { transform: 'translateY(0)', boxShadow: 'var(--readers-shadow), var(--readers-ring)' }
    ], { duration: Math.max(500, PULSE.duration * 0.8), easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  }
  // a click pulses; focusing from the keyboard pulses too (a click also focuses, hence the guard)
  var input = field.querySelector('.readers__input');
  var clicked = false;
  field.addEventListener('pointerdown', function () {
    if (input && document.activeElement === input) return; // already in the field: placing the cursor isn't a new arrival
    clicked = true; pulse(); setTimeout(function () { clicked = false; }, 300);
  });
  if (input) input.addEventListener('focus', function () { if (!clicked) pulse(); });

  // The list (Figma 5973:15996 for its look): the readers' models drift slowly up
  // (homepage.css), listed twice so the drift loops. Typing stops the drift and narrows the
  // list to the readers whose name, model or protocol holds the text, from the top under the
  // field, scrolling if there are more than fit. Hovering one shows its photo in a card
  // centred on the list; the card lets the pointer through, so the row under it stays
  // hovered. Emptying the field brings every reader back and the drift picks up where it was.
  var lines = box.querySelector('.readers__lines');
  var win = box.querySelector('.readers__lines-window');
  var card = box.querySelector('.readers__card');
  var originals = lines ? Array.prototype.slice.call(lines.querySelectorAll('.readers__line')) : [];
  originals.forEach(function (li) {
    var c = li.cloneNode(true); c.classList.add('is-copy'); c.setAttribute('aria-hidden', 'true');
    lines.appendChild(c);
  });
  var rows = lines ? Array.prototype.slice.call(lines.querySelectorAll('.readers__line')) : [];
  function lap() { // the drift's loop: one listing's height (homepage.css --lap)
    if (box.classList.contains('readers--searching')) return; // the copies are hidden, so there's no height to read
    if (lines && originals.length) lines.style.setProperty('--lap', (rows[originals.length].offsetTop - rows[0].offsetTop) + 'px'); // the first copy's top
  }
  lap();
  if (lines) new ResizeObserver(lap).observe(lines);
  // Rails: the list is every reader in the catalogue, so the photos load when the field is
  // first used (the previews only show while searching), not all of them with the page
  var photosLoaded = false;
  function loadPhotos() {
    if (photosLoaded) return;
    photosLoaded = true;
    originals.forEach(function (li) { var i = new Image(); i.src = li.dataset.photo; }); // ready before the first hover
  }
  var photoField = box.querySelector('.readers__input');
  if (photoField) photoField.addEventListener('focus', loadPhotos);

  var shots = card ? Array.prototype.slice.call(card.querySelectorAll('img')) : [];
  var shown = null, hideTimer = 0, shot = 0;
  function showPreview(li) {
    clearTimeout(hideTimer);
    if (!shown || shown.dataset.photo !== li.dataset.photo || !card.classList.contains('is-showing')) {
      var next = shots[shot = 1 - shot], last = shots[1 - shot];
      next.src = li.dataset.photo;
      next.classList.add('is-on'); last.classList.remove('is-on');
    }
    card.classList.add('is-showing');
    if (shown && shown !== li) shown.classList.remove('is-hovered');
    li.classList.add('is-hovered');
    shown = li;
  }
  function hidePreview() {
    if (card) card.classList.remove('is-showing');
    if (shown) shown.classList.remove('is-hovered');
    shown = null;
  }
  // one pending hide at a time: a newer one replaces the older, so a stale timer can't hide
  // the card after the pointer has settled on a match
  function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(hidePreview, 80); }

  // each row that's newly in the results rises in, the first few a beat after one another
  function revealRows(added) {
    if (reduce.matches) return;
    added.forEach(function (li, i) {
      li.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 240, delay: Math.min(i, 10) * 16, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
    });
  }
  if (input && lines) {
    var driftTime = null; // how far the drift had got when the search began
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var searching = box.classList.contains('readers--searching');
      if (q && !searching) {
        var drift = lines.getAnimations()[0];
        driftTime = drift ? drift.currentTime : null;
      }
      box.classList.toggle('readers--searching', q.length > 0);
      var added = [];
      originals.forEach(function (li) {
        var match = q.length > 0 && (li.dataset.name + ' ' + li.textContent + ' ' + li.dataset.tag).toLowerCase().indexOf(q) >= 0;
        if (match && !li.classList.contains('is-match')) added.push(li);
        li.classList.toggle('is-match', match);
      });
      if (win) win.scrollTop = 0;
      if (shown && !shown.classList.contains('is-match')) hidePreview();
      if (q) { revealRows(added); return; }
      if (searching) {
        var resumed = lines.getAnimations()[0];
        if (resumed && driftTime !== null) resumed.currentTime = driftTime;
        lap();
        if (!reduce.matches) lines.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
      }
    });
  }
  if (win && lines && card) {
    win.addEventListener('pointerleave', hideSoon);
    lines.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch' || !box.classList.contains('readers--searching')) return;
      var li = e.target.closest('.readers__line');
      if (li && li.classList.contains('is-match')) showPreview(li);
      else hideSoon(); // a short grace, so crossing the gap between two rows doesn't flicker
    });
  }

  window.AGReaders = { pulse: pulse, config: PULSE, defaults: JSON.parse(JSON.stringify(PULSE)), applyLook: applyLook };
})();
