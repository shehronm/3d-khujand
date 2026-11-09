/* Support chat (feature 3, Figma 5632:20990 → 5632:21018). When the chat comes into view
   the conversation plays out the way a messaging app shows it: the customer's question
   pops in, Nat starts typing (three bouncing dots), the dots give way to Nat's first
   reply, a second follows with her name and avatar coming down from under it, and the
   customer answers.
   Each new row pushes the thread up from the bottom, and its bubble glides in on a
   diagonal, fading up from nothing and blurring into focus. Rows say when they show in their data-step (and the
   typing row when it goes, in data-until).
   Markup: .chat in index.html. Styles: .chat__* in styles.css.
   Settings live in CHAT (window.AGSupport.config); (its live tuners are in archive/: support-tuner.js, name-tuner.js) */
(function () {
  const chat = document.querySelector('.chat');
  if (!chat) return;
  const rows = [...chat.querySelectorAll('.chat__row')];
  if (rows.length < 2) return;
  const stepOf = r => +r.dataset.step || 0;
  const lastStep = Math.max(...rows.map(stepOf));

  const CHAT = {
    // ms after the chat comes into view for each step: the question, Nat typing, her first
    // reply (replacing the dots), her second, the customer's answer
    at: [150, 1900, 3000, 3900, 6150],
    open: 270,              // ms a new row takes to push the thread up
    openEase: 'cubic-bezier(0.3, 1.5, 0.5, 1)',
    // a long push (Nat's second reply makes room for itself and her name at once, over
    // 100px) gets its own, gentler motion, so the thread glides up rather than lurching
    longPush: 80,           // px: pushes longer than this use the two settings below
    openLong: 620,          // ms a long push takes
    openLongEase: 'cubic-bezier(0.22, 1, 0.36, 1)', // a smooth ease-out, no overshoot
    // the customer's grey bubbles: they come in from below-left
    pop: 460,               // ms a bubble takes to come in
    popEase: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    greyX: 8,               // px to the left of its place that it starts (negative: to the right)
    greyY: 8,               // px below its place that it starts (negative: above)
    fadeBy: 0.85,           // share of its time by which it is fully opaque and sharp
    blur: 3,                // px of blur it starts with, clearing as it fades in
    // Nat's blue replies are sent the way a messaging app sends them: each glides up from
    // below, tilted a little and slightly small and faint, straightening, growing and going
    // solid in one smooth movement (no second step, no overshoot). The thread moves up on
    // the same curve and time, so the whole conversation travels together
    sendRise: 40,           // px below its place that it starts
    sendTilt: -5,           // degrees it starts tilted (negative: anticlockwise)
    sendScale: 0.9,         // size it starts at
    sendFadeBy: 0.35,       // share of its time by which it is fully opaque and sharp
    sendBlur: 3,            // px of blur it starts with
    sendDuration: 650,      // ms it takes
    sendEase: 'cubic-bezier(0.32, 0.72, 0, 1)', // a long, soft settle
    typingOut: 160,         // ms the typing dots take to fade away as the reply takes their place
    // Nat's typing dots: they come in from below-right
    blueDuration: 650,      // ms a bubble takes to come in
    blueEase: 'cubic-bezier(0.25, 0.8, 0.3, 1)',
    blueX: 8,               // px to the right of its place that it starts (negative: to the left)
    blueY: 8,               // px below its place that it starts (negative: above)
    blueFadeBy: 0.81,       // share of its time by which it is fully opaque and sharp
    blueBlur: 3,            // px of blur it starts with
    nameAfter: 430,         // ms after her second bubble has fully come in that Nat's name and avatar follow
    nameDrop: 3,            // px above their place that they start: tucked under the bubble
    nameDuration: 850,      // ms they take to come in
    nameBlur: 8,            // px of blur they start with
    threshold: 0.15,         // share of the chat on screen before it starts
    loop: true,             // start over after the last message
    loopWait: 5500,         // ms the finished thread stays before it starts over
    // before it starts over, the whole thread flicks up and away, as if scrolled quickly,
    // fading and blurring out (and faded at the top of the chat as it goes)
    exitRise: 90,           // px it travels up
    exitDuration: 420,      // ms it takes
    exitBlur: 6,            // px of blur it ends with
    exitEase: 'cubic-bezier(0.55, 0, 0.85, 0.3)', // picks up speed as it goes, like a flick
    exitStagger: 45,        // ms between one row leaving and the next, top row first
    // debugging
    slow: 1                 // slow motion: every time and duration is multiplied by this
  };
  const defaults = JSON.parse(JSON.stringify(CHAT));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timers = [], anims = [], step = 0;

  const t = ms => ms * Math.max(0.05, CHAT.slow);
  function clear() {
    timers.forEach(clearTimeout); timers = [];
    anims.forEach(a => a.cancel()); anims = [];
  }
  // back to the start: an empty thread, nothing running
  function reset() {
    clear();
    step = 0;
    rows.forEach(r => r.classList.add('is-later'));
    chat.classList.add('chat--waiting');
  }

  // a bubble glides in on a diagonal from nothing, blurring into focus: the customer's
  // (left) up and to the right from below-left, Nat's (right) up and to the left from
  // below-right
  function pop(bubble) {
    if (bubble.classList.contains('chat__bubble--blue')) { send(bubble); return; }
    const grey = !!bubble.closest('.chat__row--them');
    const P = grey
      ? { dx: -CHAT.greyX, dy: CHAT.greyY, dur: CHAT.pop, ease: CHAT.popEase, fade: CHAT.fadeBy, blur: CHAT.blur }
      : { dx: CHAT.blueX, dy: CHAT.blueY, dur: CHAT.blueDuration, ease: CHAT.blueEase, fade: CHAT.blueFadeBy, blur: CHAT.blueBlur };
    const fade = Math.min(1, Math.max(0.01, P.fade));
    const frames = [
      { offset: 0, opacity: 0, filter: `blur(${P.blur}px)`, transform: `translate(${P.dx}px, ${P.dy}px)` },
      { offset: fade, opacity: 1, filter: 'blur(0px)' },
      { offset: 1, opacity: 1, filter: 'blur(0px)', transform: 'translate(0, 0)' }
    ];
    anims.push(bubble.animate(frames, { duration: t(P.dur), easing: P.ease, fill: 'backwards' }));
  }

  // a blue reply flies up into place (transform-origin, styles.css: its tail corner)
  function send(bubble) {
    const fade = Math.min(0.95, Math.max(0.01, CHAT.sendFadeBy));
    anims.push(bubble.animate([
      { offset: 0, transform: `translateY(${CHAT.sendRise}px) rotate(${CHAT.sendTilt}deg) scale(${CHAT.sendScale})` },
      { offset: 1, transform: 'translateY(0) rotate(0deg) scale(1)' }
    ], { duration: t(CHAT.sendDuration), easing: CHAT.sendEase, fill: 'backwards' }));
    anims.push(bubble.animate([
      { offset: 0, opacity: 0, filter: `blur(${CHAT.sendBlur}px)` },
      { offset: fade, opacity: 1, filter: 'blur(0px)' },
      { offset: 1, opacity: 1, filter: 'blur(0px)' }
    ], { duration: t(CHAT.sendDuration), easing: 'ease-out', fill: 'backwards' }));
  }

  // the typing dots don't just vanish when the reply replaces them: a copy fades and shrinks
  // away where they were, over the top of the thread
  function typingGone(row) {
    const bubble = row.querySelector('.chat__bubble');
    if (!bubble) return;
    const box = chat.getBoundingClientRect(), r = bubble.getBoundingClientRect();
    const ghost = bubble.cloneNode(true);
    Object.assign(ghost.style, { position: 'absolute', left: (r.left - box.left) + 'px', top: (r.top - box.top) + 'px', margin: '0', zIndex: '2' });
    chat.appendChild(ghost);
    const a = ghost.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
      { duration: t(CHAT.typingOut), easing: 'ease-out', fill: 'forwards' });
    anims.push(a);
    a.finished.then(() => ghost.remove(), () => ghost.remove());
  }

  // one step of the conversation: its rows show (and the typing row goes, when its time is up)
  function arrive(n) {
    const showing = rows.filter(r => stepOf(r) === n);
    const going = rows.filter(r => r.dataset.until != null && +r.dataset.until === n);
    // FLIP: note where the rows already showing sit, make the change (the thread is
    // anchored at the bottom, so they all jump to make room), then slide them from where
    // they were to where they now are
    const shown = rows.filter(r => !r.classList.contains('is-later') && !going.includes(r));
    const before = shown.map(r => r.getBoundingClientRect().top);
    going.forEach(r => { if (r.classList.contains('chat__row--typing')) typingGone(r); });
    going.forEach(r => r.classList.add('is-later'));
    // when one of Nat's replies arrives, the thread moves up with it, on its curve and time
    const sent = showing.some(r => r.querySelector('.chat__bubble--blue'));
    showing.forEach(r => r.classList.remove('is-later'));
    shown.forEach((r, i) => {
      const delta = before[i] - r.getBoundingClientRect().top;
      if (!delta) return;
      const long = Math.abs(delta) > CHAT.longPush;
      const timing = sent ? { duration: t(CHAT.sendDuration), easing: CHAT.sendEase }
        : { duration: t(long ? CHAT.openLong : CHAT.open), easing: long ? CHAT.openLongEase : CHAT.openEase };
      anims.push(r.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], timing));
    });
    showing.forEach(row => {
      const bubble = row.querySelector('.chat__bubble');
      if (bubble) pop(bubble);
      // Nat's name and avatar: their room is made with her second bubble, but they only
      // come once that bubble is fully in, sliding down from under it, fading and blurring
      // into focus
      if (row.classList.contains('chat__row--name')) {
        anims.push(row.animate([
          { opacity: 0, filter: `blur(${CHAT.nameBlur}px)`, transform: `translateY(${-CHAT.nameDrop}px)` },
          { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' }
        ], { duration: t(CHAT.nameDuration), delay: t(CHAT.sendDuration * 0.6 + CHAT.nameAfter), easing: CHAT.popEase, fill: 'backwards' }));
      }
    });
  }

  // the next step, now (the tuner's step button)
  function next() {
    if (step > lastStep) reset();
    arrive(step++);
  }

  // the whole sequence from the start
  function play() {
    if (reduce.matches) { clear(); finished(); return; }
    reset();
    const times = [];
    for (let n = 0; n <= lastStep; n++) times.push(CHAT.at[n] != null ? CHAT.at[n] : (times[n - 1] || 0) + 1200);
    times.forEach(ms => timers.push(setTimeout(next, t(ms))));
    if (CHAT.loop) {
      const end = Math.max(...times) + CHAT.pop + CHAT.loopWait;
      timers.push(setTimeout(() => { if (onScreen && !document.hidden) again(); else loopDue = true; }, t(end)));
    }
  }
  // starting over: the finished thread flicks up and out, then the conversation begins again
  function again() {
    // each row flicks up in turn, the top one first, the way content leaves a scrolled view
    const leaving = rows.filter(r => !r.classList.contains('is-later'));
    const outs = leaving.map((r, i) => r.animate([
      { offset: 0, transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' },
      { offset: 0.7, opacity: 0 },
      { offset: 1, transform: `translateY(${-CHAT.exitRise}px)`, opacity: 0, filter: `blur(${CHAT.exitBlur}px)` }
    ], { delay: t(i * CHAT.exitStagger), duration: t(CHAT.exitDuration), easing: CHAT.exitEase, fill: 'forwards' }));
    anims.push(...outs);
    if (!outs.length) { play(); return; }
    outs[outs.length - 1].finished.then(play, () => {}); // play() clears the thread (and these) and starts again
  }

  // the whole conversation at rest, without the typing bubble
  function finished() {
    chat.classList.add('chat--waiting');
    rows.forEach(r => r.classList.toggle('is-later', r.dataset.until != null));
  }

  if (reduce.matches) { finished(); return; } // the whole thread, still
  reset();
  // it starts the first time it comes into view; after that, a loop that comes due while
  // the chat is scrolled away (or the tab is hidden) waits and runs when it is back
  let onScreen = false, started = false, loopDue = false;
  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    if (!onScreen) return;
    if (!started) { started = true; play(); }
    else if (loopDue && !document.hidden) { loopDue = false; again(); }
  }, { threshold: CHAT.threshold, rootMargin: '60px' }).observe(chat);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && onScreen && loopDue) { loopDue = false; again(); }
  });

  // debugging the name: the conversation as it stands just before Nat's second reply, then
  // that reply and her name and avatar, played as normal (archive/name-tuner.js used it)
  function playName() {
    reset();
    for (let n = 0; n < 3; n++) arrive(n);
    anims.forEach(a => a.finish()); anims = [];
    step = 3;
    arrive(step++);
  }

  window.AGSupport = { config: CHAT, defaults: defaults, play: play, next: next, reset: reset, playName: playName };
})();
