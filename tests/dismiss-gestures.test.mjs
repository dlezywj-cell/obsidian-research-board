import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8');
function setup() {
  const handlers = {};
  const articleHandlers = {};
  const classes = new Set();
  let closed = 0;
  const dialog = {
    addEventListener: (name, callback) => { handlers[name] = callback; },
    querySelector: () => ({ addEventListener: (name, callback) => { articleHandlers[name] = callback; } }),
    getBoundingClientRect: () => ({ right: 800, top: 20 }),
    classList: { toggle: (name, value) => value ? classes.add(name) : classes.delete(name), remove: (name) => classes.delete(name) },
    close: () => { closed++; handlers.close(); },
  };
  const context = vm.createContext({ dialog, matchMedia: () => ({ matches: true }), performance: { now: () => 100 }, window: { getSelection: () => '' } });
  vm.runInContext(source.slice(source.indexOf('function setupDismissGestures'), source.indexOf('function init(data)')) + '\nsetupDismissGestures(dialog);', context);
  const touch = (x, y) => ({ identifier: 1, clientX: x, clientY: y });
  const start = (excluded = false) => articleHandlers.touchstart({ touches: [touch(30, 100)], target: { closest: () => excluded } });
  const move = (x, y) => articleHandlers.touchmove({ touches: [touch(x, y)], cancelable: true, preventDefault() {} });
  const end = (x, y) => articleHandlers.touchend({ changedTouches: [touch(x, y)], touches: [] });
  return { handlers, articleHandlers, classes, start, move, end, closed: () => closed };
}
test('mouse reveals only in upper right, then hides on leaving', () => {
  const s = setup();
  s.handlers.pointermove({ pointerType: 'mouse', clientX: 770, clientY: 50 });
  assert(s.classes.has('controls-visible'));
  s.handlers.pointermove({ pointerType: 'mouse', clientX: 400, clientY: 400 });
  assert(!s.classes.has('controls-visible'));
  assert.equal(s.articleHandlers.scroll, undefined);
});
test('deliberate right swipe closes the dialog', () => {
  const s = setup(); s.start(); s.move(150, 110); s.end(160, 112); assert.equal(s.closed(), 1);
});
test('vertical, left, short, cancelled and table gestures do not close', () => {
  for (const [x, y] of [[40, 240], [0, 100], [65, 100]]) {
    const s = setup(); s.start(); s.move(x, y); s.end(x, y); assert.equal(s.closed(), 0);
  }
  const table = setup(); table.start(true); table.move(200, 100); table.end(200, 100); assert.equal(table.closed(), 0);
  const cancelled = setup(); cancelled.start(); cancelled.move(200, 100); cancelled.articleHandlers.touchcancel(); cancelled.end(200, 100); assert.equal(cancelled.closed(), 0);
  const verticalFirst = setup(); verticalFirst.start(); verticalFirst.move(32, 140); verticalFirst.move(200, 140); verticalFirst.end(200, 140); assert.equal(verticalFirst.closed(), 0);
});
