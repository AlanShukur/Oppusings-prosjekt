/**
 * Crash reporting for the studio. Sends a short technical report (error text, code location,
 * page path, release) to /api/client-errors, which writes it to the hosting provider's log.
 * Never sends project content, file names, query strings or blob/data URLs, and is capped
 * per page load so a crash loop cannot flood the log.
 */
export const RELEASE = 'sprint-1';
const MAX_REPORTS = 5;

const clean = value => String(value ?? '')
  .replace(/\b(blob|data):[^\s)'"]+/g, '$1:…')
  .replace(/https?:\/\/[^/\s)'"]+/g, '')
  .replace(/\?[^\s)'":]*/g, ''); // stop at ':' so 'app.js?v=2:12:5' keeps its line and column

export function createErrorReporter({ send = body => fetch('/api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' }), page = () => globalThis.location?.pathname || 'unknown' } = {}) {
  const seen = new Set();
  let sent = 0;
  /** Report an unexpected problem. Returns true when a report was sent. */
  function report(error, { kind = 'handled', context } = {}) {
    try {
      const message = clean(error?.message ?? error).trim().slice(0, 500);
      const stack = clean(error?.stack ?? '').split('\n').slice(0, 8).join('\n').slice(0, 2000);
      const key = message + '|' + (stack.split('\n')[1] || '');
      if (!message || seen.has(key) || sent >= MAX_REPORTS) return false;
      seen.add(key); sent++;
      const body = JSON.stringify({ kind, message, stack, page: page(), release: RELEASE, ...(context ? { context: String(context).slice(0, 100) } : {}) });
      Promise.resolve(send(body)).catch(() => {});
      return true;
    } catch { return false; }
  }
  function install(target = globalThis) {
    target.addEventListener('error', event => { if (event.error || event.message) report(event.error || event.message, { kind: 'error' }); });
    target.addEventListener('unhandledrejection', event => report(event.reason, { kind: 'unhandledrejection' }));
  }
  return { report, install };
}

const reporter = createErrorReporter();
export const reportProblem = reporter.report;
export const installErrorReporting = reporter.install;
