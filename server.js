'use strict';
/*
 * Bluebook-style SAT runner — zero-dependency Node server.
 *
 *  Student side
 *  - GET  /<id>                 personal test page (e.g. /2222) for a student registered by the operator
 *  - GET  /api/student/<id>     { id, name }
 *  - POST /api/start            { code, studentId }  -> Telegram: name + start code; returns token + questions (answers stripped)
 *  - POST /api/finish           { token, studentId, answers } -> graded on the server, stored in db.json; Telegram: name + code
 *
 *  Operator side (login required)
 *  - GET  /operator             operator panel
 *  - POST /api/op/login | /api/op/logout, GET /api/op/me
 *  - GET/POST /api/op/students, PUT/DELETE /api/op/students/<id>
 *
 *  Database: data/db.json (see lib/db.js). The Telegram token, operator passwords and
 *  the answer key never reach the browser.
 *
 *  Set / change an operator password:  node server.js set-operator <login> <password>
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JsonDB } = require('./lib/db');

loadEnv(path.join(__dirname, '.env'));

const db = new JsonDB(path.join(__dirname, 'data', 'db.json'));

if (process.argv[2] === 'set-operator') {
  const [login, password] = process.argv.slice(3);
  if (!login || !password || password.length < 6) {
    console.error('Usage: node server.js set-operator <login> <password>   (password: 6+ characters)');
    process.exit(1);
  }
  db.setOperator(login, password);
  console.log(`Operator "${login}" saved to data/db.json.`);
  process.exit(0);
}

if (db.data.operators.length === 0) {
  const login = process.env.OPERATOR_LOGIN || 'admin';
  const password = process.env.OPERATOR_PASSWORD || crypto.randomBytes(6).toString('base64url');
  db.setOperator(login, password);
  console.log('\n==============================================');
  console.log(' Operator account created');
  console.log(`   login:    ${login}`);
  console.log(`   password: ${process.env.OPERATOR_PASSWORD ? '(from OPERATOR_PASSWORD in .env)' : password}`);
  console.log(' Change it with: node server.js set-operator <login> <password>');
  console.log('==============================================\n');
}

const PORT = Number(process.env.PORT) || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8873915390:AAGKrNcWCS-ewS4TLThMFCVddPIsE38OLZ4';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1004368993240';
const SKIP_TELEGRAM = process.env.SKIP_TELEGRAM === '0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const QUESTIONS_FILE = path.join(__dirname, 'data', 'questions.js');

const MODULES = [
  { key: 'english', part: 'module1', label: 'Reading and Writing — Module 1' },
  { key: 'english', part: 'module2', label: 'Reading and Writing — Module 2' },
  { key: 'math', part: 'module1', label: 'Math — Module 1' },
  { key: 'math', part: 'module2', label: 'Math — Module 2' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** test token -> { code, studentId, name, startedAt, finished } */
const sessions = new Map();

/** operator session id (cookie) -> { login, expires } */
const opSessions = new Map();
const OP_SESSION_MS = 12 * 60 * 60 * 1000;
const OP_COOKIE = 'bb_op';

/** ip -> { count, until } — throttles password guessing */
const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;

const STUDENT_PATH = /^\/(\d{3,8})\/?$/;

/* ------------------------------------------------------------------ */

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

/** Re-read on every call so edits to data/questions.js apply without a restart. */
function loadQuestions() {
  delete require.cache[require.resolve(QUESTIONS_FILE)];
  return require(QUESTIONS_FILE);
}

function publicQuestions(all) {
  const strip = (list = []) =>
    list.map(({ answer, explanation, ...q }) => q); // eslint-disable-line no-unused-vars
  return {
    english: { module1: strip(all.english?.module1), module2: strip(all.english?.module2) },
    math: { module1: strip(all.math?.module1), module2: strip(all.math?.module2) },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

async function sendTelegram(text) {
  if (SKIP_TELEGRAM) {
    console.log('[telegram skipped]\n' + text);
    return;
  }
  if (!BOT_TOKEN || !CHAT_ID) throw new Error('Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).');
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(`Telegram error: ${data.description || res.status}`);
}

function stamp() {
  return new Date().toLocaleString('en-GB', { hour12: false });
}

/* ---------------------------- grading ------------------------------ */

/** Parse "3.5", "-7/2", ".6667" into a number; NaN if invalid. */
function toNumber(s) {
  s = String(s).trim();
  if (/^-?\d*\.?\d+\/-?\d*\.?\d+$/.test(s)) {
    const [a, b] = s.split('/').map(Number);
    return b === 0 ? NaN : a / b;
  }
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}

function isCorrect(q, given) {
  if (given == null || given === '') return false;
  if (q.type === 'spr') {
    const accepted = Array.isArray(q.answer) ? q.answer : [q.answer];
    const g = String(given).trim();
    return accepted.some((a) => {
      if (String(a).trim() === g) return true;
      const x = toNumber(a), y = toNumber(g);
      return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
    });
  }
  return String(given).toUpperCase() === String(q.answer).toUpperCase();
}

function grade(all, answers) {
  return MODULES.map((m, mi) => {
    const list = all[m.key]?.[m.part] || [];
    const given = (answers && answers[mi]) || {};
    const rows = list.map((q, qi) => {
      const g = given[qi];
      return { n: qi + 1, ok: isCorrect(q, g) };
    });
    return { ...m, total: list.length, correct: rows.filter((r) => r.ok).length, rows };
  });
}

/** Telegram message: only who and which code — answers and scores stay on the operator page. */
function statusMessage(title, { name, code }) {
  return [
    title,
    `Student: <b>${escapeHtml(name || '—')}</b>`,
    `Start code: <code>${escapeHtml(code || '—')}</code>`,
    `Time: ${stamp()}`,
  ].join('\n');
}

function summarize(graded) {
  const part = (a) => ({ correct: a.reduce((s, m) => s + m.correct, 0), total: a.reduce((s, m) => s + m.total, 0) });
  return {
    rw: part(graded.slice(0, 2)),
    math: part(graded.slice(2)),
    modules: graded.map((m) => ({ label: m.label, correct: m.correct, total: m.total })),
  };
}

/* ------------------------ operator auth ---------------------------- */

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function operatorOf(req) {
  const sid = parseCookies(req)[OP_COOKIE];
  const s = sid && opSessions.get(sid);
  if (!s) return null;
  if (s.expires < Date.now()) { opSessions.delete(sid); return null; }
  return s;
}

function cookieHeader(value, maxAgeSec, req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  return `${OP_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);

function publicStudent(s) {
  const last = s.results && s.results.length ? s.results[s.results.length - 1] : null;
  return { id: s.id, name: s.name, createdAt: s.createdAt, lastStart: s.lastStart, lastResult: last, attempts: (s.results || []).length };
}

/* ----------------------------- http -------------------------------- */

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new Error('Payload too large')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  /* ---------------- student-facing ---------------- */
  const studentMatch = pathname.match(/^\/api\/student\/(\d{3,8})$/);
  if (studentMatch) {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    const s = db.getStudent(studentMatch[1]);
    return s ? send(res, 200, { id: s.id, name: s.name }) : send(res, 404, { error: 'This test link is not valid.' });
  }

  if (pathname.startsWith('/api/op/')) return handleOperator(req, res, pathname);

  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }

  if (pathname === '/api/start') {
    const code = String(body.code || '');
    if (!/^\d{6}$/.test(code)) return send(res, 400, { error: 'The start code must be 6 digits.' });

    let student = null;
    if (body.studentId) {
      student = db.getStudent(body.studentId);
      if (!student) return send(res, 404, { error: 'This test link is not valid. Ask your proctor for your link.' });
    }
    const name = student ? student.name : cleanName(body.name);

    let questions;
    try { questions = publicQuestions(loadQuestions()); }
    catch (e) { console.error(e); return send(res, 500, { error: 'Questions could not be loaded.' }); }
    try {
      await sendTelegram(statusMessage('🟢 <b>Test started</b>', { name, code }));
    } catch (e) {
      console.error(e.message);
      return send(res, 502, { error: 'Unable to verify start code. Please try again.' });
    }
    const token = crypto.randomBytes(18).toString('hex');
    sessions.set(token, { code, studentId: student ? student.id : null, name, startedAt: Date.now() });
    if (student) db.updateStudent(student.id, { lastStart: { code, at: new Date().toISOString() } });
    return send(res, 200, { token, name, questions });
  }

  if (pathname === '/api/finish') {
    const s = sessions.get(String(body.token || ''));
    if (s && s.finished) return send(res, 200, { ok: true });
    const studentId = s ? s.studentId : (body.studentId ? String(body.studentId) : null);
    const student = studentId ? db.getStudent(studentId) : null;
    const code = s ? s.code : String(body.code || '').replace(/\D/g, '').slice(0, 6);
    const name = student ? student.name : (s ? s.name : cleanName(body.name));
    try {
      const result = { code, finishedAt: new Date().toISOString(), ...summarize(grade(loadQuestions(), body.answers)) };
      // Store before notifying so a Telegram outage never loses a score; retries don't duplicate it.
      result.startedAt = s ? s.startedAt : null;
      const already = (student && student.results || []).some((r) => r.code === code && (!s || r.startedAt === s.startedAt));
      if (student && !already) {
        db.updateStudent(student.id, { results: [...(student.results || []), result].slice(-20) });
      }
      await sendTelegram(statusMessage('🏁 <b>Test finished</b>', { name, code }));
      if (s) s.finished = true;
      return send(res, 200, { ok: true });
    } catch (e) {
      console.error(e.message);
      return send(res, 502, { error: 'Could not submit results.' });
    }
  }

  return send(res, 404, { error: 'Not found' });
}

async function handleOperator(req, res, pathname) {
  // Same-origin JSON only (plus SameSite=Strict cookie) — blocks cross-site form posts.
  if (req.method !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { error: 'JSON required' });
  }

  if (pathname === '/api/op/login' && req.method === 'POST') {
    const ip = clientIp(req);
    const a = loginAttempts.get(ip);
    if (a && a.count >= MAX_ATTEMPTS && a.until > Date.now()) {
      return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    }
    let body;
    try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
    if (!db.verifyOperator(String(body.login || ''), String(body.password || ''))) {
      const cur = a && a.until > Date.now() ? a : { count: 0 };
      loginAttempts.set(ip, { count: cur.count + 1, until: Date.now() + LOCK_MS });
      return send(res, 401, { error: 'Incorrect login or password.' });
    }
    loginAttempts.delete(ip);
    const sid = crypto.randomBytes(32).toString('hex');
    opSessions.set(sid, { login: String(body.login), expires: Date.now() + OP_SESSION_MS });
    return send(res, 200, { login: String(body.login) }, { 'Set-Cookie': cookieHeader(sid, OP_SESSION_MS / 1000, req) });
  }

  if (pathname === '/api/op/logout' && req.method === 'POST') {
    const sid = parseCookies(req)[OP_COOKIE];
    if (sid) opSessions.delete(sid);
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0, req) });
  }

  const op = operatorOf(req);
  if (!op) return send(res, 401, { error: 'Not signed in.' });

  if (pathname === '/api/op/me' && req.method === 'GET') return send(res, 200, { login: op.login });

  if (pathname === '/api/op/students') {
    if (req.method === 'GET') return send(res, 200, { students: db.listStudents().map(publicStudent) });
    if (req.method === 'POST') {
      let body;
      try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
      const name = cleanName(body.name);
      const id = String(body.id || '').trim();
      if (!name) return send(res, 400, { error: 'Enter the student’s full name.' });
      if (id && !/^\d{3,8}$/.test(id)) return send(res, 400, { error: 'The page number must be 3–8 digits.' });
      if (id && db.getStudent(id)) return send(res, 409, { error: `Page ${id} is already used by ${db.getStudent(id).name}.` });
      return send(res, 201, { student: publicStudent(db.addStudent({ id: id || undefined, name })) });
    }
  }

  const one = pathname.match(/^\/api\/op\/students\/(\d{3,8})$/);
  if (one) {
    const s = db.getStudent(one[1]);
    if (!s) return send(res, 404, { error: 'Student not found.' });
    if (req.method === 'PUT') {
      let body;
      try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
      const name = cleanName(body.name);
      if (!name) return send(res, 400, { error: 'Enter the student’s full name.' });
      return send(res, 200, { student: publicStudent(db.updateStudent(s.id, { name })) });
    }
    if (req.method === 'DELETE') {
      db.deleteStudent(s.id);
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Not found' });
}

function serveFile(req, res, file, status = 200) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
  let file = path.normalize(path.join(PUBLIC_DIR, decoded));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  serveFile(req, res, file);
}

/** Per-student manifest so an app installed from /2222 opens /2222. */
function serveManifest(req, res, url) {
  const base = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8'));
  const sid = url.searchParams.get('s');
  const student = sid && /^\d{3,8}$/.test(sid) ? db.getStudent(sid) : null;
  if (student) Object.assign(base, { id: `/${student.id}`, start_url: `/${student.id}` });
  send(res, 200, JSON.stringify(base), { 'Content-Type': MIME['.webmanifest'], 'Cache-Control': 'no-cache' });
}

function notFoundPage(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bluebook</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font:500 16px Roboto,Arial,sans-serif;text-align:center}h1{font-size:26px;margin:0 0 10px}</style></head>
<body><div><h1>This test link is not valid</h1><p>Ask your proctor for your personal test link.</p></div>
<script>try{var m=location.pathname.match(/^\\/(\\d{3,8})\\/?$/);if(m&&localStorage.getItem('bb.student')===m[1])localStorage.removeItem('bb.student')}catch(e){}</script></body></html>`);
}

http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, 'Bad request'); }
  const { pathname } = url;

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch((e) => { console.error(e); send(res, 500, { error: 'Server error' }); });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  if (pathname === '/operator' || pathname === '/operator/') {
    return serveFile(req, res, path.join(PUBLIC_DIR, 'operator.html'));
  }
  if (pathname === '/manifest.webmanifest') return serveManifest(req, res, url);

  const m = pathname.match(STUDENT_PATH);
  if (m) {
    if (!db.getStudent(m[1])) return notFoundPage(res);
    return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'));
  }
  serveStatic(req, res, pathname);
}).listen(PORT, () => {
  console.log(`SAT runner on http://localhost:${PORT}   ·   operator panel: http://localhost:${PORT}/operator`);
  if (SKIP_TELEGRAM) console.log('SKIP_TELEGRAM=1 — messages are printed here instead of sent.');
  else if (!BOT_TOKEN || !CHAT_ID) console.warn('WARNING: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set in .env');
});

// Drop expired operator sessions and finished test tokens once an hour.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of opSessions) if (v.expires < now) opSessions.delete(k);
  for (const [k, v] of sessions) if (now - v.startedAt > 24 * 3600 * 1000) sessions.delete(k);
  for (const [k, v] of loginAttempts) if (v.until < now) loginAttempts.delete(k);
}, 3600 * 1000).unref();
