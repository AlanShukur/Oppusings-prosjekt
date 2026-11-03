import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePlan, classifyRoom, RULESET, DISCLAIMER } from '../public/studio/tek17-check.js';
import { PlanEditor } from '../public/studio/plan.js';

const room = (id, x, y, w, h, type = 'room', extra = {}) => ({id, name: id, type, x, y, w, h, color: '#e8e1d1', width: w / 50, height: h / 50, area: w * h / 2500, ...extra});
const examplePlan = () => new PlanEditor({innerHTML: '', dataset: {}, style: {}, addEventListener() {}}).getState();
const find = (report, ruleId, roomId) => report.results.filter(result => result.ruleId === ruleId && (roomId === undefined || result.roomId === roomId));

test('the example home passes utsyn for every oppholdsrom and its stue window is low enough', () => {
  const report = evaluatePlan(examplePlan(), {bedrooms: 2, bathrooms: 1});
  for (const id of ['living', 'bed1', 'bed2']) assert.deepEqual(find(report, 'tek17-13-8', id).map(r => r.status).filter(s => s !== 'ok'), [], id);
  assert.ok(find(report, 'tek17-13-8', 'living').some(r => r.title === 'Utsyn fra stuen' && r.status === 'ok'));
  assert.equal(report.summary.brudd, 0);
});

test('daylight is unknown without light transmission and computed with it (Ag ≥ 0,07 · A / LT)', () => {
  const plan = examplePlan();
  assert.ok(find(evaluatePlan(plan, {}), 'tek17-13-7').every(r => r.status === 'ukjent'));
  const report = evaluatePlan(plan, {building: {lightTransmission: 0.6}});
  assert.deepEqual(find(report, 'tek17-13-7').map(r => r.status), ['ok', 'ok', 'ok']);
  const dim = evaluatePlan({...plan, items: plan.items.map(item => item.id === 'example-window-bed2' ? {...item, width: 0.6, height: 0.6} : item)}, {building: {lightTransmission: 0.6}});
  assert.equal(find(dim, 'tek17-13-7', 'bed2')[0].status, 'brudd');
});

test('an interior bedroom carved out of a room has no exterior wall and fails utsyn', () => {
  const plan = {variant: 'custom', rooms: [room('a', 0, 0, 500, 400, 'living'), room('inner', 500, 100, 150, 150, 'bedroom'), room('b', 650, 0, 200, 400, 'living'), room('top', 500, 0, 150, 100, 'hall'), room('bottom', 500, 250, 150, 150, 'hall')], items: []};
  const result = find(evaluatePlan(plan, {}), 'tek17-13-8', 'inner')[0];
  assert.equal(result.status, 'brudd');
  assert.match(result.message, /uten yttervegg/);
});

test('a window on a wall that sits a wall-thickness from another room is not trusted as exterior', () => {
  const plan = {variant: 'custom', rooms: [room('a', 0, 0, 200, 200, 'bedroom'), room('b', 207.5, 0, 200, 200, 'living')], items: [{id: 'w', type: 'window', x: 200, y: 100, rotation: 90}]};
  assert.equal(find(evaluatePlan(plan, {}), 'tek17-13-8', 'a')[0].status, 'advarsel');
});

test('room height uses 2,4 m for oppholdsrom and the pre-2011 bruksendring relief of 2,0 m', () => {
  const plan = {variant: 'custom', rooms: [room('k', 0, 0, 200, 200, 'bedroom', {ceilingHeight: 2.1, previousUse: 'tilleggsdel'}), room('l', 200, 0, 200, 200, 'living')], items: []};
  const strict = evaluatePlan(plan, {building: {ceilingHeight: 2.3}});
  assert.equal(find(strict, 'tek17-12-7', 'l')[0].status, 'brudd');
  assert.equal(find(strict, 'tek17-12-7', 'k')[0].status, 'brudd');
  assert.ok(strict.results.some(r => r.ruleId === 'tek17-1-2' && r.status === 'ukjent'), 'asks for the application year');
  const relief = evaluatePlan(plan, {building: {ceilingHeight: 2.4, permitBefore2011: true}});
  assert.equal(find(relief, 'tek17-12-7', 'k')[0].status, 'ok');
  assert.equal(find(relief, 'tek17-13-8', 'k').length, 0, '§ 13-8 does not apply to qualifying bruksendring');
  assert.ok(find(relief, 'tek17-13-7', 'k').some(r => r.title === 'Dagslys ved bruksendring'));
});

test('door free widths: 0,76 m inside the dwelling and 0,86 m for the entrance', () => {
  const base = {variant: 'custom', rooms: [room('a', 0, 0, 300, 300, 'living'), room('b', 300, 0, 200, 300, 'bedroom')]};
  const narrow = evaluatePlan({...base, items: [{id: 'd', type: 'door', x: 300, y: 150, rotation: 90, width: 0.7}, {id: 'e', type: 'door', x: 100, y: 300, rotation: 0, width: 0.8, entrance: true}]}, {});
  assert.deepEqual(find(narrow, 'tek17-12-13').map(r => r.status).sort(), ['brudd', 'brudd']);
  const fine = evaluatePlan({...base, items: [{id: 'd', type: 'door', x: 300, y: 150, rotation: 90, width: 0.8}, {id: 'e', type: 'door', x: 100, y: 300, rotation: 0, width: 0.9, entrance: true}]}, {});
  assert.deepEqual(find(fine, 'tek17-12-13').map(r => r.status), ['ok']);
  const unknown = evaluatePlan({...base, items: [{id: 'd', type: 'door', x: 300, y: 150, rotation: 90}]}, {});
  assert.equal(find(unknown, 'tek17-12-13')[0].status, 'ukjent');
});

test('storage needs 5 m² above 50 m² BRA and accepts storage outside the flat', () => {
  const plan = {variant: 'custom', rooms: [room('a', 0, 0, 500, 300, 'living')], items: []};
  assert.equal(find(evaluatePlan(plan, {}), 'tek17-12-10')[0].status, 'ukjent');
  assert.equal(find(evaluatePlan(plan, {building: {externalStorageM2: 5}}), 'tek17-12-10')[0].status, 'ok');
  assert.equal(find(evaluatePlan(plan, {building: {externalStorageM2: 2}}), 'tek17-12-10')[0].status, 'brudd');
});

test('escape windows are required in at least every other oppholdsrom on a non-entrance floor', () => {
  const plan = {variant: 'custom', rooms: [room('a', 0, 0, 200, 200, 'bedroom'), room('b', 200, 0, 200, 200, 'bedroom')], items: [{id: 'w', type: 'window', x: 100, y: 0, rotation: 0, width: 0.8, height: 0.6, sillHeight: 0.9, escape: true}]};
  const building = {multiLevelUnit: true, planLevel: 'annen'};
  assert.equal(find(evaluatePlan(plan, {building}), 'tek17-11-13')[0].status, 'brudd', 'sum of height and width must be at least 1,5 m');
  plan.items[0].height = 0.8;
  assert.equal(find(evaluatePlan(plan, {building}), 'tek17-11-13').at(-1).status, 'ok');
});

test('turning space is only checked for tilgjengelig boenhet, but the main bath is always assessed', () => {
  const plan = {variant: 'custom', rooms: [room('h', 0, 0, 60, 200, 'hall'), room('bad', 60, 0, 60, 100, 'bath')], items: []};
  assert.equal(find(evaluatePlan(plan, {}), 'tek17-12-7').filter(r => r.title === 'Snuareal for rullestol').length, 0);
  assert.equal(find(evaluatePlan(plan, {building: {accessibleUnit: true}}), 'tek17-12-7', 'h').find(r => r.title === 'Snuareal for rullestol').status, 'brudd');
  assert.equal(find(evaluatePlan(plan, {}), 'tek17-12-9')[0].status, 'advarsel');
});

test('søknadsplikt follows the questionnaire and derives bruksendring from the drawing', () => {
  const plan = {variant: 'custom', rooms: [room('k', 0, 0, 200, 200, 'bedroom', {previousUse: 'tilleggsdel'})], items: []};
  assert.ok(evaluatePlan(plan, {}).results.some(r => r.title === 'Bruksendring' && r.status === 'soknad'));
  assert.ok(evaluatePlan({...plan, rooms: [room('k', 0, 0, 200, 200, 'bedroom')]}, {measures: {bearingWall: 'ja'}}).results.some(r => r.status === 'soknad' && r.ref === 'pbl § 20-1 b'));
  const simple = evaluatePlan({...plan, rooms: [room('k', 0, 0, 200, 200, 'bedroom')]}, {measures: {bearingWall: 'nei', facade: false, useChange: 'nei'}});
  assert.ok(simple.results.some(r => r.ref === 'SAK10 § 4-1 e nr. 1' && r.status === 'ok'));
});

test('a partition drawn across a room is flagged, since the check still sees one room', () => {
  const plan = {variant: 'custom', rooms: [room('a', 0, 0, 400, 300, 'living')], items: [{id: 'p', type: 'wall', x: 200, y: 0, x2: 200, y2: 300, rotation: 0}]};
  assert.ok(evaluatePlan(plan, {}).results.some(r => r.title === 'Skillevegg i rom'));
});

test('results are honest: sourced, never "godkjent", and the disclaimer names the tiltakshaver', () => {
  const report = evaluatePlan(examplePlan(), {building: {lightTransmission: 0.6, ceilingHeight: 2.5}});
  for (const result of report.results) {
    assert.doesNotMatch(result.message, /godkjent/i);
    if (/^(TEK17|SAK10|pbl)/.test(result.ref)) assert.match(result.url || '', /^https:\/\/(www\.dibk\.no|lovdata\.no)\//, result.ref);
  }
  assert.match(DISCLAIMER, /tiltakshaver/);
  assert.equal(RULESET.version, '2026-11-03');
  assert.equal(classifyRoom({type: 'office'}), 'stay');
  assert.equal(classifyRoom({type: 'storage'}), 'no');
});

// Walls marked in the drawing (Sprint 2): status and load-bearing from plan.walls.
const pair = (walls, items = []) => ({variant: 'custom', rooms: [room('a', 0, 0, 200, 200, 'living'), room('b', 200, 0, 200, 200, 'bedroom')], items, walls});
const SHARED = 'a:right|b:left';
const answered = {measures: {bearingWall: 'nei', facade: false, useChange: 'nei'}};
const titled = (report, title) => report.results.filter(result => result.title === title);

test('demolishing a wall marked load-bearing needs an application and points at that wall', () => {
  const report = evaluatePlan(pair([{key: SHARED, status: 'demolish', loadBearing: 'yes'}]), {});
  const [result] = titled(report, 'Riving av bærende vegg');
  assert.equal(result.status, 'soknad');
  assert.equal(result.wallKey, SHARED);
  assert.match(result.message, /mellom «a» og «b»/);
  assert.equal(titled(report, 'Bærende konstruksjon').length, 0, 'the per-wall result is enough');
  assert.equal(titled(report, 'Riving av vegger').length, 0, 'the drawing answers the wall question');
});

test('a wall marked for demolition without a load-bearing answer asks for it', () => {
  const [result] = titled(evaluatePlan(pair([{key: SHARED, status: 'demolish', loadBearing: 'unknown'}]), {}), 'Er veggen bærende?');
  assert.equal(result.status, 'ukjent');
  assert.equal(result.wallKey, SHARED);
});

test('the questionnaire cannot hide a load-bearing wall marked in the drawing', () => {
  const report = evaluatePlan(pair([{key: SHARED, status: 'demolish', loadBearing: 'yes'}]), answered);
  assert.equal(titled(report, 'Riving av bærende vegg')[0].status, 'soknad');
  assert.equal(titled(report, 'Ikke-bærende vegger').length, 0);
});

test('only non-load-bearing walls removed and everything answered gives the exemption, plus the merge note', () => {
  const report = evaluatePlan(pair([{key: SHARED, status: 'demolish', loadBearing: 'no'}]), answered);
  assert.equal(titled(report, 'Ikke-bærende vegger')[0].status, 'ok');
  const [merge] = titled(report, 'Rom slås sammen');
  assert.equal(merge.status, 'info');
  assert.match(merge.message, /^Når veggen mellom «a» og «b» rives/);
});

test('removing an exterior wall is flagged as a facade change and blocks the exemption', () => {
  const report = evaluatePlan(pair([{key: 'a:top', status: 'demolish', loadBearing: 'no'}]), answered);
  assert.equal(titled(report, 'Riving av yttervegg')[0].status, 'advarsel');
  assert.equal(titled(report, 'Ikke-bærende vegger').length, 0);
  assert.equal(titled(report, 'Rom slås sammen').length, 0);
});

test('a new load-bearing wall is a warning, not an exemption', () => {
  const report = evaluatePlan(pair([{key: SHARED, status: 'new', loadBearing: 'yes'}]), answered);
  assert.equal(titled(report, 'Ny bærende vegg')[0].status, 'advarsel');
  assert.equal(titled(report, 'Ikke-bærende vegger').length, 0);
});

test('a wall drawn in two pieces is reported once, and unchanged walls report nothing', () => {
  const split = [{id: 'item-split', type: 'wall', x: 0, y: 100, x2: 150, y2: 100, rotation: 0}];
  const report = evaluatePlan(pair([{key: 'a:left', status: 'demolish', loadBearing: 'yes'}, {key: SHARED, status: 'existing', loadBearing: 'yes'}], split), {});
  assert.equal(titled(report, 'Riving av bærende vegg').length, 1);
  assert.equal(report.results.filter(result => result.wallKey === SHARED).length, 0);
});
