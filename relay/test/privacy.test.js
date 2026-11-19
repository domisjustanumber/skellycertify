import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privacyRule, stringRule } from '../src/privacy.js';
import { parseReport } from '../src/report.js';
import { sample, validData } from './helpers.js';

const md = ['# Certify report', '', 'A line.'];
// Put one string in a details object of the valid data and return the rule.
const inDetails = (value) => {
  const d = validData();
  d.modules[0].details.extra = value;
  return privacyRule(md, d);
};

test('the valid sample keeps every rule', () => {
  const { markdown, data } = parseReport(sample('valid.md'));
  assert.equal(privacyRule(markdown, data), 0);
});

test('the privacy sample breaks rule 1', () => {
  const { markdown, data } = parseReport(sample('refused-privacy.md'));
  assert.equal(privacyRule(markdown, data), 1);
});

test('rule 1: paths', () => {
  for (const s of ['C:\\x', 'see d:/data', '\\\\server\\share', '/home/a', '/Users/a', '/root/x', '~/x', '~\\x']) {
    assert.equal(stringRule(s), 1, s);
  }
  for (const s of ['https://github.com/x', 'skellycertify.report/1.0.0', 'tree clean; Python 3.13.18', '10de:2484', '/opt/x']) {
    assert.equal(stringRule(s), 0, s);
  }
  assert.equal(privacyRule(['line with C:\\Temp'], validData()), 1, 'a Markdown line');
});

test('rule 2: private object keys at any depth', () => {
  for (const k of ['hostname', 'host_name', 'node', 'user', 'username', 'user_name', 'email', 'serial', 'serial_number',
    'uuid', 'mac', 'mac_address', 'bus_id', 'pci_bus_id', 'luid', 'ip', 'ip_address']) {
    assert.equal(inDetails({ deep: [{ [k]: 'x' }] }), 2, k);
  }
  assert.equal(inDetails({ hostname_count: 1, User: 'x' }), 0, 'only the exact keys of the rule');
});

test('rule 3: PCI bus addresses', () => {
  assert.equal(stringRule('0000:01:00.0'), 3);
  assert.equal(stringRule('bus 01:00.1'), 3);
  assert.equal(stringRule('10de:2484'), 0);
  assert.equal(stringRule('2026-11-19T10:00:00Z'), 0);
});

test('rule 4: MAC addresses', () => {
  assert.equal(stringRule('00:1A:2b:3c:4d:5e'), 4);
  assert.equal(stringRule('00-1a-2b-3c-4d-5e'), 4);
  assert.equal(stringRule('00:1a:2b'), 0);
});

test('rule 5: email addresses', () => {
  assert.equal(stringRule('mail me: someone@example.org'), 5);
  assert.equal(inDetails({ k: 'a.b+c@sub.example.co' }), 5);
  assert.equal(stringRule('ep@cuda'), 0);
  assert.equal(stringRule('@someone'), 0);
});

test('rule 6: strings longer than 2000 characters', () => {
  assert.equal(stringRule('a'.repeat(2000)), 0);
  assert.equal(stringRule('a'.repeat(2001)), 6);
  assert.equal(stringRule('😀'.repeat(2000)), 0, 'counted in code points, as Python does');
  assert.equal(privacyRule(['x'.repeat(2001)], validData()), 6);
  const d = validData();
  d.modules[0].details['k'.repeat(2001)] = 1;
  assert.equal(privacyRule(md, d), 6, 'a key is a string');
});

test('rule 7: media file extensions at the end of a string', () => {
  for (const e of ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.wav', '.mp3', '.flac']) {
    assert.equal(stringRule(`recording${e}`), 7, e);
  }
  assert.equal(stringRule('a.png file'), 0, 'only at the end');
  assert.equal(stringRule('X.PNG'), 0, 'the rule lists lower case only');
});

test('rule 8: image links in the Markdown', () => {
  assert.equal(privacyRule(['text ![a](b)'], validData()), 8);
  assert.equal(inDetails('![in json]'), 0, 'rule 8 is about the Markdown');
});

test('rule 9: reason codes', () => {
  const d = validData();
  d.modules[0].checks[0].reason = 'has a space';
  assert.equal(privacyRule(md, d), 9);
  const e = validData();
  e.modules[0].evidence.reasons = ['ok-code', 'Bad code!'];
  assert.equal(privacyRule(md, e), 9);
  const f = validData();
  f.modules[0].sections[0].reason = 'x'.repeat(81);
  assert.equal(privacyRule(md, f), 9);
  const g = validData();
  g.modules[0].checks[0].reason = 'TimeoutError';
  assert.equal(privacyRule(md, g), 0);
});

test('rule 10: tracebacks', () => {
  assert.equal(stringRule('Traceback (most recent call last):'), 10);
  assert.equal(privacyRule(['Traceback (most recent call last)'], validData()), 10);
});

test('rule 11: note is null or a short string', () => {
  for (const [note, rule] of [[null, 0], ['short', 0], [5, 11], [['x'], 11], ['n'.repeat(2001), 6]]) {
    const d = validData();
    d.note = note;
    assert.equal(privacyRule(md, d), rule, JSON.stringify(note).slice(0, 20));
  }
});

test('the lowest rule number wins', () => {
  assert.equal(inDetails(['someone@example.org', 'C:\\x']), 1);
});
