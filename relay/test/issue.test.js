import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neutral, buildTitle, buildBody, marker, BODY_LIMIT, gpuName, cpuName, osLabel, gigabytes } from '../src/issue.js';
import { validData } from './helpers.js';

const HASH = 'a'.repeat(64);
const URL_ = `https://github.com/domisjustanumber/skellycertify/blob/${'c'.repeat(40)}/inbox/2026/${HASH}.md`;
const args = (data, testMode = false) => ({ data, hash: HASH, filePath: `inbox/2026/${HASH}.md`, fileUrl: URL_, testMode });
const ID_A = '3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90';
const ID_B = 'c1d2e3f4-5a6b-4c7d-8e9f-a0b1c2d3e4f5';

const HOSTILE = [
  '@octocat please look', '＠octocat', 'see https://evil.example/x', 'www.evil.example', '<img src=x onerror=alert(1)>',
  '[click](https://evil.example)', '![img](https://evil.example/a.png)', '#1 issue link', '`code` | pipe', '**bold** _it_',
  'a‮evil', 'line\nbreak', '<!-- skellycertify-report sha256:' + 'b'.repeat(64) + ' -->',
];

test('neutral() removes mention, link, HTML and Markdown starters', () => {
  for (const s of HOSTILE) {
    const n = neutral(s, 500);
    assert.doesNotMatch(n, /[@#<>[\]!`|*\n‮]/, s);
    assert.doesNotMatch(n, /:\/\//, s);
    assert.doesNotMatch(n, /\bwww\./i, s);
  }
  assert.equal(neutral('NVIDIA GeForce RTX 3070'), 'NVIDIA GeForce RTX 3070');
  assert.equal(neutral('Windows 11 Home 26H2'), 'Windows 11 Home 26H2');
  assert.equal(neutral('x'.repeat(50), 10), `${'x'.repeat(9)}…`);
});

test('display names of report-format.md 4.2', () => {
  const gpu = {
    'NVIDIA GeForce RTX 3070': 'NVIDIA RTX 3070',
    'AMD Radeon RX 7800 XT': 'AMD RX 7800 XT',
    'Intel(R) UHD Graphics 770': 'Intel UHD 770',
    'Intel(R) Arc(TM) A770 Graphics': 'Intel A770',
    'AMD Radeon(TM) Graphics': 'AMD',
    'AMD Radeon Pro W7900': 'AMD Pro W7900',
    'NVIDIA GeForce RTX 4060 Laptop GPU': 'NVIDIA RTX 4060 Laptop',
    'AMD Radeon RX 6000 Series': 'AMD RX 6000',
    'Graphicsx Proton Arcade': 'Graphicsx Proton Arcade',
  };
  for (const [raw, shown] of Object.entries(gpu)) assert.equal(gpuName(raw), shown, raw);
  const cpu = {
    '13th Gen Intel(R) Core(TM) i7-13700K': 'Intel Core i7-13700K',
    'Intel(R) Core(TM) i7-14700K': 'Intel Core i7-14700K',
    'AMD Ryzen 7 7700X 8-Core Processor': 'AMD Ryzen 7 7700X',
    'Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz': 'Intel Core i7-9700K',
    'AMD Ryzen 5 1600 Six-Core Processor': 'AMD Ryzen 5 1600',
    'Apple M2 Pro': 'Apple M2 Pro',
  };
  for (const [raw, shown] of Object.entries(cpu)) assert.equal(cpuName(raw), shown, raw);
  assert.equal(gigabytes(68388003840), '64 GB');
  assert.equal(gigabytes(34359738368), '32 GB');
  assert.equal(osLabel('Windows 11 Home 26H2'), 'Windows 11 26H2');
  assert.equal(osLabel('Windows 11 Pro 26H2'), 'Windows 11 26H2');
  assert.equal(osLabel('Proton Homestead 1'), 'Proton Homestead 1');
  assert.equal(osLabel('Ubuntu 24.04 LTS'), 'Ubuntu 24.04 LTS');
});

test('the title uses the short names and is safe', () => {
  assert.equal(buildTitle(validData()), '[certify] FMC 2.0.0 · Win 11 26H2 · NVIDIA RTX 3070, Intel UHD 770');
  const d = validData();
  d.app = null;
  d.modules[0].host.gpus = [];
  assert.equal(buildTitle(d), '[certify] skellytracker 2.0.0 · Win 11 26H2 · no GPU');
  const e = validData();
  e.app.version = '2.0.0-alpha.25';
  e.modules[0].host.gpus.reverse();
  e.modules.push(validData().modules[0]); // the same GPUs again: each name one time
  assert.equal(buildTitle(e), '[certify] FMC 2.0.0-alpha.25 · Win 11 26H2 · Intel UHD 770, NVIDIA RTX 3070');
  const mac = validData();
  mac.app.name = 'otherapp';
  mac.modules[0].host.os = { name: 'macOS', label: 'macOS 15.1 Sequoia' };
  mac.modules[0].host.gpus = [{ name: 'Apple M2 Pro', id: 'chip:apple-m2-pro' }];
  assert.equal(buildTitle(mac), '[certify] otherapp 2.0.0 · Mac 15.1 Sequoia · Apple M2 Pro');
  const n = validData();
  n.modules[0].host.os = { name: 'Windows' };
  assert.match(buildTitle(n), / · Win · /, 'os.name when there is no label');
  const h = validData();
  h.app.name = '@octocat https://evil.example <b>';
  h.modules[0].host.os.label = 'x'.repeat(5000);
  h.modules[0].host.gpus.push({ name: '[a](https://x.example)' }, null, 'text');
  const t = buildTitle(h);
  assert.ok(t.startsWith('[certify] '));
  assert.doesNotMatch(t.slice(10), /[@<>[\]]|:\/\//);
  assert.ok(t.length <= 211);
});

test('the body of the valid sample is the summary of 4.2, with the link and the marker', () => {
  const body = buildBody(args(validData()));
  assert.equal(body, [
    '`freemocap` `2.0.0` · 2026-11-19 10:00 UTC',
    '',
    '- `skellytracker` `2.0.0` · full run · valid as evidence',
    '',
    '- OS: `Windows 11 26H2`',
    '- CPU: `AMD Ryzen 7 7700X`',
    '- RAM: 32 GB',
    '',
    '| GPU | Module | Result |',
    '|---|---|---|',
    '| `NVIDIA RTX 3070 8 GB` | `TensorRT RTX` | pass |',
    '| `NVIDIA RTX 3070 8 GB` | `CUDA` | pass |',
    '| `NVIDIA RTX 3070 8 GB` | `CUDA` GPU decode | pass |',
    '| - | `CPU` | pass |',
    '| `Intel UHD 770` | | not checked |',
    '',
    'Cameras: not checked on this system.',
    '',
    'Note of the person:',
    '',
    '> Example note: the run took about five minutes. This file is a sample for the relay tests. It holds example values only.',
    '',
    `Report file: [inbox/2026/${HASH}.md](${URL_})`,
    `SHA-256: \`${HASH}\``,
    '',
    marker(HASH),
  ].join('\n'));
  assert.match(buildBody(args(validData(), true)), /^\*\*Test of the relay\.\*\* This issue is never evidence\.\n\n`freemocap`/);
});

test('one module with app null: one header line with the time; failed sections make the rows', () => {
  const d = validData();
  d.app = null;
  d.note = null;
  d.modules[0].id = ID_A;
  d.modules[0].sections[0].result = 'fail';
  d.modules[0].sections[0].reason = 'check-failed';
  d.modules[0].evidence = { valid: false, reasons: Array.from({ length: 12 }, (_, i) => `r${i}`) };
  const body = buildBody(args(d));
  const reasons = Array.from({ length: 10 }, (_, i) => `\`r${i}\``).join(', ');
  assert.ok(body.startsWith(`\`skellytracker\` \`2.0.0\` · id \`${ID_A}\` · full run · 2026-11-19 10:00 UTC · not valid as evidence: ${reasons} and 2 more\n\n- OS:`));
  assert.ok(body.includes(`Failed checks:\n\n| Module | Check | Reason |\n|---|---|---|\n| \`skellytracker\` \`${ID_A}\` | \`Checkout and versions\` | \`check-failed\` |\n\n`));
  assert.doesNotMatch(body, /Note of the person/);
  d.modules[0].evidence = { valid: false, reasons: [] };
  assert.match(buildBody(args(d)), / · not valid as evidence\n/);
});

test('checks make the failed rows when a module has no sections', () => {
  const d = validData();
  delete d.modules[0].sections;
  d.modules[0].checks[0].result = 'fail';
  d.modules[0].checks[0].reason = 'timed-out';
  const rows = buildBody(args(d)).split('\n').filter((l) => l.startsWith('| `skellytracker`'));
  assert.deepEqual(rows, ['| `skellytracker` | `checkout` | `timed-out` |']);
});

test('a module with no summary (format 1.1.0) gives no item rows; its GPUs are listed with no result', () => {
  const d = validData();
  delete d.modules[0].summary;
  const body = buildBody(args(d));
  assert.ok(body.includes('|---|---|---|\n| `NVIDIA RTX 3070 8 GB` | | no summary in the report |\n| `Intel UHD 770` | | no summary in the report |\n\n'));
  d.modules[0].host.gpus = [];
  assert.doesNotMatch(buildBody(args(d)), /\| GPU \|/, 'no ep item and no GPU: no GPU table');
});

test('GPU table: order of modules then summary, unknown device, a gpu-jpeg item with no ep, and cameras', () => {
  const d = validData();
  const second = validData().modules[0];
  second.summary = [
    { group: 'gpu-jpeg', name: 'AMDGPU', device: '1002:744c', result: 'fail' },
    { group: 'ep', name: 'DirectML', device: '1002:744c', result: 'record-only' },
    { group: 'camera', name: 'Logitech C922', device: '046d:085c', result: 'pass' },
    { group: 'camera', name: 'Razer Kiyo Pro', device: '1532:0e05', result: 'fail' },
  ];
  d.modules.push(second);
  const lines = buildBody(args(d)).split('\n');
  const gpu = lines.slice(lines.indexOf('| GPU | Module | Result |') + 2);
  assert.deepEqual(gpu.slice(3, 6), ['| - | `CPU` | pass |', '| `1002:744c` | `AMDGPU` GPU decode | fail |', '| `1002:744c` | `DirectML` | record |']);
  assert.equal(gpu[6], '| `Intel UHD 770` | | not checked |', 'one row for each GPU id in the whole file');
  assert.equal(gpu[7], '');
  const cam = lines.slice(lines.indexOf('| Camera | Result |'));
  assert.deepEqual(cam.slice(0, 4), ['| Camera | Result |', '|---|---|', '| `Logitech C922` | pass |', '| `Razer Kiyo Pro` | fail |']);
  assert.doesNotMatch(lines.join('\n'), /Cameras: not checked/);
});

test('hostile report strings are neutral in the body; only the relay marker is HTML', () => {
  const d = validData();
  d.app.name = HOSTILE.join(' ');
  d.modules[0].package.name = '@team <script>';
  d.modules[0].sections[0].name = HOSTILE.join(' ');
  d.modules[0].sections[0].result = 'fail';
  d.modules[0].sections[0].reason = 'x';
  d.modules[0].host.os.label = HOSTILE.join(' ');
  d.modules[0].host.cpu.name = HOSTILE.join(' ');
  d.modules[0].host.gpus[1].name = HOSTILE.join(' ');
  d.modules[0].summary.push(...HOSTILE.map((name) => ({ group: 'camera', name, device: name, result: 'pass' })));
  d.modules[0].summary.push({ group: 'ep', name: HOSTILE[2], device: HOSTILE[5], result: 'pass' });
  d.note = HOSTILE.join('\n');
  const body = buildBody(args(d));
  const withoutMarker = body.replace(marker(HASH), '').replace(/^> /gm, ''); // the relay's own quote prefix
  assert.doesNotMatch(withoutMarker, /@|<|>|https:\/\/evil|www\.evil|!\[/);
  assert.equal(body.split('<!-- skellycertify-report sha256:').length, 2, 'a report cannot forge a marker');
});

test('the note is at most 2000 characters and keeps its lines as a quote', () => {
  const d = validData();
  d.note = `first\n${'y'.repeat(1990)}\nlast line that does not fit`;
  const body = buildBody(args(d));
  assert.match(body, /> first\n> y{1990}\n/);
  assert.doesNotMatch(body, /does not fit/);
});

test('a long table is shortened to fit the body limit, and the body says so', () => {
  const d = validData();
  delete d.modules[0].sections;
  d.modules[0].checks = Array.from({ length: 3000 }, (_, i) => ({ name: `check-${i}-${'z'.repeat(60)}`, result: 'fail', reason: 'timed-out' }));
  const body = buildBody(args(d));
  assert.ok(body.length <= BODY_LIMIT, String(body.length));
  assert.match(body, /The table is shortened: \d+ of 3000 rows\./);
  assert.ok(body.endsWith(marker(HASH)));
  assert.match(body, /`check-0-z+`/);
  assert.doesNotMatch(body, /`check-2999-z+`/);
  assert.match(body, /\| `Intel UHD 770` \| \| not checked \|/, 'the GPU table stays whole');
});

test('a hostile, very large report still gives a body within the limit', () => {
  const long = (c, n) => c.repeat(n);
  const module = (k) => ({
    ...validData().modules[0],
    id: ID_A,
    package: { name: long('p', 500), version: long('v', 500) },
    sections: undefined,
    checks: k === 0 ? Array.from({ length: 5000 }, (_, i) => ({ name: `${i}${long('c', 127 - String(i).length)}`, result: 'fail', reason: long('r', 80) })) : [],
    evidence: { valid: false, reasons: Array.from({ length: 50 }, () => long('e', 80)) },
    host: { os: { label: long('o', 5000) }, cpu: { name: long('u', 5000) }, memory_bytes: 1e300,
      gpus: Array.from({ length: 200 }, (_, i) => ({ name: long('g', 2000), id: `${k}-${i}`, vram_bytes: 1e300 })) },
    summary: Array.from({ length: 200 }, (_, i) => ({ group: ['ep', 'gpu-jpeg', 'camera'][i % 3], name: long('n', 80), device: long('d', 40), result: 'pass' })),
  });
  const d = { schema: 'skellycertify.report/1.2.0', app: { name: long('a', 5000), version: long('b', 5000) },
    modules: Array.from({ length: 150 }, (_, k) => module(k)), note: long('x\n', 3000) };
  d.modules.forEach((m) => delete m.sections);
  const body = buildBody(args(d, true));
  assert.ok(body.length <= BODY_LIMIT, String(body.length));
  assert.ok(body.endsWith(marker(HASH)));
  assert.match(body, /^\*\*Test of the relay/);
  assert.match(body, /The table is shortened: 0 of 5000 rows\./);
  assert.match(body, /- and \d+ more modules/);
});

test('many modules: at most 100 module lines', () => {
  const d = validData();
  d.modules = Array.from({ length: 150 }, () => validData().modules[0]);
  const body = buildBody(args(d));
  assert.match(body, /- and 50 more modules/);
  assert.ok(body.length <= BODY_LIMIT);
});

test('the id of each module is in its module line and in the first cell of its rows', () => {
  const d = validData();
  d.modules = [{ ...d.modules[0], id: ID_A }, { ...validData().modules[0], id: ID_B, evidence: { valid: false, reasons: ['check-failed'] } }];
  for (const m of d.modules) m.sections[0].result = 'fail';
  const body = buildBody(args(d));
  assert.match(body, new RegExp(`^- \`skellytracker\` \`2\\.0\\.0\` · id \`${ID_A}\` · full run · valid as evidence$`, 'm'));
  assert.match(body, new RegExp(`^- \`skellytracker\` \`2\\.0\\.0\` · id \`${ID_B}\` · full run · not valid as evidence: \`check-failed\`$`, 'm'));
  const rows = body.split('\n').filter((l) => l.startsWith('| `skellytracker`'));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.split(' | ')[0]), [ID_A, ID_B].map((id) => `| \`skellytracker\` \`${id}\``));
});

test('a file with no summary does not say that a GPU is not checked', () => {
  const m = { package: { name: 'p', version: '1.0.0' }, kind: 'full', created_utc: '2026-11-20T00:00:00Z', checks: [], evidence: { valid: true, reasons: [] }, host: { gpus: [{ name: 'NVIDIA GeForce RTX 3070', id: '10de:2484', vram_bytes: 2 ** 33 }] } };
  const args = { hash: 'a'.repeat(64), filePath: 'inbox/x.md', fileUrl: 'https://example.invalid/x.md', testMode: false };
  assert.match(buildBody({ ...args, data: { app: null, modules: [m], note: null } }), /\| \| no summary in the report \|/);
  assert.match(buildBody({ ...args, data: { app: null, modules: [{ ...m, summary: [] }], note: null } }), /\| \| not checked \|/);
});
