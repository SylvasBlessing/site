/*
 * First-gesture audio unlock for /play (Sylva's Blessing).
 *
 * Chrome starts every AudioContext "suspended" and only lets sound through
 * once resume() is called from inside a real user gesture. The game's own
 * unlock listener can disarm before its AudioContext exists / before a music
 * theme has been requested, which left the music silent until the volume
 * slider happened to call resume() from inside its drag gesture.
 *
 * This shim runs before the game bundle, tracks every AudioContext the page
 * creates, and resumes them on the first user gesture. It stays armed until
 * a context exists and every tracked context has reached "running", then
 * removes its listeners and gets out of the way.
 *
 * Injected into /play/index.html by .github/workflows/deploy.yml at deploy
 * time. Remove once the unlock is fixed upstream in the game source repo
 * (Blovely133/desktop-tutorial).
 */
(function () {
  'use strict';

  var contexts = [];
  var armed = false;

  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Native = window[name];
    if (typeof Native !== 'function') return;
    var Wrapped = function AudioContext(options) {
      var ctx = options === undefined ? new Native() : new Native(options);
      contexts.push(ctx);
      return ctx;
    };
    Wrapped.prototype = Native.prototype;
    window[name] = Wrapped;
  });

  // Events that grant user activation across Chrome / Safari / Firefox.
  var GESTURES = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown', 'click'];

  function unlock() {
    var pending = false;
    for (var i = 0; i < contexts.length; i++) {
      var state = contexts[i].state;
      if (state === 'suspended' || state === 'interrupted') {
        pending = true;
        try { contexts[i].resume().catch(function () {}); } catch (e) { /* ignore */ }
      }
    }
    // Stay armed until the game has created its context (it does so lazily)
    // and every tracked context has actually reached "running". resume() is
    // async, so the gesture that unlocks still reports "suspended" here —
    // the next gesture sees "running" and disarms. Extra armed gestures are
    // harmless no-ops.
    if (contexts.length && !pending) disarm();
  }

  function disarm() {
    if (!armed) return;
    armed = false;
    GESTURES.forEach(function (e) {
      window.removeEventListener(e, unlock, true);
    });
  }

  GESTURES.forEach(function (e) {
    window.addEventListener(e, unlock, true);
  });
  armed = true;
})();
