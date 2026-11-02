/**
 * Local-first project storage. Same contract as the cloud `api` in cloud.js (bootstrap, list,
 * create, get, save, remove, files, upload, removeFile), so the studio can run without an
 * account: projects and uploaded files stay in this browser's IndexedDB and never leave the device.
 *
 * The rules the server enforces are kept here too, so a later move to accounts is a straight
 * copy: revision checks (two tabs cannot silently overwrite each other), atomic deletes, file
 * type sniffing and the same file and project limits.
 */
import { ApiError } from './cloud.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PROJECT_FILES = 12;
export const MAX_PROJECTS = 100;
export const LOCAL_USER = { id: 'local', name: 'Denne enheten', email: '' };

const now = () => new Date().toISOString();
const newId = () => globalThis.crypto.randomUUID();
const fail = (status, code, message, details = {}) => { throw new ApiError(message, status, code, { error: { code, message }, ...details }); };

function detectMime(bytes) {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-') return 'application/pdf';
  return null;
}

function summary(record, fileCount) {
  const rooms = record.plan?.rooms || [];
  return { id: record.id, project: record.project, revision: record.revision, status: 'active', createdAt: record.createdAt, updatedAt: record.updatedAt, roomCount: rooms.length, area: rooms.reduce((sum, room) => sum + (Number(room.area) || 0), 0), fileCount };
}

/** IndexedDB backend: one transaction per call, so check-then-write steps are atomic across tabs. */
export function indexedDbBackend(name = 'romly-local') {
  let opening = null;
  const open = () => opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('files', { keyPath: 'id' }).createIndex('projectId', 'projectId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
    request.onblocked = () => reject(new Error('Lagringen er åpen i en eldre fane. Lukk andre Romly-faner og prøv igjen.'));
  });
  const wrap = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  return {
    async run(mode, work) {
      const db = await open();
      const transaction = db.transaction(['projects', 'files'], mode);
      const done = new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error('Lagringen ble avbrutt.')); });
      const tx = {
        get: (store, key) => wrap(transaction.objectStore(store).get(key)),
        put: (store, value) => wrap(transaction.objectStore(store).put(value)),
        delete: (store, key) => wrap(transaction.objectStore(store).delete(key)),
        all: store => wrap(transaction.objectStore(store).getAll()),
        filesOf: projectId => wrap(transaction.objectStore('files').index('projectId').getAll(projectId)),
      };
      let result;
      try { result = await work(tx); }
      catch (error) { try { transaction.abort(); } catch { /* already finished */ } throw error; }
      await done;
      return result;
    },
  };
}

/** In-memory backend with the same contract, for tests and browsers without IndexedDB. */
export function memoryBackend() {
  const stores = { projects: new Map(), files: new Map() };
  let queue = Promise.resolve();
  const copy = value => value === undefined ? undefined : structuredClone(value);
  return {
    run(mode, work) {
      const next = queue.then(async () => {
        // Work on a snapshot and commit only on success, like an IndexedDB transaction.
        const draft = { projects: new Map(stores.projects), files: new Map(stores.files) };
        const tx = {
          get: async (store, key) => copy(draft[store].get(key)),
          put: async (store, value) => { draft[store].set(value.id, copy(value)); },
          delete: async (store, key) => { draft[store].delete(key); },
          all: async store => [...draft[store].values()].map(copy),
          filesOf: async projectId => [...draft.files.values()].filter(file => file.projectId === projectId).map(copy),
        };
        const result = await work(tx);
        if (mode === 'readwrite') { stores.projects = draft.projects; stores.files = draft.files; }
        return result;
      });
      queue = next.catch(() => {});
      return next;
    },
  };
}

export function createLocalApi(backend = typeof indexedDB === 'undefined' ? memoryBackend() : indexedDbBackend()) {
  const urls = new Map();
  const fileUrl = file => {
    if (!urls.has(file.id)) urls.set(file.id, URL.createObjectURL(file.blob));
    return urls.get(file.id);
  };
  const release = id => { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } };
  const meta = file => ({ id: file.id, name: file.name, size: file.size, mimeType: file.mimeType, status: 'ready', canDelete: true, createdAt: file.createdAt, url: fileUrl(file) });
  const sorted = files => files.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(meta);
  const record = (tx, id) => tx.get('projects', id).then(value => value || fail(404, 'not_found', 'Prosjektet finnes ikke på denne enheten.'));

  return {
    async bootstrap(preferredId) {
      return backend.run('readonly', async tx => {
        const projects = (await tx.all('projects')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const project = projects.find(p => p.id === preferredId) || projects[0] || null;
        return { user: LOCAL_USER, project, files: project ? sorted(await tx.filesOf(project.id)) : [], hasProjects: projects.length > 0 };
      });
    },
    async session() { return { user: LOCAL_USER }; },
    async list() {
      return backend.run('readonly', async tx => {
        const [projects, files] = await Promise.all([tx.all('projects'), tx.all('files')]);
        return { projects: projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(p => summary(p, files.filter(f => f.projectId === p.id).length)) };
      });
    },
    async create({ project, plan }) {
      const created = await backend.run('readwrite', async tx => {
        if ((await tx.all('projects')).length >= MAX_PROJECTS) fail(409, 'project_limit', 'Du kan ha maksimalt 100 prosjekter. Slett et prosjekt før du oppretter flere.');
        const date = now(), value = { id: newId(), project: structuredClone(project), plan: structuredClone(plan), revision: 1, status: 'active', createdAt: date, updatedAt: date };
        await tx.put('projects', value);
        return value;
      });
      // Ask the browser not to evict the user's work under storage pressure.
      globalThis.navigator?.storage?.persist?.().catch(() => {});
      return { project: created, files: [] };
    },
    async get(id) {
      return backend.run('readonly', async tx => ({ project: await record(tx, id), files: sorted(await tx.filesOf(id)) }));
    },
    async save(id, { project, plan, revision }) {
      return backend.run('readwrite', async tx => {
        const current = await record(tx, id);
        if (current.revision !== revision) fail(409, 'revision_conflict', 'Prosjektet er endret i en annen fane. Last inn den nyeste versjonen før du lagrer.', { currentRevision: current.revision });
        if (plan?.reference && !(await tx.get('files', plan.reference.fileId))) fail(409, 'reference_unavailable', 'Underlaget ble slettet mens prosjektet ble lagret. Velg en opplastet fil på nytt.');
        const next = { ...current, project: structuredClone(project), plan: structuredClone(plan), revision: current.revision + 1, updatedAt: now() };
        await tx.put('projects', next);
        return { project: next };
      });
    },
    async remove(id, revision) {
      const removed = await backend.run('readwrite', async tx => {
        const current = await record(tx, id);
        if (current.revision !== Number(revision)) fail(409, 'revision_conflict', 'Prosjektet er endret i en annen fane. Åpne listen på nytt før du sletter.', { currentRevision: current.revision });
        const files = await tx.filesOf(id);
        for (const file of files) await tx.delete('files', file.id);
        await tx.delete('projects', id);
        return files.map(file => file.id);
      });
      removed.forEach(release);
      return null;
    },
    async files(id) {
      return backend.run('readonly', async tx => { await record(tx, id); return { files: sorted(await tx.filesOf(id)) }; });
    },
    async upload(id, file) {
      if (!file || !file.size || file.size > MAX_FILE_BYTES) fail(413, 'file_too_large', 'Hver fil må være mellom 1 byte og 20 MB.');
      const mime = detectMime(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
      if (!mime || (file.type && file.type.toLowerCase() !== mime)) fail(415, 'unsupported_file', 'Bruk en gyldig JPG-, PNG-, WebP- eller PDF-fil.');
      const name = String(file.name || 'fil').replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 180).trim() || 'fil';
      const blob = file.type === mime ? file : new Blob([file], { type: mime });
      const stored = await backend.run('readwrite', async tx => {
        await record(tx, id);
        if ((await tx.filesOf(id)).length >= MAX_PROJECT_FILES) fail(409, 'file_limit', 'Prosjektet kan ha maksimalt 12 filer. Fjern en fil før du laster opp flere.');
        const value = { id: newId(), projectId: id, name, mimeType: mime, size: file.size, blob, createdAt: now() };
        await tx.put('files', value);
        return value;
      });
      return { file: meta(stored) };
    },
    async removeFile(projectId, fileId) {
      await backend.run('readwrite', async tx => {
        const project = await record(tx, projectId), file = await tx.get('files', fileId);
        if (!file || file.projectId !== projectId) fail(404, 'not_found', 'Filen finnes ikke i prosjektet.');
        if (project.plan?.reference?.fileId === fileId) fail(409, 'reference_in_use', 'Filen brukes som plantegning. Fjern underlaget fra tegningen før du sletter filen.');
        await tx.delete('files', fileId);
      });
      release(fileId);
      return null;
    },
    /** Everything on this device as one JSON-safe backup (drawings and wishes; uploaded files are listed, not embedded). */
    async exportAll() {
      return backend.run('readonly', async tx => {
        const [projects, files] = await Promise.all([tx.all('projects'), tx.all('files')]);
        return { format: 'romly-backup-v1', exportedAt: now(), projects: projects.map(p => ({ project: p.project, plan: p.plan, createdAt: p.createdAt, updatedAt: p.updatedAt, files: files.filter(f => f.projectId === p.id).map(f => ({ name: f.name, mimeType: f.mimeType, size: f.size })) })) };
      });
    },
    async deleteAll() {
      const ids = await backend.run('readwrite', async tx => {
        const [projects, files] = await Promise.all([tx.all('projects'), tx.all('files')]);
        for (const file of files) await tx.delete('files', file.id);
        for (const project of projects) await tx.delete('projects', project.id);
        return files.map(file => file.id);
      });
      ids.forEach(release);
      return null;
    },
    async usage() {
      const estimate = await globalThis.navigator?.storage?.estimate?.().catch(() => null);
      const persisted = await globalThis.navigator?.storage?.persisted?.().catch(() => null);
      return { used: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted: persisted ?? null };
    },
  };
}
