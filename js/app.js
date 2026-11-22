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

  function showView(name) {
    currentView = name;
    ['algs', 'trainer', 'solves'].forEach(function (v) {
      $('view-' + v).hidden = v !== name;
    });
    Array.prototype.forEach.call($('viewTabs').children, function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
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
  var currentSet = 'all';        // follows focus: 'all' | 'oll' | 'pll'
  var focus = null;              // the set whose colour the page has taken on
  var statusFilter = null;       // 'known' | 'learning' | 'new' | null
  var searchTerm = '';
  var STATUS_WORD = { known: 'Known', learning: 'Learning', 'new': 'To learn' };

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
    if (statusFilter && Store.status(item.id) !== statusFilter) return false;
    if (!searchTerm) return true;
    var hay = (item.name + ' ' + (item.group || '') + ' ' + item.shape).toLowerCase();
    if (hay.indexOf(searchTerm.toLowerCase()) >= 0) return true;
    return notationMatch(item, searchTerm);
  }

  /* PLL cards show just the letter, since the blue band already says PLL;
     the full name stays in the text for screen readers and search. */
  function titleOf(item) {
    if (item.set === 'pll') return item.short + '<span class="sr-only"> perm</span>';
    return item.name;
  }

  function makeCard(item) {
    var status = Store.status(item.id);
    var card = document.createElement('div');
    card.className = 'card' + (status !== 'new' ? ' ' + status : '');
    card.tabIndex = 0;
    var best = Store.best(Store.algTimes(item.id));
    var variants = variantsOf(item);
    var meta = [];
    if (status !== 'new') meta.push('<span class="state-word">' + STATUS_WORD[status] + '</span>');
    if (item.shape) meta.push('<span class="badge">' + item.shape + '</span>');
    if (variants.length > 1) meta.push('<span class="badge">' + variants.length + ' algs</span>');
    if (best != null) meta.push('<span class="card-best">Best ' + fmt(best) + '</span>');

    card.innerHTML =
      '<button class="thumb" title="Show all sides" aria-label="Show all sides of ' + item.name + '">' +
        diagram(item, 84) +
      '</button>' +
      '<h3 class="card-title">' + titleOf(item) + '</h3>' +
      '<div class="card-alg">' + LCD.notation(activeAlg(item)) + '</div>' +
      (meta.length ? '<div class="card-meta">' + meta.join('') + '</div>' : '');

    card.addEventListener('click', function (e) {
      if (e.target.closest('.thumb')) { openDetail(item); return; }
      Store.cycleStatus(item.id);
      renderAlgs();
      var again = document.querySelector('.card[data-id="' + item.id + '"]');
      if (again && document.activeElement === document.body) again.focus();
    });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      Store.cycleStatus(item.id);
      renderAlgs();
      var again = document.querySelector('.card[data-id="' + item.id + '"]');
      if (again) again.focus();
    });
    card.dataset.id = item.id;
    return card;
  }

  function grid(items) {
    var g = document.createElement('div');
    g.className = 'grid';
    items.forEach(function (i) { g.appendChild(makeCard(i)); });
    return g;
  }

  var BAND_ABOUT = {
    oll: 'Orient the last layer: make the top all yellow.',
    pll: 'Permute the last layer: move the pieces home.'
  };

  function renderBand(set, items, container) {
    var all = CASES.filter(function (c) { return c.set === set; });
    var known = all.filter(function (c) { return Store.status(c.id) === 'known'; }).length;
    var band = document.createElement('section');
    band.className = 'band ' + set;
    band.id = 'band-' + set;
    var label = set.toUpperCase();
    band.innerHTML =
      '<div class="wrap">' +
        '<div class="band-head">' +
          '<button class="band-title" data-focus="' + set + '" aria-pressed="' + (focus === set) + '" ' +
            'title="' + (focus === set ? 'Show all cases' : 'Show only ' + label) + '">' + label + '</button>' +
          '<div class="band-about"><strong>' + known + ' of ' + all.length + ' known</strong>' +
            '<span>' + BAND_ABOUT[set] + '</span></div>' +
          (focus === set ? '<button class="band-back" data-focus="">Show all cases</button>' : '') +
        '</div>' +
      '</div>';
    var inner = band.firstChild;
    if (set === 'oll') inner.appendChild(grid(items));
    else {
      Algs.PLL_GROUPS.forEach(function (g) {
        var inGroup = items.filter(function (c) { return c.group === g; });
        if (!inGroup.length) return;
        var head = document.createElement('h3');
        head.className = 'subgroup';
        var groupKnown = all.filter(function (c) { return c.group === g && Store.status(c.id) === 'known'; }).length;
        var groupTotal = all.filter(function (c) { return c.group === g; }).length;
        head.innerHTML = g + ' <span>' + groupKnown + ' of ' + groupTotal + ' known</span>';
        inner.appendChild(head);
        inner.appendChild(grid(inGroup));
      });
    }
    container.appendChild(band);
  }

  function renderDevice() {
    var count = { known: 0, learning: 0, 'new': 0 };
    CASES.forEach(function (c) { count[Store.status(c.id)]++; });
    $('lcdKnown').innerHTML = LCD.count(count.known, 2, count.known + ' known');
    $('lcdLearning').innerHTML = LCD.count(count.learning, 2, count.learning + ' learning');
    $('lcdNew').innerHTML = LCD.count(count['new'], 2, count['new'] + ' to go');
    document.querySelectorAll('.readout').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.filter === statusFilter));
    });
    var strip = $('strip');
    strip.innerHTML = CASES.map(function (c, i) {
      var s = Store.status(c.id);
      return '<button class="' + s + '" data-i="' + i + '" tabindex="' + (i === stripIndex ? 0 : -1) + '" ' +
        'aria-label="' + c.name + ', ' + STATUS_WORD[s].toLowerCase() + '"></button>';
    }).join('');
    $('stripFirst').textContent = CASES[0].name;
    $('stripLast').textContent = CASES[CASES.length - 1].name;
    hideTip();
    return count;
  }

  function renderAlgs() {
    var count = renderDevice();

    var note = $('filterNote');
    if (statusFilter) {
      var what = { known: 'known cases', learning: 'cases you are learning', 'new': 'cases still to learn' }[statusFilter];
      note.innerHTML = '<span>Showing only ' + what + ' (' + count[statusFilter] + ').</span>' +
        '<button class="link-btn" id="clearFilter">Show all</button>';
      note.hidden = false;
    } else note.hidden = true;

    var content = $('content');
    content.innerHTML = '';
    ['oll', 'pll'].forEach(function (set) {
      var items = CASES.filter(function (c) { return c.set === set && matches(c); });
      if (items.length) renderBand(set, items, content);
    });
    if (!content.children.length) {
      content.innerHTML = '<div class="wrap"><p class="empty">No cases match. Clear the search' +
        (statusFilter ? ' or the filter' : '') + ' to see them again.</p></div>';
    }
  }

  $('search').addEventListener('input', function (e) {
    searchTerm = e.target.value.trim();
    renderAlgs();
  });

  /* The three readouts filter the list by status; press again to clear. */
  $('readouts').addEventListener('click', function (e) {
    var btn = e.target.closest('.readout');
    if (!btn) return;
    statusFilter = statusFilter === btn.dataset.filter ? null : btn.dataset.filter;
    renderAlgs();
  });
  $('filterNote').addEventListener('click', function (e) {
    if (e.target.id === 'clearFilter') { statusFilter = null; renderAlgs(); }
  });

  /* OLL / PLL: the page floods with the set's sticker colour, then shows only
     that set. Pressing the heading again (or "Show all cases") floods back. */
  var wiping = false;
  function setFocus(next, from) {
    if (wiping || next === focus) return;
    function apply() {
      focus = next;
      currentSet = next || 'all';
      if (next) document.body.dataset.focus = next; else delete document.body.dataset.focus;
      var leaving = focus ? null : from && from.set;
      renderAlgs();
      var target = $(next ? 'band-' + next : 'band-' + (leaving || 'oll'));
      if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - 12);
      var title = document.querySelector('#band-' + (next || leaving || 'oll') + ' .band-title');
      if (title) title.focus({ preventScroll: true });
    }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { apply(); return; }
    var wipe = $('wipe'), dot = wipe.firstElementChild;
    var vw = wipe.clientWidth, vh = wipe.clientHeight;
    var x = from ? from.x : vw / 2, y = from ? from.y : vh * 0.3;
    var r = Math.ceil(Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))) + 2;
    wipe.className = 'wipe';
    dot.style.cssText = 'left:' + (x - r) + 'px;top:' + (y - r) + 'px;width:' + 2 * r + 'px;height:' + 2 * r + 'px;' +
      'background:' + (next === 'oll' ? 'var(--yellow)' : next === 'pll' ? 'var(--blue)' : 'var(--page-base)') + ';transform:scale(0)';
    void wipe.offsetWidth;
    wiping = true;
    wipe.className = 'wipe run';
    dot.style.transform = 'scale(1)';
    setTimeout(function () {
      // Swap the page while it's fully covered, then wait until the new list
      // has painted before fading, so the fade never stalls on a slow phone.
      apply();
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        wipe.className = 'wipe fade';
        setTimeout(function () { wipe.className = 'wipe'; wiping = false; }, 240);
      }); });
    }, 560);
  }
  $('content').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-focus]');
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    var set = btn.closest('.band') ? btn.closest('.band').id.replace('band-', '') : null;
    setFocus(btn.dataset.focus || null, { x: r.left + r.width / 2, y: r.top + r.height / 2, set: set });
  });

  /* The strip: hover or scrub across it to see each case, click to open it.
     Arrow keys move along it; only one square is in the tab order. */
  var stripIndex = 0;
  var hot = -1;
  function showTip(i) {
    var strip = $('strip'), btn = strip.children[i], tip = $('stripTip');
    if (!btn) return;
    if (hot >= 0 && strip.children[hot]) strip.children[hot].classList.remove('hot');
    hot = i;
    btn.classList.add('hot');
    var c = CASES[i];
    tip.innerHTML = c.name + ' <span>' + STATUS_WORD[Store.status(c.id)].toLowerCase() + '</span>';
    tip.hidden = false;
    var wrap = strip.parentNode.getBoundingClientRect(), b = btn.getBoundingClientRect();
    var center = b.left - wrap.left + b.width / 2;
    var half = tip.offsetWidth / 2;
    var left = Math.max(half, Math.min(wrap.width - half, center));
    tip.style.left = left + 'px';
    tip.style.bottom = (wrap.bottom - b.top + 12) + 'px';
    tip.style.setProperty('--ax', (center - left + half) + 'px');
  }
  function hideTip() {
    var strip = $('strip');
    if (hot >= 0 && strip.children[hot]) strip.children[hot].classList.remove('hot');
    hot = -1;
    $('stripTip').hidden = true;
  }
  function stripButtonAt(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.parentNode === $('strip') ? el : null;
  }
  $('strip').addEventListener('pointermove', function (e) {
    var btn = e.pointerType === 'mouse' ? e.target.closest('#strip > button') : stripButtonAt(e.clientX, e.clientY);
    if (btn) showTip(Number(btn.dataset.i));
  });
  $('strip').addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    var btn = stripButtonAt(e.clientX, e.clientY);
    if (btn) showTip(Number(btn.dataset.i));
  });
  $('strip').addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse' && !$('strip').contains(document.activeElement)) hideTip();
  });
  $('strip').addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'mouse') setTimeout(hideTip, 900);
  });
  $('strip').addEventListener('click', function (e) {
    var btn = e.target.closest('#strip > button');
    if (btn) { stripIndex = Number(btn.dataset.i); openDetail(CASES[stripIndex]); }
  });
  $('strip').addEventListener('focusin', function (e) {
    if (e.target.dataset.i != null) showTip(Number(e.target.dataset.i));
  });
  $('strip').addEventListener('focusout', function (e) {
    if (!$('strip').contains(e.relatedTarget)) hideTip();
  });
  $('strip').addEventListener('keydown', function (e) {
    var i = Number(e.target.dataset.i);
    var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: CASES.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    next = Math.max(0, Math.min(CASES.length - 1, next));
    var strip = $('strip');
    strip.children[i].tabIndex = -1;
    strip.children[next].tabIndex = 0;
    strip.children[next].focus();
    stripIndex = next;
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
    hideTip();
    var state = Cube.caseState(item.alg);
    var times = Store.algTimes(item.id);

    var back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal" role="dialog" aria-label="' + item.name + '">' +
        '<h2>' + item.name + '</h2>' +
        '<p class="sub">' + (item.set === 'oll' ? 'OLL' : 'PLL, ' + item.group.toLowerCase()) +
          (item.shape ? ', ' + item.shape : '') +
          (times.length ? '. Best ' + fmt(Store.best(times)) + ' over ' + times.length + ' attempts.' : '') +
        '</p>' +
        '<div class="modal-views">' +
          '<div><div>' + diagram(item, 128) + '</div><div class="viewlabel">Case</div></div>' +
          '<div id="cube3dSlot"></div>' +
          '<div><div>' + Render.net(state, 250) + '</div><div class="viewlabel">All six sides</div></div>' +
        '</div>' +
        '<div class="variants" id="variants"></div>' +
        '<form class="addalg" id="addAlgForm">' +
          '<input class="search" id="addAlgInput" autocomplete="off" spellcheck="false" ' +
            'placeholder="Type your own alg, e.g. R U R\' U R U2 R\'">' +
          '<button class="btn primary" type="submit">Check and add</button>' +
        '</form>' +
        '<div class="addalg-result" id="addAlgResult"></div>' +
        '<div class="row">' +
          '<button class="btn" data-status="new">To learn</button>' +
          '<button class="btn" data-status="learning">Learning</button>' +
          '<button class="btn" data-status="known">Known</button>' +
          '<span class="spacer"></span>' +
          '<button class="btn primary" id="trainThis">Time this alg</button>' +
          '<button class="btn" id="closeDetail">Close</button>' +
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
    label.textContent = 'Drag to rotate';
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
          '<div class="variant-body"><div class="variant-alg">' + LCD.notation(v.alg) + '</div>' +
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
        result.textContent = 'You already have that one.';
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
        (check.finish ? ', then ' + check.finish : '') + '. Added and selected.';
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

  /* Both timers draw onto a Stackmat: the pads' lights show the state, the
     LCD shows the time (or the inspection countdown). */
  function paintStackmat(panel, display, timer, value) {
    var st = timer.state;
    var s = (st === 'holding' || st === 'inspecting-holding') ? 'holding' : st === 'ready' ? 'ready' :
      st === 'running' ? 'running' : timer.isInspecting() ? 'inspecting' : 'idle';
    panel.dataset.state = s;
    display.className = 'lcd timer-display' + (s === 'idle' || s === 'running' ? '' : ' ' + s);
    if (typeof value === 'string') {
      display.innerHTML = LCD.text(value === 'DNF' ? 'dnF' : value === '+2' ? '2' : value,
        value === '+2' ? 'plus 2 seconds' : value === 'DNF' ? 'did not finish' : value + ' seconds of inspection left');
    } else display.innerHTML = LCD.time(value);
  }

  function paintTrainerDisplay() {
    paintStackmat($('trainerPanel'), $('trainerDisplay'), trainerTimer, trainerTimer.elapsed);
  }

  function renderTrainerStats() {
    if (!currentCase) { $('trainerStats').innerHTML = ''; $('trainerTimes').innerHTML = ''; return; }
    var times = Store.algTimes(currentCase.id);
    var last = times.length ? times[times.length - 1].t : null;
    function cell(label, value) {
      return '<div class="stat"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>';
    }
    $('trainerStats').innerHTML =
      cell('Last', fmt(last)) +
      cell('Best', fmt(Store.best(times))) +
      cell('ao5', fmt(Store.averageOf(times, 5))) +
      cell('Attempts', times.length);

    $('trainerHistoryLabel').textContent = 'Recent times for ' + currentCase.name;
    $('trainerTimes').innerHTML = times.slice(-8).reverse().map(function (t, i) {
      return '<div class="time-row"><span class="idx">' + (times.length - i) + '</span>' +
        '<span class="val">' + fmt(t.t) + '</span>' +
        '<span class="scr">' + new Date(t.ts).toLocaleString() + '</span></div>';
    }).join('') || '<div class="empty">No times for this case yet. Hold space to start.</div>';
  }

  function renderTrainer() {
    if (!currentCase || (pinned && currentCase.id !== pinned.id)) pickCase();
    trainerTimer.reset();
    if (!currentCase) {
      $('trainerDiagram').innerHTML = '';
      $('trainerName').textContent = 'No cases here yet';
      $('trainerAlg').textContent = 'Mark some cases on the Algorithms page, or pick another set above.';
      renderTrainerStats();
      return;
    }
    $('trainerDiagram').innerHTML = diagram(currentCase, 128);
    $('trainerName').textContent = currentCase.name + (pinned ? ' (pinned)' : '');
    // If the alg you picked is written from another angle, say so here too.
    var alg = activeAlg(currentCase);
    var note = alg === currentCase.alg ? null : Cube.checkAlg(currentCase.alg, alg, currentCase.set);
    $('trainerAlg').innerHTML = (note && note.setup ? '(' + note.setup + ' first) ' : '') + LCD.notation(alg);
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
    this.textContent = showAlg ? 'Hide alg' : 'Show alg';
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

  var SOLVE_HINTS = {
    normal: 'Hold <kbd>Space</kbd> until both lights turn green, let go to start, press any key to stop.',
    inspecting: 'Inspecting. Hold <kbd>Space</kbd> until the lights turn green, then let go to start.',
    '+2': 'Past 15 seconds: starting now adds 2 seconds.',
    DNF: 'Past 17 seconds: this solve will count as DNF.'
  };
  var solveHintKey = 'normal';
  function paintSolveDisplay() {
    var value = solveTimer.display();
    paintStackmat($('solvePanel'), $('solveDisplay'), solveTimer, value);
    var key = value === '+2' || value === 'DNF' ? value : solveTimer.isInspecting() ? 'inspecting' : 'normal';
    if (key !== solveHintKey) { solveHintKey = key; $('solveHint').innerHTML = SOLVE_HINTS[key]; }
  }

  function renderSolves() {
    $('scramble').innerHTML = LCD.notation(scramble);
    paintSolveDisplay();
    $('inspectionToggle').textContent = '15s inspection: ' + (Store.settings().inspection ? 'on' : 'off');
    $('inspectionToggle').classList.toggle('on', !!Store.settings().inspection);

    var list = Store.solves();
    function cell(label, value) {
      return '<div class="stat"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>';
    }
    $('solveStats').innerHTML =
      cell('Best', fmt(Store.best(list))) +
      cell('ao5', fmt(Store.averageOf(list, 5))) +
      cell('ao12', fmt(Store.averageOf(list, 12))) +
      cell('Solves', list.length);

    $('solveTimes').innerHTML = list.slice().reverse().map(function (s, i) {
      var index = list.length - i;
      var cls = 'time-row' + (s.penalty === 'dnf' ? ' dnf' : s.penalty === '+2' ? ' plus2' : '');
      var shown = s.penalty === 'dnf' ? 'DNF' : fmt(s.t + (s.penalty === '+2' ? 2000 : 0)) + (s.penalty === '+2' ? '+' : '');
      return '<div class="' + cls + '"><span class="idx">' + index + '</span>' +
        '<span class="val">' + shown + '</span>' +
        '<span class="scr">' + LCD.notation(s.scramble) + '</span></div>';
    }).join('') || '<div class="empty">No solves yet. Hold space to start.</div>';
  }

  $('newScramble').addEventListener('click', function () {
    scramble = Cube.scramble(20);
    $('scramble').innerHTML = LCD.notation(scramble);
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

  // --------------------------------------------------------------- settings
  /* Light is the default for everyone; dark is a choice that sticks. */
  function applySettings() {
    var s = Store.settings();
    var dark = s.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('themeBtn').textContent = dark ? 'Light mode' : 'Dark mode';
    var words = s.words !== false;
    document.body.classList.toggle('no-words', !words);
    $('wordsBtn').textContent = 'Status words: ' + (words ? 'on' : 'off');
    $('wordsBtn').title = 'Write "Known" or "Learning" on each case as well as colouring it';
  }
  $('themeBtn').addEventListener('click', function () {
    Store.setSetting('theme', Store.settings().theme === 'dark' ? 'light' : 'dark');
    applySettings();
  });
  $('wordsBtn').addEventListener('click', function () {
    Store.setSetting('words', Store.settings().words === false);
    applySettings();
  });

  // ------------------------------------------------------------------- start
  applySettings();
  showView('algs');
})();
