import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReport, splitReport } from '../src/report.js';
import { sample, validData, reportFile } from './helpers.js';

const refused = (text, code, detail) =>
  assert.throws(() => parseReport(text), (e) => e.code === code && (detail === undefined || e.detail === detail));

test('the valid sample parses', () => {
  const { markdown, data } = parseReport(sample('valid.md'));
  assert.equal(data.modules[0].package.name, 'skellytracker');
  assert.equal(markdown[0], '# Certify report');
});

test('the format sample is refused for its schema', () => {
  refused(sample('refused-format.md'), 'wrong-schema', 'report.schema');
});

test('the reader takes the last json block, and a longer fence is allowed', () => {
  const text = '# Certify report\n\n```json\n{"x": 1}\n```\n\n````json\n' + JSON.stringify(validData()) + '\n````\n';
  assert.equal(JSON.parse(splitReport(text).json).schema, 'skellycertify.report/1.2.0');
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
  assert.ok(parseReport(reportFile(d)));
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
  assert.ok(parseReport(reportFile(n)), 'app null is a report of one package');
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
  assert.ok(parseReport(reportFile(d)));
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
    assert.ok(parseReport(reportFile(d)));
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
  assert.ok(parseReport(reportFile(d)));
  for (const id of [ID.toUpperCase(), ID.replace(/-/g, ''), '3f2b8c1e-9a4d-1e7b-b6a1-0c5d2e8f7a90', 42, '', null]) {
    const e = validData();
    e.modules[0].id = id;
    refused(reportFile(e), 'bad-value', 'report.modules[0].id');
  }
  assert.ok(parseReport(reportFile(validData())), 'no id');
  const two = validData();
  two.modules = [{ ...two.modules[0], id: ID }, { ...two.modules[0], id: ID }];
  assert.ok(parseReport(reportFile(two)), 'the same id twice');
});
