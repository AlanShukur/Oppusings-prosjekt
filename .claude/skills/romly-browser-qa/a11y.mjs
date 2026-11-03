// Readable text in the studio, at desktop, tablet and phone widths: every visible text is at least 11px and meets
// WCAG AA contrast (4.5:1, or 3:1 for large text) against what is actually behind it, no text overlaps other text or
// a control, and nothing scrolls sideways. Views: projects, Grunnlag, the studio, an element selected, and the check.
// Usage: node .claude/skills/romly-browser-qa/a11y.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser} from './qa-harness.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5174';
const MIN_SIZE = 11;
// Runs in the page: one entry per element with its own text.
const AUDIT = `(() => {
  const parse = c => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return {r, g, b, a}; };
  const lum = ({r, g, b}) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bottom) => ({r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1});
  const background = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let bg = {r: 255, g: 255, b: 255, a: 1}; for (const c of layers.reverse()) bg = blend(c, bg); return bg; };
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '') + '«' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 18) + '»';
  const dialog = document.querySelector('#app-dialog[open]');
  const scope = dialog || document.body, texts = [], seen = new Set();
  // A box cut to what its scrolling or clipping ancestors actually show; null when none of it shows.
  const visible = (el, box) => {
    let r = {left: box.left, top: box.top, right: box.right, bottom: box.bottom};
    for (let e = el.parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const c = e.getBoundingClientRect();
      r = {left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom)};
    }
    return r.right - r.left > 1 && r.bottom - r.top > 1 ? r : null;
  };
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement;
    if (!node.textContent.trim() || !el || el.closest('svg, script, style, #toast, :disabled, [aria-disabled="true"]')) continue;
    if (!el.checkVisibility({opacityProperty: true, visibilityProperty: true})) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const box = visible(el, range.getBoundingClientRect()); if (!box) continue;
    texts.push({el, box});
    if (seen.has(el)) continue; seen.add(el);
    const s = getComputedStyle(el), bg = background(el), fg = blend(parse(s.color), bg);
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(s.fontSize), large = size >= 24 || (+s.fontWeight >= 700 && size >= 18.66);
    el.__audit = {el: name(el), text: node.textContent.trim().replace(/\\s+/g, ' ').slice(0, 32), size, ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5};
  }
  const entries = [...seen].map(el => el.__audit);
  // Text that overlaps other text, or a control it is not part of.
  const controls = [...scope.querySelectorAll('button, input, select, textarea, a')].filter(c => c.checkVisibility() && !c.closest('#toast')).map(c => ({c, box: visible(c, c.getBoundingClientRect())})).filter(entry => entry.box);
  const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 2 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 2;
  const overlaps = new Set();
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    for (let j = i + 1; j < texts.length; j++) { const u = texts[j]; if (t.el !== u.el && !t.el.contains(u.el) && !u.el.contains(t.el) && hit(t.box, u.box)) overlaps.add(name(t.el) + ' × ' + name(u.el)); }
    for (const {c, box} of controls) if (!c.contains(t.el) && !t.el.contains(c) && hit(t.box, box)) overlaps.add(name(t.el) + ' × ' + name(c));
  }
  return {entries, overlaps: [...overlaps], sideways: document.documentElement.scrollWidth > innerWidth + 1};
})()`;

let all = true;
for (const [label, width, height, mobile] of [['desktop', 1366, 900, false], ['tablet', 900, 1000, false], ['phone', 390, 844, true]]) {
  const b = await openBrowser({base, width, height, mobile});
  const {go, evaluate, until, check} = b;
  const audit = async view => {
    const {entries, overlaps, sideways} = await evaluate(AUDIT);
    const small = entries.filter(e => e.size < MIN_SIZE), faint = entries.filter(e => e.ratio < e.need);
    check(`${label} ${view}: all text is ${MIN_SIZE}px or larger`, !small.length, small.slice(0, 4).map(e => `${e.size}px ${e.el} «${e.text}»`).join(' | '));
    check(`${label} ${view}: all text meets WCAG AA contrast`, !faint.length, faint.slice(0, 4).map(e => `${e.ratio}:1 ${e.el} «${e.text}»`).join(' | '));
    check(`${label} ${view}: no text overlaps other text or a control`, !overlaps.length, overlaps.slice(0, 4).join(' | '));
    check(`${label} ${view}: no sideways scrolling`, !sideways);
  };
  try {
    await go('/studio/index.html');
    await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'projects dialog', 30000);
    await audit('projects');
    await evaluate(`document.querySelector('#first-project-btn').click()`);
    await until(`!!document.querySelector('#create-project-submit')`, 'create form');
    await evaluate(`document.querySelector('#create-project-submit').click()`);
    await until(`!!document.querySelector('#ground-cancel')`, 'Grunnlag', 30000);
    await audit('Grunnlag');
    await evaluate(`document.querySelector('#ground-cancel').click()`);
    await until(`!document.querySelector('#app-dialog').open`, 'dialog closed');
    // Wait for the toast to go, and for the save status to settle on its longest text.
    await evaluate(`romly.editor.updateRoom('bed1', {name: 'Soverom 1'})`);
    await until(`!document.querySelector('#toast').classList.contains('visible')`, 'toast gone', 10000);
    for (const panel of mobile ? ['canvas', 'tools', 'properties'] : [null]) {
      if (panel) await evaluate(`document.querySelector('[data-workspace-panel="${panel}"]').click()`);
      await audit('studio' + (panel ? ` (${panel})` : ''));
    }
    await evaluate(`document.querySelector('[data-tool-tab="interior"]').click(); romly.editor.addItem('bed')`);
    if (mobile) await evaluate(`document.querySelector('[data-workspace-panel="properties"]').click()`);
    await audit('element selected');
    await evaluate(`document.querySelector('#check-btn').click()`);
    await until(`document.querySelectorAll('#check-results .check-item').length > 0`, 'check results');
    await audit('check');
  } catch (error) {
    check(`${label}: script completed`, false, error.message);
  }
  all = await b.finish() && all;
}
process.exit(all ? 0 : 1);
