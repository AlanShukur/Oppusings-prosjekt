/** User-owned projects and private files. Identity is supplied by the hosting layer. */
export const MAX_JSON_BYTES = 256 * 1024;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PROJECT_FILES = 12;
export const MAX_USER_PROJECTS = 100;
export const MAX_USER_STORAGE_BYTES = 1024 * 1024 * 1024;
export const MAX_ERROR_REPORT_BYTES = 8 * 1024;
// Same as PLAN_VERSION in public/studio/plan.js (a test checks). Newer plans are refused, since unknown fields would be dropped.
export const PLAN_VERSION = 1;
export const UPLOAD_LEASE_MS = 15 * 60 * 1000;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const ITEM_TYPES = new Set(['window', 'door', 'plant', 'sofa', 'table', 'bed', 'wall']);
const ROOM_TYPES = new Set(['living', 'bedroom', 'bath', 'hall', 'office', 'kitchen', 'dining', 'storage', 'room']);
const bool = value => typeof value === 'boolean';
const oneOf = (...values) => value => values.includes(value);
// Optional facts used by the indicative TEK17 check. Absent or null means "not answered".
const BUILDING_FIELDS = {
  ceilingHeight: value => finite(value, 1.5, 6),
  permitBefore2011: bool,
  accessibleUnit: bool,
  multiLevelUnit: bool,
  planLevel: oneOf('inngangsplan', 'annen'),
  multiUnitBuilding: bool,
  smallDetached: bool,
  lightTransmission: value => finite(value, 0.3, 1),
  externalStorageM2: value => finite(value, 0, 100),
  existingBathrooms: value => Number.isInteger(value) && value >= 0 && value <= 5,
  sillAboveTerrain: value => finite(value, 0, 30),
};
const MEASURE_FIELDS = {
  bearingWall: oneOf('ja', 'nei', 'vet-ikke'),
  facade: bool,
  useChange: oneOf('tilleggsdel-hoveddel', 'innen-hoveddel', 'nei'),
  newPipesThroughFireSeparation: bool,
};
const ROOM_FIELDS = { ceilingHeight: value => finite(value, 1.5, 6), previousUse: oneOf('hoveddel', 'tilleggsdel') };
const OPENING_FIELDS = { width: value => finite(value, 0.2, 6), height: value => finite(value, 0.2, 3), sillHeight: value => finite(value, 0, 2.5), entrance: value => value === true, escape: value => value === true };

/** Copy only allowlisted optional keys; never default-fill, so unanswered facts stay absent. */
function optionalFields(source, fields, label, target = {}) {
  if (source === undefined || source === null) return target;
  if (!object(source)) fail(400, 'invalid_project', `${label} har ugyldig innhold.`);
  for (const [key, valid] of Object.entries(fields)) {
    if (source[key] === undefined || source[key] === null) continue;
    if (!valid(source[key])) fail(400, 'invalid_project', `${label} har ugyldig innhold.`);
    target[key] = source[key];
  }
  return target;
}
const PLAN_VARIANTS = new Set(['balanced', 'family', 'three', '3', '03', '02', 'open', 'social', '01', 'custom']);
const PROJECT_VARIANTS = new Set(['01', '02', '03']);
const REFERENCE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const fail = (status, code, message, extra) => { throw new ApiError(status, code, message, extra); };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
const now = () => new Date().toISOString();
const uploadCutoff = () => new Date(Date.now() - UPLOAD_LEASE_MS).toISOString();
const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function text(value, field, max, required = false, multiline = false) {
  if (typeof value !== 'string' || value.length > max || (!multiline && /[\u0000-\u001f\u007f]/.test(value)) || (multiline && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))) {
    fail(400, 'invalid_project', `${field} har ugyldig innhold.`);
  }
  const clean = value.trim();
  if (required && !clean) fail(400, 'invalid_project', `${field} må fylles ut.`);
  return clean;
}

/** Reconstruct an allowlisted state; never persist arbitrary client properties. */
export function validateProjectPayload(payload) {
  if (!object(payload) || !object(payload.project) || !object(payload.plan)) fail(400, 'invalid_project', 'Prosjektet mangler gyldige prosjektdata eller plantegning.');
  const p = payload.project;
  if (!Number.isInteger(p.bedrooms) || p.bedrooms < 1 || p.bedrooms > 5 || !Number.isInteger(p.bathrooms) || p.bathrooms < 1 || p.bathrooms > 3 || !PROJECT_VARIANTS.has(p.variant)) {
    fail(400, 'invalid_project', 'Antall rom eller planvariant er ugyldig.');
  }
  const project = {
    name: text(p.name, 'Prosjektnavn', 70, true),
    municipality: text(p.municipality ?? '', 'Kommune', 70),
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    wishes: text(p.wishes ?? '', 'Ønsker', 4000, false, true),
    variant: p.variant,
  };
  const building = optionalFields(p.building, BUILDING_FIELDS, 'Opplysninger om boligen');
  if (Object.keys(building).length) project.building = building;
  const measures = optionalFields(p.measures, MEASURE_FIELDS, 'Opplysninger om tiltaket');
  if (Object.keys(measures).length) project.measures = measures;
  const source = payload.plan;
  if (!Array.isArray(source.rooms) || source.rooms.length > 30 || (!source.rooms.length && source.variant !== 'custom') || !Array.isArray(source.items) || source.items.length > 300 || !PLAN_VARIANTS.has(source.variant)) {
    fail(400, 'invalid_plan', 'Plantegningen kan ha maksimalt 30 rom og 300 elementer. En tom tegning må være en egen plan.');
  }
  if (source.schemaVersion !== undefined && (!Number.isInteger(source.schemaVersion) || source.schemaVersion < 0)) fail(400, 'invalid_plan', 'Plantegningen har en ugyldig formatversjon.');
  if (source.schemaVersion > PLAN_VERSION) fail(400, 'plan_too_new', 'Plantegningen er lagret med en nyere versjon av Romly. Last inn siden på nytt.');
  const ids = new Set();
  function uniqueId(id) {
    if (typeof id !== 'string' || !ID.test(id) || ids.has(id)) fail(400, 'invalid_plan', 'Rom og elementer må ha unike, gyldige ID-er.');
    ids.add(id);
    return id;
  }
  const rooms = source.rooms.map(r => {
    if (!object(r) || !ROOM_TYPES.has(r.type) || !/^#[\da-f]{6}$/i.test(r.color ?? '') || !finite(r.x, -5000, 5000) || !finite(r.y, -5000, 5000) || !finite(r.w, 1, 5000) || !finite(r.h, 1, 5000) || !finite(r.width, 0.02, 100) || !finite(r.height, 0.02, 100) || !finite(r.area, 0.0004, 10000)) {
      fail(400, 'invalid_plan', 'Et rom inneholder ugyldige mål eller egenskaper.');
    }
    const width = r.w / 50;
    const height = r.h / 50;
    const area = r.w * r.h / 2500;
    if (Math.abs(r.width - width) > 0.00001 || Math.abs(r.height - height) > 0.00001 || Math.abs(r.area - area) > 0.00001) fail(400, 'invalid_plan', 'Rommål og areal stemmer ikke med tegningen.');
    return optionalFields(r, ROOM_FIELDS, 'Et rom', { id: uniqueId(r.id), name: text(r.name, 'Romnavn', 80, true), type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, color: r.color.toLowerCase(), width, height, area });
  });
  const items = source.items.map(i => {
    if (!object(i) || !ITEM_TYPES.has(i.type) || !finite(i.x, -5000, 10000) || !finite(i.y, -5000, 10000) || !finite(i.rotation, -3600, 3600)) fail(400, 'invalid_plan', 'Et element inneholder ugyldige egenskaper.');
    const item = { id: uniqueId(i.id), type: i.type, x: i.x, y: i.y, rotation: i.rotation };
    if (i.x2 !== undefined || i.y2 !== undefined) {
      if (i.type !== 'wall' || !finite(i.x2, -5000, 10000) || !finite(i.y2, -5000, 10000)) fail(400, 'invalid_plan', 'Skilleveggen har ugyldige endepunkter.');
      item.x2 = i.x2;
      item.y2 = i.y2;
    }
    if (i.type === 'door' || i.type === 'window') optionalFields(i, OPENING_FIELDS, 'En dør eller et vindu', item);
    return item;
  });
  const plan = { rooms, items, variant: source.variant };
  if (source.schemaVersion !== undefined) plan.schemaVersion = source.schemaVersion;
  if (source.reference !== undefined && source.reference !== null) {
    const ref = source.reference;
    if (!object(ref) || typeof ref.fileId !== 'string' || !ID.test(ref.fileId) || !REFERENCE_MIME_TYPES.has(ref.mimeType) || !Number.isInteger(ref.page) || ref.page < 1 || ref.page > 200 || !Number.isInteger(ref.pixelWidth) || !finite(ref.pixelWidth, 1, 20000) || !Number.isInteger(ref.pixelHeight) || !finite(ref.pixelHeight, 1, 20000) || !finite(ref.x, -5000, 5000) || !finite(ref.y, -5000, 5000) || !finite(ref.w, 1, 5000) || !finite(ref.h, 1, 5000) || !finite(ref.opacity, 0, 1)) {
      fail(400, 'invalid_reference', 'Plantegningens underlag har ugyldige mål, sidetall eller filegenskaper.');
    }
    plan.reference = {
      fileId: ref.fileId,
      name: text(ref.name, 'Filnavn', 180, true),
      mimeType: ref.mimeType,
      page: ref.page,
      pixelWidth: ref.pixelWidth,
      pixelHeight: ref.pixelHeight,
      x: ref.x, y: ref.y, w: ref.w, h: ref.h,
      opacity: ref.opacity,
    };
  }
  return { project, plan };
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail(400, 'invalid_revision', 'Prosjektversjonen mangler. Last prosjektet på nytt.');
  return value;
}

function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if (site === 'cross-site' || origin && origin !== new URL(request.url).origin) fail(403, 'cross_origin', 'Forespørselen må komme fra Romly.');
}

async function readLimitedBody(request, max) {
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > max)) fail(413, 'body_too_large', 'Filen eller prosjektet er for stort.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        fail(413, 'body_too_large', 'Filen eller prosjektet er for stort.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { body.set(chunk, position); position += chunk.byteLength; }
  return body;
}

const ERROR_KINDS = new Set(['error', 'unhandledrejection', 'handled']);
// Crash reports carry no project content; scrub anything that could still identify a person.
const scrub = value => String(value)
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-post]')
  .replace(/\b\d{8,}\b/g, '[tall]')
  .replace(/\b(blob|data):[^\s)'"]+/g, '$1:…')
  .replace(/\?[^\s)'":]*/g, ''); // stop at ':' so 'app.js?v=2:12:5' keeps its line and column

/** Studio crash reports: no sign-in needed, same-origin only, logged for the hosting provider's log view. */
async function clientError(request, env) {
  if (request.method !== 'POST') fail(405, 'method_not_allowed', 'Denne handlingen er ikke støttet.');
  assertSameOrigin(request);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, 'json_required', 'Feilrapporten må sendes som JSON.');
  const body = await readLimitedBody(request, MAX_ERROR_REPORT_BYTES);
  let report;
  try { report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { fail(400, 'invalid_json', 'Feilrapporten kunne ikke leses.'); }
  if (!object(report) || !ERROR_KINDS.has(report.kind) || typeof report.message !== 'string' || !report.message.trim()) fail(400, 'invalid_report', 'Feilrapporten er ugyldig.');
  const text = (value, max) => typeof value === 'string' ? scrub(value).slice(0, max) : undefined;
  console.error('Romly client error', {
    env: env?.ROMLY_ENV || 'unknown',
    kind: report.kind,
    page: typeof report.page === 'string' && /^\/[\w\-./]{0,200}$/.test(report.page) ? report.page : 'unknown',
    release: text(report.release, 40) || 'unknown',
    context: text(report.context, 100),
    message: text(report.message, 500),
    stack: text(report.stack, 2000),
  });
  return noContent();
}

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, 'json_required', 'Prosjektdata må sendes som JSON.');
  const body = await readLimitedBody(request, MAX_JSON_BYTES);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { fail(400, 'invalid_json', 'Prosjektdataene kunne ikke leses.'); }
}

function record(row) {
  const state = JSON.parse(row.state_json);
  return { id: row.id, project: state.project, plan: state.plan, revision: row.revision, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function ownedProject(db, projectId, userId, active = false) {
  const row = await db.prepare('SELECT * FROM projects WHERE id = ? AND owner_id = ?').bind(projectId, userId).first();
  if (!row) fail(404, 'not_found', 'Prosjektet finnes ikke eller du har ikke tilgang.');
  if (active && row.status !== 'active') fail(409, 'project_deleting', 'Prosjektet er under sletting. Prøv å slette det på nytt.');
  return row;
}

async function conflict(db, projectId, userId) {
  const current = await ownedProject(db, projectId, userId, true);
  fail(409, 'revision_conflict', 'Prosjektet er endret i en annen fane eller på en annen enhet. Last inn den nyeste versjonen før du lagrer.', { currentRevision: current.revision });
}

function fileMetadata(row) {
  const expiresAt = row.status === 'pending' ? new Date(Date.parse(row.created_at) + UPLOAD_LEASE_MS).toISOString() : undefined;
  return { id: row.id, name: row.filename, size: row.size, mimeType: row.mime_type, status: row.status, canDelete: row.status !== 'pending' || row.created_at <= uploadCutoff(), ...(expiresAt ? { expiresAt } : {}), createdAt: row.created_at, url: `/api/projects/${row.project_id}/files/${row.id}` };
}

function assertBucket(env) {
  if (!env.BUCKET) fail(503, 'storage_unavailable', 'Fillagringen er midlertidig utilgjengelig. Prøv igjen senere.');
}

function sessionMetadata(user) {
  return {
    user: user?.userId ? { id: user.userId, email: user.email, name: user.displayName || user.email } : null,
    signInUrl: '/signin-with-chatgpt?return_to=%2F',
    signOutUrl: '/signout-with-chatgpt?return_to=%2F',
  };
}

async function projectFiles(env, user, projectId) {
  const result = await env.DB.prepare(`SELECT f.* FROM project_files f JOIN projects p ON p.id = f.project_id WHERE f.project_id = ? AND p.owner_id = ? ORDER BY f.created_at ASC, f.id ASC`).bind(projectId, user.userId).all();
  return result.results.map(fileMetadata);
}

async function bootstrap(request, env, user) {
  const session = sessionMetadata(user);
  if (!session.user) return json({ ...session, project: null, files: [], hasProjects: false });
  if (!env?.DB) fail(503, 'database_unavailable', 'Prosjektlagringen er midlertidig utilgjengelig. Prøv igjen senere.');
  const requested = new URL(request.url).searchParams.get('projectId') || '';
  const preferred = ID.test(requested) ? requested : '';
  // Select only this user's record, even when another user's ID is supplied.
  const row = await env.DB.prepare(`SELECT * FROM projects WHERE owner_id = ? AND status = 'active' ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, updated_at DESC, id ASC LIMIT 1`).bind(user.userId, preferred).first();
  if (row) {
    const files = await projectFiles(env, user, row.id);
    return json({ ...session, project: record(row), files, hasProjects: true });
  }
  const existing = await env.DB.prepare('SELECT id FROM projects WHERE owner_id = ? LIMIT 1').bind(user.userId).first();
  return json({ ...session, project: null, files: [], hasProjects: !!existing });
}

async function listProjects(env, user) {
  // Project lists must not transfer and parse every full floorplan from D1.
  const result = await env.DB.prepare(`SELECT p.id, p.revision, p.status, p.created_at, p.updated_at, json_extract(p.state_json, '$.project') AS project_json, json_array_length(p.state_json, '$.plan.rooms') AS room_count, (SELECT COALESCE(SUM(CAST(json_extract(room.value, '$.area') AS REAL)), 0) FROM json_each(p.state_json, '$.plan.rooms') AS room) AS area, (SELECT COUNT(*) FROM project_files f WHERE f.project_id = p.id) AS file_count FROM projects p WHERE p.owner_id = ? ORDER BY p.updated_at DESC, p.id ASC LIMIT ?`).bind(user.userId, MAX_USER_PROJECTS).all();
  return json({ projects: result.results.map(row => ({
    id: row.id,
    project: JSON.parse(row.project_json),
    revision: row.revision,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roomCount: row.room_count,
    area: row.area,
    fileCount: row.file_count,
  })) });
}

async function createProject(request, env, user) {
  const state = validateProjectPayload(await readJson(request));
  if (state.plan.reference) fail(400, 'reference_requires_upload', 'Opprett prosjektet og last opp plantegningen før du bruker filen som underlag.');
  const id = crypto.randomUUID();
  const date = now();
  const result = await env.DB.prepare(`INSERT INTO projects (id, owner_id, state_json, revision, status, created_at, updated_at) SELECT ?, ?, ?, 1, 'active', ?, ? WHERE (SELECT COUNT(*) FROM projects WHERE owner_id = ?) < ?`).bind(id, user.userId, JSON.stringify(state), date, date, user.userId, MAX_USER_PROJECTS).run();
  if (!changes(result)) fail(409, 'project_limit', 'Du kan ha maksimalt 100 prosjekter. Slett et prosjekt før du oppretter flere.');
  return json({ project: record(await ownedProject(env.DB, id, user.userId)), files: [] }, 201);
}

async function updateProject(request, env, user, projectId) {
  await ownedProject(env.DB, projectId, user.userId, true);
  const body = await readJson(request);
  const expected = revision(body?.revision);
  const state = validateProjectPayload(body);
  const reference = state.plan.reference;
  if (reference) {
    const file = await env.DB.prepare(`SELECT f.id, f.mime_type FROM project_files f JOIN projects p ON p.id = f.project_id WHERE f.id = ? AND f.project_id = ? AND p.owner_id = ? AND f.status = 'ready'`).bind(reference.fileId, projectId, user.userId).first();
    if (!file || file.mime_type !== reference.mimeType) fail(400, 'invalid_reference', 'Underlaget må være en ferdig opplastet fil i dette prosjektet med riktig filtype.');
  }
  // Return the exact committed state atomically: a separate SELECT could observe
  // a later writer and give this client a revision belonging to different data.
  const updated = await env.DB.prepare(`UPDATE projects SET state_json = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ? AND status = 'active' AND (? IS NULL OR EXISTS (SELECT 1 FROM project_files f WHERE f.id = ? AND f.project_id = ? AND f.mime_type = ? AND f.status = 'ready')) RETURNING *`).bind(JSON.stringify(state), now(), projectId, user.userId, expected, reference?.fileId ?? null, reference?.fileId ?? null, projectId, reference?.mimeType ?? null).first();
  if (!updated) {
    const current = await ownedProject(env.DB, projectId, user.userId, true);
    if (current.revision === expected && reference) fail(409, 'reference_unavailable', 'Underlaget ble endret eller slettet mens prosjektet ble lagret. Velg en opplastet fil på nytt.');
    return conflict(env.DB, projectId, user.userId);
  }
  return json({ project: record(updated) });
}

async function deleteProject(request, env, user, projectId) {
  const row = await ownedProject(env.DB, projectId, user.userId);
  const expected = revision(Number(new URL(request.url).searchParams.get('revision')));
  if (row.revision !== expected) return conflict(env.DB, projectId, user.userId);
  const locked = await env.DB.prepare(`UPDATE projects SET status = 'deleting' WHERE id = ? AND owner_id = ? AND revision = ? AND NOT EXISTS (SELECT 1 FROM project_files WHERE project_id = ? AND status = 'pending' AND created_at > ?)`).bind(projectId, user.userId, expected, projectId, uploadCutoff()).run();
  if (!changes(locked)) {
    const current = await ownedProject(env.DB, projectId, user.userId);
    if (current.revision !== expected) return conflict(env.DB, projectId, user.userId);
    fail(409, 'upload_in_progress', 'Vent til filopplastingen er ferdig før du sletter prosjektet.');
  }
  const files = await env.DB.prepare(`SELECT f.* FROM project_files f JOIN projects p ON p.id = f.project_id WHERE f.project_id = ? AND p.owner_id = ?`).bind(projectId, user.userId).all();
  if (files.results.length) {
    assertBucket(env);
    try { for (const file of files.results) await env.BUCKET.delete(file.storage_key); }
    catch { fail(503, 'file_cleanup_failed', 'Noen filer kunne ikke slettes. Prosjektet beholdes til du prøver slettingen på nytt.'); }
  }
  // The deleting state prevents new uploads and writes while object cleanup runs.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM project_files WHERE project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ? AND status = 'deleting' AND revision = ?)`).bind(projectId, projectId, user.userId, expected),
    env.DB.prepare(`DELETE FROM projects WHERE id = ? AND owner_id = ? AND status = 'deleting' AND revision = ?`).bind(projectId, user.userId, expected),
  ]);
  return noContent();
}

async function listFiles(env, user, projectId) {
  await ownedProject(env.DB, projectId, user.userId);
  return json({ files: await projectFiles(env, user, projectId) });
}

function detectMime(bytes) {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-') return 'application/pdf';
  return null;
}

async function uploadedFile(request) {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) fail(415, 'multipart_required', 'Filen må sendes som en filopplasting.');
  const max = MAX_FILE_BYTES + 128 * 1024;
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > max)) fail(413, 'body_too_large', 'Filen er for stor. Maksimal filstørrelse er 20 MB.');
  if (!request.body) fail(400, 'invalid_upload', 'Velg en fil som skal lastes opp.');
  let received = 0;
  const limited = request.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > max) fail(413, 'body_too_large', 'Filen er for stor. Maksimal filstørrelse er 20 MB.');
      controller.enqueue(chunk);
    },
  }));
  let form;
  // Parse from the bounded stream, without duplicating a 20 MB multipart body.
  try { form = await new Response(limited, { headers: { 'Content-Type': type } }).formData(); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    if (received > max) fail(413, 'body_too_large', 'Filen er for stor. Maksimal filstørrelse er 20 MB.');
    fail(400, 'invalid_upload', 'Filopplastingen kunne ikke leses.');
  }
  const entries = [...form.entries()];
  const file = form.get('file');
  if (entries.length !== 1 || !file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') fail(400, 'invalid_upload', 'Last opp én fil om gangen.');
  if (file.size < 1 || file.size > MAX_FILE_BYTES) fail(413, 'file_too_large', 'Hver fil må være mellom 1 byte og 20 MB.');
  const mime = detectMime(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!mime || file.type.toLowerCase() !== mime) fail(415, 'unsupported_file', 'Bruk en gyldig JPG-, PNG-, WebP- eller PDF-fil.');
  const name = String(file.name || 'fil').replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 180).trim() || 'fil';
  return { file, mime, name };
}

async function uploadFile(request, env, user, projectId) {
  await ownedProject(env.DB, projectId, user.userId, true);
  assertBucket(env);
  const { file, mime, name } = await uploadedFile(request);
  const id = crypto.randomUUID();
  const key = `projects/${projectId}/${id}`;
  const date = now();
  // The per-project count and the per-account byte quota are checked in the same atomic insert.
  const reservation = await env.DB.prepare(`INSERT INTO project_files (id, project_id, storage_key, filename, mime_type, size, status, created_at) SELECT ?, ?, ?, ?, ?, ?, 'pending', ? WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ? AND status = 'active') AND (SELECT COUNT(*) FROM project_files WHERE project_id = ?) < ? AND (SELECT COALESCE(SUM(f.size), 0) FROM project_files f JOIN projects p ON p.id = f.project_id WHERE p.owner_id = ?) + ? <= ?`).bind(id, projectId, key, name, mime, file.size, date, projectId, user.userId, projectId, MAX_PROJECT_FILES, user.userId, file.size, MAX_USER_STORAGE_BYTES).run();
  if (!changes(reservation)) {
    await ownedProject(env.DB, projectId, user.userId, true);
    const usage = await env.DB.prepare(`SELECT COALESCE(SUM(f.size), 0) AS used FROM project_files f JOIN projects p ON p.id = f.project_id WHERE p.owner_id = ?`).bind(user.userId).first();
    if (Number(usage?.used ?? 0) + file.size > MAX_USER_STORAGE_BYTES) fail(409, 'storage_limit', 'Kontoen har nådd grensen på 1 GB lagrede filer. Slett filer du ikke trenger før du laster opp flere.');
    fail(409, 'file_limit', 'Prosjektet kan ha maksimalt 12 filer. Fjern en fil før du laster opp flere.');
  }
  try {
    // A Blob gives R2 its exact length without copying a second full ArrayBuffer.
    await env.BUCKET.put(key, file, { httpMetadata: { contentType: mime }, customMetadata: { projectId, fileId: id } });
    const result = await env.DB.prepare(`UPDATE project_files SET status = 'ready' WHERE id = ? AND project_id = ? AND status = 'pending' AND created_at > ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ? AND status = 'active')`).bind(id, projectId, uploadCutoff(), projectId, user.userId).run();
    if (!changes(result)) throw new Error('Upload reservation is no longer active');
  } catch {
    // Retain metadata until object deletion succeeds, so cleanup can be retried.
    await env.DB.prepare(`UPDATE project_files SET status = 'deleting' WHERE id = ? AND project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ?)`).bind(id, projectId, projectId, user.userId).run();
    try {
      await env.BUCKET.delete(key);
      await env.DB.prepare(`DELETE FROM project_files WHERE id = ? AND project_id = ? AND status = 'deleting' AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ?)`).bind(id, projectId, projectId, user.userId).run();
    } catch { /* Its deleting row stays visible for a user-triggered retry. */ }
    fail(503, 'upload_failed', 'Filen kunne ikke lagres. Prøv igjen, eller fjern en fil som venter på sletting.');
  }
  const row = await env.DB.prepare(`SELECT f.* FROM project_files f JOIN projects p ON p.id = f.project_id WHERE f.id = ? AND f.project_id = ? AND p.owner_id = ?`).bind(id, projectId, user.userId).first();
  return json({ file: fileMetadata(row) }, 201);
}

async function ownedFile(env, user, projectId, fileId, active = false) {
  const project = await ownedProject(env.DB, projectId, user.userId, active);
  const file = await env.DB.prepare(`SELECT f.* FROM project_files f JOIN projects p ON p.id = f.project_id WHERE f.id = ? AND f.project_id = ? AND p.owner_id = ?`).bind(fileId, projectId, user.userId).first();
  if (!file) fail(404, 'not_found', 'Filen finnes ikke eller du har ikke tilgang.');
  return { ...file, referenceFileId: JSON.parse(project.state_json).plan?.reference?.fileId };
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = [...new TextEncoder().encode(filename)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

async function getFile(env, user, projectId, fileId) {
  const file = await ownedFile(env, user, projectId, fileId, true);
  if (file.status !== 'ready') fail(409, 'file_not_ready', 'Filen er under behandling eller venter på sletting.');
  assertBucket(env);
  const result = await env.BUCKET.get(file.storage_key);
  if (!result) fail(404, 'file_missing', 'Filen kunne ikke finnes i lagringen. Last den opp på nytt.');
  return new Response(result.body, { headers: {
    'Content-Type': file.mime_type,
    'Content-Length': String(result.size ?? file.size),
    'Content-Disposition': contentDisposition(file.filename),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'",
  } });
}

async function deleteFile(env, user, projectId, fileId) {
  const file = await ownedFile(env, user, projectId, fileId, true);
  if (file.referenceFileId === fileId) fail(409, 'reference_in_use', 'Filen brukes som plantegning. Fjern underlaget fra tegningen før du sletter filen.');
  const cutoff = uploadCutoff();
  if (file.status === 'pending' && file.created_at > cutoff) fail(409, 'upload_in_progress', 'Vent til filopplastingen er ferdig før du fjerner filen.');
  assertBucket(env);
  const marked = await env.DB.prepare(`UPDATE project_files SET status = 'deleting' WHERE id = ? AND project_id = ? AND created_at = ? AND (status IN ('ready', 'deleting') OR (status = 'pending' AND created_at <= ?)) AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ? AND status = 'active' AND COALESCE(json_extract(state_json, '$.plan.reference.fileId'), '') <> ?)`).bind(fileId, projectId, file.created_at, cutoff, projectId, user.userId, fileId).run();
  if (!changes(marked)) {
    const current = await ownedProject(env.DB, projectId, user.userId, true);
    if (JSON.parse(current.state_json).plan?.reference?.fileId === fileId) fail(409, 'reference_in_use', 'Filen brukes som plantegning. Fjern underlaget fra tegningen før du sletter filen.');
    fail(409, 'project_changed', 'Prosjektet er endret. Last det på nytt.');
  }
  try { await env.BUCKET.delete(file.storage_key); }
  catch { fail(503, 'file_cleanup_failed', 'Filen kunne ikke slettes. Prøv igjen.'); }
  await env.DB.prepare(`DELETE FROM project_files WHERE id = ? AND project_id = ? AND status = 'deleting' AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ?)`).bind(fileId, projectId, projectId, user.userId).run();
  return noContent();
}

/** Framework-independent router. Pass only a server-verified user, never request JSON. */
export async function handleProjectsRequest(request, env, user) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/api/session') {
      if (request.method !== 'GET') fail(405, 'method_not_allowed', 'Denne handlingen er ikke støttet.');
      return json(sessionMetadata(user));
    }
    if (path === '/api/bootstrap') {
      if (request.method !== 'GET') fail(405, 'method_not_allowed', 'Denne handlingen er ikke støttet.');
      return await bootstrap(request, env, user);
    }
    if (path === '/api/client-errors') return await clientError(request, env);
    if (!user?.userId) fail(401, 'authentication_required', 'Logg inn for å åpne og lagre prosjekter.');
    assertSameOrigin(request);
    if (!env?.DB) fail(503, 'database_unavailable', 'Prosjektlagringen er midlertidig utilgjengelig. Prøv igjen senere.');
    if (path === '/api/projects') {
      if (request.method === 'GET') return await listProjects(env, user);
      if (request.method === 'POST') return await createProject(request, env, user);
      fail(405, 'method_not_allowed', 'Denne handlingen er ikke støttet.');
    }
    const match = /^\/api\/projects\/([A-Za-z0-9_-]{1,100})(?:\/files(?:\/([A-Za-z0-9_-]{1,100}))?)?$/.exec(path);
    if (!match) fail(404, 'not_found', 'Adressen finnes ikke.');
    const [, projectId, fileId] = match;
    const fileRoute = path.includes('/files');
    if (!fileRoute) {
      if (request.method === 'GET') {
        const project = record(await ownedProject(env.DB, projectId, user.userId));
        return json({ project, files: await projectFiles(env, user, projectId) });
      }
      if (request.method === 'PUT') return await updateProject(request, env, user, projectId);
      if (request.method === 'DELETE') return await deleteProject(request, env, user, projectId);
    } else if (fileId) {
      if (request.method === 'GET') return await getFile(env, user, projectId, fileId);
      if (request.method === 'DELETE') return await deleteFile(env, user, projectId, fileId);
    } else {
      if (request.method === 'GET') return await listFiles(env, user, projectId);
      if (request.method === 'POST') return await uploadFile(request, env, user, projectId);
    }
    fail(405, 'method_not_allowed', 'Denne handlingen er ikke støttet.');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message }, ...error.extra }, error.status);
    // Keep database SQL, object keys, stack traces, and other users' data out of the response.
    // The server log gets enough to diagnose: route shape (ids masked), error kind and a bounded message.
    let route = 'unknown';
    try { route = new URL(request.url).pathname.replace(/\/projects\/[^/]+/, '/projects/:id').replace(/\/files\/[^/]+/, '/files/:id'); } catch { /* keep 'unknown' */ }
    console.error('Romly API request failed', { env: env?.ROMLY_ENV || 'unknown', method: request.method, route, kind: error?.name || 'Error', message: String(error?.message ?? '').slice(0, 300), stack: String(error?.stack ?? '').split('\n').slice(1, 4).join(' | ') });
    return json({ error: { code: 'internal_error', message: 'Noe gikk galt ved lagring. Prøv igjen senere.' } }, 500);
  }
}
