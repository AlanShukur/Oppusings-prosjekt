export class ApiError extends Error {
  constructor(message, status = 0, code = 'network_error', details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  try {
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(body?.error?.message || 'Handlingen kunne ikke fullføres. Prøv igjen.', response.status, body?.error?.code, body || {});
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'Serveren svarte ikke i tide. Endringene dine er ikke bekreftet lagret.' : 'Ingen forbindelse til serveren. Endringene dine er ikke bekreftet lagret.');
  } finally {
    clearTimeout(timer);
  }
}

const projectPath = id => '/api/projects/' + encodeURIComponent(id);
export const api = {
  bootstrap: id => request('/api/bootstrap'+(id?'?projectId='+encodeURIComponent(id):'')),
  session: () => request('/api/session'),
  list: () => request('/api/projects'),
  create: data => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  get: id => request(projectPath(id)),
  save: (id, data) => request(projectPath(id), { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id, revision) => request(projectPath(id) + '?revision=' + encodeURIComponent(revision), { method: 'DELETE' }),
  files: id => request(projectPath(id) + '/files'),
  upload: (id, file) => { const body = new FormData(); body.append('file', file); return request(projectPath(id) + '/files', { method: 'POST', body }); },
  removeFile: (projectId, fileId) => request(projectPath(projectId) + '/files/' + encodeURIComponent(fileId), { method: 'DELETE' }),
};

const copy = data => JSON.parse(JSON.stringify(data));
/** Only a stale revision is a conflict; other 409s (file in use, project deleting) are ordinary errors. */
export const isRevisionConflict = error => error?.status === 409 && (error.code === 'revision_conflict' || error.code === undefined);
export const isSignedOut = error => error?.status === 401;
const isTransient = error => !error?.status || error.status >= 500;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const sameContent = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Serialized writes keep the revision and editor snapshot paired across saves. */
export class ProjectSync {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.user = null;
    this.record = null;
    this.pending = null;
    this.sequence = 0;
    this.savedSequence = 0;
    this.saving = null;
    this.timer = null;
    this.error = null;
    this.generation = 0;
    this.retries = 0;
    this.retryTimer = null;
  }

  errorStatus(error, retrying = false) {
    if (isRevisionConflict(error)) return ['conflict', 'Nyere versjon finnes · Løs konflikten'];
    if (isSignedOut(error)) return ['error', 'Du er logget ut · Logg inn for å lagre'];
    return ['error', retrying ? 'Ikke lagret ennå · Prøver igjen automatisk' : 'Ikke lagret på kontoen · Prøv igjen'];
  }

  get dirty() { return this.sequence !== this.savedSequence; }
  get recoveryKey() { return this.user && this.record ? `romly-recovery:${this.user.id}:${this.record.id}` : null; }

  status(state, message) { this.onStatus({ state, message, error: this.error, dirty: this.dirty }); }

  activate(record) {
    if (this.saving) throw new Error('Vent til lagringen er ferdig før du bytter prosjekt.');
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    this.retries = 0;
    this.record = record ? copy(record) : null;
    this.pending = null;
    this.sequence = this.savedSequence = 0;
    this.error = null;
    this.generation++;
    this.status(record ? 'saved' : 'demo', record ? 'Lagret på kontoen' : 'Eksempelvisning · Ikke lagret');
  }

  mark(snapshot) {
    if (!this.user || !this.record) {
      this.status('demo', 'Eksempelvisning · Ikke lagret');
      return;
    }
    this.pending = copy(snapshot);
    this.sequence++;
    this.writeRecovery();
    clearTimeout(this.timer);
    if (isRevisionConflict(this.error)) {
      this.status('conflict', 'Nyere versjon finnes · Løs konflikten');
      return;
    }
    this.error = null;
    this.status('pending', 'Endringer venter på lagring');
    this.timer = setTimeout(() => this.flush().catch(() => {}), 650);
  }

  writeRecovery() {
    try {
      if (this.recoveryKey && this.pending) localStorage.setItem(this.recoveryKey, JSON.stringify({ revision: this.record.revision, data: this.pending, updatedAt: new Date().toISOString() }));
    } catch { /* Cloud saving works even when browser storage is unavailable. */ }
  }

  recovery() {
    try { return this.recoveryKey ? JSON.parse(localStorage.getItem(this.recoveryKey)) : null; } catch { return null; }
  }

  clearRecovery() {
    try { if (this.recoveryKey) localStorage.removeItem(this.recoveryKey); } catch {}
  }

  async flush() {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    if (this.saving) {
      await this.saving;
      if (this.dirty) return this.flush();
      return;
    }
    if (!this.dirty || !this.record || !this.user) return;
    if (isRevisionConflict(this.error)) throw this.error;
    const id = this.record.id;
    const generation = this.generation;
    const sequence = this.sequence;
    const snapshot = copy(this.pending);
    const revision = this.record.revision;
    this.error = null;
    this.status('saving', 'Lagrer på kontoen …');
    this.saving = (async () => {
      try {
        const result = await api.save(id, { ...snapshot, revision });
        if (this.generation !== generation || this.record?.id !== id) return;
        this.acknowledge(result.project, sequence);
      } catch (error) {
        if (this.generation !== generation) throw error;
        // A save whose response was lost (timeout, dropped connection) comes back as a conflict
        // with our own write: exactly one revision ahead. If the account version already holds
        // exactly this snapshot, adopt it instead of reporting a conflict with ourselves.
        if (isRevisionConflict(error) && error.details?.currentRevision === revision + 1) {
          try {
            const current = (await api.get(id)).project;
            if (this.generation === generation && current?.id === id && sameContent({ project: current.project, plan: current.plan }, snapshot)) {
              this.acknowledge(current, sequence);
              return;
            }
          } catch { /* Keep the original conflict. */ }
        }
        this.error = error;
        this.writeRecovery();
        const retrying = isTransient(error) && this.retries < 3;
        if (retrying) {
          this.retries++;
          this.retryTimer = setTimeout(() => this.flush().catch(() => {}), 2000 * 2 ** (this.retries - 1));
        }
        this.status(...this.errorStatus(error, retrying));
        throw error;
      }
    })();
    try { await this.saving; } finally { this.saving = null; }
    if (this.dirty) return this.flush();
  }

  acknowledge(record, sequence) {
    this.record = record;
    this.savedSequence = sequence;
    this.error = null;
    this.retries = 0;
    if (!this.dirty) this.clearRecovery();
    else this.writeRecovery();
    this.status(this.dirty ? 'pending' : 'saved', this.dirty ? 'Nye endringer venter på lagring' : 'Lagret på kontoen');
  }
}
