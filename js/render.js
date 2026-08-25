/*
 * render.js — pictures of a case: the classic top-down diagram, an unfolded
 * net of all six sides, and a draggable 3D cube. All three read the same state
 * produced by cube.js, so they can never disagree with each other.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cube.js'));
  else root.Render = factory(root.Cube);
})(typeof self !== 'undefined' ? self : this, function (Cube) {
  'use strict';

  var COLORS = {
    U: '#f2d02c', D: '#f7f7f2', F: '#3aa856', B: '#2f6fd0',
    R: '#d63c30', L: '#ee8b2b', dim: '#3a3a44', line: '#101014'
  };

  var CELL = 24, STRIP = 10, GAP = 2, PAD = 2;
  var ORIGIN = PAD + STRIP + GAP; // 14

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function rect(x, y, w, h, fill, r) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (r == null ? 2 : r) + '" fill="' + fill + '" stroke="' + COLORS.line + '" stroke-width="1"/>';
  }

  /* Strip stickers, in reading order around the diagram. The index gymnastics
     come from each side face being read from outside, not from above. */
  function strips(f) {
    return {
      top: [f.B[2], f.B[1], f.B[0]],      // back face, seen from above
      bottom: [f.F[0], f.F[1], f.F[2]],
      left: [f.L[0], f.L[1], f.L[2]],
      right: [f.R[2], f.R[1], f.R[0]]
    };
  }

  function stripRects(f, colorOf) {
    var s = strips(f), out = '';
    for (var i = 0; i < 3; i++) {
      var at = ORIGIN + CELL * i;
      out += rect(at, PAD, CELL, STRIP, colorOf(s.top[i]));
      out += rect(at, ORIGIN + CELL * 3 + GAP, CELL, STRIP, colorOf(s.bottom[i]));
      out += rect(PAD, at, STRIP, CELL, colorOf(s.left[i]));
      out += rect(ORIGIN + CELL * 3 + GAP, at, STRIP, CELL, colorOf(s.right[i]));
    }
    return out;
  }

  function centerOf(x, z) {
    return [ORIGIN + CELL * (x + 1) + CELL / 2, ORIGIN + CELL * (z + 1) + CELL / 2];
  }

  /* Arrows for PLL: one per piece that moves, collapsed to a double-headed
     arrow when two pieces simply swap. */
  function arrows(state) {
    var pieces = Cube.topLayerPieces(state).filter(function (p) { return !p.solved; });
    var drawn = {}, out = '';
    pieces.forEach(function (p) {
      var key = p.from.join(',') + '>' + p.to.join(',');
      var back = p.to.join(',') + '>' + p.from.join(',');
      if (drawn[key] || drawn[back]) return;
      var isSwap = pieces.some(function (q) { return q.from.join() === p.to.join() && q.to.join() === p.from.join(); });
      drawn[key] = true;
      var a = centerOf(p.from[0], p.from[1]);
      var b = centerOf(p.to[0], p.to[1]);
      // Pull the ends in so the heads sit inside the stickers.
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.hypot(dx, dy) || 1;
      var trim = 7;
      var x1 = a[0] + dx / len * trim, y1 = a[1] + dy / len * trim;
      var x2 = b[0] - dx / len * trim, y2 = b[1] - dy / len * trim;
      out += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
        '" stroke="#15151a" stroke-width="3.4" stroke-linecap="round"' +
        ' marker-end="url(#ah)"' + (isSwap ? ' marker-start="url(#ah2)"' : '') + '/>';
    });
    return out;
  }

  var MARKERS =
    '<defs>' +
    '<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">' +
    '<path d="M0,0 L10,5 L0,10 z" fill="#15151a"/></marker>' +
    '<marker id="ah2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">' +
    '<path d="M10,0 L0,5 L10,10 z" fill="#15151a"/></marker>' +
    '</defs>';

  /* The card picture: OLL shows orientation only, PLL shows colours + arrows. */
  function diagram(item, size) {
    var state = Cube.caseState(item.alg);
    var f = Cube.facelets(state);
    var isOll = item.set === 'oll';
    var colorOf = isOll
      ? function (c) { return c === 'U' ? COLORS.U : COLORS.dim; }
      : function (c) { return COLORS[c] || COLORS.dim; };

    var svg = '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
      '" class="diagram" role="img" aria-label="' + esc(item.name) + ' case">' + MARKERS;
    svg += stripRects(f, colorOf);
    for (var i = 0; i < 9; i++) {
      svg += rect(ORIGIN + CELL * (i % 3), ORIGIN + CELL * Math.floor(i / 3), CELL, CELL, colorOf(f.U[i]));
    }
    if (!isOll) svg += arrows(state);
    return svg + '</svg>';
  }

  /* Unfolded map of all six sides, laid out as the usual cross. */
  function net(state, width) {
    var f = Cube.facelets(state);
    var c = 16, face = c * 3, gap = 5, pad = 3;
    var w = face * 4 + gap * 3 + pad * 2;
    var h = face * 3 + gap * 2 + pad * 2;
    var pos = {
      U: [pad + face + gap, pad],
      L: [pad, pad + face + gap],
      F: [pad + face + gap, pad + face + gap],
      R: [pad + (face + gap) * 2, pad + face + gap],
      B: [pad + (face + gap) * 3, pad + face + gap],
      D: [pad + face + gap, pad + (face + gap) * 2]
    };
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + (width || w) +
      '" class="net" role="img" aria-label="unfolded cube">';
    Object.keys(pos).forEach(function (name) {
      var ox = pos[name][0], oy = pos[name][1];
      for (var i = 0; i < 9; i++) {
        svg += rect(ox + c * (i % 3), oy + c * Math.floor(i / 3), c, c, COLORS[f[name][i]] || COLORS.dim, 1.5);
      }
      svg += '<text x="' + (ox + face / 2) + '" y="' + (oy + face + 8) +
        '" text-anchor="middle" font-size="7" fill="#8a8a94" font-family="monospace">' + name + '</text>';
    });
    return svg + '</svg>';
  }

  /* Draggable CSS 3D cube. Returns an element; call .setState() to repaint. */
  function cube3d(state, size) {
    var wrap = document.createElement('div');
    wrap.className = 'cube3d';
    wrap.style.setProperty('--cube-size', (size || 150) + 'px');
    var scene = document.createElement('div');
    scene.className = 'cube3d-scene';
    wrap.appendChild(scene);

    var faces = {};
    ['U', 'D', 'F', 'B', 'L', 'R'].forEach(function (name) {
      var face = document.createElement('div');
      face.className = 'cube3d-face cube3d-' + name;
      for (var i = 0; i < 9; i++) {
        var st = document.createElement('i');
        face.appendChild(st);
      }
      scene.appendChild(face);
      faces[name] = face;
    });

    var rx = -26, ry = -34, dragging = false, lastX = 0, lastY = 0;
    function paint() { scene.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)'; }
    paint();

    wrap.setState = function (next) {
      var f = Cube.facelets(next);
      Object.keys(faces).forEach(function (name) {
        var cells = faces[name].children;
        for (var i = 0; i < 9; i++) cells[i].style.background = COLORS[f[name][i]] || COLORS.dim;
      });
    };
    wrap.setState(state);

    function down(e) {
      dragging = true;
      var pt = e.touches ? e.touches[0] : e;
      lastX = pt.clientX; lastY = pt.clientY;
    }
    function move(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      ry += (pt.clientX - lastX) * 0.6;
      rx -= (pt.clientY - lastY) * 0.6;
      rx = Math.max(-89, Math.min(89, rx));
      lastX = pt.clientX; lastY = pt.clientY;
      paint();
      if (e.cancelable) e.preventDefault();
    }
    function up() { dragging = false; }

    wrap.addEventListener('mousedown', down);
    wrap.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move);
    wrap.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    wrap.addEventListener('touchend', up);
    wrap.destroy = function () {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    return wrap;
  }

  /* Which edges point up — the first thing you look for when recognising OLL. */
  function ollShape(item) {
    var f = Cube.facelets(Cube.caseState(item.alg));
    var up = [f.U[1], f.U[3], f.U[5], f.U[7]].filter(function (c) { return c === 'U'; }).length;
    if (up === 4) return 'cross';
    if (up === 0) return 'dot';
    // A line has the two oriented edges opposite each other.
    var oriented = [f.U[1] === 'U', f.U[3] === 'U', f.U[5] === 'U', f.U[7] === 'U'];
    if (up === 2) return (oriented[0] && oriented[3]) || (oriented[1] && oriented[2]) ? 'line' : 'L shape';
    return 'mixed';
  }

  return { diagram: diagram, net: net, cube3d: cube3d, ollShape: ollShape, COLORS: COLORS };
});
