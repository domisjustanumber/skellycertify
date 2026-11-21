import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privacyRule, stringRule, duplicateKey, PATH_RE, PCI_RE, MAC_RE, EMAIL_RE, IPV4_RE } from '../src/privacy.js';
import { parseReport } from '../src/report.js';
import { sample, validData, NOW } from './helpers.js';

const parse = (text) => parseReport(text, NOW);

const md = ['# Certify report', '', 'A line.'];
// Put one string in a details object of the valid data and return the rule.
const inDetails = (value) => {
  const d = validData();
  d.modules[0].details.extra = value;
  return privacyRule(md, d);
};

test('the valid samples keep every rule', () => {
  for (const name of ['valid.md', 'valid-quick.md']) {
    const { markdown, data } = parse(sample(name));
    assert.equal(privacyRule(markdown, data), 0, name);
  }
});

test('the strings of summary obey the same rules', () => {
  const rule = (field, value) => {
    const d = validData();
    d.modules[0].summary[0][field] = value;
    return privacyRule(md, d);
  };
  assert.equal(rule('name', 'Camera of a@example.com'), 5);
  assert.equal(rule('name', 'C:\\x'), 1);
  assert.equal(rule('device', '00:1a:2b:3c:4d:5e'), 4);
  assert.equal(rule('device', '0000:01:00.0'), 3);
  assert.equal(rule('device', '10de:2484'), 0, 'a PCI id is allowed');
});

test('the privacy sample breaks rule 1', () => {
  const { markdown, data } = parse(sample('refused-privacy.md'));
  assert.equal(privacyRule(markdown, data), 1);
});

test('rule 1: paths', () => {
  for (const s of ['C:\\x', 'see d:/data', '\\\\server\\share', '/home/$USER', '/Users/a', '/root/x', '~/x', '~\\x']) {
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
  assert.equal(inDetails({ Hostname: 'x' }), 2, 'case-insensitive');
  assert.equal(inDetails({ MAC_Address: 'x' }), 2, 'case-insensitive');
  assert.equal(inDetails({ hostname_count: 1, users: 'x' }), 0, 'only the names of the rule');
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
  assert.equal(stringRule('X.JPG'), 7, 'case-insensitive');
  assert.equal(stringRule('clip.Mp4'), 7, 'case-insensitive');
});

test('rule 7: the name of a test_media item of a module is exempt (section 3.9)', () => {
  const item = (name) => ({ name, sha256: 'a'.repeat(64), bytes: 1, source: 'bundled' });
  const withMedia = (name, extra = {}) => {
    const d = validData();
    d.modules[0].test_media = [{ ...item(name), ...extra }];
    return d;
  };
  assert.equal(privacyRule(md, withMedia('sample.mp4')), 0, 'the name passes');
  assert.equal(privacyRule(md, withMedia('ok.zip', { source: 'x.mp4' })), 7, 'another field of the item');
  assert.equal(privacyRule(md, withMedia('C:/data/sample.mp4')), 1, 'a path is refused');
  assert.equal(privacyRule(md, withMedia('x'.repeat(2001) + '.mp4')), 6, 'the length rule applies');
  assert.equal(privacyRule(md, withMedia('Traceback (most recent call last) a.mp4')), 10);
  const nested = validData();
  nested.modules[0].details.test_media = [item('sample.mp4')];
  assert.equal(privacyRule(md, nested), 7, 'test_media inside details gets no exemption');
  const other = validData();
  other.modules[0].details.name = 'sample.mp4';
  assert.equal(privacyRule(md, other), 7, 'a name elsewhere gets no exemption');
  assert.equal(privacyRule(['sample.mp4'], withMedia('sample.mp4')), 7, 'the Markdown part');
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

test('rule 6 is tested first: no pattern runs on a string longer than 2000 characters', () => {
  assert.equal(stringRule('C:\\' + 'x'.repeat(2001)), 6);
  assert.equal(privacyRule([`<${'x'.repeat(2001)}`], validData()), 6);
});

test('each pattern costs linear time: a 250,000-character line finishes well under 1 second', () => {
  for (const s of ['a'.repeat(250_000), 'a.'.repeat(125_000), '@a-'.repeat(83_334)]) {
    for (const [name, re] of Object.entries({ PATH_RE, PCI_RE, MAC_RE, EMAIL_RE, IPV4_RE })) {
      const t = performance.now();
      re.test(s);
      const ms = performance.now() - t;
      assert.ok(ms < 250, `${name} on ${s.slice(0, 3)}…: ${ms.toFixed(0)} ms`);
    }
    const t = performance.now();
    privacyRule([s], validData());
    assert.ok(performance.now() - t < 250, 'privacyRule');
  }
  assert.ok(EMAIL_RE.test('mail a.b+c@sub.example.co now'), 'the bound pattern still finds an address');
});

test('rule 17: the Markdown part holds no "<", "](", "]:", "://" or "www."', () => {
  for (const line of ['a <b>', 'see [x](y)', 'https: no, ftp://x', 'WWW.example', 'a_www.example', '<', '[x]: y', '  [ref]:']) {
    assert.equal(privacyRule([line], validData()), 17, line);
  }
  for (const line of ['> a quote', '| a | b |', 'trt-rtx@10de-2484-0:image', 'a ] (b)', 'a ] : b', 'www example']) {
    assert.equal(privacyRule([line], validData()), 0, line);
  }
  assert.equal(inDetails('<private>'), 0, 'rule 17 is about the Markdown');
});

test('rule 18: the note is clean', () => {
  const rule = (note) => { const d = validData(); d.note = note; return privacyRule(md, d); };
  for (const note of ['Line one.\nLine two: 5 min, 30% (ok) - fine? yes/no; a_b + c = d · Ünïcödé 日本語 1/2', '', 'x'.repeat(2000), "it's"]) {
    assert.equal(rule(note), 0, note.slice(0, 20));
  }
  for (const note of ['a <b>', '@me', '#1', 'a\tb', 'a\r\nb', 'a\u0000b', 'mail me!', '[x]', '`code`', '*', 'see http://x', 'www.x', 'WwW.x', 'a\u202eb', '😀']) {
    assert.equal(rule(note), 18, JSON.stringify(note));
  }
});

test('rule 19: the same key two times in one object of the JSON text', () => {
  assert.equal(duplicateKey('{"a": 1, "b": {"a": 2}, "c": [{"a": 3}, {"a": 4}]}'), false, 'one key in different objects');
  assert.equal(duplicateKey('{"a": 1, "a": 2}'), true);
  assert.equal(duplicateKey('{"x": {"k": "v", "k": "w"}}'), true);
  assert.equal(duplicateKey('{"a": 1, "\\u0061": 2}'), true, 'an escaped key is the same key');
  assert.equal(duplicateKey('{"a": "\\"a\\": , {", "b": ["a", "a"]}'), false, 'strings and list values are not keys');
  assert.equal(duplicateKey('[{"a": 1}, {"a": 1}]'), false);
  const { markdown, data, json } = parse(sample('valid.md'));
  assert.equal(privacyRule(markdown, data, json), 0);
  assert.equal(privacyRule(markdown, data, json.replace('"note":', '"note": null, "note":')), 19);
});

test('rule 20: an IPv4 address in the Markdown part or the note; not in other JSON values', () => {
  assert.equal(privacyRule(['from 192.0.2.44 today'], validData()), 20);
  assert.equal(privacyRule(['255.255.255.255'], validData()), 20);
  assert.equal(privacyRule(['1.2.3.256 and 300.1.1.1 and 1.2.3'], validData()), 0);
  const d = validData();
  d.note = 'my address is 203.0.113.9';
  assert.equal(privacyRule(md, d), 20);
  assert.equal(inDetails('32.0.101.6881'), 0, 'a driver version in the JSON');
  assert.equal(inDetails('203.0.113.9'), 0, 'rule 20 is only for the Markdown part and the note');
});
