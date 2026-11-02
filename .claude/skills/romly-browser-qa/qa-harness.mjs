// Minimal headless Chrome driver over the DevTools protocol for Romly's browser QA.
// No Puppeteer: Node 22's built-in fetch and WebSocket are enough. Each run gets a fresh,
// temporary Chrome profile, so IndexedDB starts empty and the studio behaves like a first visit.
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function openBrowser({base, width = 1366, height = 900, mobile = false, out = join(tmpdir(), 'romly-qa')} = {}) {
  if (!base) throw Error('openBrowser needs a base URL, for example http://127.0.0.1:5174');
  base = base.replace(/\/$/, '');
  await mkdir(out, {recursive: true});
  const profile = await mkdtemp(join(tmpdir(), 'romly-qa-profile-'));
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
  const errors = [], apiRequests = [], results = [], pending = new Map();
  let ws, id = 0;

  const close = async () => {
    try { ws?.close(); } catch {}
    chrome.kill();
    await pause(500);
    await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 300}).catch(() => {});
  };

  try {
    // Chrome writes the port it picked into DevToolsActivePort, so parallel runs never collide.
    let port;
    for (let i = 0; i < 80 && !port; i++) {
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim(); } catch { await pause(250); }
    }
    if (!port) throw Error('Chrome did not start. Set CHROME_PATH if it is not at ' + CHROME);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true}); });
  } catch (error) { await close(); throw error; }

  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(Error(JSON.stringify(m.error))); else p.resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent' && new URL(m.params.request.url).pathname.startsWith('/api/')) apiRequests.push(m.params.request.method + ' ' + m.params.request.url);
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, {resolve, reject});
    ws.send(JSON.stringify({id: n, method, params}));
    setTimeout(() => { if (pending.has(n)) { pending.delete(n); reject(Error('CDP timeout: ' + method)); } }, 30000);
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const until = async (expression, label, ms = 20000) => {
    for (let t = 0; t < ms; t += 200) { try { if (await evaluate(expression)) return true; } catch {} await pause(200); }
    throw Error('timeout waiting for ' + label);
  };
  const go = async path => { await send('Page.navigate', {url: base + path}); await pause(300); };
  const shot = async name => {
    const file = join(out, name + '.png');
    await writeFile(file, Buffer.from((await send('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
    return file;
  };
  const setFiles = async (selector, files) => {
    const node = await send('Runtime.evaluate', {expression: `document.querySelector(${JSON.stringify(selector)})`});
    await send('DOM.setFileInputFiles', {files, objectId: node.result.objectId});
  };
  const check = (name, ok, detail = '') => {
    results.push({name, ok: !!ok, detail});
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  };
  // Records the page-error check, writes results.json, closes Chrome and returns true when all passed.
  const finish = async () => {
    check('no uncaught page errors', !errors.length, errors.slice(0, 5).join(' | '));
    await writeFile(join(out, 'results.json'), JSON.stringify({base, results, errors, apiRequests}, null, 2));
    await close();
    console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed. Screenshots and results.json: ${out}`);
    return results.every(r => r.ok);
  };

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile});
  return {base, out, send, evaluate, until, go, shot, setFiles, check, finish, errors, apiRequests, results};
}
