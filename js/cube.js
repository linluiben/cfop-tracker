/*
 * cube.js — a tiny 3x3x3 cube model.
 *
 * Cases are not hand-drawn: every OLL/PLL picture in this app is derived by
 * applying the inverse of the algorithm to a solved cube and reading the
 * resulting stickers. If an algorithm is wrong, its picture is wrong too —
 * which is exactly what tools/verify-algs.cjs checks for.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cube = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Axis directions: +x, -x, +y, -y, +z, -z
  var DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  var FACE_OF_DIR = ['R', 'L', 'U', 'D', 'F', 'B'];

  function dirIndex(v) {
    for (var i = 0; i < 6; i++) {
      if (DIRS[i][0] === v[0] && DIRS[i][1] === v[1] && DIRS[i][2] === v[2]) return i;
    }
    return -1;
  }

  // 90° rotations, each named after the face turn that spins that way.
  var ROT = {
    U: function (p) { return [-p[2], p[1], p[0]]; },
    D: function (p) { return [p[2], p[1], -p[0]]; },
    R: function (p) { return [p[0], p[2], -p[1]]; },
    L: function (p) { return [p[0], -p[2], p[1]]; },
    F: function (p) { return [p[1], -p[0], p[2]]; },
    B: function (p) { return [-p[1], p[0], p[2]]; }
  };

  // layer(p) -> true when the cubie is part of the turned slab.
  var MOVES = {
    U: { rot: 'U', layer: function (p) { return p[1] === 1; } },
    D: { rot: 'D', layer: function (p) { return p[1] === -1; } },
    R: { rot: 'R', layer: function (p) { return p[0] === 1; } },
    L: { rot: 'L', layer: function (p) { return p[0] === -1; } },
    F: { rot: 'F', layer: function (p) { return p[2] === 1; } },
    B: { rot: 'B', layer: function (p) { return p[2] === -1; } },
    // slices
    M: { rot: 'L', layer: function (p) { return p[0] === 0; } },
    E: { rot: 'D', layer: function (p) { return p[1] === 0; } },
    S: { rot: 'F', layer: function (p) { return p[2] === 0; } },
    // wide turns
    u: { rot: 'U', layer: function (p) { return p[1] >= 0; } },
    d: { rot: 'D', layer: function (p) { return p[1] <= 0; } },
    r: { rot: 'R', layer: function (p) { return p[0] >= 0; } },
    l: { rot: 'L', layer: function (p) { return p[0] <= 0; } },
    f: { rot: 'F', layer: function (p) { return p[2] >= 0; } },
    b: { rot: 'B', layer: function (p) { return p[2] <= 0; } },
    // whole-cube rotations
    x: { rot: 'R', layer: function () { return true; } },
    y: { rot: 'U', layer: function () { return true; } },
    z: { rot: 'F', layer: function () { return true; } }
  };

  function solved() {
    var cubies = [];
    for (var x = -1; x <= 1; x++) {
      for (var y = -1; y <= 1; y++) {
        for (var z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          var s = [null, null, null, null, null, null];
          if (x === 1) s[0] = 'R';
          if (x === -1) s[1] = 'L';
          if (y === 1) s[2] = 'U';
          if (y === -1) s[3] = 'D';
          if (z === 1) s[4] = 'F';
          if (z === -1) s[5] = 'B';
          cubies.push({ p: [x, y, z], s: s });
        }
      }
    }
    return cubies;
  }

  function clone(state) {
    return state.map(function (c) { return { p: c.p.slice(), s: c.s.slice() }; });
  }

  function turn(state, name, times) {
    var move = MOVES[name];
    if (!move) throw new Error('unknown move: ' + name);
    var rot = ROT[move.rot];
    // Precompute where each sticker normal ends up.
    var dirMap = DIRS.map(function (v) { return dirIndex(rot(v)); });
    var n = ((times % 4) + 4) % 4;
    for (var t = 0; t < n; t++) {
      for (var i = 0; i < state.length; i++) {
        var c = state[i];
        if (!move.layer(c.p)) continue;
        c.p = rot(c.p);
        var ns = [null, null, null, null, null, null];
        for (var d = 0; d < 6; d++) if (c.s[d]) ns[dirMap[d]] = c.s[d];
        c.s = ns;
      }
    }
    return state;
  }

  var TOKEN_RE = /([UDRLFBudrlfbMESxyz])(w?)(['2]*)/g;

  function parse(alg) {
    var tokens = [];
    var cleaned = String(alg).replace(/[()[\]]/g, ' ');
    var m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(cleaned)) !== null) {
      var face = m[1];
      if (m[2] === 'w') face = face.toLowerCase(); // Rw == r
      var mods = m[3] || '';
      var times = mods.indexOf('2') >= 0 ? 2 : 1;
      // A prime on a double turn (R2') is still a half turn.
      if (times === 1 && mods.indexOf("'") >= 0) times = -1;
      tokens.push({ face: face, times: times });
    }
    return tokens;
  }

  function apply(state, alg) {
    parse(alg).forEach(function (t) { turn(state, t.face, t.times); });
    return state;
  }

  function invert(alg) {
    return parse(alg).map(function (t) {
      return t.face + (t.times === 2 ? '2' : t.times === -1 ? '' : "'");
    }).reverse().join(' ');
  }

  /* Algs that carry a net cube rotation (PLL Ja's x, V's y) leave the centers
     off-axis. The pieces are where they belong — only the frame differs — so we
     rename the colors instead of turning the cube, which would move pieces
     relative to the solver's point of view. */
  function normalize(state) {
    var rename = {};
    for (var d = 0; d < 6; d++) {
      var v = DIRS[d];
      for (var i = 0; i < state.length; i++) {
        var c = state[i];
        if (c.p[0] === v[0] && c.p[1] === v[1] && c.p[2] === v[2]) {
          rename[c.s[d]] = FACE_OF_DIR[d];
          break;
        }
      }
    }
    state.forEach(function (c) {
      c.s = c.s.map(function (col) { return col ? rename[col] : null; });
    });
    return state;
  }

  /* Facelets in the usual reading order: each face as a 9-cell row-major grid,
     seen from outside, U with B at the top and D with F at the top. */
  function facelets(state) {
    var at = {};
    state.forEach(function (c) { at[c.p.join(',')] = c; });
    function sticker(pos, dir) {
      var c = at[pos.join(',')];
      return c ? c.s[dir] : null;
    }
    var out = { U: [], R: [], F: [], D: [], L: [], B: [] };
    for (var r = 0; r < 3; r++) {
      for (var col = 0; col < 3; col++) {
        out.U.push(sticker([col - 1, 1, r - 1], 2));
        out.D.push(sticker([col - 1, -1, 1 - r], 3));
        out.F.push(sticker([col - 1, 1 - r, 1], 4));
        out.B.push(sticker([1 - col, 1 - r, -1], 5));
        out.R.push(sticker([1, 1 - r, 1 - col], 0));
        out.L.push(sticker([-1, 1 - r, col - 1], 1));
      }
    }
    return out;
  }

  /* Top-layer pieces with their home position, for PLL arrows.
     Coordinates are the cube's own x/z, so (-1,-1) is back-left. */
  function topLayerPieces(state) {
    return state.filter(function (c) {
      return c.p[1] === 1 && !(c.p[0] === 0 && c.p[2] === 0);
    }).map(function (c) {
      var home = [0, 0, 0];
      for (var d = 0; d < 6; d++) {
        if (!c.s[d]) continue;
        var homeDir = DIRS[FACE_OF_DIR.indexOf(c.s[d])];
        home = [home[0] + homeDir[0], home[1] + homeDir[1], home[2] + homeDir[2]];
      }
      return {
        type: (c.s.filter(Boolean).length === 3) ? 'corner' : 'edge',
        from: [c.p[0], c.p[2]],
        to: [home[0], home[2]],
        solved: c.p[0] === home[0] && c.p[2] === home[2]
      };
    });
  }

  /* The state you would be looking at right before executing `alg`. */
  function caseState(alg) {
    var state = solved();
    apply(state, invert(alg));
    normalize(state);
    return state;
  }

  /* Sanity checks used by the verifier and by the renderer's fallback. */
  function inspect(state) {
    var f = facelets(state);
    var f2lIntact = ['F', 'R', 'B', 'L'].every(function (face) {
      return f[face].slice(3).every(function (c) { return c === face; });
    }) && f.D.every(function (c) { return c === 'D'; });
    var oriented = f.U.every(function (c) { return c === 'U'; });
    var sidesPermuted = ['F', 'R', 'B', 'L'].every(function (face) {
      return f[face].slice(0, 3).every(function (c) { return c === face; });
    });
    return {
      f2lIntact: f2lIntact,
      oriented: oriented,
      permuted: sidesPermuted,
      solved: f2lIntact && oriented && sidesPermuted
    };
  }

  function scramble(len) {
    var faces = ['U', 'D', 'R', 'L', 'F', 'B'];
    var axis = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };
    var mods = ['', "'", '2'];
    var out = [];
    var last = null, beforeLast = null;
    while (out.length < (len || 20)) {
      var f = faces[Math.floor(Math.random() * 6)];
      if (f === last) continue;
      if (beforeLast === f && axis[last] === axis[f]) continue; // no R L R
      out.push(f + mods[Math.floor(Math.random() * 3)]);
      beforeLast = last;
      last = f;
    }
    return out.join(' ');
  }

  return {
    solved: solved,
    clone: clone,
    apply: apply,
    invert: invert,
    parse: parse,
    normalize: normalize,
    facelets: facelets,
    topLayerPieces: topLayerPieces,
    caseState: caseState,
    inspect: inspect,
    scramble: scramble
  };
});
