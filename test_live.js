const http = require('http');

const BASE = 'http://localhost:5000';

const TESTS = [
  // [label, method, path, body, expectedStatus]
  ['GET /api/health',                               'GET',  '/api/health',                        null,                200],
  ['GET /api/issues/nearby (DB down → 503)',         'GET',  '/api/issues/nearby?lat=12.97&lng=77.59', null,           503],
  ['GET /api/issues/mine (DB down → 503)',           'GET',  '/api/issues/mine',                   null,                503],
  ['POST /api/issues (empty → 400)',                'POST', '/api/issues',                        '{}',                400],
  ['GET /api/notifications (no auth → 401)',        'GET',  '/api/notifications',                 null,                401],
  ['GET /api/officer/issues (no auth → 401)',       'GET',  '/api/officer/issues',                null,                401],
  ['GET /api/officer/work-orders (no auth → 401)',  'GET',  '/api/officer/work-orders',           null,                401],
  ['GET /api/officer/repairs (no auth → 401)',      'GET',  '/api/officer/repairs',               null,                401],
  ['GET /api/officer/contractors (no auth → 401)',  'GET',  '/api/officer/contractors',           null,                401],
  ['GET /api/officer/stats (no auth → 401)',        'GET',  '/api/officer/stats',                 null,                401],
  ['GET /api/officer/copilot/history (→ 401)',      'GET',  '/api/officer/copilot/history',       null,                401],
  ['GET /api/officer/duplicates (→ 401)',           'GET',  '/api/officer/duplicates',            null,                401],
  ['GET /api/officer/ai/findings (→ 401)',          'GET',  '/api/officer/ai/findings',           null,                401],
  ['GET /api/officer/issues/prioritized (→ 401)',   'GET',  '/api/officer/issues/prioritized',    null,                401],
  ['GET /api/nonexistent (expect 404)',             'GET',  '/api/nonexistent',                   null,                404],
  ['POST /api/auth/register (no body → 400)',       'POST', '/api/auth/register',                 '{}',                400],
  ['POST /api/officer/auth/login (no body → 400)',  'POST', '/api/officer/auth/login',            '{}',                400],
];

function request(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 6000,
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 120) }));
    });

    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', body: '' }); });
    req.on('error', (e) => resolve({ status: 'CONN_ERR', body: e.message.slice(0, 60) }));

    if (body) req.write(body);
    req.end();
  });
}

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m', BOLD = '\x1b[1m';

async function run() {
  console.log(`\n${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}${BOLD}   CivicSense AI — Full Live API Test Report${RESET}`);
  console.log(`${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}\n`);

  let pass = 0, fail = 0;
  const rows = [];

  for (const [label, method, path, body, expected] of TESTS) {
    const { status, body: rb } = await request(method, path, body);
    const ok = status === expected;
    if (ok) pass++; else fail++;
    const tag = ok ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
    const got = typeof status === 'number' ? status : `${YELLOW}${status}${RESET}`;
    rows.push({ label, expected, got: status, ok, body: rb });
    console.log(`  ${tag}  ${label.padEnd(50)} expected:${expected}  got:${got}`);
  }

  console.log(`\n${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}`);
  const total = TESTS.length;
  const color = fail === 0 ? GREEN : RED;
  console.log(`${color}${BOLD}  TOTAL: ${total}  |  PASS: ${pass}  |  FAIL: ${fail}${RESET}`);

  if (fail === 0) {
    console.log(`\n${GREEN}${BOLD}  ✓ ALL ENDPOINTS WIRED AND RESPONDING CORRECTLY${RESET}`);
  } else {
    console.log(`\n${RED}${BOLD}  ✗ Failed endpoints:${RESET}`);
    rows.filter(r => !r.ok).forEach(r => {
      console.log(`    - ${r.label}`);
      console.log(`      expected:${r.expected}  got:${r.got}`);
      if (r.body) console.log(`      response: ${r.body}`);
    });
  }
  console.log(`\n${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}\n`);
}

run().catch(console.error);
