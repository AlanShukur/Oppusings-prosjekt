import test from 'node:test';
import assert from 'node:assert/strict';
import { createErrorReporter, RELEASE } from '../public/studio/error-reporter.js';

function setup() {
  const bodies = [];
  const reporter = createErrorReporter({ send: body => { bodies.push(JSON.parse(body)); }, page: () => '/studio/index.html' });
  return { reporter, bodies };
}

test('a crash report carries the error and location but no URLs, queries or blob data', () => {
  const { reporter, bodies } = setup();
  const error = new Error('Kunne ikke lese blob:https://romly.test/1234-abcd?token=hemmelig');
  error.stack = 'Error: Kunne ikke lese\n    at render (https://romly.test/studio/plan.js?v=3:12:5)\n    at data:image/png;base64,AAAA';
  assert.equal(reporter.report(error, { context: '3d' }), true);
  const [sent] = bodies;
  assert.equal(sent.kind, 'handled');
  assert.equal(sent.page, '/studio/index.html');
  assert.equal(sent.release, RELEASE);
  assert.equal(sent.context, '3d');
  assert.doesNotMatch(JSON.stringify(sent), /romly\.test|token|hemmelig|base64/);
  assert.match(sent.stack, /\/studio\/plan\.js:12:5/);
});

test('repeated crashes are sent once, and at most five reports per page load', () => {
  const { reporter, bodies } = setup();
  for (let i = 0; i < 3; i++) reporter.report(new Error('Samme feil'));
  assert.equal(bodies.length, 1);
  for (let i = 0; i < 10; i++) reporter.report(new Error(`Feil ${i}`));
  assert.equal(bodies.length, 5);
});

test('uncaught errors and rejected promises are picked up from the window', () => {
  const { reporter, bodies } = setup();
  const target = new EventTarget();
  reporter.install(target);
  const error = new Error('Ukjent feil');
  const crash = new Event('error'); crash.error = error; crash.message = error.message;
  target.dispatchEvent(crash);
  const rejection = new Event('unhandledrejection'); rejection.reason = new Error('Avvist løfte');
  target.dispatchEvent(rejection);
  assert.deepEqual(bodies.map(body => [body.kind, body.message]), [['error', 'Ukjent feil'], ['unhandledrejection', 'Avvist løfte']]);
});

test('a failing network call never throws back into the app', async () => {
  const reporter = createErrorReporter({ send: () => Promise.reject(new Error('offline')), page: () => '/' });
  assert.equal(reporter.report(new Error('Noe gikk galt')), true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reporter.report(''), false, 'empty messages are ignored');
});
