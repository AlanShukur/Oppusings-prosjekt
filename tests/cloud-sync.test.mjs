import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectSync, isRevisionConflict } from '../public/studio/cloud.js';

const userA = { id: 'account-a', name: 'Kari' };
const userB = { id: 'account-b', name: 'Ola' };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
let originalFetch, originalStorage, storage, calls, instances;

function record(id = 'project-a', revision = 1) {
  return {
    id, revision,
    project: { name: 'Mitt hjem', municipality: 'Oslo', bedrooms: 2, bathrooms: 1, wishes: '', variant: '01' },
    plan: { variant: 'balanced', rooms: [{ id: 'living', name: 'Stue', width: 4, height: 5, area: 20 }], items: [] },
    createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
  };
}

function edited(name) {
  const value = record();
  value.project.name = name;
  return { project: value.project, plan: value.plan };
}

function syncFor(user = userA, current = record()) {
  const statuses = [];
  const sync = new ProjectSync(status => statuses.push(status));
  sync.user = user;
  sync.activate(current);
  instances.push(sync);
  return { sync, statuses };
}

function success(call, revision = call.body.revision + 1) {
  const id = decodeURIComponent(call.path.split('/').at(-1));
  call.resolve(new Response(JSON.stringify({ project: { ...record(id, revision), project: call.body.project, plan: call.body.plan } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function conflict(call, currentRevision = 5) {
  call.resolve(new Response(JSON.stringify({ error: { code: 'revision_conflict', message: 'En nyere versjon er lagret.' }, currentRevision }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
}

async function waitForRequests(count) {
  for (let i = 0; i < 50; i++) {
    if (calls.length >= count) return;
    await nextTurn();
  }
  assert.fail(`Expected ${count} save requests, received ${calls.length}.`);
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  storage = new Map(); calls = []; instances = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    setItem(key, value) { storage.set(String(key), String(value)); },
    getItem(key) { return storage.get(String(key)) ?? null; },
    removeItem(key) { storage.delete(String(key)); }
  } });
  globalThis.fetch = (path, options) => new Promise((resolve, reject) => {
    calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null, resolve, reject });
  });
});

afterEach(() => {
  for (const sync of instances) { clearTimeout(sync.timer); clearTimeout(sync.retryTimer); }
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('edits made during a save persist in order with the revision returned by the previous save', async () => {
  const { sync, statuses } = syncFor();
  sync.mark(edited('Første endring'));
  const saving = sync.flush();
  await waitForRequests(1);
  assert.equal(calls[0].body.revision, 1);
  assert.equal(calls[0].body.project.name, 'Første endring');
  sync.mark(edited('Siste endring'));
  assert.equal(calls.length, 1, 'a second write must wait for the first revision');
  success(calls[0], 2);
  await waitForRequests(2);
  assert.equal(calls[1].body.revision, 2);
  assert.equal(calls[1].body.project.name, 'Siste endring');
  success(calls[1], 3);
  await saving;
  assert.equal(sync.dirty, false);
  assert.equal(sync.record.revision, 3);
  assert.equal(sync.record.project.name, 'Siste endring');
  assert.equal(statuses.at(-1).state, 'saved');
  assert.equal(sync.recovery(), null);
});

test('a confirmed older snapshot cannot clear the recovery copy of a newer unsaved edit', async () => {
  const { sync } = syncFor();
  sync.mark(edited('På vei til serveren'));
  const saving = sync.flush();
  await waitForRequests(1);
  sync.mark(edited('Nyere lokalt arbeid'));
  success(calls[0], 2);
  await waitForRequests(2);
  const recovery = sync.recovery();
  assert.equal(recovery.data.project.name, 'Nyere lokalt arbeid');
  assert.equal(recovery.revision, 2);
  assert.equal(sync.dirty, true);
  success(calls[1], 3);
  await saving;
  assert.equal(sync.recovery(), null);
});

test('later mutations of an editor object cannot silently change an already queued save', async () => {
  const { sync } = syncFor();
  const snapshot = edited('Bekreftet brukerendring');
  sync.mark(snapshot);
  snapshot.project.name = 'Utilsiktet mutasjon';
  snapshot.plan.rooms[0].area = 999;
  const saving = sync.flush();
  await waitForRequests(1);
  assert.equal(calls[0].body.project.name, 'Bekreftet brukerendring');
  assert.equal(calls[0].body.plan.rooms[0].area, 20);
  success(calls[0]);
  await saving;
});

test('a revision conflict retains local work and stops automatic or explicit overwrite attempts', async () => {
  const { sync, statuses } = syncFor();
  sync.mark(edited('Min lokale løsning'));
  const saving = sync.flush();
  await waitForRequests(1);
  conflict(calls[0], 9);
  await assert.rejects(saving, error => error.status === 409 && error.details.currentRevision === 9);
  assert.equal(sync.dirty, true);
  assert.equal(sync.record.revision, 1);
  assert.equal(statuses.at(-1).state, 'conflict');
  assert.equal(sync.recovery().data.project.name, 'Min lokale løsning');
  sync.mark(edited('Min løsning med flere rettelser'));
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(calls.length, 1);
  assert.equal(sync.recovery().data.project.name, 'Min løsning med flere rettelser');
  await assert.rejects(sync.flush(), error => error.status === 409);
  assert.equal(calls.length, 1, 'retry must not bypass the revision conflict');
});

test('a network failure preserves recovery data and an explicit retry uses the unconfirmed revision', async () => {
  const { sync, statuses } = syncFor();
  sync.mark(edited('Arbeid som må beholdes'));
  const saving = sync.flush();
  await waitForRequests(1);
  calls[0].reject(new TypeError('Offline'));
  await assert.rejects(saving, error => error.code === 'network_error');
  assert.equal(sync.dirty, true);
  assert.equal(statuses.at(-1).state, 'error');
  assert.equal(sync.recovery().data.project.name, 'Arbeid som må beholdes');
  assert.equal(sync.recovery().revision, 1);
  assert.equal(calls.length, 1);
  const retry = sync.flush();
  await waitForRequests(2);
  assert.equal(calls[1].body.revision, 1);
  assert.equal(calls[1].body.project.name, 'Arbeid som må beholdes');
  success(calls[1], 2);
  await retry;
  assert.equal(sync.dirty, false);
  assert.equal(sync.recovery(), null);
  assert.equal(statuses.at(-1).state, 'saved');
});

test('an edit made after a network failure is the snapshot sent by the explicit retry', async () => {
  const { sync } = syncFor();
  sync.mark(edited('Før frakobling'));
  const saving = sync.flush();
  await waitForRequests(1); calls[0].reject(new TypeError('Offline'));
  await assert.rejects(saving);
  sync.mark(edited('Rettet mens frakoblet'));
  const retry = sync.flush();
  await waitForRequests(2);
  assert.equal(calls[1].body.project.name, 'Rettet mens frakoblet');
  success(calls[1]); await retry;
  assert.equal(sync.record.project.name, 'Rettet mens frakoblet');
});

test('project activation is blocked during a save so a response cannot be attributed to another project', async () => {
  const { sync } = syncFor();
  sync.mark(edited('Lagrer bolig A'));
  const saving = sync.flush();
  await waitForRequests(1);
  assert.throws(() => sync.activate(record('project-b')), /lagringen/i);
  assert.equal(sync.record.id, 'project-a');
  assert.equal(sync.recovery().data.project.name, 'Lagrer bolig A');
  success(calls[0]); await saving;
  sync.activate(record('project-b', 6));
  assert.equal(sync.record.id, 'project-b');
  assert.equal(sync.record.revision, 6);
  assert.equal(sync.dirty, false);
});

test('recovery records are separated by both account and project', () => {
  const { sync: first } = syncFor(userA, record('project-a'));
  const { sync: second } = syncFor(userA, record('project-b'));
  const { sync: otherAccount } = syncFor(userB, record('project-a'));
  first.mark(edited('Kari, bolig A'));
  second.mark(edited('Kari, bolig B'));
  otherAccount.mark(edited('Ola, bolig A'));
  assert.equal(storage.size, 3);
  assert.equal(first.recovery().data.project.name, 'Kari, bolig A');
  assert.equal(second.recovery().data.project.name, 'Kari, bolig B');
  assert.equal(otherAccount.recovery().data.project.name, 'Ola, bolig A');
  first.clearRecovery();
  assert.equal(first.recovery(), null);
  assert.equal(second.recovery().data.project.name, 'Kari, bolig B');
  assert.equal(otherAccount.recovery().data.project.name, 'Ola, bolig A');
});

test('a later page instance can recover pending work without automatically sending it to the server', () => {
  const { sync: beforeReload } = syncFor();
  beforeReload.mark(edited('Gjenopprettbar løsning'));
  const { sync: afterReload } = syncFor();
  assert.equal(afterReload.recovery().data.project.name, 'Gjenopprettbar løsning');
  assert.equal(afterReload.recovery().revision, 1);
  assert.equal(calls.length, 0);
});

test('browser storage failure does not prevent a confirmed cloud save', async () => {
  globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  const { sync, statuses } = syncFor();
  sync.mark(edited('Lagres uten lokal lagringsplass'));
  const saving = sync.flush(); await waitForRequests(1);
  success(calls[0]); await saving;
  assert.equal(sync.dirty, false);
  assert.equal(statuses.at(-1).state, 'saved');
});

test('anonymous or example editing cannot enqueue an authenticated project write', async () => {
  const { sync, statuses } = syncFor(null, record());
  sync.mark(edited('Anonym endring'));
  await sync.flush();
  assert.equal(calls.length, 0);
  assert.equal(storage.size, 0);
  assert.equal(statuses.at(-1).state, 'demo');
});

test('concurrent callers waiting for a save share the same ordered writes', async () => {
  const { sync } = syncFor();
  sync.mark(edited('Første arbeid'));
  const firstWaiter = sync.flush();
  await waitForRequests(1);
  sync.mark(edited('Andre arbeid'));
  const secondWaiter = sync.flush();
  assert.equal(calls.length, 1);
  success(calls[0], 2); await waitForRequests(2);
  assert.equal(calls[1].body.revision, 2);
  success(calls[1], 3);
  await Promise.all([firstWaiter, secondWaiter]);
  assert.equal(calls.length, 2);
  assert.equal(sync.record.revision, 3);
  assert.equal(sync.dirty, false);
});

function respond(call, body, status = 200) {
  call.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

test('a lost save response is recognised as our own write instead of a conflict', async () => {
  const { sync, statuses } = syncFor();
  const snapshot = edited('Lagret, men svaret kom aldri');
  sync.mark(snapshot);
  const saving = sync.flush();
  await waitForRequests(1);
  conflict(calls[0], 2);
  await waitForRequests(2);
  assert.equal(calls[1].options.method ?? 'GET', 'GET');
  respond(calls[1], { project: { ...record('project-a', 2), ...snapshot }, files: [] });
  await saving;
  assert.equal(sync.record.revision, 2);
  assert.equal(sync.dirty, false);
  assert.equal(statuses.at(-1).state, 'saved');
});

test('a one-revision conflict with different content is still a conflict', async () => {
  const { sync, statuses } = syncFor();
  sync.mark(edited('Min endring'));
  const saving = sync.flush();
  await waitForRequests(1);
  conflict(calls[0], 2);
  await waitForRequests(2);
  respond(calls[1], { project: { ...record('project-a', 2), project: { ...record().project, name: 'Endret i en annen fane' } }, files: [] });
  await assert.rejects(saving, error => isRevisionConflict(error));
  assert.equal(statuses.at(-1).state, 'conflict');
});

test('a 409 that is not a revision conflict does not block later saves', async () => {
  const { sync, statuses } = syncFor();
  sync.mark(edited('Første'));
  const saving = sync.flush();
  await waitForRequests(1);
  respond(calls[0], { error: { code: 'reference_unavailable', message: 'Underlaget ble endret.' } }, 409);
  await assert.rejects(saving, error => error.code === 'reference_unavailable');
  assert.equal(statuses.at(-1).state, 'error');
  sync.mark(edited('Andre'));
  const retry = sync.flush();
  await waitForRequests(2);
  success(calls[1]);
  await retry;
  assert.equal(statuses.at(-1).state, 'saved');
});
