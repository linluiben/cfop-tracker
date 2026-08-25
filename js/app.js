/* app.js — wires the case list, the detail view, the alg trainer and the
   full-solve timer together. */
(function () {
  'use strict';

  var CASES = Algs.all();
  var BY_ID = {};
  CASES.forEach(function (c) {
    c.shape = c.set === 'oll' ? Render.ollShape(c) : '';
    BY_ID[c.id] = c;
  });

  var diagramCache = {};
  function diagram(item, size) {
    var key = item.id + '@' + size;
    if (!diagramCache[key]) diagramCache[key] = Render.diagram(item, size);
    return diagramCache[key];
  }

  /* Every way through a case: the built-in one, the shipped alternates, and
     anything you have typed in yourself. The diagram always comes from the
     built-in alg — that one defines the case. */
  function variantsOf(item) {
    var chosen = Store.chosen(item.id);
    var out = [{ alg: item.alg, source: 'built-in' }];
    item.alts.forEach(function (a) { out.push({ alg: a, source: 'alternate' }); });
    Store.userAlgs(item.id).forEach(function (a) { out.push({ alg: a, source: 'yours' }); });
    out.forEach(function (v) {
      v.active = chosen ? v.alg === chosen : v.source === 'built-in';
      v.check = Cube.checkAlg(item.alg, v.alg, item.set);
    });
    if (!out.some(function (v) { return v.active; })) out[0].active = true;
    return out;
  }

  function activeAlg(item) {
    var chosen = Store.chosen(item.id);
    if (!chosen) return item.alg;
    var known = variantsOf(item).some(function (v) { return v.alg === chosen; });
    return known ? chosen : item.alg;
  }

  var $ = function (id) { return document.getElementById(id); };
  var fmt = Timer.format;

  Store.load();

  // ------------------------------------------------------------------ views
  var currentView = 'algs';
  var SUBTITLES = {
    algs: 'Click a case to cycle: new → learning → known. Click its picture to see all six sides.',
    trainer: 'Drill single algorithms: look at the case, hold space, execute, stop. Times are kept per case.',
    solves: 'Full solves: scramble, hold space, go. Penalties apply to your most recent solve.'
  };

  function showView(name) {
    currentView = name;
    ['algs', 'trainer', 'solves'].forEach(function (v) {
      $('view-' + v).hidden = v !== name;
    });
    Array.prototype.forEach.call($('viewTabs').children, function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    $('subtitle').textContent = SUBTITLES[name];
    trainerTimer.detach();
    solveTimer.detach();
    if (name === 'trainer') { trainerTimer.attach($('trainerPanel')); renderTrainer(); }
    if (name === 'solves') { solveTimer.attach($('solvePanel')); renderSolves(); }
    if (name === 'algs') renderAlgs();
  }

  $('viewTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.viewtab');
    if (btn) showView(btn.dataset.view);
  });

  // ------------------------------------------------------- algorithms view
  var currentSet = 'all';
  var statusFilters = new Set();
  var searchTerm = '';

  /* "R U R'" searches the moves themselves; anything else searches names.
     Padding both sides with spaces keeps R from matching R'. */
  function notationMatch(item, query) {
    if (!/^[UDRLFBMESxyzw'2\s()[\]]+$/i.test(query)) return false;
    var needle = ' ' + Cube.canonical(query) + ' ';
    if (needle === '  ') return false;
    return variantsOf(item).some(function (v) {
      return (' ' + Cube.canonical(v.alg) + ' ').indexOf(needle) >= 0;
    });
  }

  function matches(item) {
    if (currentSet !== 'all' && item.set !== currentSet) return false;
    if (statusFilters.size && !statusFilters.has(Store.status(item.id))) return false;
    if (!searchTerm) return true;
    var hay = (item.name + ' ' + (item.group || '') + ' ' + item.shape).toLowerCase();
    if (hay.indexOf(searchTerm.toLowerCase()) >= 0) return true;
    return notationMatch(item, searchTerm);
  }

  function makeCard(item) {
    var status = Store.status(item.id);
    var card = document.createElement('div');
    card.className = 'card' + (status !== 'new' ? ' ' + status : '');
    var best = Store.best(Store.algTimes(item.id));
    var meta = [];
    var variants = variantsOf(item);
    if (item.shape) meta.push('<span class="badge">' + item.shape + '</span>');
    if (variants.length > 1) meta.push('<span class="badge">' + variants.length + ' algs</span>');
    if (best != null) meta.push('<span class="card-best">best ' + fmt(best) + '</span>');

    card.innerHTML =
      '<button class="thumb" title="show all sides" aria-label="show all sides of ' + item.name + '">' +
        diagram(item, 62) +
      '</button>' +
      '<div class="card-body">' +
        '<div class="card-top">' +
          '<div class="card-name">' +
            (item.num !== '' ? '<span class="card-num">' + item.num + '</span>' : '') +
            '<span class="card-title">' + item.name + '</span>' +
          '</div><span class="status-dot"></span>' +
        '</div>' +
        '<div class="card-alg">' + activeAlg(item) + '</div>' +
        (meta.length ? '<div class="card-meta">' + meta.join('') + '</div>' : '') +
      '</div>';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.thumb')) { openDetail(item); return; }
      Store.cycleStatus(item.id);
      renderAlgs();
    });
    return card;
  }

  function renderGroup(name, items, container) {
    if (!items.length) return;
    var group = document.createElement('div');
    group.className = 'group';
    var known = items.filter(function (i) { return Store.status(i.id) === 'known'; }).length;
    group.innerHTML = '<div class="group-head"><span class="group-name">' + name +
      '</span><span class="group-count">' + known + '/' + items.length + ' known</span></div>';
    var grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach(function (i) { grid.appendChild(makeCard(i)); });
    group.appendChild(grid);
    container.appendChild(group);
  }

  function renderAlgs() {
    var total = CASES.length;
    var known = CASES.filter(function (c) { return Store.status(c.id) === 'known'; }).length;
    var learning = CASES.filter(function (c) { return Store.status(c.id) === 'learning'; }).length;
    $('overview').innerHTML =
      '<div class="stat known"><div class="num">' + known + '</div><div class="lbl">known</div></div>' +
      '<div class="stat learning"><div class="num">' + learning + '</div><div class="lbl">learning</div></div>' +
      '<div class="stat"><div class="num">' + (total - known - learning) + '</div><div class="lbl">new</div></div>';
    $('bar').innerHTML =
      '<div class="bar-seg bar-known" style="width:' + (known / total * 100) + '%"></div>' +
      '<div class="bar-seg bar-learning" style="width:' + (learning / total * 100) + '%"></div>';

    var content = $('content');
    content.innerHTML = '';

    var oll = CASES.filter(function (c) { return c.set === 'oll' && matches(c); });
    if (oll.length) renderGroup('OLL — orientation (57 cases)', oll, content);

    var pll = CASES.filter(function (c) { return c.set === 'pll' && matches(c); });
    if (pll.length) {
      var head = document.createElement('div');
      head.className = 'section-head';
      head.textContent = 'PLL — permutation (21 cases)';
      content.appendChild(head);
      Algs.PLL_GROUPS.forEach(function (g) {
        renderGroup(g, pll.filter(function (c) { return c.group === g; }), content);
      });
    }

    if (!content.children.length) content.innerHTML = '<div class="empty">no cases match your filters</div>';
  }

  $('setTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn) return;
    Array.prototype.forEach.call($('setTabs').children, function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentSet = btn.dataset.set;
    renderAlgs();
  });

  $('search').addEventListener('input', function (e) {
    searchTerm = e.target.value.trim();
    renderAlgs();
  });

  [['chipLearning', 'learning'], ['chipKnown', 'known']].forEach(function (pair) {
    $(pair[0]).addEventListener('click', function () {
      if (statusFilters.has(pair[1])) { statusFilters.delete(pair[1]); this.classList.remove('active'); }
      else { statusFilters.add(pair[1]); this.classList.add('active'); }
      renderAlgs();
    });
  });

  // ------------------------------------------------------------- case detail
  var openCube = null;

  function closeDetail() {
    var back = document.querySelector('.modal-backdrop');
    if (back) back.remove();
    if (openCube) { openCube.destroy(); openCube = null; }
    document.removeEventListener('keydown', escClose);
  }

  function escClose(e) { if (e.key === 'Escape') closeDetail(); }

  function openDetail(item) {
    closeDetail();
    var state = Cube.caseState(item.alg);
    var times = Store.algTimes(item.id);

    var back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal" role="dialog" aria-label="' + item.name + '">' +
        '<h2>' + item.name + '</h2>' +
        '<p class="sub">' + (item.set === 'oll' ? 'OLL' : item.group) +
          (item.shape ? ' · ' + item.shape : '') +
          (times.length ? ' · best ' + fmt(Store.best(times)) + ' over ' + times.length + ' attempts' : '') +
        '</p>' +
        '<div class="modal-views">' +
          '<div><div>' + diagram(item, 128) + '</div><div class="viewlabel">case</div></div>' +
          '<div id="cube3dSlot"></div>' +
          '<div><div>' + Render.net(state, 250) + '</div><div class="viewlabel">all six sides</div></div>' +
        '</div>' +
        '<div class="variants" id="variants"></div>' +
        '<form class="addalg" id="addAlgForm">' +
          '<input class="search" id="addAlgInput" autocomplete="off" spellcheck="false" ' +
            'placeholder="type your own alg, e.g. R U R\' U R U2 R\'">' +
          '<button class="btn primary" type="submit">check &amp; add</button>' +
        '</form>' +
        '<div class="addalg-result" id="addAlgResult"></div>' +
        '<div class="row">' +
          '<button class="btn" data-status="new">new</button>' +
          '<button class="btn" data-status="learning">learning</button>' +
          '<button class="btn" data-status="known">known</button>' +
          '<span class="spacer"></span>' +
          '<button class="btn primary" id="trainThis">time this alg</button>' +
          '<button class="btn" id="closeDetail">close</button>' +
        '</div>' +
      '</div>';

    var q = function (id) { return back.querySelector('#' + id); };
    var slot = q('cube3dSlot');
    openCube = Render.cube3d(state, 118);
    var holder = document.createElement('div');
    holder.className = 'cube-holder';
    holder.appendChild(openCube);
    var label = document.createElement('div');
    label.className = 'viewlabel';
    label.textContent = 'drag to rotate';
    holder.appendChild(label);
    slot.appendChild(holder);

    /* One row per variant: pick one to use, delete your own, and see what the
       checker worked out about each (length, and any U turn it assumes). */
    function paintVariants() {
      var list = variantsOf(item);
      q('variants').innerHTML = list.map(function (v, i) {
        var badges = ['<span class="badge">' + v.check.moves + ' moves</span>'];
        if (v.check.setup) badges.push('<span class="badge warn">start with ' + v.check.setup + '</span>');
        if (v.check.finish) badges.push('<span class="badge warn">' + v.check.finish + ' after</span>');
        if (v.source !== 'built-in') badges.push('<span class="badge">' + v.source + '</span>');
        return '<div class="variant' + (v.active ? ' active' : '') + '" data-index="' + i + '">' +
          '<button class="variant-pick" data-use="' + i + '" title="use this one" ' +
            'aria-label="use this algorithm">' + (v.active ? '●' : '○') + '</button>' +
          '<div class="variant-body"><div class="variant-alg">' + v.alg + '</div>' +
          '<div class="card-meta">' + badges.join('') + '</div></div>' +
          (v.source === 'yours'
            ? '<button class="btn danger" data-drop="' + i + '" title="delete">✕</button>'
            : '') +
        '</div>';
      }).join('');
      q('variants').dataset.count = list.length;
    }
    paintVariants();

    function paintStatus() {
      back.querySelectorAll('[data-status]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.status === Store.status(item.id));
      });
    }
    paintStatus();

    q('addAlgForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = q('addAlgInput');
      var result = q('addAlgResult');
      var typed = input.value.trim();
      if (!typed) return;
      var already = variantsOf(item).some(function (v) {
        return Cube.canonical(v.alg) === Cube.canonical(typed);
      });
      if (already) {
        result.className = 'addalg-result bad';
        result.textContent = 'you already have that one';
        return;
      }
      var check = Cube.checkAlg(item.alg, typed, item.set);
      if (!check.ok) {
        result.className = 'addalg-result bad';
        result.textContent = '✗ ' + check.reason;
        return;
      }
      Store.addUserAlg(item.id, typed);
      Store.choose(item.id, typed);
      input.value = '';
      result.className = 'addalg-result ok';
      result.textContent = '✓ solves the case in ' + check.moves + ' moves' +
        (check.setup ? ', starting with ' + check.setup : '') +
        (check.finish ? ', then ' + check.finish : '') + ' — added and selected';
      paintVariants();
      renderAlgs();
    });

    back.addEventListener('click', function (e) {
      if (e.target === back || e.target.id === 'closeDetail') { closeDetail(); return; }
      var pick = e.target.closest('[data-use]');
      if (pick) {
        var chosen = variantsOf(item)[Number(pick.dataset.use)];
        Store.choose(item.id, chosen.source === 'built-in' ? null : chosen.alg);
        paintVariants();
        renderAlgs();
        return;
      }
      var drop = e.target.closest('[data-drop]');
      if (drop) {
        var doomed = variantsOf(item)[Number(drop.dataset.drop)];
        Store.removeUserAlg(item.id, doomed.alg);
        paintVariants();
        renderAlgs();
        return;
      }
      var statusBtn = e.target.closest('[data-status]');
      if (statusBtn) {
        Store.setStatus(item.id, statusBtn.dataset.status);
        paintStatus();
        renderAlgs();
      }
      if (e.target.id === 'trainThis') {
        closeDetail();
        pinned = item;
        showView('trainer');
      }
    });

    document.addEventListener('keydown', escClose);
    document.body.appendChild(back);
  }

  // ------------------------------------------------------------- alg trainer
  var scope = 'all';
  var pinned = null;
  var currentCase = null;
  var showAlg = true;
  var advanceTimer = null;

  function scopeCases() {
    if (pinned) return [pinned];
    return CASES.filter(function (c) {
      if (scope === 'all') return true;
      if (scope === 'oll' || scope === 'pll') return c.set === scope;
      return Store.status(c.id) === scope;
    });
  }

  function pickCase() {
    var pool = scopeCases();
    if (!pool.length) { currentCase = null; return; }
    var next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && currentCase && next.id === currentCase.id) {
      next = pool[(pool.indexOf(next) + 1) % pool.length];
    }
    currentCase = next;
  }

  var trainerTimer = new Timer({
    onChange: paintTrainerDisplay,
    onStop: function (ms) {
      if (!currentCase) return;
      Store.addAlgTime(currentCase.id, ms);
      renderTrainerStats();
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(function () {
        pickCase();
        renderTrainer();
      }, 1400);
    }
  });

  function paintTrainerDisplay() {
    var el = $('trainerDisplay');
    el.className = 'timer-display' + (trainerTimer.state === 'holding' ? ' holding' :
      trainerTimer.state === 'ready' ? ' ready' : '');
    el.textContent = fmt(trainerTimer.elapsed);
  }

  function renderTrainerStats() {
    if (!currentCase) { $('trainerStats').innerHTML = ''; $('trainerTimes').innerHTML = ''; return; }
    var times = Store.algTimes(currentCase.id);
    var last = times.length ? times[times.length - 1].t : null;
    function cell(label, value) {
      return '<div class="stat"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>';
    }
    $('trainerStats').innerHTML =
      cell('last', fmt(last)) +
      cell('best', fmt(Store.best(times))) +
      cell('ao5', fmt(Store.averageOf(times, 5))) +
      cell('attempts', times.length);

    $('trainerHistoryLabel').textContent = 'Recent — ' + currentCase.name;
    $('trainerTimes').innerHTML = times.slice(-8).reverse().map(function (t, i) {
      return '<div class="time-row"><span class="idx">' + (times.length - i) + '</span>' +
        '<span class="val">' + fmt(t.t) + '</span>' +
        '<span class="scr">' + new Date(t.ts).toLocaleString() + '</span></div>';
    }).join('') || '<div class="empty">no times for this case yet</div>';
  }

  function renderTrainer() {
    if (!currentCase || (pinned && currentCase.id !== pinned.id)) pickCase();
    trainerTimer.reset();
    if (!currentCase) {
      $('trainerDiagram').innerHTML = '';
      $('trainerName').textContent = 'no cases in this scope';
      $('trainerAlg').textContent = '';
      renderTrainerStats();
      return;
    }
    $('trainerDiagram').innerHTML = diagram(currentCase, 132);
    $('trainerName').textContent = currentCase.name + (pinned ? ' (pinned)' : '');
    // If the alg you picked is written from another angle, say so here too.
    var alg = activeAlg(currentCase);
    var note = alg === currentCase.alg ? null : Cube.checkAlg(currentCase.alg, alg, currentCase.set);
    $('trainerAlg').textContent = (note && note.setup ? '(' + note.setup + ' first) ' : '') + alg;
    $('trainerAlg').className = 'timer-alg' + (showAlg ? '' : ' hidden');
    paintTrainerDisplay();
    renderTrainerStats();
  }

  $('scopeTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn) return;
    Array.prototype.forEach.call($('scopeTabs').children, function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    scope = btn.dataset.scope;
    pinned = null;
    currentCase = null;
    renderTrainer();
  });

  $('toggleAlg').addEventListener('click', function () {
    showAlg = !showAlg;
    this.textContent = showAlg ? 'hide alg' : 'show alg';
    $('trainerAlg').className = 'timer-alg' + (showAlg ? '' : ' hidden');
  });

  $('skipCase').addEventListener('click', function () {
    clearTimeout(advanceTimer);
    pinned = null;
    pickCase();
    renderTrainer();
  });

  $('clearCaseTimes').addEventListener('click', function () {
    if (!currentCase) return;
    if (confirm('Clear all recorded times for ' + currentCase.name + '?')) {
      Store.clearAlgTimes(currentCase.id);
      renderTrainerStats();
      renderAlgs();
    }
  });

  // -------------------------------------------------------------- full solves
  var scramble = Cube.scramble(20);

  var solveTimer = new Timer({
    onChange: paintSolveDisplay,
    inspection: function () { return !!Store.settings().inspection; },
    onStop: function (ms, penalty) {
      Store.addSolve(ms, scramble);
      if (penalty) Store.updateSolve(Store.solves().length - 1, { penalty: penalty });
      scramble = Cube.scramble(20);
      renderSolves();
    }
  });

  function paintSolveDisplay() {
    var el = $('solveDisplay');
    var cls = 'timer-display';
    if (solveTimer.state === 'holding' || solveTimer.state === 'inspecting-holding') cls += ' holding';
    else if (solveTimer.state === 'ready') cls += ' ready';
    else if (solveTimer.isInspecting()) cls += ' inspecting';
    el.className = cls;
    var value = solveTimer.display();
    el.textContent = typeof value === 'string' ? value : fmt(value);
  }

  function renderSolves() {
    $('scramble').textContent = scramble;
    paintSolveDisplay();
    $('inspectionToggle').textContent = '15s inspection: ' + (Store.settings().inspection ? 'on' : 'off');
    $('inspectionToggle').classList.toggle('on', !!Store.settings().inspection);

    var list = Store.solves();
    function cell(label, value) {
      return '<div class="stat"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>';
    }
    $('solveStats').innerHTML =
      cell('best', fmt(Store.best(list))) +
      cell('ao5', fmt(Store.averageOf(list, 5))) +
      cell('ao12', fmt(Store.averageOf(list, 12))) +
      cell('solves', list.length);

    $('solveTimes').innerHTML = list.slice().reverse().map(function (s, i) {
      var index = list.length - i;
      var cls = 'time-row' + (s.penalty === 'dnf' ? ' dnf' : s.penalty === '+2' ? ' plus2' : '');
      var shown = s.penalty === 'dnf' ? 'DNF' : fmt(s.t + (s.penalty === '+2' ? 2000 : 0)) + (s.penalty === '+2' ? '+' : '');
      return '<div class="' + cls + '"><span class="idx">' + index + '</span>' +
        '<span class="val">' + shown + '</span>' +
        '<span class="scr">' + s.scramble + '</span></div>';
    }).join('') || '<div class="empty">no solves yet — hold space to start</div>';
  }

  $('newScramble').addEventListener('click', function () {
    scramble = Cube.scramble(20);
    $('scramble').textContent = scramble;
  });

  $('inspectionToggle').addEventListener('click', function () {
    Store.setSetting('inspection', !Store.settings().inspection);
    renderSolves();
  });

  function lastSolvePenalty(penalty) {
    var list = Store.solves();
    if (!list.length) return;
    var last = list[list.length - 1];
    Store.updateSolve(list.length - 1, { penalty: last.penalty === penalty ? '' : penalty });
    renderSolves();
  }
  $('plus2').addEventListener('click', function () { lastSolvePenalty('+2'); });
  $('dnf').addEventListener('click', function () { lastSolvePenalty('dnf'); });

  $('deleteSolve').addEventListener('click', function () {
    var list = Store.solves();
    if (list.length) { Store.removeSolve(list.length - 1); renderSolves(); }
  });

  $('clearSession').addEventListener('click', function () {
    if (Store.solves().length && confirm('Delete all ' + Store.solves().length + ' solves?')) {
      Store.clearSolves();
      renderSolves();
    }
  });

  // ------------------------------------------------------------------- data
  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cfop-tracker-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });

  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        Store.importJSON(reader.result);
        showView(currentView);
        alert('Imported.');
      } catch (err) {
        alert('That file could not be read: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('resetBtn').addEventListener('click', function () {
    if (confirm('Reset all progress? This clears every known/learning mark. Times are kept.')) {
      Store.resetProgress();
      renderAlgs();
    }
  });

  // ------------------------------------------------------------------- start
  showView('algs');
})();
