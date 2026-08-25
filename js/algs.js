/*
 * algs.js — the case list. Each entry is just an id, a name and an algorithm;
 * every diagram is generated from the algorithm at runtime (see cube.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Algs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OLL = [
    [1, "R U2 (R2' F R F') U2 (R' F R F')"],
    [2, "L F L' (U2 R U2' R' U2) L F' L'"],
    [3, "r' R2 U R' U r U2' r' U M'"],
    [4, "l L2' U' L U' l' U2 l U' M'"],
    [5, "l' U2 L U L' U l"],
    [6, "r U2' R' U' R U' r'"],
    [7, "r U R' U R U2' r'"],
    [8, "l' U' L U' L' U2 l"],
    [9, "(R U R' U') R' F (R2 U R' U') F'"],
    [10, "r R2' U2' R U R' U R U R r'"],
    [11, "S' U2 R U R' U R U2' R' S"],
    [12, "M' R' U' R U' R' U2 R U' R r'"],
    [13, "F (U R U' R2') F' R (U R U' R')"],
    [14, "R' F R U R' F' R F U' F'"],
    [15, "l' U' l (L' U' L U) l' U l"],
    [16, "r U r' (R U R' U') r U' r'"],
    [17, "F R' F' R2 r' (U R U' R') U' M'"],
    [18, "r U R' U R U2' r2' U' R U' R' U2' r"],
    [19, "r' R U (R U R' U') M' (R' F R F')"],
    [20, "(r U R' U') M2' (U R U' R') U' M'"],
    [21, "R U R' U R U' R' U R U2' R'"],
    [22, "R U2' (R2' U' R2 U' R2') U2' R"],
    [23, "R2 D R' U2 R D' R' U2 R'"],
    [24, "(r U R' U') (r' F R F')"],
    [25, "(F R' F' r) (U R U' r')"],
    [26, "R U2' R' U' R U' R'"],
    [27, "R U R' U R U2' R'"],
    [28, "(r U R' U') r' R (U R U' R')"],
    [29, "M U R U R' U' R' F R F' M'"],
    [30, "M U' L' U' L U L F' L' F M'"],
    [31, "R' U' F (U R U' R') F' R"],
    [32, "L U F' (U' L' U L) F L'"],
    [33, "(R U R' U') (R' F R F')"],
    [34, "f R f' U' r' U' R U M'"],
    [35, "R U2' (R2' F R F') R U2' R'"],
    [36, "L' U' L U' L' U L U (L F' L' F)"],
    [37, "(F R' F' R) (U R U' R')"],
    [38, "R U R' U R U' R' U' (R' F R F')"],
    [39, "(f' L F L') (U' L' U L) S"],
    [40, "(f R' F' R) (U R U' R') S'"],
    [41, "R U R' U R U2' R' F (R U R' U') F'"],
    [42, "(R' F R F') (R' F R F') (R U R' U') R U R'"],
    [43, "R' U' F' U F R"],
    [44, "F (U R U' R') F'"],
    [45, "F (R U R' U') F'"],
    [46, "R' U' (R' F R F') U R"],
    [47, "(F R' F' R) U2 R U' R' U R U2' R'"],
    [48, "F (R U R' U') (R U R' U') F'"],
    [49, "r U' r2' U r2 U r2' U' r"],
    [50, "l' U l2 U' l2' U' l2 U l'"],
    [51, "F (U R U' R') (U R U' R') F'"],
    [52, "R' F' U' F U' R U R' U R"],
    [53, "l' U' L U' L' U L U' L' U2 l"],
    [54, "r U R' U R U' R' U R U2' r'"],
    [55, "R' F U R U' R2' F' R2 U R' U' R"],
    [56, "r U r' (U R U' R') U R U' M' U' r'"],
    [57, "(R U R' U') M' (U R U' r')"]
  ];

  var PLL = [
    ["Aa", "Corners only", "x L2 D2 (L' U' L) D2 (L' U L')"],
    ["Ab", "Corners only", "x R2 D2 (R U R') D2 (R U' R)"],
    ["E", "Corners only", "x' (L' U L D') (L' U' L D) (L' U' L D') (L' U L D)"],
    ["Ua", "Edges only", "R U' R U R U R U' R' U' R2"],
    ["Ub", "Edges only", "R2 U R U R' U' R' U' R' U R'"],
    ["H", "Edges only", "M2 U M2 U2 M2 U M2"],
    ["Z", "Edges only", "M' U M2 U M2 U M' U2 M2"],
    ["Ga", "G perm", "R2 U R' U R' U' R U' R2 U' D R' U R D'"],
    ["Gb", "G perm", "(R' U' R) (U D') R2 U R' U R U' R U' R2 D"],
    ["Gc", "G perm", "R2 U' R U' R U R' U R2 U D' R U' R' D"],
    ["Gd", "G perm", "(R U R') (U' D) R2 U' R U' R' U R' U R2 D'"],
    ["T", "Adjacent swap", "(R U R' U') R' F R2 U' R' U' (R U R') F'"],
    ["F", "Adjacent swap", "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"],
    ["Ja", "Adjacent swap", "x (R2 F R F') R U2 (r' U r) U2"],
    ["Jb", "Adjacent swap", "(R U R' F') (R U R' U') R' F R2 U' R'"],
    ["Ra", "Adjacent swap", "(R U' R' U') (R U R D) (R' U' R D') (R' U2 R')"],
    ["Rb", "Adjacent swap", "R2 F R (U R U' R') F' R U2 R' U2 R"],
    ["Na", "Adjacent swap", "(R U R' U) (R U R' F' R U R' U' R' F R2 U' R') (U2 R U' R')"],
    ["Nb", "Adjacent swap", "r' D' F (r U' r') F' D (r2 U r' U') (r' F r F')"],
    ["V", "Diagonal swap", "R' U R' U' y R' F' R2 U' R' U R' F R F"],
    ["Y", "Diagonal swap", "F (R U' R' U') (R U R') F' (R U R' U') (R' F R F')"]
  ];


  /* Alternates worth having: a second way through a case that suits different
     hands. Some are written from a different angle, so verify-algs.cjs records
     the U turn you need first — the app shows it as a badge. */
  var ALTS = {
    'oll-21': ["R U2 R' U' R U R' U' R U' R'", "F (R U R' U') (R U R' U') (R U R' U') F'"],
    'oll-22': ["R' U2 R2 U R2 U R2 U2 R'"],
    'oll-23': ["R2 D' R U2 R' D R U2 R"],
    'oll-25': ["F' r U R' U' r' F R"],
    'oll-26': ["y' R' U' R U' R' U2 R", "L' U' L U' L' U2 L"],
    'oll-27': ["y L U L' U L U2 L'"],
    'oll-43': ["f' L' U' L U f"],
    'oll-44': ["f R U R' U' f'"],
    'pll-Aa': ["y x R' U R' D2 R U' R' D2 R2", "R' F R' B2 R F' R' B2 R2"],
    'pll-Ab': ["R B' R F2 R' B R F2 R2"],
    'pll-E': ["R B' R' F R B R' F' R B R' F R B' R' F'"],
    'pll-Ua': ["M2 U M U2 M' U M2"],
    'pll-Ub': ["M2 U' M U2 M' U' M2"],
    'pll-H': ["M2 U' M2 U2 M2 U' M2"],
    'pll-Z': ["M2 U M2 U M' U2 M2 U2 M' U2"],
    'pll-Ga': ["R2 u R' U R' U' R u' R2 y' R' U R"],
    'pll-Gb': ["F' U' F R2 u R' U R U' R u' R2", "R' U' R y R2 u R' U R U' R u' R2"],
    'pll-Gc': ["R2 u' R U' R U R' u R2 y R U' R'"],
    'pll-Gd': ["R U R' y' R2 u' R U' R' U R' u R2"],
    'pll-Ja': ["R' U L' U2 R U' R' U2 R L"],
    'pll-Jb': ["R U2 R' U' R U2 L' U R' U' L"],
    'pll-Ra': ["R U R' F' R U2 R' U2 R' F R U R U2 R' U'"],
    'pll-Rb': ["R' U2 R U2 R' F R U R' U' R' F' R2"],
    'pll-Nb': ["R' U R U' R' F' U' F R U R' F R' F' R U' R"],
    'pll-V': ["R' U R' d' R' F' R2 U' R' U R' F R F"],
    'pll-F': ["R' U2 R' d' R' F' R2 U' R' U R' F R U' F"]
  };

  var PLL_GROUPS = ['Corners only', 'Edges only', 'G perm', 'Adjacent swap', 'Diagonal swap'];

  /* One flat list so the tracker, the trainer and the timer all agree on ids. */
  function all() {
    var out = [];
    OLL.forEach(function (o) {
      var id = 'oll-' + o[0];
      out.push({ id: id, set: 'oll', num: o[0], name: 'OLL ' + o[0], group: 'OLL', alg: o[1], alts: ALTS[id] || [] });
    });
    PLL.forEach(function (p) {
      var pid = 'pll-' + p[0];
      out.push({ id: pid, set: 'pll', num: '', name: p[0] + ' perm', short: p[0], group: p[1], alg: p[2], alts: ALTS[pid] || [] });
    });
    return out;
  }

  return { OLL: OLL, PLL: PLL, ALTS: ALTS, PLL_GROUPS: PLL_GROUPS, all: all };
});
