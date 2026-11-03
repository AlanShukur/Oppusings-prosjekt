import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { handleProjectsRequest } from '../lib/projects-api.mjs';
import { createDatabase, MemoryBucket } from './storage-adapters.mjs';

const origin = 'https://romly.test';
const owner = { userId: 'user-owner', email: 'owner@example.test', displayName: 'Prosjekteier' };
const other = { userId: 'user-other', email: 'other@example.test', displayName: 'Annen bruker' };
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=', 'base64'));
let env;

beforeEach(async () => { env = { DB: await createDatabase(), BUCKET: new MemoryBucket() }; });
afterEach(() => env?.DB.close());

function draft(name = 'Storgata 14') {
  return {
    project: { name, municipality: 'Oslo', bedrooms: 2, bathrooms: 1, wishes: 'Et ekstra soverom og en sosial stue.', variant: '01' },
    plan: {
      variant: 'balanced',
      rooms: [{ id: 'living', name: 'Stue / kjøkken', type: 'living', x: 140, y: 100, w: 320, h: 430, width: 6.4, height: 8.6, area: 55.04, color: '#f0e9dc' }],
      items: []
    }
  };
}

async function api(path, { method = 'GET', body, headers = {}, user = owner } = {}) {
  const requestHeaders = new Headers(headers);
  let requestBody = body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }
  if (!['GET', 'HEAD'].includes(method) && !requestHeaders.has('Origin')) requestHeaders.set('Origin', origin);
  return handleProjectsRequest(new Request(origin + path, { method, headers: requestHeaders, body: requestBody }), env, user);
}

async function json(response, expectedStatus) {
  assert.equal(response.status, expectedStatus);
  return response.status === 204 ? null : response.json();
}

async function create(name) {
  return (await json(await api('/api/projects', { method: 'POST', body: draft(name) }), 201)).project;
}

async function upload(projectId, { name = 'plantegning.png', type = 'image/png', bytes = png, user = owner } = {}) {
  const body = new FormData();
  body.set('file', new File([bytes], name, { type }));
  return api(`/api/projects/${projectId}/files`, { method: 'POST', body, user });
}

async function interruptedUpload(projectId, ageInMinutes = 0) {
  const id = crypto.randomUUID();
  const key = `projects/${projectId}/${id}`;
  const createdAt = new Date(Date.now() - ageInMinutes * 60000).toISOString();
  await env.DB.prepare(`INSERT INTO project_files (id, project_id, storage_key, filename, mime_type, size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).bind(id, projectId, key, 'avbrutt-opplasting.png', 'image/png', png.byteLength, createdAt).run();
  await env.BUCKET.put(key, png);
  return { id, url: `/api/projects/${projectId}/files/${id}` };
}

test('session exposes identity and normal top-level sign-in links without requiring authentication', async () => {
  const anonymous = await json(await api('/api/session', { user: null }), 200);
  assert.equal(anonymous.user, null);
  assert.match(anonymous.signInUrl, /^\/signin-with-chatgpt\?return_to=/);
  const signedIn = await json(await api('/api/session'), 200);
  assert.equal(signedIn.user.id, owner.userId);
  assert.equal(signedIn.user.email, owner.email);
  assert.match(signedIn.signOutUrl, /^\/signout-with-chatgpt\?return_to=/);
});

test('all project and file operations reject anonymous requests', async () => {
  for (const [path, method, body] of [
    ['/api/projects', 'GET'], ['/api/projects', 'POST', draft()],
    ['/api/projects/unknown', 'GET'], ['/api/projects/unknown', 'PUT', { ...draft(), revision: 1 }],
    ['/api/projects/unknown?revision=1', 'DELETE'], ['/api/projects/unknown/files', 'GET'],
    ['/api/projects/unknown/files', 'POST'], ['/api/projects/unknown/files/unknown', 'GET'],
    ['/api/projects/unknown/files/unknown', 'DELETE']
  ]) {
    const result = await api(path, { method, body, user: null });
    assert.equal(result.status, 401, `${method} ${path}`);
  }
});

test('project survives separate create, list and read requests with ownership-derived identity', async () => {
  const payload = draft();
  payload.ownerId = other.userId;
  const created = (await json(await api('/api/projects', { method: 'POST', body: payload }), 201)).project;
  assert.ok(created.id);
  assert.ok(Number.isInteger(created.revision));
  const listed = await json(await api('/api/projects'), 200);
  assert.deepEqual(listed.projects.map(project => project.id), [created.id]);
  assert.equal(listed.projects[0].project.name, payload.project.name);
  assert.equal(listed.projects[0].roomCount, 1);
  assert.ok(Math.abs(listed.projects[0].area - 55.04) < 0.001);
  const read = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.deepEqual(read.project, payload.project);
  assert.deepEqual(read.plan, payload.plan);
  assert.equal((await json(await api('/api/projects', { user: other }), 200)).projects.length, 0);
});

test('another user cannot read, change, delete, upload into or discover files of an owned project', async () => {
  const created = await create();
  const file = (await json(await upload(created.id), 201)).file;
  for (const [path, method, body] of [
    [`/api/projects/${created.id}`, 'GET'],
    [`/api/projects/${created.id}`, 'PUT', { ...draft('Uvedkommende endring'), revision: created.revision }],
    [`/api/projects/${created.id}?revision=${created.revision}`, 'DELETE'],
    [`/api/projects/${created.id}/files`, 'GET'],
    [`/api/projects/${created.id}/files/${file.id}`, 'GET'],
    [`/api/projects/${created.id}/files/${file.id}`, 'DELETE']
  ]) assert.equal((await api(path, { method, body, user: other })).status, 404, `${method} ${path}`);
  assert.equal((await upload(created.id, { user: other })).status, 404);
  const preserved = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.equal(preserved.project.name, 'Storgata 14');
});

test('malformed project state cannot be stored as HTML injection, invalid geometry or duplicate identifiers', async () => {
  const mutations = [
    value => { value.project.name = ''; },
    value => { value.project.bedrooms = 99; },
    value => { value.plan.rooms[0].x = '<img src=x onerror=alert(1)>'; },
    value => { value.plan.rooms[0].w = -2; },
    value => { value.plan.rooms[0].area = 100000; },
    value => { value.plan.rooms[0].color = 'url(javascript:alert(1))'; },
    value => { value.plan.rooms.push({ ...value.plan.rooms[0] }); },
    value => { value.plan.items.push({ id: 'item-1', type: 'script', x: 200, y: 200, rotation: 0 }); },
    value => { value.plan.items.push({ id: 'item-1', type: 'sofa', x: '<svg>', y: 200, rotation: 0 }); },
    value => { value.plan.rooms = Array.from({ length: 31 }, (_, i) => ({ ...value.plan.rooms[0], id: `r-${i}` })); }
  ];
  for (const mutate of mutations) {
    const value = draft(); mutate(value);
    const response = await api('/api/projects', { method: 'POST', body: value });
    assert.ok([400, 422].includes(response.status), `invalid state accepted: ${JSON.stringify(value)}`);
    assert.ok((await response.json()).error.message);
  }
  assert.equal((await json(await api('/api/projects'), 200)).projects.length, 0);
});

test('oversized JSON and malformed JSON requests are rejected without storing a project', async () => {
  const huge = draft(); huge.project.wishes = 'a'.repeat(300000);
  assert.ok([400, 413, 422].includes((await api('/api/projects', { method: 'POST', body: huge })).status));
  const malformed = await api('/api/projects', { method: 'POST', body: '{bad', headers: { 'Content-Type': 'application/json' } });
  assert.equal(malformed.status, 400);
  assert.equal((await json(await api('/api/projects'), 200)).projects.length, 0);
});

test('optimistic concurrency prevents a stale editor from overwriting newer saved work', async () => {
  const created = await create();
  const first = (await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('Nyeste endring'), revision: created.revision } }), 200)).project;
  assert.equal(first.revision, created.revision + 1);
  const stale = await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('Gammel nettleser'), revision: created.revision } }), 409);
  assert.equal(stale.currentRevision, first.revision);
  assert.equal((await json(await api(`/api/projects/${created.id}`), 200)).project.project.name, 'Nyeste endring');
});

test('simultaneous editors cannot both save the same revision', async () => {
  const created = await create();
  const responses = await Promise.all([
    api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('Endring A'), revision: created.revision } }),
    api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('Endring B'), revision: created.revision } })
  ]);
  assert.deepEqual(responses.map(response => response.status).sort((a, b) => a - b), [200, 409]);
  const stored = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.equal(stored.revision, created.revision + 1);
  assert.ok(['Endring A', 'Endring B'].includes(stored.project.name));
});

test('a save response acknowledges its own committed revision even if another editor writes immediately afterwards', async () => {
  const created = await create();
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let interleaved = false;
  let laterSave;
  env.DB.prepare = sql => {
    const statement = originalPrepare(sql);
    if (!/^UPDATE projects SET state_json\s*=/i.test(sql)) return statement;
    const intercept = current => ({
      bind(...args) { return intercept(current.bind(...args)); },
      async first(...args) { const result = await current.first(...args); await writeFromOtherEditor(); return result; },
      async run(...args) { const result = await current.run(...args); await writeFromOtherEditor(); return result; },
      all: (...args) => current.all(...args)
    });
    async function writeFromOtherEditor() {
      if (interleaved) return;
      interleaved = true;
      laterSave = await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('En annen fane, etterpå'), revision: created.revision + 1 } }), 200);
    }
    return intercept(statement);
  };
  const firstSave = (await json(await api(`/api/projects/${created.id}`, { method: 'PUT', body: { ...draft('Denne fanens lagring'), revision: created.revision } }), 200)).project;
  assert.equal(interleaved, true);
  assert.equal(firstSave.revision, created.revision + 1);
  assert.equal(firstSave.project.name, 'Denne fanens lagring');
  assert.equal(laterSave.project.revision, created.revision + 2);
  const latest = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.equal(latest.revision, created.revision + 2);
  assert.equal(latest.project.name, 'En annen fane, etterpå');
});

test('list places the most recently updated project first', async () => {
  const first = await create('Første prosjekt');
  await new Promise(resolve => setTimeout(resolve, 5));
  const second = await create('Andre prosjekt');
  await new Promise(resolve => setTimeout(resolve, 5));
  await json(await api(`/api/projects/${first.id}`, { method: 'PUT', body: { ...draft('Første prosjekt oppdatert'), revision: first.revision } }), 200);
  assert.deepEqual((await json(await api('/api/projects'), 200)).projects.map(project => project.id), [first.id, second.id]);
});

test('cross-origin project writes and uploads are rejected even for a signed-in user', async () => {
  assert.equal((await api('/api/projects', { method: 'POST', body: draft(), headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await api('/api/projects', { method: 'POST', body: draft(), headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const created = await create();
  const body = new FormData(); body.set('file', new File([png], 'plan.png', { type: 'image/png' }));
  assert.equal((await api(`/api/projects/${created.id}/files`, { method: 'POST', body, headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('an uploaded image persists with private metadata and an authenticated byte-for-byte download', async () => {
  const created = await create();
  const file = (await json(await upload(created.id, { name: 'Plantegning æøå.png' }), 201)).file;
  assert.equal(file.name, 'Plantegning æøå.png');
  assert.equal(file.size, png.byteLength);
  assert.equal(file.mimeType, 'image/png');
  assert.match(file.url, new RegExp(`^/api/projects/${created.id}/files/`));
  assert.ok(!JSON.stringify(file).includes('storageKey'));
  const files = await json(await api(`/api/projects/${created.id}/files`), 200);
  assert.equal(files.files.length, 1);
  assert.equal(files.files[0].id, file.id);
  const response = await api(file.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.match(response.headers.get('Cache-Control'), /(?:private|no-store)/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Disposition'), /filename\*/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
  const summary = (await json(await api('/api/projects'), 200)).projects[0];
  assert.equal(summary.fileCount, 1);
});

test('PDF uploads are retained and served with the validated PDF content type', async () => {
  const created = await create();
  const bytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const file = (await json(await upload(created.id, { name: 'Godkjent plan.pdf', type: 'application/pdf', bytes }), 201)).file;
  const response = await api(file.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('upload validation rejects executable content, mismatched MIME, empty files and files over 20 MB', async () => {
  const created = await create();
  for (const options of [
    { name: 'fake.png', type: 'image/png', bytes: '<html><script>alert(1)</script></html>' },
    { name: 'wrong.jpg', type: 'image/jpeg', bytes: png },
    { name: 'vector.svg', type: 'image/svg+xml', bytes: '<svg onload="alert(1)"/>' },
    { name: 'empty.png', type: 'image/png', bytes: new Uint8Array() },
    { name: 'too-big.png', type: 'image/png', bytes: new Uint8Array(20 * 1024 * 1024 + 1) }
  ]) {
    const response = await upload(created.id, options);
    assert.ok([400, 413, 415, 422].includes(response.status), `invalid upload accepted: ${options.name}`);
  }
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 0);
  assert.equal(env.BUCKET.objects.size, 0);
});

test('the file limit applies to persisted metadata and rejected uploads leave no extra objects', async () => {
  const created = await create();
  for (let i = 0; i < 12; i++) await json(await upload(created.id, { name: `plan-${i}.png` }), 201);
  const excess = await upload(created.id, { name: 'plan-13.png' });
  assert.ok([400, 409, 413, 422].includes(excess.status));
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 12);
  assert.equal(env.BUCKET.objects.size, 12);
});

test('concurrent uploads cannot both claim the final available file slot', async () => {
  const created = await create();
  for (let i = 0; i < 11; i++) await json(await upload(created.id, { name: `plan-${i}.png` }), 201);
  const responses = await Promise.all([
    upload(created.id, { name: 'race-a.png' }),
    upload(created.id, { name: 'race-b.png' })
  ]);
  const statuses = responses.map(response => response.status).sort((a, b) => a - b);
  assert.equal(statuses[0], 201);
  assert.ok([400, 409, 413, 422].includes(statuses[1]));
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 12);
  assert.equal(env.BUCKET.objects.size, 12);
});

test('a failed object write cannot report a successful upload or leave a visible file record', async () => {
  const created = await create(); env.BUCKET.failPut = true;
  const response = await upload(created.id);
  assert.ok(response.status >= 500);
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 0);
  assert.equal(env.BUCKET.objects.size, 0);
});

test('failed upload cleanup exposes a recoverable deleting file until the owner retries removal', async () => {
  const created = await create(); env.BUCKET.failPut = true; env.BUCKET.failDelete = true;
  assert.ok((await upload(created.id)).status >= 500);
  const files = (await json(await api(`/api/projects/${created.id}/files`), 200)).files;
  assert.equal(files.length, 1);
  assert.equal(files[0].status, 'deleting');
  assert.equal((await api(files[0].url)).status, 409);
  env.BUCKET.failPut = false; env.BUCKET.failDelete = false;
  await json(await api(files[0].url, { method: 'DELETE' }), 204);
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 0);
});

test('project deletion waits for an upload already writing its object', { timeout: 5000 }, async () => {
  const created = await create();
  let releasePut, enteredPut;
  const entered = new Promise(resolve => { enteredPut = resolve; });
  const released = new Promise(resolve => { releasePut = resolve; });
  const realPut = env.BUCKET.put.bind(env.BUCKET);
  env.BUCKET.put = async (...args) => { enteredPut(); await released; return realPut(...args); };
  const uploading = upload(created.id);
  await entered;
  try {
    const deleting = await api(`/api/projects/${created.id}?revision=${created.revision}`, { method: 'DELETE' });
    assert.equal(deleting.status, 409);
    assert.equal((await deleting.json()).error.code, 'upload_in_progress');
    assert.equal((await api(`/api/projects/${created.id}`)).status, 200);
  } finally { releasePut(); }
  await json(await uploading, 201);
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files[0].status, 'ready');
});

test('a recent interrupted upload remains protected while a stale one exposes cleanup recovery', async () => {
  const created = await create();
  const recent = await interruptedUpload(created.id);
  const stale = await interruptedUpload(created.id, 20);
  const files = (await json(await api(`/api/projects/${created.id}/files`), 200)).files;
  const recentMetadata = files.find(file => file.id === recent.id);
  const staleMetadata = files.find(file => file.id === stale.id);
  assert.equal(recentMetadata.canDelete, false);
  assert.equal(staleMetadata.canDelete, true);
  assert.ok(Date.parse(recentMetadata.expiresAt) > Date.now());
  assert.ok(Date.parse(staleMetadata.expiresAt) < Date.now());
  assert.equal((await api(recent.url, { method: 'DELETE' })).status, 409);
  await json(await api(stale.url, { method: 'DELETE' }), 204);
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 1);
});

test('a stale pending upload cannot permanently block deletion of its project', async () => {
  const created = await create(); await interruptedUpload(created.id, 20);
  await json(await api(`/api/projects/${created.id}?revision=${created.revision}`, { method: 'DELETE' }), 204);
  assert.equal((await api(`/api/projects/${created.id}`)).status, 404);
  assert.equal(env.BUCKET.objects.size, 0);
});

test('an old upload finishing after project deletion cleans its late object instead of leaking it', { timeout: 5000 }, async () => {
  const created = await create();
  let releasePut, enteredPut;
  const entered = new Promise(resolve => { enteredPut = resolve; });
  const released = new Promise(resolve => { releasePut = resolve; });
  const realPut = env.BUCKET.put.bind(env.BUCKET);
  env.BUCKET.put = async (...args) => { enteredPut(); await released; return realPut(...args); };
  const uploading = upload(created.id);
  await entered;
  try {
    await env.DB.prepare(`UPDATE project_files SET created_at = ? WHERE project_id = ? AND status = 'pending'`).bind(new Date(Date.now() - 20 * 60000).toISOString(), created.id).run();
    await json(await api(`/api/projects/${created.id}?revision=${created.revision}`, { method: 'DELETE' }), 204);
  } finally { releasePut(); }
  assert.ok((await uploading).status >= 500);
  assert.equal(env.BUCKET.objects.size, 0);
  assert.equal((await api(`/api/projects/${created.id}`)).status, 404);
});

test('individual file deletion removes the object and metadata and makes its URL unavailable', async () => {
  const created = await create();
  const file = (await json(await upload(created.id), 201)).file;
  await json(await api(file.url, { method: 'DELETE' }), 204);
  assert.equal((await api(file.url)).status, 404);
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 0);
  assert.equal(env.BUCKET.objects.size, 0);
});

test('a file identifier cannot be used under a different project, even for the same owner', async () => {
  const first = await create('Bolig A'); const second = await create('Bolig B');
  const file = (await json(await upload(first.id), 201)).file;
  const wrongParent = `/api/projects/${second.id}/files/${file.id}`;
  assert.equal((await api(wrongParent)).status, 404);
  assert.equal((await api(wrongParent, { method: 'DELETE' })).status, 404);
  assert.equal((await api(file.url)).status, 200);
});

test('failed file deletion leaves metadata available for a later retry', async () => {
  const created = await create(); const file = (await json(await upload(created.id), 201)).file;
  env.BUCKET.failDelete = true;
  assert.ok((await api(file.url, { method: 'DELETE' })).status >= 500);
  assert.equal((await json(await api(`/api/projects/${created.id}/files`), 200)).files.length, 1);
  env.BUCKET.failDelete = false;
  await json(await api(file.url, { method: 'DELETE' }), 204);
});

test('project deletion requires its current revision and removes all owned attachments', async () => {
  const created = await create(); const file = (await json(await upload(created.id), 201)).file;
  const latest = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.ok([400, 409, 422].includes((await api(`/api/projects/${created.id}`, { method: 'DELETE' })).status));
  assert.equal((await api(`/api/projects/${created.id}?revision=${latest.revision + 1}`, { method: 'DELETE' })).status, 409);
  assert.equal((await api(`/api/projects/${created.id}`)).status, 200);
  await json(await api(`/api/projects/${created.id}?revision=${latest.revision}`, { method: 'DELETE' }), 204);
  assert.equal((await api(`/api/projects/${created.id}`)).status, 404);
  assert.equal((await api(file.url)).status, 404);
  assert.equal(env.BUCKET.objects.size, 0);
  assert.deepEqual((await json(await api('/api/projects'), 200)).projects, []);
});

test('object storage failure during project deletion preserves the project for recovery', async () => {
  const created = await create(); await json(await upload(created.id), 201);
  const latest = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  env.BUCKET.failDelete = true;
  const response = await api(`/api/projects/${created.id}?revision=${latest.revision}`, { method: 'DELETE' });
  assert.ok(response.status >= 500);
  assert.equal((await api(`/api/projects/${created.id}`)).status, 200);
  env.BUCKET.failDelete = false;
  const afterFailure = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  await json(await api(`/api/projects/${created.id}?revision=${afterFailure.revision}`, { method: 'DELETE' }), 204);
});

test('database failures return a generic service error without revealing SQL or infrastructure details', async () => {
  const real = env.DB; env.DB = { prepare() { throw new Error('secret.sql SELECT owner_id FROM projects'); } };
  try {
    const response = await api('/api/projects');
    assert.ok(response.status >= 500);
    const body = await response.text();
    assert.ok(!body.includes('secret.sql'));
    assert.ok(!body.includes('SELECT'));
  } finally { env.DB = real; }
});

test('optional TEK17 facts, opening sizes and Bod rooms round-trip; unanswered facts stay absent', async () => {
  const payload = draft();
  payload.project.building = { ceilingHeight: 2.4, permitBefore2011: true, accessibleUnit: null, lightTransmission: 0.6, unknownKey: 'dropped' };
  payload.project.measures = { bearingWall: 'vet-ikke', facade: false };
  payload.plan.rooms.push({ id: 'bod', name: 'Bod', type: 'storage', x: 460, y: 100, w: 100, h: 100, width: 2, height: 2, area: 4, color: '#e8e1d1', ceilingHeight: 2.2, previousUse: 'tilleggsdel' });
  payload.plan.items.push({ id: 'w1', type: 'window', x: 200, y: 100, rotation: 0, width: 1.2, height: 1.3, sillHeight: 0.8, escape: true }, { id: 'd1', type: 'door', x: 140, y: 300, rotation: 90, width: 0.9, entrance: true }, { id: 'p1', type: 'plant', x: 200, y: 200, rotation: 0, width: 0.5, depth: 0.5, sillHeight: 1 });
  const created = (await json(await api('/api/projects', { method: 'POST', body: payload }), 201)).project;
  const read = (await json(await api(`/api/projects/${created.id}`), 200)).project;
  assert.deepEqual(read.project.building, { ceilingHeight: 2.4, permitBefore2011: true, lightTransmission: 0.6 });
  assert.deepEqual(read.project.measures, { bearingWall: 'vet-ikke', facade: false });
  assert.equal(read.plan.rooms[1].type, 'storage');
  assert.equal(read.plan.rooms[1].previousUse, 'tilleggsdel');
  assert.deepEqual(read.plan.items[0], payload.plan.items[0]);
  assert.deepEqual(read.plan.items[1], payload.plan.items[1]);
  assert.deepEqual([read.plan.items[2].width, read.plan.items[2].depth], [0.5, 0.5], 'furniture keeps its size');
  assert.equal(read.plan.items[2].sillHeight, undefined, 'opening fields are not kept on furniture');
});

test('invalid optional facts are rejected instead of being stored', async () => {
  for (const mutate of [
    body => { body.project.building = { ceilingHeight: 12 }; },
    body => { body.project.measures = { bearingWall: 'kanskje' }; },
    body => { body.plan.items.push({ id: 'w', type: 'window', x: 1, y: 1, rotation: 0, sillHeight: -1 }); },
    body => { body.plan.rooms[0].previousUse = 'kjeller'; },
    body => { body.project.building = 'ja'; },
  ]) {
    const body = draft();
    mutate(body);
    assert.equal((await api('/api/projects', { method: 'POST', body })).status, 400);
  }
});

test('an account cannot store more than the per-user byte quota across projects', async () => {
  const first = await create('A');
  const second = await create('B');
  await env.DB.prepare(`INSERT INTO project_files (id, project_id, storage_key, filename, mime_type, size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'ready', ?)`).bind('big', first.id, `projects/${first.id}/big`, 'stor.pdf', 'application/pdf', 1024 * 1024 * 1024 - 10, new Date().toISOString()).run();
  const response = await upload(second.id);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'storage_limit');
  assert.equal((await json(await api(`/api/projects/${second.id}/files`), 200)).files.length, 0);
  assert.equal((await upload(second.id, { user: other })).status, 404);
});

test('studio crash reports are accepted without sign-in, scrubbed and logged with the environment', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    env.ROMLY_ENV = 'staging';
    const report = { kind: 'error', message: 'Feil for kari@example.no med kontonummer 12345678901', stack: 'at x (/studio/app.js?v=2:1:1)', page: '/studio/index.html', release: 'sprint-1', context: '3d' };
    const response = await api('/api/client-errors', { method: 'POST', body: report, user: null });
    assert.equal(response.status, 204);
    const [label, entry] = logged.at(-1);
    assert.equal(label, 'Romly client error');
    assert.equal(entry.env, 'staging');
    assert.equal(entry.page, '/studio/index.html');
    assert.doesNotMatch(JSON.stringify(entry), /kari@example|12345678901|\?v=2/);
  } finally { console.error = original; delete env.ROMLY_ENV; }
});

test('crash reports must be same-origin, small, well-formed JSON sent with POST', async () => {
  const report = { kind: 'error', message: 'Feil' };
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await api('/api/client-errors', { method: 'POST', body: report, user: null, headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await api('/api/client-errors', { method: 'POST', body: { ...report, message: 'x'.repeat(9000) }, user: null })).status, 413);
    assert.equal((await api('/api/client-errors', { method: 'POST', body: { kind: 'virus', message: 'Feil' }, user: null })).status, 400);
    assert.equal((await api('/api/client-errors', { method: 'POST', body: 'ikke json', user: null, headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await api('/api/client-errors', { user: null })).status, 405);
  } finally { console.error = original; }
});
