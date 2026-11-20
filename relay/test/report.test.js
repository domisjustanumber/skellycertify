import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReport, splitReport } from '../src/report.js';
import { sample, validData, reportFile, NOW } from './helpers.js';

const parse = (text, now = NOW) => parseReport(text, now);
const refused = (text, code, detail) =>
  assert.throws(() => parse(text), (e) => e.code === code && (detail === undefined || e.detail === detail));

test('the valid sample parses', () => {
  const { markdown, data } = parse(sample('valid.md'));
  assert.equal(data.modules[0].package.name, 'skellytracker');
  assert.equal(markdown[0], '# Certify report');
});

test('the format sample is refused for its schema', () => {
  refused(sample('refused-format.md'), 'wrong-schema', 'report.schema');
});

test('the reader takes the last json block, and a longer fence is allowed', () => {
  const text = '# Certify report\n\n```json\n{"x": 1}\n```\n\n````json\n' + JSON.stringify(validData()) + '\n````\n';
  assert.equal(JSON.parse(splitReport(text).json).schema, 'skellycertify.report/1.4.0');
});

test('the file must end with the block and one newline', () => {
  const good = reportFile(validData());
  refused(good.slice(0, -1), 'no-json-block');
  refused(`${good}\n`, 'no-json-block');
  refused(`${good}trailing text\n`, 'no-json-block');
  refused('# Certify report\n', 'no-json-block');
  refused(good.replace('```json', '```JSON'), 'no-json-block');
});

test('a fence inside the block that would close it early is refused', () => {
  const text = '# r\n\n```json\n{\n```\n}\n```\n';
  refused(text, 'no-json-block');
});

test('parseReport refuses each CR; the handler turns CRLF into LF before it', () => {
  refused(reportFile(validData()).replace('# Certify report', '# Certify\rreport'), 'lone-cr');
  refused(reportFile(validData()).replace(/\n/g, '\r\n'), 'lone-cr');
});

test('bad JSON and a JSON value that is not an object are refused', () => {
  refused('# r\n\n```json\n{not json}\n```\n', 'bad-json');
  refused('# r\n\n```json\n[1, 2]\n```\n', 'bad-json');
});

test('schema: major version 1 only', () => {
  for (const s of ['skellycertify.report/2.0.0', 'skellycertify.report/1.0', 'other/1.0.0', 'skellycertify.report/01.0.0']) {
    const d = validData();
    d.schema = s;
    refused(reportFile(d), 'wrong-schema', 'report.schema');
  }
  const d = validData();
  d.schema = 'skellycertify.report/1.7.3';
  d.modules[0].schema = 'skellycertify.report/1.2.0';
  assert.ok(parse(reportFile(d)));
});

test('each required field of section 4.1 is checked', () => {
  for (const key of ['schema', 'app', 'modules', 'note']) {
    const d = validData();
    delete d[key];
    refused(reportFile(d), 'missing-field', `report.${key}`);
  }
  const d = validData();
  d.modules = [];
  refused(reportFile(d), 'bad-value', 'report.modules');
  const n = validData();
  n.app = null;
  assert.ok(parse(reportFile(n)), 'app null is a report of one package');
  const a = validData();
  delete a.app.version;
  refused(reportFile(a), 'missing-field', 'report.app.version');
});

test('each required field of section 3 is checked', () => {
  const cases = [
    [(m) => delete m.schema, 'missing-field', 'report.modules[0].schema'],
    [(m) => delete m.package, 'missing-field', 'report.modules[0].package'],
    [(m) => delete m.package.name, 'missing-field', 'report.modules[0].package.name'],
    [(m) => delete m.kind, 'missing-field', 'report.modules[0].kind'],
    [(m) => { m.kind = 'slow'; }, 'bad-value', 'report.modules[0].kind'],
    [(m) => delete m.created_utc, 'missing-field', 'report.modules[0].created_utc'],
    [(m) => { m.created_utc = '2026-11-19 10:00'; }, 'bad-value', 'report.modules[0].created_utc'],
    [(m) => delete m.host, 'missing-field', 'report.modules[0].host'],
    [(m) => delete m.checks, 'missing-field', 'report.modules[0].checks'],
    [(m) => delete m.evidence, 'missing-field', 'report.modules[0].evidence'],
    [(m) => delete m.evidence.valid, 'missing-field', 'report.modules[0].evidence.valid'],
    [(m) => { m.evidence.reasons = 'none'; }, 'bad-value', 'report.modules[0].evidence.reasons'],
    [(m) => delete m.checks[0].name, 'missing-field', 'report.modules[0].checks[0].name'],
    [(m) => { m.checks[0].name = 'bad name'; }, 'bad-value', 'report.modules[0].checks[0].name'],
    [(m) => delete m.checks[0].section, 'missing-field', 'report.modules[0].checks[0].section'],
    [(m) => { m.checks[0].result = 'ok'; }, 'bad-value', 'report.modules[0].checks[0].result'],
    [(m) => delete m.checks[0].reason, 'missing-field', 'report.modules[0].checks[0].reason'],
    [(m) => { m.checks[6].reason = null; }, 'bad-value', 'report.modules[0].checks[6].reason'],
    [(m) => delete m.sections[0].result, 'missing-field', 'report.modules[0].sections[0].result'],
    [(m) => { m.cleanup = [{ name: 'x', result: 'fail', reason: null }]; }, 'bad-value', 'report.modules[0].cleanup[0].reason'],
  ];
  for (const [change, code, detail] of cases) {
    const d = validData();
    change(d.modules[0]);
    refused(reportFile(d), code, detail);
  }
});

test('a check needs no section when the module has no sections', () => {
  const d = validData();
  delete d.modules[0].sections;
  d.modules[0].checks.forEach((c) => delete c.section);
  assert.ok(parse(reportFile(d)));
});

test('summary: optional; when present at most 200 items of the form of section 3.7', () => {
  const ok = [
    (m) => delete m.summary,
    (m) => { m.summary = []; },
    (m) => { m.summary = Array.from({ length: 200 }, () => ({ group: 'camera', name: 'n'.repeat(80), device: 'd'.repeat(40), result: 'record-only' })); },
    (m) => { m.summary[0].extra = 1; }, // a reader ignores a field that it does not know
  ];
  for (const change of ok) {
    const d = validData();
    change(d.modules[0]);
    assert.ok(parse(reportFile(d)));
  }
  const W = 'report.modules[0].summary';
  const bad = [
    [(m) => { m.summary = {}; }, 'bad-value', W],
    [(m) => { m.summary = null; }, 'bad-value', W],
    [(m) => { m.summary = Array.from({ length: 201 }, () => m.summary[0]); }, 'bad-value', W],
    [(m) => { m.summary[1] = 'CUDA'; }, 'bad-value', `${W}[1]`],
    [(m) => { m.summary[0].group = 'gpu'; }, 'bad-value', `${W}[0].group`],
    [(m) => delete m.summary[0].group, 'missing-field', `${W}[0].group`],
    [(m) => { m.summary[0].name = ''; }, 'bad-value', `${W}[0].name`],
    [(m) => { m.summary[0].name = 'n'.repeat(81); }, 'bad-value', `${W}[0].name`],
    [(m) => { m.summary[0].name = 7; }, 'bad-value', `${W}[0].name`],
    [(m) => { m.summary[0].device = 'd'.repeat(41); }, 'bad-value', `${W}[0].device`],
    [(m) => delete m.summary[0].device, 'missing-field', `${W}[0].device`],
    [(m) => { m.summary[0].result = 'not-run'; }, 'bad-value', `${W}[0].result`],
    [(m) => { m.summary[0].result = 'in-use'; }, 'bad-value', `${W}[0].result`],
  ];
  for (const [change, code, detail] of bad) {
    const d = validData();
    change(d.modules[0]);
    refused(reportFile(d), code, detail);
  }
});

test('summary 1.3.0: partial, skipped with a reason, and benchmark items', () => {
  const ok = [
    (m) => { m.summary[0].result = 'partial'; },
    (m) => { m.summary[0].result = 'partial'; m.summary[0].reason = null; },
    (m) => { m.summary[0].result = 'skipped'; m.summary[0].reason = 'busy'; },
    (m) => { m.summary[0].result = 'skipped'; m.summary[0].reason = 'reviewed'; },
    (m) => { m.summary.push({ group: 'camera', name: 'Razer Kiyo Pro', device: '1532:0e05', result: 'skipped', reason: 'busy' }); },
    (m) => { m.summary[4].ms_per_frame = 0; m.summary[4].fps = 0; m.summary[4].stage = 's'.repeat(80); },
    (m) => { m.summary[4].result = 'whatever'; }, // a benchmark item has no result: a reader ignores it
  ];
  for (const change of ok) {
    const d = validData();
    change(d.modules[0]);
    assert.ok(parse(reportFile(d)));
  }
  const W = 'report.modules[0].summary';
  const bad = [
    [(m) => { m.summary[0].result = 'skipped'; }, 'missing-field', `${W}[0].reason`],
    [(m) => { m.summary[0].result = 'skipped'; m.summary[0].reason = null; }, 'bad-value', `${W}[0].reason`],
    [(m) => { m.summary[0].result = 'skipped'; m.summary[0].reason = 'in-use'; }, 'bad-value', `${W}[0].reason`],
    [(m) => { m.summary[0].reason = 'busy'; }, 'bad-value', `${W}[0].reason`],
    [(m) => { m.summary[0].result = 'partial'; m.summary[0].reason = 'reviewed'; }, 'bad-value', `${W}[0].reason`],
    [(m) => delete m.summary[4].stage, 'missing-field', `${W}[4].stage`],
    [(m) => { m.summary[4].stage = ''; }, 'bad-value', `${W}[4].stage`],
    [(m) => { m.summary[4].stage = 's'.repeat(81); }, 'bad-value', `${W}[4].stage`],
    [(m) => delete m.summary[4].ms_per_frame, 'missing-field', `${W}[4].ms_per_frame`],
    [(m) => { m.summary[4].ms_per_frame = -1; }, 'bad-value', `${W}[4].ms_per_frame`],
    [(m) => { m.summary[4].ms_per_frame = '12.4'; }, 'bad-value', `${W}[4].ms_per_frame`],
    [(m) => { m.summary[5].fps = null; }, 'bad-value', `${W}[5].fps`], // JSON has no Infinity or NaN
    [(m) => delete m.summary[5].fps, 'missing-field', `${W}[5].fps`],
    [(m) => { m.summary[4].device = 'd'.repeat(41); }, 'bad-value', `${W}[4].device`],
  ];
  for (const [change, code, detail] of bad) {
    const d = validData();
    change(d.modules[0]);
    refused(reportFile(d), code, detail);
  }
});

test('gate 1.4.0: optional on an ep, gpu-jpeg or camera item; a check name of 3.4', () => {
  const camera = { group: 'camera', name: 'Logitech C922', device: '046d:085c', result: 'partial' };
  const ok = [
    (m) => { m.summary[0].gate = 'cuda@10de-2484-0'; },
    (m) => { m.summary[2].gate = 'g'.repeat(128); m.summary[2].result = 'partial'; },
    (m) => { m.summary.push({ ...camera, gate: '046d-085c:gate' }); },
    (m) => { m.summary.push({ ...camera, result: 'skipped', reason: 'busy', gate: '046d-085c:gate' }); },
    (m) => { m.summary[4].gate = null; }, // a benchmark item has no gate: a reader ignores it
  ];
  for (const change of ok) {
    const d = validData();
    change(d.modules[0]);
    assert.ok(parse(reportFile(d)));
  }
  const W = 'report.modules[0].summary';
  for (const gate of [null, '', 7, ['a'], 'a gate', '-gate', 'g'.repeat(129), 'gate<x>']) {
    const d = validData();
    d.modules[0].summary.push({ ...camera, gate });
    refused(reportFile(d), 'bad-value', `${W}[${d.modules[0].summary.length - 1}].gate`);
  }
});

test('module: optional on a check and a section; when present a string of at most 80 characters', () => {
  const ok = [
    (m) => { m.checks[0].module = 'm'.repeat(80); },
    (m) => { m.sections[0].module = 'CUDA'; },
  ];
  for (const change of ok) {
    const d = validData();
    change(d.modules[0]);
    assert.ok(parse(reportFile(d)));
  }
  const bad = [
    [(m) => { m.checks[0].module = 'm'.repeat(81); }, 'report.modules[0].checks[0].module'],
    [(m) => { m.checks[0].module = null; }, 'report.modules[0].checks[0].module'],
    [(m) => { m.sections[1].module = 3; }, 'report.modules[0].sections[1].module'],
  ];
  for (const [change, detail] of bad) {
    const d = validData();
    change(d.modules[0]);
    refused(reportFile(d), 'bad-value', detail);
  }
});

test('notices 1.4.0: optional; at most 50 items of a code and at most 8 short values (section 3.8)', () => {
  const ok = [
    (m) => { m.notices = []; },
    (m) => { m.notices = [{ code: 'camera-wedged', values: { camera: 'Logitech C922' } }, { code: 'replug_all' }]; },
    (m) => { m.notices = Array.from({ length: 50 }, () => ({ code: 'c'.repeat(80), values: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`k${i}`, i % 2 ? 'v'.repeat(80) : 0.5])) })); },
    (m) => { m.notices = [{ code: 'x', extra: 1 }]; }, // a reader ignores a field that it does not know
  ];
  for (const change of ok) {
    const d = validData();
    change(d.modules[0]);
    assert.ok(parse(reportFile(d)));
  }
  const W = 'report.modules[0].notices';
  const bad = [
    [(m) => { m.notices = {}; }, 'bad-value', W],
    [(m) => { m.notices = Array.from({ length: 51 }, () => ({ code: 'x' })); }, 'bad-value', W],
    [(m) => { m.notices = ['camera-wedged']; }, 'bad-value', `${W}[0]`],
    [(m) => { m.notices = [{ values: {} }]; }, 'missing-field', `${W}[0].code`],
    [(m) => { m.notices = [{ code: 'Camera is wedged' }]; }, 'bad-value', `${W}[0].code`],
    [(m) => { m.notices = [{ code: 'c'.repeat(81) }]; }, 'bad-value', `${W}[0].code`],
    [(m) => { m.notices = [{ code: 'x', values: [] }]; }, 'bad-value', `${W}[0].values`],
    [(m) => { m.notices = [{ code: 'x', values: null }]; }, 'bad-value', `${W}[0].values`],
    [(m) => { m.notices = [{ code: 'x', values: { a: 'v'.repeat(81) } }]; }, 'bad-value', `${W}[0].values`],
    [(m) => { m.notices = [{ code: 'x', values: { a: { b: 1 } } }]; }, 'bad-value', `${W}[0].values`],
    [(m) => { m.notices = [{ code: 'x', values: { a: true } }]; }, 'bad-value', `${W}[0].values`],
    [(m) => { m.notices = [{ code: 'x', values: { a: null } }]; }, 'bad-value', `${W}[0].values`],
    [(m) => { m.notices = [{ code: 'x', values: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 1])) }]; }, 'bad-value', `${W}[0].values`],
  ];
  for (const [change, code, detail] of bad) {
    const d = validData();
    change(d.modules[0]);
    refused(reportFile(d), code, detail);
  }
});

test('id: optional; when present a version 4 UUID in lower case; a repeat is allowed', () => {
  const ID = '3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90';
  const d = validData();
  d.modules[0].id = ID;
  assert.ok(parse(reportFile(d)));
  for (const id of [ID.toUpperCase(), ID.replace(/-/g, ''), '3f2b8c1e-9a4d-1e7b-b6a1-0c5d2e8f7a90', 42, '', null]) {
    const e = validData();
    e.modules[0].id = id;
    refused(reportFile(e), 'bad-value', 'report.modules[0].id');
  }
  assert.ok(parse(reportFile(validData())), 'no id');
  const two = validData();
  two.modules = [{ ...two.modules[0], id: ID }, { ...two.modules[0], id: ID }];
  assert.ok(parse(reportFile(two)), 'the same id twice');
});

test('host: each known field of section 3.3 has its form; another form is refused', () => {
  const ok = [
    (h) => { delete h.os; delete h.cpu; delete h.gpus; delete h.memory_bytes; },
    (h) => { h.gpus = Array.from({ length: 16 }, (_, i) => ({ name: 'n'.repeat(200), id: `${i}`.padEnd(40, 'x') })); },
    (h) => { h.os.build = '26300'; h.os.release = 11; h.extra = { any: [1] }; }, // a reader ignores a field that it does not know
    (h) => { h.gpus[0].vram_bytes = 0; delete h.gpus[0].vendor; delete h.gpus[0].driver_version; },
    (h) => { // a writer writes null for an unknown field (3.3)
      for (const f of Object.keys(h.os)) h.os[f] = null;
      h.cpu.name = null; h.memory_bytes = null;
      Object.assign(h.gpus[0], { vendor: null, driver_version: null, vram_bytes: null });
    },
    (h) => { h.os = null; h.cpu = null; h.gpus = null; },
  ];
  for (const change of ok) {
    const d = validData();
    change(d.modules[0].host);
    assert.ok(parse(reportFile(d)));
  }
  const W = 'report.modules[0].host';
  const bad = [
    [(h) => { h.os = 'Windows'; }, 'bad-value', `${W}.os`],
    [(h) => { h.os.label = { a: 1 }; }, 'bad-value', `${W}.os.label`],
    [(h) => { h.os.build = [26300]; }, 'bad-value', `${W}.os.build`],
    [(h) => { h.cpu = ['AMD']; }, 'bad-value', `${W}.cpu`],
    [(h) => { h.cpu.name = true; }, 'bad-value', `${W}.cpu.name`],
    [(h) => { h.memory_bytes = -1; }, 'bad-value', `${W}.memory_bytes`],
    [(h) => { h.memory_bytes = '32 GB'; }, 'bad-value', `${W}.memory_bytes`],
    [(h) => { h.gpus = {}; }, 'bad-value', `${W}.gpus`],
    [(h) => { h.gpus = Array.from({ length: 17 }, () => h.gpus[0]); }, 'bad-value', `${W}.gpus`],
    [(h) => { h.gpus[1] = null; }, 'bad-value', `${W}.gpus[1]`],
    [(h) => { delete h.gpus[0].name; }, 'missing-field', `${W}.gpus[0].name`],
    [(h) => { h.gpus[0].name = 'n'.repeat(201); }, 'bad-value', `${W}.gpus[0].name`],
    [(h) => { h.gpus[0].name = { toString: 1 }; }, 'bad-value', `${W}.gpus[0].name`],
    [(h) => { h.gpus[0].name = null; }, 'bad-value', `${W}.gpus[0].name`],
    [(h) => { h.gpus[0].id = null; }, 'bad-value', `${W}.gpus[0].id`],
    [(h) => { delete h.gpus[0].id; }, 'missing-field', `${W}.gpus[0].id`],
    [(h) => { h.gpus[0].id = 'i'.repeat(41); }, 'bad-value', `${W}.gpus[0].id`],
    [(h) => { h.gpus[0].vendor = 1; }, 'bad-value', `${W}.gpus[0].vendor`],
    [(h) => { h.gpus[0].driver_version = 610.88; }, 'bad-value', `${W}.gpus[0].driver_version`],
    [(h) => { h.gpus[0].vram_bytes = -2; }, 'bad-value', `${W}.gpus[0].vram_bytes`],
  ];
  for (const [change, code, detail] of bad) {
    const d = validData();
    change(d.modules[0].host);
    refused(reportFile(d), code, detail);
  }
});

test('created_utc: the year must be the current UTC year, the year before or the year after', () => {
  const text = reportFile(validData()); // 2026
  for (const now of ['2025-01-01T00:00:00Z', '2026-06-01T00:00:00Z', '2027-12-31T23:59:59Z']) {
    assert.ok(parse(text, Date.parse(now)), now);
  }
  for (const now of ['2024-12-31T23:59:59Z', '2028-01-01T00:00:00Z']) {
    assert.throws(() => parse(text, Date.parse(now)), (e) => e.code === 'bad-value' && e.detail === 'report.modules[0].created_utc', now);
  }
  const d = validData();
  d.modules.push({ ...validData().modules[0], created_utc: '1999-01-01T00:00:00Z' });
  refused(reportFile(d), 'bad-value', 'report.modules[1].created_utc');
});
