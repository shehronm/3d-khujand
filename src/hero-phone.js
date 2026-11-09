/* Hero phone: the fold-in on load. The phone starts a little large and low, its top leaning toward
   us, rises and folds back to face-on, swings a touch past flat (the tap) and settles;
   the grid pulse (hero-grid.js) is timed to the tap.
   Settings live in PHONE (window.AGPhone.config); phone-tuner.js edits them live. */
(function () {
  var device = document.querySelector('.hero__device');
  var phone = device && device.querySelector('.phone');
  if (!phone) return;
  var hold = phone.querySelector('.phone__hold');
  var band = phone.querySelector('.phone__shimmer i');

  var PHONE = {
    delay: 320,                                   // extra ms on top of its cue: the copy's entrance (hero-copy.js) says when to start
    duration: 1250,                               // ms for the whole move, start to settled
    tilt: -60,                                    // starting tilt, degrees: negative = top toward us, positive = top away
    lift: -104,                                   // px the phone starts above its resting place (negative = below)
    scale: 1.1,                                   // starting size (1 = full size)
    blur: 11,                                     // starting blur, px
    fadeBy: 0.6,                                  // share of the move by which it is fully opaque and sharp
    perspective: 3800,                            // px: smaller = a more dramatic fold
    pivot: 77,                                    // where it hinges, % down the phone (100 = its bottom edge)
    tapAt: 0.74,                                  // share of the move where the tap lands
    tapTilt: 2,                                   // degrees it folds past flat on the tap
    tapDip: 0,                                    // px it drops below its resting place on the tap
    easeIn: 'cubic-bezier(0.65, 0, 0.35, 1)',     // the fold down to the tap
    easeSettle: 'cubic-bezier(0.3, 0, 0.2, 1)',   // the settle back from it
    // on the screen, starting `screenLead` ms before the phone has settled
    screenLead: 100,                              // ms before the move ends that the shimmer begins
    shimmer: true,                                // a white band runs up the card, bottom to top
    shimmerDuration: 900,                         // ms it takes to cross the card
    shimmerOpacity: 0.22,                         // how strong the band is (subtle)
    holdDelay: 250,                               // ms after the shimmer starts that the reader icon and label begin to fade in
    holdFade: 400                                 // ms they take to fade in
  };
  var defaults = JSON.parse(JSON.stringify(PHONE));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var anims = [];
  var startedAt = 0;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  // ms after load that the phone starts: halfway through the copy's entrance (hero-copy.js), plus `delay`
  function startDelay() { return (window.AGHeroCopy ? window.AGHeroCopy.phoneDelay() : 0) + PHONE.delay; }
  function tapMs() { return startDelay() + clamp(PHONE.tapAt, 0.05, 0.95) * PHONE.duration; }

  function play() {
    anims.forEach(function (a) { a.cancel(); });
    anims = [];
    phone.style.opacity = 1; // the stylesheet hides it until this script takes over
    if (reduce.matches) {
      // reduced motion: no fold, blur or shimmer, just a short fade, still after the headline
      anims.push(phone.animate([{ opacity: 0 }, { opacity: 1 }],
        { delay: startDelay(), duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }));
      startedAt = -Infinity;
      return;
    }
    (device.querySelector('.hero__fade') || device).style.perspective = PHONE.perspective + 'px'; // the phone's parent: the fade's box (_hero.html.erb)
    phone.style.transformOrigin = '50% ' + PHONE.pivot + '%';
    var tap = clamp(PHONE.tapAt, 0.05, 0.95), fade = clamp(PHONE.fadeBy, 0.01, 1);
    var frames = [
      { offset: 0, opacity: 0, filter: 'blur(' + PHONE.blur + 'px)', easing: PHONE.easeIn,
        transform: 'translateY(' + -PHONE.lift + 'px) rotateX(' + PHONE.tilt + 'deg) scale(' + PHONE.scale + ')' },
      { offset: fade, opacity: 1, filter: 'blur(0px)' },
      { offset: tap, transform: 'translateY(' + PHONE.tapDip + 'px) rotateX(' + PHONE.tapTilt + 'deg) scale(1)', easing: PHONE.easeSettle },
      { offset: 1, opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px) rotateX(0deg) scale(1)' }
    ].sort(function (a, b) { return a.offset - b.offset; });
    var fold = phone.animate(frames, { delay: startDelay(), duration: PHONE.duration, fill: 'backwards' });
    anims.push(fold);
    // the layer hint only while it moves: left on, a filter layer the size of the phone stays in memory
    phone.style.willChange = 'transform, opacity, filter';
    fold.finished.then(function () { phone.style.willChange = ''; }, function () {});
    startedAt = performance.now();
    screen(Math.max(0, startDelay() + PHONE.duration - PHONE.screenLead));
    // on a replay the grid pulses again with the tap (on load it starts itself)
    if (window.AGHeroGrid) window.AGHeroGrid.play(tapMs());
  }

  // The screen's own sequence, starting at `at` ms: a shimmer crosses the card bottom to
  // top, and the reader icon and "Hold near reader" fade up. Delayed Web Animations, so a
  // replay cancels and restarts them with the phone.
  function screen(at) {
    if (band && PHONE.shimmer) {
      var sweep = band.animate([
        { opacity: PHONE.shimmerOpacity, transform: 'translateY(160%) rotate(-7deg)' },
        { opacity: PHONE.shimmerOpacity, transform: 'translateY(-115%) rotate(-7deg)' }
      ], { delay: at, duration: PHONE.shimmerDuration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      anims.push(sweep);
      band.style.willChange = 'transform';
      sweep.finished.then(function () { band.style.willChange = ''; }, function () {});
    }
    if (hold) {
      var wait = at + Math.max(0, PHONE.holdDelay), total = wait + PHONE.holdFade;
      anims.push(hold.animate([
        { offset: 0, opacity: 0, transform: 'translateY(4px)' },
        { offset: wait / total, opacity: 0, transform: 'translateY(4px)', easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
        { offset: 1, opacity: 1, transform: 'translateY(0)' }
      ], { duration: total }));
    }
  }

  window.AGPhone = {
    config: PHONE,
    defaults: defaults,
    play: play,
    // ms from now until the tap lands (0 once it has)
    tapIn: function () { return Math.max(0, tapMs() - (performance.now() - startedAt)); }
  };
  play();
})();
