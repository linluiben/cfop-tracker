/*
 * timer.js — the stopwatch itself: hold space (or touch) until it turns green,
 * release to start, hit anything to stop. Optional 15 second inspection.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Timer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOLD_MS = 350;          // how long to hold before the timer arms
  var STOP_GUARD_MS = 250;    // ignore input right after stopping

  function Timer(opts) {
    this.opts = opts || {};
    this.state = 'idle';      // idle | holding | ready | inspecting | running
    this.startedAt = 0;
    this.elapsed = 0;
    this.inspectionStart = 0;
    this.enabled = false;
    this._holdTimer = null;
    this._raf = null;
    this._stoppedAt = 0;
    this._down = false;

    this._onKeyDown = this._keyDown.bind(this);
    this._onKeyUp = this._keyUp.bind(this);
  }

  Timer.prototype._emit = function () {
    if (this.opts.onChange) this.opts.onChange(this);
  };

  Timer.prototype._setState = function (state) {
    this.state = state;
    this._emit();
  };

  Timer.prototype.isInspecting = function () {
    return this.state.indexOf('inspecting') === 0;
  };

  Timer.prototype.display = function () {
    if (this.isInspecting()) {
      var left = 15 - (performance.now() - this.inspectionStart) / 1000;
      return left > 0 ? String(Math.ceil(left)) : (left > -2 ? '+2' : 'DNF');
    }
    return this.elapsed;
  };

  Timer.prototype._loop = function () {
    var self = this;
    this._raf = requestAnimationFrame(function () {
      if (self.state === 'running') self.elapsed = performance.now() - self.startedAt;
      if (self.state === 'running' || self.isInspecting()) {
        self._emit();
        self._loop();
      }
    });
  };

  Timer.prototype.press = function () {
    if (!this.enabled || this._down) return;
    this._down = true;
    if (performance.now() - this._stoppedAt < STOP_GUARD_MS) return;

    if (this.state === 'running') { this.stop(); return; }
    if (this.state === 'idle' && this.opts.inspection && this.opts.inspection()) {
      this.inspectionStart = performance.now();
      this._setState('inspecting');
      this._loop();
      return;
    }
    if (this.state === 'idle' || this.state === 'inspecting') {
      var self = this;
      this._setState(this.state === 'inspecting' ? 'inspecting-holding' : 'holding');
      this._holdTimer = setTimeout(function () { self._setState('ready'); }, HOLD_MS);
    }
  };

  Timer.prototype.release = function () {
    this._down = false;
    if (!this.enabled) return;
    clearTimeout(this._holdTimer);
    if (this.state === 'ready') this.start();
    else if (this.state === 'holding') this._setState('idle');
    else if (this.state === 'inspecting-holding') this._setState('inspecting');
  };

  Timer.prototype.start = function () {
    this.penaltyFromInspection = '';
    if (this.inspectionStart) {
      var used = (performance.now() - this.inspectionStart) / 1000;
      if (used > 17) this.penaltyFromInspection = 'dnf';
      else if (used > 15) this.penaltyFromInspection = '+2';
      this.inspectionStart = 0;
    }
    this.startedAt = performance.now();
    this.elapsed = 0;
    this._setState('running');
    this._loop();
  };

  Timer.prototype.stop = function () {
    if (this.state !== 'running') return;
    this.elapsed = performance.now() - this.startedAt;
    cancelAnimationFrame(this._raf);
    this._stoppedAt = performance.now();
    this._setState('idle');
    if (this.opts.onStop) this.opts.onStop(this.elapsed, this.penaltyFromInspection || '');
  };

  Timer.prototype.reset = function () {
    clearTimeout(this._holdTimer);
    cancelAnimationFrame(this._raf);
    this.elapsed = 0;
    this.inspectionStart = 0;
    this._down = false;
    this._setState('idle');
  };

  Timer.prototype._keyDown = function (e) {
    if (e.repeat) return;
    var typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (typing) return;
    if (e.code === 'Space') { e.preventDefault(); this.press(); }
    else if (this.state === 'running') { this.stop(); }
  };

  Timer.prototype._keyUp = function (e) {
    if (e.code !== 'Space') return;
    e.preventDefault();
    this.release();
  };

  Timer.prototype.attach = function (surface) {
    if (this.enabled) return;
    this.enabled = true;
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    if (surface) {
      var self = this;
      this._surface = surface;
      this._touchStart = function (e) { e.preventDefault(); self.press(); };
      this._touchEnd = function (e) { e.preventDefault(); self.release(); };
      surface.addEventListener('touchstart', this._touchStart, { passive: false });
      surface.addEventListener('touchend', this._touchEnd, { passive: false });
      surface.addEventListener('mousedown', this._touchStart);
      surface.addEventListener('mouseup', this._touchEnd);
    }
  };

  Timer.prototype.detach = function () {
    this.enabled = false;
    this.reset();
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    if (this._surface) {
      this._surface.removeEventListener('touchstart', this._touchStart);
      this._surface.removeEventListener('touchend', this._touchEnd);
      this._surface.removeEventListener('mousedown', this._touchStart);
      this._surface.removeEventListener('mouseup', this._touchEnd);
      this._surface = null;
    }
  };

  /* 12.345 / 1:02.34 */
  Timer.format = function (ms) {
    if (ms == null) return '—';
    if (!isFinite(ms)) return 'DNF';
    var total = ms / 1000;
    var minutes = Math.floor(total / 60);
    var seconds = total - minutes * 60;
    var s = seconds.toFixed(2);
    if (minutes) return minutes + ':' + (seconds < 10 ? '0' : '') + s;
    return s;
  };

  return Timer;
});
