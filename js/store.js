/*
 * store.js — everything the app remembers, in one localStorage key, plus the
 * averaging maths the timer views need.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'cfop-tracker:v1';
  var data = {
    status: {}, algTimes: {}, solves: [],
    userAlgs: {},   // id -> algs you typed in yourself
    chosen: {},     // id -> the alg you want shown and trained
    settings: { inspection: false }
  };
  var listeners = [];

  function adopt(parsed) {
    return {
      status: parsed.status || {},
      algTimes: parsed.algTimes || {},
      solves: parsed.solves || [],
      userAlgs: parsed.userAlgs || {},
      chosen: parsed.chosen || {},
      settings: Object.assign({ inspection: false }, parsed.settings)
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        data = adopt(parsed);
      }
    } catch (e) {
      console.warn('could not read saved data', e);
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('could not save', e);
    }
    listeners.forEach(function (fn) { fn(data); });
  }

  function onChange(fn) { listeners.push(fn); }

  // ---- case status -------------------------------------------------------
  function status(id) { return data.status[id] || 'new'; }

  function cycleStatus(id) {
    var cur = status(id);
    if (cur === 'new') data.status[id] = 'learning';
    else if (cur === 'learning') data.status[id] = 'known';
    else delete data.status[id];
    save();
    return status(id);
  }

  function setStatus(id, value) {
    if (value === 'new') delete data.status[id];
    else data.status[id] = value;
    save();
  }

  // ---- times -------------------------------------------------------------
  function addAlgTime(id, ms) {
    (data.algTimes[id] = data.algTimes[id] || []).push({ t: ms, ts: Date.now() });
    save();
  }

  function algTimes(id) { return data.algTimes[id] || []; }

  function addSolve(ms, scramble) {
    data.solves.push({ t: ms, ts: Date.now(), scramble: scramble || '', penalty: '' });
    save();
  }

  function solves() { return data.solves; }

  function updateSolve(index, changes) {
    if (!data.solves[index]) return;
    Object.assign(data.solves[index], changes);
    save();
  }

  function removeSolve(index) {
    data.solves.splice(index, 1);
    save();
  }

  function clearSolves() { data.solves = []; save(); }

  function clearAlgTimes(id) {
    if (id) delete data.algTimes[id]; else data.algTimes = {};
    save();
  }

  function resetProgress() { data.status = {}; save(); }

  // ---- stats -------------------------------------------------------------
  /* Effective time: +2 adds two seconds, DNF is Infinity so it sorts last and
     poisons an average unless it is the single dropped worst. */
  function effective(entry) {
    if (!entry) return null;
    if (entry.penalty === 'dnf') return Infinity;
    return entry.t + (entry.penalty === '+2' ? 2000 : 0);
  }

  function best(list) {
    var times = list.map(effective).filter(function (t) { return isFinite(t); });
    return times.length ? Math.min.apply(null, times) : null;
  }

  function mean(list) {
    var times = list.map(effective);
    if (!times.length || times.some(function (t) { return !isFinite(t); })) return null;
    return times.reduce(function (a, b) { return a + b; }, 0) / times.length;
  }

  /* WCA-style average of n: drop the fastest and slowest, mean the rest. */
  function averageOf(list, n) {
    if (list.length < n) return null;
    var window = list.slice(-n).map(effective);
    var sorted = window.slice().sort(function (a, b) { return a - b; });
    var trimmed = sorted.slice(1, -1);
    if (trimmed.some(function (t) { return !isFinite(t); })) return null; // 2+ DNFs
    return trimmed.reduce(function (a, b) { return a + b; }, 0) / trimmed.length;
  }

  function bestAverageOf(list, n) {
    if (list.length < n) return null;
    var bestAvg = null;
    for (var i = n; i <= list.length; i++) {
      var avg = averageOf(list.slice(0, i), n);
      if (avg != null && (bestAvg == null || avg < bestAvg)) bestAvg = avg;
    }
    return bestAvg;
  }

  // ---- import / export ---------------------------------------------------
  function exportJSON() { return JSON.stringify(data, null, 2); }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('not a backup file');
    data = adopt(parsed);
    save();
  }

  // ---- algorithm variants --------------------------------------------------
  function userAlgs(id) { return data.userAlgs[id] || []; }

  function addUserAlg(id, alg) {
    var list = data.userAlgs[id] = data.userAlgs[id] || [];
    if (list.indexOf(alg) < 0) list.push(alg);
    save();
  }

  function removeUserAlg(id, alg) {
    var list = data.userAlgs[id] || [];
    var at = list.indexOf(alg);
    if (at >= 0) list.splice(at, 1);
    if (data.chosen[id] === alg) delete data.chosen[id];
    save();
  }

  function chosen(id) { return data.chosen[id] || null; }

  function choose(id, alg) {
    if (alg) data.chosen[id] = alg; else delete data.chosen[id];
    save();
  }

  function settings() { return data.settings; }
  function setSetting(key, value) { data.settings[key] = value; save(); }

  return {
    load: load, save: save, onChange: onChange,
    status: status, cycleStatus: cycleStatus, setStatus: setStatus, resetProgress: resetProgress,
    addAlgTime: addAlgTime, algTimes: algTimes, clearAlgTimes: clearAlgTimes,
    addSolve: addSolve, solves: solves, updateSolve: updateSolve, removeSolve: removeSolve, clearSolves: clearSolves,
    effective: effective, best: best, mean: mean, averageOf: averageOf, bestAverageOf: bestAverageOf,
    userAlgs: userAlgs, addUserAlg: addUserAlg, removeUserAlg: removeUserAlg,
    chosen: chosen, choose: choose,
    exportJSON: exportJSON, importJSON: importJSON,
    settings: settings, setSetting: setSetting
  };
});
