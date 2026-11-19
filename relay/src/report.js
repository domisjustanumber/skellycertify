// Parse and check a report file (report-format.md, sections 3, 4.1 and 4.2).
// Each function is pure. A refusal throws a Refused with a fixed code and a fixed detail.

export class Refused extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

export const SCHEMA_MAJOR = 1;
const SCHEMA_RE = /^skellycertify\.report\/1\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const CHECK_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/;
const KINDS = ['quick', 'full', 'passive'];
const RESULTS = ['pass', 'fail', 'not-run', 'record-only'];

// Split the file into the Markdown part and the JSON text of the last fenced `json` block.
// The file must end with that block and one "\n" (section 4.2).
export function splitReport(text) {
  if (text.includes('\r')) throw new Refused('bad-line-ends', 'the file must use \\n line ends');
  if (!text.endsWith('\n')) throw new Refused('no-json-block', 'the file must end with a fenced json block and one \\n');
  const lines = text.slice(0, -1).split('\n');
  const close = /^(`{3,})[ \t]*$/.exec(lines[lines.length - 1]);
  if (!close) throw new Refused('no-json-block', 'the file must end with a fenced json block and one \\n');
  for (let i = lines.length - 2; i >= 0; i--) {
    const open = /^(`{3,})json[ \t]*$/.exec(lines[i]);
    if (open && open[1].length <= close[1].length) {
      const inner = lines.slice(i + 1, -1);
      const early = new RegExp(`^\`{${open[1].length},}[ \\t]*$`);
      if (inner.some((l) => early.test(l))) break; // a line inside would close the block early
      return { markdown: lines.slice(0, i), json: inner.join('\n') };
    }
  }
  throw new Refused('no-json-block', 'the file must end with a fenced json block and one \\n');
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The detail is a field path built from fixed key names and list indexes, never report content.
function need(obj, key, where, test = () => true, badCode = 'bad-value') {
  if (!isObj(obj) || !(key in obj)) throw new Refused('missing-field', `${where}.${key}`);
  if (!test(obj[key])) throw new Refused(badCode, `${where}.${key}`);
  return obj[key];
}

const str = (v) => typeof v === 'string';
const strOrNull = (v) => v === null || typeof v === 'string';

function checkRow(row, where, hasSections, isCleanup) {
  if (!isObj(row)) throw new Refused('bad-value', where);
  if (hasSections && !isCleanup) need(row, 'section', where, str);
  need(row, 'name', where, (v) => str(v) && CHECK_NAME_RE.test(v));
  const result = need(row, 'result', where, (v) => RESULTS.includes(v));
  need(row, 'reason', where, (v) => strOrNull(v) && !(v === null && (result === 'fail' || result === 'not-run')));
}

function checkModule(m, where) {
  if (!isObj(m)) throw new Refused('bad-value', where);
  need(m, 'schema', where, (v) => str(v) && SCHEMA_RE.test(v), 'wrong-schema');
  const pkg = need(m, 'package', where, isObj);
  need(pkg, 'name', `${where}.package`, str);
  need(pkg, 'version', `${where}.package`, str);
  need(m, 'kind', where, (v) => KINDS.includes(v));
  need(m, 'created_utc', where, (v) => str(v) && UTC_RE.test(v));
  need(m, 'host', where, isObj);
  const hasSections = 'sections' in m;
  const checks = need(m, 'checks', where, Array.isArray);
  checks.forEach((c, i) => checkRow(c, `${where}.checks[${i}]`, hasSections, false));
  if (hasSections) {
    const sections = need(m, 'sections', where, Array.isArray);
    sections.forEach((s, i) => {
      const w = `${where}.sections[${i}]`;
      if (!isObj(s)) throw new Refused('bad-value', w);
      need(s, 'id', w, str);
      need(s, 'name', w, str);
      need(s, 'result', w, (v) => RESULTS.includes(v));
      need(s, 'reason', w, strOrNull);
    });
  }
  if ('cleanup' in m) {
    need(m, 'cleanup', where, Array.isArray).forEach((c, i) => checkRow(c, `${where}.cleanup[${i}]`, hasSections, true));
  }
  const ev = need(m, 'evidence', where, isObj);
  need(ev, 'valid', `${where}.evidence`, (v) => typeof v === 'boolean');
  need(ev, 'reasons', `${where}.evidence`, Array.isArray);
}

// Parse the JSON block and check the fields that sections 3 and 4.1 require.
export function parseReport(text) {
  const { markdown, json } = splitReport(text);
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Refused('bad-json', 'the json block does not parse');
  }
  if (!isObj(data)) throw new Refused('bad-json', 'the json block is not an object');
  need(data, 'schema', 'report', (v) => str(v) && SCHEMA_RE.test(v), 'wrong-schema');
  const app = need(data, 'app', 'report', (v) => v === null || isObj(v));
  if (app !== null) {
    need(app, 'name', 'report.app', str);
    need(app, 'version', 'report.app', str);
  }
  const modules = need(data, 'modules', 'report', (v) => Array.isArray(v) && v.length > 0);
  modules.forEach((m, i) => checkModule(m, `report.modules[${i}]`));
  need(data, 'note', 'report'); // rule 11 of section 6 checks its type and length
  return { markdown, data };
}
