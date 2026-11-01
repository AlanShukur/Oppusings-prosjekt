import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Execute the actual application migrations against SQLite. The adapter only
// translates D1's transport shape; SQL parsing, constraints and transactions are
// handled by the real database engine.
export async function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  const directory = resolve('drizzle');
  const migrations = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (!migrations.length) throw new Error('Generate the application migrations before running API tests.');
  for (const file of migrations) database.exec(await readFile(resolve(directory, file), 'utf8'));

  class Statement {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...args) { return new Statement(this.sql, args); }
    async first(column) {
      const row = database.prepare(this.sql).get(...this.args);
      return row ? (column ? row[column] : { ...row }) : null;
    }
    async all() {
      const results = database.prepare(this.sql).all(...this.args).map(row => ({ ...row }));
      return { success: true, results, meta: { changes: 0 } };
    }
    async run() {
      const result = database.prepare(this.sql).run(...this.args);
      return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    }
    async raw(options) {
      const statement = database.prepare(this.sql);
      const columns = statement.columns().map(column => column.name);
      const rows = statement.all(...this.args).map(row => columns.map(column => row[column]));
      return options?.columnNames ? [columns, ...rows] : rows;
    }
  }

  let batchQueue = Promise.resolve();
  async function executeBatch(statements) {
    database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) {
        const returnsRows = /^\s*(?:SELECT|WITH|PRAGMA)\b/i.test(statement.sql) || /\bRETURNING\b/i.test(statement.sql);
        results.push(await (returnsRows ? statement.all() : statement.run()));
      }
      database.exec('COMMIT');
      return results;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  return {
    prepare(sql) { return new Statement(sql); },
    batch(statements) {
      const result = batchQueue.then(() => executeBatch(statements));
      batchQueue = result.catch(() => {});
      return result;
    },
    async exec(sql) { database.exec(sql); return { count: 1, duration: 0 }; },
    close() { database.close(); }
  };
}

export class MemoryBucket {
  objects = new Map();
  failPut = false;
  failDelete = false;
  failGet = false;

  async put(key, value, options = {}) {
    if (this.failPut) throw new Error('Injected object storage failure');
    const bytes = value instanceof ReadableStream
      ? new Uint8Array(await new Response(value).arrayBuffer())
      : value instanceof Blob
        ? new Uint8Array(await value.arrayBuffer())
        : new Uint8Array(value);
    const object = { key, bytes, size: bytes.byteLength, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {}, uploaded: new Date(), etag: 'test-etag', httpEtag: '"test-etag"' };
    this.objects.set(key, object);
    return { ...object };
  }

  async get(key) {
    if (this.failGet) throw new Error('Injected object storage failure');
    const object = this.objects.get(key);
    if (!object) return null;
    const bytes = object.bytes.slice();
    return {
      ...object,
      body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
      async arrayBuffer() { return bytes.buffer; },
      writeHttpMetadata(headers) {
        if (object.httpMetadata.contentType) headers.set('Content-Type', object.httpMetadata.contentType);
        if (object.httpMetadata.contentDisposition) headers.set('Content-Disposition', object.httpMetadata.contentDisposition);
      }
    };
  }

  async head(key) {
    const object = this.objects.get(key);
    return object ? { ...object } : null;
  }

  async delete(keys) {
    if (this.failDelete) throw new Error('Injected object storage failure');
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}
