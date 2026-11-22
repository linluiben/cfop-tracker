/*
 * lcd.js — two small typesetters: seven-segment digits for the Stackmat-style
 * displays, and cube notation with primes and brackets set tight.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LCD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  /* Notation: a prime hugs its letter, brackets hug their moves, a closing
     bracket hugs a prime. Each move is unbreakable so R' never splits across
     lines. The text content stays the plain alg, so copy/paste still works. */
  function notation(alg) {
    var tokens = String(alg).match(/[()[\]]|[^\s()[\]]+/g) || [];
    var out = '', space = false;
    tokens.forEach(function (t, i) {
      if (t === '(' || t === '[') { out += (space ? ' ' : '') + '<span class="nb-open">' + t + '</span>'; space = false; return; }
      if (t === ')' || t === ']') {
        var prime = /'$/.test(tokens[i - 1] || '');
        out += '<span class="nb-close' + (prime ? ' after-prime' : '') + '">' + t + '</span>';
        space = true; return;
      }
      out += (space ? ' ' : '') + '<span class="mv">' + esc(t).replace(/'/g, '<span class="pr">\'</span>') + '</span>';
      space = true;
    });
    return out;
  }

  /* ---- seven segments ---- */
  var SEGS = {
    '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
    '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
    'd': 'bcdeg', 'n': 'ceg', 'F': 'aefg', 'E': 'adefg', 'r': 'eg'
  };
  var W = 38, H = 70, T = 8, G = 1.2;

  function digit(x, ch) {
    var on = SEGS[ch] || '', out = '';
    function hseg(y) { return [[x+T/2+G,y],[x+T+G,y-T/2],[x+W-T-G,y-T/2],[x+W-T/2-G,y],[x+W-T-G,y+T/2],[x+T+G,y+T/2]]; }
    function vseg(xx, y0, y1) { return [[xx,y0+G],[xx+T/2,y0+T/2+G],[xx+T/2,y1-T/2-G],[xx,y1-G],[xx-T/2,y1-T/2-G],[xx-T/2,y0+T/2+G]]; }
    var shapes = {
      a: hseg(T/2), g: hseg(H/2), d: hseg(H-T/2),
      f: vseg(x+T/2, T/2, H/2), b: vseg(x+W-T/2, T/2, H/2),
      e: vseg(x+T/2, H/2, H-T/2), c: vseg(x+W-T/2, H/2, H-T/2)
    };
    Object.keys(shapes).forEach(function (k) {
      out += '<polygon class="' + (on.indexOf(k) >= 0 ? 'seg-on' : 'seg-off') + '" points="' +
        shapes[k].map(function (p) { return p.join(','); }).join(' ') + '"/>';
    });
    return out;
  }
  function dot(cx, cy, lit) {
    return '<rect class="' + (lit ? 'seg-on' : 'seg-off') + '" x="' + (cx - 4) + '" y="' + (cy - 4) + '" width="8" height="8" rx="1"/>';
  }
  function svg(inner, width, label) {
    return '<svg viewBox="-6 0 ' + (width + 10) + ' 70" role="img" aria-label="' + esc(label) + '">' +
      '<g transform="skewX(-7) translate(8 0)">' + inner + '</g></svg>';
  }

  /* Stackmat layout M:SS.hh, ghost segments behind every position. */
  function time(ms, label) {
    ms = Math.max(0, Math.min(ms || 0, 599990));
    var cs = Math.floor(ms / 10), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60, h = cs % 100;
    var c = [m ? String(m) : ' ', (m || s >= 10) ? String(Math.floor(s / 10)) : ' ', String(s % 10), String(Math.floor(h / 10)), String(h % 10)];
    var x = 0, out = '';
    out += digit(x, c[0]); x += 44;
    out += dot(x + 4, 22, !!m) + dot(x + 4, 48, !!m); x += 16;
    out += digit(x, c[1]); x += 46;
    out += digit(x, c[2]); x += 44;
    out += dot(x + 4, 66, true); x += 16;
    out += digit(x, c[3]); x += 46;
    out += digit(x, c[4]); x += 40;
    return svg(out, x, label || (ms / 1000).toFixed(2) + ' seconds');
  }

  /* Short text (digits and the few letters above), right-aligned in the same
     five-digit layout as a time so the display doesn't jump between states. */
  function text(str, label) {
    str = String(str).slice(-5);
    while (str.length < 5) str = ' ' + str;
    var x = 0, out = '';
    out += digit(x, str[0]); x += 44;
    out += dot(x + 4, 22, false) + dot(x + 4, 48, false); x += 16;
    out += digit(x, str[1]); x += 46;
    out += digit(x, str[2]); x += 44;
    out += dot(x + 4, 66, false); x += 16;
    out += digit(x, str[3]); x += 46;
    out += digit(x, str[4]); x += 40;
    return svg(out, x, label || str.trim());
  }

  /* A whole number, right-aligned in a fixed number of positions. */
  function count(n, places, label) {
    var str = String(n), x = 0, out = '';
    while (str.length < places) str = ' ' + str;
    for (var i = 0; i < places; i++) { out += digit(x, str[i]); x += 46; }
    return svg(out, x - 6, label || String(n));
  }

  return { notation: notation, time: time, text: text, count: count };
});
