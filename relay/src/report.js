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
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/; // a version 4 UUID in lower case
const KINDS = ['quick', 'full', 'passive'];
export const RESULTS = ['pass', 'fail', 'not-run', 'record-only'];
const SUMMARY_GROUPS = ['ep', 'gpu-jpeg', 'camera', 'benchmark'];
const SUMMARY_RESULTS = ['pass', 'fail', 'record-only', 'partial', 'skipped'];
const SKIP_REASONS = ['busy', 'reviewed'];
const SUMMARY_ITEMS = 200; // a limit of the relay, so that the issue body stays small
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/; // the pattern of a reason code (section 5.2)
const NOTICES = 50; // section 3.8
const NOTICE_VALUES = 8;

// Split the file into the Markdown part and the JSON text of the last fenced `json` block.
// The file must end with that block and one "\n" (section 4.2).
export function splitReport(text) {
  // The handler turns each CRLF into LF first. A CR that is left is a lone CR.
  if (text.includes('\r')) throw new Refused('lone-cr', 'a CR that is not part of CRLF is not allowed');
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
const short = (v) => str(v) && [...v].length <= 80;
const figure = (v) => Number.isFinite(v) && v >= 0;
const upTo = (n) => (v) => str(v) && [...v].length <= n;
const strOrNum = (v) => str(v) || Number.isFinite(v);
const orNull = (test) => (v) => v === null || test(v);
const GPUS = 16; // a limit of the relay, so that the issue stays small
const OS_FIELDS = ['name', 'release', 'version', 'build', 'label', 'arch'];

// Section 3.3. Each known field has its form, so that the issue prints only text. Each optional
// field can be null (unknown); name and id of a GPU cannot.
function checkHost(host, where) {
  for (const [key, fields] of [['os', OS_FIELDS], ['cpu', ['name']]]) {
    if (!(key in host) || host[key] === null) continue;
    const obj = need(host, key, where, isObj);
    for (const f of fields) if (f in obj) need(obj, f, `${where}.${key}`, orNull(strOrNum));
  }
  if ('memory_bytes' in host) need(host, 'memory_bytes', where, orNull(figure));
  if ('gpus' in host && host.gpus !== null) {
    need(host, 'gpus', where, (v) => Array.isArray(v) && v.length <= GPUS).forEach((g, i) => {
      const w = `${where}.gpus[${i}]`;
      if (!isObj(g)) throw new Refused('bad-value', w);
      need(g, 'name', w, upTo(200));
      need(g, 'id', w, upTo(40));
      for (const f of ['vendor', 'driver_version']) if (f in g) need(g, f, w, strOrNull);
      if ('vram_bytes' in g) need(g, 'vram_bytes', w, orNull(figure));
    });
  }
}

function checkRow(row, where, hasSections, isCleanup) {
  if (!isObj(row)) throw new Refused('bad-value', where);
  if (hasSections && !isCleanup) need(row, 'section', where, str);
  need(row, 'name', where, (v) => str(v) && CHECK_NAME_RE.test(v));
  const result = need(row, 'result', where, (v) => RESULTS.includes(v));
  need(row, 'reason', where, (v) => strOrNull(v) && !(v === null && (result === 'fail' || result === 'not-run')));
  if ('module' in row) need(row, 'module', where, short);
}

function checkModule(m, where, year) {
  if (!isObj(m)) throw new Refused('bad-value', where);
  need(m, 'schema', where, (v) => str(v) && SCHEMA_RE.test(v), 'wrong-schema');
  // Two modules may have the same id. A repeat only makes the issue harder to read, and a refusal
  // would block a hand-in the user cannot fix.
  if ('id' in m) need(m, 'id', where, (v) => str(v) && ID_RE.test(v));
  const pkg = need(m, 'package', where, isObj);
  need(pkg, 'name', `${where}.package`, str);
  need(pkg, 'version', `${where}.package`, str);
  need(m, 'kind', where, (v) => KINDS.includes(v));
  // The year names the folder on inbox: only this UTC year, the year before or the year after.
  need(m, 'created_utc', where, (v) => str(v) && UTC_RE.test(v) && Math.abs(Number(v.slice(0, 4)) - year) <= 1);
  checkHost(need(m, 'host', where, isObj), `${where}.host`);
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
      if ('module' in s) need(s, 'module', w, short);
    });
  }
  if ('summary' in m) { // section 3.7
    need(m, 'summary', where, (v) => Array.isArray(v) && v.length <= SUMMARY_ITEMS).forEach((s, i) => {
      const w = `${where}.summary[${i}]`;
      if (!isObj(s)) throw new Refused('bad-value', w);
      const group = need(s, 'group', w, (v) => SUMMARY_GROUPS.includes(v));
      need(s, 'name', w, (v) => short(v) && v.length > 0);
      need(s, 'device', w, (v) => v === null || (str(v) && [...v].length <= 40));
      if (group === 'benchmark') { // no result and no reason
        need(s, 'stage', w, (v) => short(v) && v.length > 0);
        need(s, 'ms_per_frame', w, figure);
        need(s, 'fps', w, figure);
      } else {
        if (need(s, 'result', w, (v) => SUMMARY_RESULTS.includes(v)) === 'skipped') {
          need(s, 'reason', w, (v) => SKIP_REASONS.includes(v));
        } else if ('reason' in s) {
          need(s, 'reason', w, (v) => v === null);
        }
        if ('gate' in s) need(s, 'gate', w, (v) => str(v) && CHECK_NAME_RE.test(v)); // a roll-up check (3.4)
      }
    });
  }
  if ('notices' in m) { // section 3.8: a code and a flat object of short values, no free text
    need(m, 'notices', where, (v) => Array.isArray(v) && v.length <= NOTICES).forEach((n, i) => {
      const w = `${where}.notices[${i}]`;
      if (!isObj(n)) throw new Refused('bad-value', w);
      need(n, 'code', w, (v) => str(v) && CODE_RE.test(v));
      if ('values' in n) {
        need(n, 'values', w, (v) => isObj(v) && Object.keys(v).length <= NOTICE_VALUES
          && Object.values(v).every((x) => Number.isFinite(x) || short(x)));
      }
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
// nowMs gives the current UTC year for the check of created_utc.
export function parseReport(text, nowMs = Date.now()) {
  const year = new Date(nowMs).getUTCFullYear();
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
  modules.forEach((m, i) => checkModule(m, `report.modules[${i}]`, year));
  need(data, 'note', 'report'); // rules 11 and 18 of section 6 check it
  return { markdown, data, json };
}
