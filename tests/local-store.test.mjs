import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalApi, memoryBackend, MAX_PROJECTS } from '../public/studio/local-store.js';
import { ProjectSync, isRevisionConflict } from '../public/studio/cloud.js';

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=', 'base64'));
const pngFile = (name = 'plan.png', type = 'image/png', bytes = png) => new File([bytes], name, { type });
const draft = (name = 'Storgata 14') => ({
  project: { name, municipality: 'Oslo', bedrooms: 2, bathrooms: 1, wishes: '', variant: '01' },
  plan: { variant: 'custom', rooms: [{ id: 'a', name: 'Stue', type: 'living', x: 0, y: 0, w: 200, h: 150, width: 4, height: 3, area: 12, color: '#f0e9dc' }], items: [] },
});
const rejects = (promise, status, code) => assert.rejects(promise, error => error.status === status && error.code === code);

test('projects keep their revision; a stale tab cannot overwrite newer work', async () => {
  const api = createLocalApi(memoryBackend());
  const { project } = await api.create(draft());
  assert.equal(project.revision, 1);
  const saved = (await api.save(project.id, { ...draft('Endret'), revision: 1 })).project;
  assert.equal(saved.revision, 2);
  assert.equal(saved.project.name, 'Endret');
  await assert.rejects(api.save(project.id, { ...draft('Gammel fane'), revision: 1 }), error => isRevisionConflict(error) && error.details.currentRevision === 2);
  assert.equal((await api.get(project.id)).project.project.name, 'Endret');
});

test('the list summarises rooms, area and files, newest first', async () => {
  const api = createLocalApi(memoryBackend());
  const first = (await api.create(draft('Første'))).project;
  await new Promise(resolve => setTimeout(resolve, 5));
  const second = (await api.create(draft('Andre'))).project;
  await api.upload(first.id, pngFile());
  const { projects } = await api.list();
  assert.deepEqual(projects.map(p => p.id), [second.id, first.id]);
  assert.equal(projects[1].roomCount, 1);
  assert.equal(projects[1].area, 12);
  assert.equal(projects[1].fileCount, 1);
});

test('uploads are sniffed by content and limited like on the server', async () => {
  const api = createLocalApi(memoryBackend());
  const { project } = await api.create(draft());
  const { file } = await api.upload(project.id, pngFile('Plantegning æøå.png'));
  assert.equal(file.mimeType, 'image/png');
  assert.equal(file.name, 'Plantegning æøå.png');
  assert.match(file.url, /^blob:/);
  await rejects(api.upload(project.id, pngFile('lur.pdf', 'application/pdf')), 415, 'unsupported_file');
  await rejects(api.upload(project.id, pngFile('script.png', 'image/png', new TextEncoder().encode('<script>alert(1)</script>'))), 415, 'unsupported_file');
  await rejects(api.upload(project.id, new File([], 'tom.png', { type: 'image/png' })), 413, 'file_too_large');
  for (let i = 1; i < 12; i++) await api.upload(project.id, pngFile(`plan-${i}.png`));
  await rejects(api.upload(project.id, pngFile('nummer-13.png')), 409, 'file_limit');
  assert.equal((await api.files(project.id)).files.length, 12);
});

test('a file used as the drawing underlay cannot be deleted, and a deleted one cannot be referenced', async () => {
  const api = createLocalApi(memoryBackend());
  const { project } = await api.create(draft());
  const { file } = await api.upload(project.id, pngFile());
  const withReference = draft();
  withReference.plan.reference = { fileId: file.id, name: 'plan.png', mimeType: 'image/png', page: 1, pixelWidth: 1, pixelHeight: 1, x: 0, y: 0, w: 100, h: 100, opacity: 0.7 };
  await api.save(project.id, { ...withReference, revision: 1 });
  await rejects(api.removeFile(project.id, file.id), 409, 'reference_in_use');
  await api.save(project.id, { ...draft(), revision: 2 });
  await api.removeFile(project.id, file.id);
  await rejects(api.save(project.id, { ...withReference, revision: 3 }), 409, 'reference_unavailable');
  assert.equal((await api.get(project.id)).project.revision, 3);
});

test('deleting a project removes its files atomically and needs the current revision', async () => {
  const api = createLocalApi(memoryBackend());
  const { project } = await api.create(draft());
  const other = (await api.create(draft('Annet'))).project;
  await api.upload(project.id, pngFile());
  await api.upload(other.id, pngFile());
  await rejects(api.remove(project.id, 7), 409, 'revision_conflict');
  await api.remove(project.id, 1);
  await rejects(api.get(project.id), 404, 'not_found');
  assert.equal((await api.files(other.id)).files.length, 1, 'other projects keep their files');
});

test('a failed write leaves nothing behind', async () => {
  const api = createLocalApi(memoryBackend());
  for (let i = 0; i < MAX_PROJECTS; i++) await api.create(draft(`P${i}`));
  await rejects(api.create(draft('For mange')), 409, 'project_limit');
  assert.equal((await api.list()).projects.length, MAX_PROJECTS);
});

test('bootstrap opens the last used project, or the newest one', async () => {
  const api = createLocalApi(memoryBackend());
  assert.deepEqual((({ project, hasProjects }) => ({ project, hasProjects }))(await api.bootstrap()), { project: null, hasProjects: false });
  const first = (await api.create(draft('Første'))).project;
  await new Promise(resolve => setTimeout(resolve, 5));
  const second = (await api.create(draft('Andre'))).project;
  assert.equal((await api.bootstrap(first.id)).project.id, first.id);
  assert.equal((await api.bootstrap('finnes-ikke')).project.id, second.id);
  assert.equal((await api.bootstrap()).user.id, 'local');
});

test('backup exports every drawing, and delete-all empties the device', async () => {
  const api = createLocalApi(memoryBackend());
  const { project } = await api.create(draft('Hytta'));
  await api.upload(project.id, pngFile());
  const backup = await api.exportAll();
  assert.equal(backup.format, 'romly-backup-v1');
  assert.equal(backup.projects[0].project.name, 'Hytta');
  assert.deepEqual(backup.projects[0].files.map(f => f.name), ['plan.png']);
  assert.doesNotThrow(() => JSON.stringify(backup));
  await api.deleteAll();
  assert.deepEqual((await api.list()).projects, []);
});

test('autosave writes to the local store and reports where it saved', async () => {
  const api = createLocalApi(memoryBackend());
  const statuses = [];
  const sync = new ProjectSync(status => statuses.push(status), { client: api, where: 'på denne enheten' });
  sync.user = { id: 'local' };
  const { project } = await api.create(draft());
  sync.activate(project);
  sync.mark(draft('Lagret lokalt'));
  await sync.flush();
  assert.equal(statuses.at(-1).message, 'Lagret på denne enheten');
  assert.equal((await api.get(project.id)).project.project.name, 'Lagret lokalt');
  assert.equal(sync.record.revision, 2);
});
