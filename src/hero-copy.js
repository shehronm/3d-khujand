/* Hero copy entrance. On load the headline comes in as one piece, fading up from nothing
   and blurring into focus as it settles down from 5px above, slowly; about 80% of the way
   through, the lede and the two buttons do the same. Halfway through the whole entrance,
   the phone starts to fold in (hero-phone.js asks phoneDelay() when to start).
   The copy is held hidden from first paint by a `hero-intro` class that a small inline
   script at the top of <body> puts on <html> (styles.css); this file takes over from it.
   Settings live in COPY (window.AGHeroCopy.config); phone-tuner.js edits them. */
(function () {
  const hero = document.querySelector('.hero');
  const title = hero && hero.querySelector('.hero__title');
  if (!title) return;
  const lede = hero.querySelector('.hero__lede');
  const buttons = [...hero.querySelectorAll('.hero__actions .btn')];

  const COPY = {
    delay: 120,          // ms after load that the headline starts
    titleDuration: 1200, // ms the headline takes to come in
    restAt: 0.5,         // share of the headline's entrance at which the lede and buttons start
    duration: 570,       // ms the lede and the buttons each take
    restStagger: 0,      // ms between the lede and the buttons (0 = together)
    blur: 10,            // px of blur each piece starts with
    rise: 5,             // px above its place that each piece starts
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)', // the same ease-out as the dark section's headline
    phoneAt: 0.5         // share of the whole entrance at which the phone starts
  };
  const defaults = JSON.parse(JSON.stringify(COPY));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // when each piece starts, and when the whole entrance is over
  function times() {
    const restStart = COPY.delay + COPY.restAt * COPY.titleDuration;
    const end = Math.max(COPY.delay + COPY.titleDuration, restStart + COPY.restStagger + COPY.duration);
    return { restStart: restStart, end: end };
  }
  // ms after load that the phone should start: phoneAt of the way through the entrance
  function phoneDelay() {
    const t = times();
    return COPY.delay + COPY.phoneAt * (t.end - COPY.delay);
  }

  let anims = [];
  function play() {
    anims.forEach(a => a.cancel());
    anims = [];
    const t = times();
    const pieces = [[title, COPY.delay, COPY.titleDuration]];
    if (lede) pieces.push([lede, t.restStart, COPY.duration]);
    buttons.forEach(b => pieces.push([b, t.restStart + COPY.restStagger, COPY.duration]));
    pieces.forEach(([el, at, dur]) => {
      const frames = reduce.matches
        ? [{ opacity: 0 }, { opacity: 1 }]  // reduced motion: a plain fade, no blur or movement
        : [
            { opacity: 0, filter: `blur(${COPY.blur}px)`, transform: `translateY(${-COPY.rise}px)` },
            { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' }
          ];
      anims.push(el.animate(frames, { delay: at, duration: reduce.matches ? 300 : dur, easing: COPY.easing, fill: 'backwards' }));
    });
    // the animations now hold everything at its start until its turn: the CSS hold can go
    document.documentElement.classList.remove('hero-intro');
  }

  window.AGHeroCopy = { config: COPY, defaults: defaults, play: play, phoneDelay: phoneDelay };
  play();
})();
