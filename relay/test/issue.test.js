import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neutral, buildTitle, buildBody, marker, BODY_LIMIT } from '../src/issue.js';
import { validData } from './helpers.js';

const HASH = 'a'.repeat(64);
const args = (data, testMode = false) => ({
  data, hash: HASH, filePath: `inbox/2026/${HASH}.md`,
  fileUrl: `https://github.com/domisjustanumber/skellycertify/blob/${'c'.repeat(40)}/inbox/2026/${HASH}.md`, testMode,
});

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

test('the title is built from facts and is safe', () => {
  assert.equal(buildTitle(validData()), '[certify] freemocap 2.0.0 · Windows 11 Home 26H2 · NVIDIA GeForce RTX 3070');
  const d = validData();
  d.app = null;
  d.modules[0].host.gpus = [];
  assert.equal(buildTitle(d), '[certify] skellytracker 2.0.0 · Windows 11 Home 26H2 · no GPU');
  const h = validData();
  h.app.name = '@octocat https://evil.example <b>';
  h.modules[0].host.os.label = 'x'.repeat(5000);
  h.modules[0].host.gpus.push({ name: '[a](https://x.example)' });
  const t = buildTitle(h);
  assert.ok(t.startsWith('[certify] '));
  assert.doesNotMatch(t.slice(10), /[@<>[\]]|:\/\//);
  assert.ok(t.length <= 211);
});

test('the body has the module lines, the table, the note, the link and the marker', () => {
  const body = buildBody(args(validData()));
  assert.match(body, /- `skellytracker` `2\.0\.0`: valid as evidence\./);
  assert.match(body, /\| `skellytracker` \| `1\. Checkout and versions` \| `pass` \| {2}\|/);
  assert.match(body, /> Example note: the run took about five minutes\./);
  assert.ok(body.includes(`Report file: [inbox/2026/${HASH}.md](https://github.com/domisjustanumber/skellycertify/blob/`));
  assert.ok(body.endsWith(marker(HASH)));
  assert.doesNotMatch(body, /Test of the relay/);
  assert.match(buildBody(args(validData(), true)), /^\*\*Test of the relay\.\*\*/);
});

test('a module that is not valid lists its reasons; checks make the rows when there are no sections', () => {
  const d = validData();
  d.modules[0].evidence = { valid: false, reasons: ['modified-tree', 'partial-run'] };
  delete d.modules[0].sections;
  const body = buildBody(args(d));
  assert.match(body, /not valid as evidence: `modified-tree`, `partial-run`\./);
  assert.match(body, /\| `skellytracker` \| `amdgpu` \| `not-run` \| `not-offered` \|/);
});

test('hostile report strings are neutral in the body; only the relay marker is HTML', () => {
  const d = validData();
  d.app.name = HOSTILE.join(' ');
  d.modules[0].package.name = '@team <script>';
  d.modules[0].sections[0].name = HOSTILE.join(' ');
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
  const a = '3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90';
  const b = 'c1d2e3f4-5a6b-4c7d-8e9f-a0b1c2d3e4f5';
  d.modules = [{ ...d.modules[0], id: a }, { ...validData().modules[0], id: b, evidence: { valid: false, reasons: ['check-failed'] } }];
  const body = buildBody(args(d));
  assert.match(body, new RegExp(`^- \`skellytracker\` \`2\.0\.0\` · id \`${a}\`: valid as evidence\.$`, 'm'));
  assert.match(body, new RegExp(`^- \`skellytracker\` \`2\.0\.0\` · id \`${b}\`: not valid as evidence: \`check-failed\`\.$`, 'm'));
  const rows = body.split('\n').filter((l) => l.startsWith('| `skellytracker`'));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.split(' | ')[0]), [a, a, b, b].map((id) => `| \`skellytracker\` \`${id}\``));
});
