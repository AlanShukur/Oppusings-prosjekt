import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { handleProjectsRequest } from '../lib/projects-api.mjs';
import { createDatabase, MemoryBucket } from './storage-adapters.mjs';

const origin = 'https://romly.test';
const owner = { userId: 'import-owner', email: 'owner@example.test', displayName: 'Prosjekteier' };
const other = { userId: 'import-other', email: 'other@example.test', displayName: 'Annen bruker' };
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=', 'base64'));
let env;

beforeEach(async () => { env = { DB: await createDatabase(), BUCKET: new MemoryBucket() }; });
afterEach(() => env?.DB.close());

function draft(name = 'Min egen bolig', custom = false) {
  return {
    project: { name, municipality: 'Oslo', bedrooms: 2, bathrooms: 1, wishes: '', variant: '01' },
    plan: {
      variant: custom ? 'custom' : 'balanced',
      rooms: custom ? [] : [{ id: 'living', name: 'Stue', type: 'living', x: 0, y: 0, w: 200, h: 250, width: 4, height: 5, area: 20, color: '#e9dfcc' }],
      items: [],
    },
  };
}

async function api(path, { method = 'GET', body, user = owner, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (body && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  if (!['GET', 'HEAD'].includes(method) && !requestHeaders.has('Origin')) requestHeaders.set('Origin', origin);
  return handleProjectsRequest(new Request(origin + path, { method, headers: requestHeaders, body }), env, user);
}

async function json(response, status) {
  assert.equal(response.status, status, await response.clone().text());
  return status === 204 ? null : response.json();
}

async function create(name, custom = false, user = owner) {
  return (await json(await api('/api/projects', { method: 'POST', body: draft(name, custom), user }), 201)).project;
}

async function upload(projectId, user = owner) {
  const body = new FormData();
  body.set('file', new File([png], 'egen-plantegning.png', { type: 'image/png' }));
  return (await json(await api(`/api/projects/${projectId}/files`, { method: 'POST', body, user }), 201)).file;
}

function reference(fileId) {
  return { fileId, name: 'egen-plantegning.png', mimeType: 'image/png', page: 1, pixelWidth: 1200, pixelHeight: 900, x: 0, y: 0, w: 600, h: 450, opacity: 0.65 };
}

test('anonymous bootstrap needs no database and reveals no preferred project', async () => {
  const database = env.DB;
  env.DB = { prepare() { assert.fail('Anonymous bootstrap must not read D1'); } };
  try {
    const result = await json(await api('/api/bootstrap?projectId=private-project', { user: null }), 200);
    assert.equal(result.user, null);
    assert.equal(result.project, null);
    assert.deepEqual(result.files, []);
    assert.equal(result.hasProjects, false);
    assert.match(result.signInUrl, /^\/signin-with-chatgpt\?/);
  } finally { env.DB = database; }
});

test('bootstrap returns own preferred project and attachments in one response', async () => {
  const first = await create('Foretrukket prosjekt');
  const attachment = await upload(first.id);
  await new Promise(resolve => setTimeout(resolve, 5));
  await create('Nyere prosjekt');
  const result = await json(await api('/api/bootstrap?projectId=' + first.id), 200);
  assert.equal(result.user.id, owner.userId);
  assert.equal(result.project.id, first.id);
  assert.equal(result.hasProjects, true);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].id, attachment.id);
  assert.equal(result.files[0].url, `/api/projects/${first.id}/files/${attachment.id}`);
  assert.equal('storageKey' in result.files[0], false);
  const direct = await json(await api(`/api/projects/${first.id}`), 200);
  assert.deepEqual(direct.files, result.files);
  assert.deepEqual(direct.project.plan, result.project.plan);
});

test('bootstrap cannot select another user’s project and falls back only to own latest', async () => {
  const own = await create('Eierens prosjekt');
  const foreign = await create('En annens prosjekt', false, other);
  const result = await json(await api('/api/bootstrap?projectId=' + foreign.id), 200);
  assert.equal(result.project.id, own.id);
  assert.equal(result.project.project.name, 'Eierens prosjekt');
  assert.deepEqual(result.files, []);
  const stranger = await json(await api('/api/bootstrap?projectId=' + own.id, { user: { userId: 'no-projects', email: 'stranger@example.test' } }), 200);
  assert.equal(stranger.project, null);
  assert.equal(stranger.hasProjects, false);
});

test('bootstrap reports deletion recovery without activating a deleting project', async () => {
  const created = await create('Avbrutt sletting');
  await env.DB.prepare("UPDATE projects SET status = 'deleting' WHERE id = ?").bind(created.id).run();
  const result = await json(await api('/api/bootstrap?projectId=' + created.id), 200);
  assert.equal(result.project, null);
  assert.equal(result.hasProjects, true);
  const listed = await json(await api('/api/projects'), 200);
  assert.equal(listed.projects[0].status, 'deleting');
});

test('project list reads summaries from D1 instead of transferring complete plans', async () => {
  const body = draft('Stor tegning');
  body.plan.rooms = Array.from({ length: 30 }, (_, i) => ({ ...body.plan.rooms[0], id: `room-${i}`, name: `Rom ${i}`, x: (i % 6) * 220, y: Math.floor(i / 6) * 270 }));
  body.plan.items = Array.from({ length: 300 }, (_, i) => ({ id: `item-${i}`, type: 'sofa', x: i, y: i, rotation: 0 }));
  await json(await api('/api/projects', { method: 'POST', body }), 201);
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let rowBytes = 0;
  env.DB.prepare = sql => {
    const statement = originalPrepare(sql);
    const wrap = current => ({
      bind(...args) { return wrap(current.bind(...args)); },
      first: (...args) => current.first(...args),
      run: (...args) => current.run(...args),
      async all(...args) {
        const result = await current.all(...args);
        rowBytes += new TextEncoder().encode(JSON.stringify(result.results)).byteLength;
        return result;
      },
    });
    return wrap(statement);
  };
  const listed = await json(await api('/api/projects'), 200);
  assert.equal(listed.projects[0].roomCount, 30);
  assert.equal(listed.projects[0].area, 600);
  assert.equal(listed.projects[0].project.name, 'Stor tegning');
  assert.equal('plan' in listed.projects[0], false);
  assert.ok(rowBytes < 2000, `D1 returned ${rowBytes} bytes for one summary; full plan was ${JSON.stringify(body.plan).length} bytes`);
});

test('only custom plans can start empty, and project creation includes an empty file list', async () => {
  const custom = await json(await api('/api/projects', { method: 'POST', body: draft('Tom egen tegning', true) }), 201);
  assert.deepEqual(custom.files, []);
  assert.deepEqual(custom.project.plan.rooms, []);
  const invalid = draft(); invalid.plan.rooms = [];
  assert.equal((await api('/api/projects', { method: 'POST', body: invalid })).status, 400);
});

test('owned ready floorplan reference and calibrated dimensions persist with an empty custom plan', async () => {
  const created = await create('Egen plantegning', true);
  const file = await upload(created.id);
  const body = draft('Egen plantegning', true);
  body.plan.reference = { ...reference(file.id), url: 'javascript:alert(1)', secretField: 'discarded' };
  const saved = (await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...body, revision: created.revision } }), 200)).project;
  assert.deepEqual(saved.plan.reference, reference(file.id));
  assert.deepEqual(saved.plan.rooms, []);
  const boot = await json(await api('/api/bootstrap?projectId=' + created.id), 200);
  assert.deepEqual(boot.project.plan.reference, reference(file.id));
  assert.equal(boot.files[0].id, file.id);
});

test('reference validation rejects unsupported file type, nonfinite geometry and invalid page or pixel dimensions', async () => {
  const created = await create('Ugyldig underlag', true);
  const file = await upload(created.id);
  const mutations = [
    ref => { ref.fileId = '../other'; },
    ref => { ref.mimeType = 'image/svg+xml'; },
    ref => { ref.page = 0; },
    ref => { ref.page = 201; },
    ref => { ref.pixelWidth = 0; },
    ref => { ref.pixelHeight = 20001; },
    ref => { ref.pixelWidth = 1200.5; },
    ref => { ref.x = '<script>'; },
    ref => { ref.w = -1; },
    ref => { ref.h = 5001; },
    ref => { ref.opacity = 1.01; },
  ];
  for (const mutate of mutations) {
    const body = draft('Ugyldig underlag', true);
    body.plan.reference = reference(file.id); mutate(body.plan.reference);
    const result = await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...body, revision: created.revision } }), 400);
    assert.equal(result.error.code, 'invalid_reference');
  }
  assert.equal((await json(await api(`/api/projects/${created.id}`), 200)).project.revision, created.revision);
});

test('a reference must belong to the same project and user, be ready and match its uploaded MIME type', async () => {
  const created = await create('Aktivt prosjekt', true);
  const sameOwnerProject = await create('Et annet prosjekt', true);
  const sameOwnerFile = await upload(sameOwnerProject.id);
  const foreignProject = await create('Annen konto', true, other);
  const foreignFile = await upload(foreignProject.id, other);
  const ownFile = await upload(created.id);
  for (const ref of [reference(sameOwnerFile.id), reference(foreignFile.id), reference('missing'), { ...reference(ownFile.id), mimeType: 'application/pdf' }]) {
    const body = draft('Aktivt prosjekt', true); body.plan.reference = ref;
    assert.equal((await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...body, revision: created.revision } })).status, 400);
  }
  await env.DB.prepare("UPDATE project_files SET status = 'pending' WHERE id = ?").bind(ownFile.id).run();
  const pending = draft('Aktivt prosjekt', true); pending.plan.reference = reference(ownFile.id);
  assert.equal((await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...pending, revision: created.revision } })).status, 400);
});

test('a copied project cannot retain a reference to an existing project’s uploaded file', async () => {
  const original = await create('Original');
  const file = await upload(original.id);
  const body = draft('Kopi', true); body.plan.reference = reference(file.id);
  const response = await json(await api('/api/projects', { method: 'POST', body }), 400);
  assert.equal(response.error.code, 'reference_requires_upload');
  assert.equal((await json(await api('/api/projects'), 200)).projects.length, 1);
});

test('a floorplan source file cannot be deleted until the active reference is removed', async () => {
  const created = await create('Underlag i bruk', true);
  const file = await upload(created.id);
  const body = draft('Underlag i bruk', true); body.plan.reference = reference(file.id);
  const saved = (await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...body, revision: created.revision } }), 200)).project;
  const protectedDelete = await json(await api(file.url, { method: 'DELETE' }), 409);
  assert.equal(protectedDelete.error.code, 'reference_in_use');
  assert.equal(env.BUCKET.objects.size, 1);
  await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('Underlag fjernet', true), revision: saved.revision } }), 200);
  await json(await api(file.url, { method: 'DELETE' }), 204);
  assert.equal(env.BUCKET.objects.size, 0);
});

test('a concurrent reference save protects its source before a file deletion can commit', async () => {
  const created = await create('Samtidig underlag', true);
  const file = await upload(created.id);
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let interleaved = false;
  env.DB.prepare = sql => {
    const statement = originalPrepare(sql);
    if (!/^UPDATE project_files SET status = 'deleting'/i.test(sql)) return statement;
    const wrap = current => ({
      bind(...args) { return wrap(current.bind(...args)); },
      async run(...args) {
        if (!interleaved) {
          interleaved = true;
          const body = draft('Samtidig underlag', true); body.plan.reference = reference(file.id);
          await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...body, revision: created.revision } }), 200);
        }
        return current.run(...args);
      },
    });
    return wrap(statement);
  };
  const response = await json(await api(file.url, { method: 'DELETE' }), 409);
  assert.equal(response.error.code, 'reference_in_use');
  assert.equal(env.BUCKET.objects.size, 1);
});

test('a reference cannot commit after its validated file was concurrently deleted', async () => {
  const created = await create('Samtidig sletting', true);
  const file = await upload(created.id);
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let interleaved = false;
  env.DB.prepare = sql => {
    const statement = originalPrepare(sql);
    if (!/^UPDATE projects SET state_json/i.test(sql)) return statement;
    const wrap = current => ({
      bind(...args) { return wrap(current.bind(...args)); },
      async first(...args) {
        if (!interleaved) { interleaved = true; await json(await api(file.url, { method: 'DELETE' }), 204); }
        return current.first(...args);
      },
    });
    return wrap(statement);
  };
  const body = draft('Samtidig sletting', true); body.plan.reference = reference(file.id);
  const result = await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...body, revision: created.revision } }), 409);
  assert.equal(result.error.code, 'reference_unavailable');
  const stored = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.equal(stored.revision, created.revision);
  assert.equal(stored.plan.reference, undefined);
});
