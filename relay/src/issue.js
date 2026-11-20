// Build the issue title and body from the facts of a report. Each function is pure.
// Each report string is untrusted. neutral() keeps only letters, digits, marks, spaces and a few
// signs: no "@" (mention), no "#" (issue link), no "<" or ">" (HTML), no "[", "]", "!", "|", "`", "*".
// It breaks "://" and "www." so that GitHub makes no link.
// The body shows the summary of report-format.md 4.2, built from the JSON and never from the Markdown.

export const BODY_LIMIT = 65536; // characters of an issue body on GitHub
const TITLE_LIMIT = 200; // GitHub allows 256; keep a margin
const NOTE_LIMIT = 2000;
const MODULE_LINES = 100;
const REASONS = 10; // reason codes shown for one module
const CUT_ROOM = 120; // room for one "shortened" line

export function neutral(value, max = 120) {
  let s = String(value ?? '').normalize('NFKC');
  s = s.replace(/[^\p{L}\p{M}\p{N} .,:;_+=()'%/?·-]+/gu, ' ');
  s = s.replace(/:\/\//g, ': //').replace(/\bwww\./gi, 'www .');
  s = s.replace(/\s+/g, ' ').trim();
  const chars = [...s];
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : s;
}

// A report value in an inline code span: GitHub makes no mention, link, autolink or HTML inside it.
const code = (value, max) => {
  const s = neutral(value, max);
  return s ? `\`${s}\`` : '';
};

const str = (v) => typeof v === 'string';
const tidy = (s) => s.replace(/\s+/g, ' ').trim();

// Display names of report-format.md 4.2. The JSON keeps each name as the OS or the driver gives it.
export const gpuName = (s) => tidy(String(s ?? '').replace(/\((?:R|TM)\)/g, ' ').replace(/\b(?:GeForce|Radeon|Arc|Graphics|GPU|Series)\b/g, ' '));
export const cpuName = (s) => tidy(String(s ?? '').replace(/\((?:R|TM)\)/g, ' ')
  .replace(/\b\d+(?:st|nd|rd|th) Gen\b/g, ' ')
  .replace(/(?:\bCPU\s*)?@\s*\d+(?:\.\d+)?\s*[GM]Hz\b/g, ' ')
  .replace(/\b\w+-Core Processor\b/g, ' '));
export const osLabel = (s) => tidy(String(s ?? '').replace(/\b(?:Home|Pro)\b/g, ' '));
export const gigabytes = (bytes) => `${Math.round(bytes / 2 ** 30)} GB`;

const gpusOf = (m) => (Array.isArray(m.host?.gpus) ? m.host.gpus.filter((g) => g !== null && typeof g === 'object') : []);
const osOf = (m) => (str(m.host?.os?.label) ? osLabel(m.host.os.label) : str(m.host?.os?.name) ? m.host.os.name : undefined);

// A check name of the format (3.4) holds no backtick, bar or space, so it is safe in a code span as it is.
// It keeps its "@", which neutral() removes. Another name, for example of a section, goes through neutral().
const testName = (v) => (/^[A-Za-z0-9_.:@-]{1,128}$/.test(String(v)) ? `\`${v}\`` : code(v, 128));

export function buildTitle(data) {
  const first = data.modules[0];
  const who = data.app ?? first.package;
  const name = who.name === 'freemocap' ? 'FMC' : who.name;
  const os = (data.modules.map(osOf).find(str) ?? 'unknown OS').replace(/^Windows\b/, 'Win').replace(/^macOS\b/, 'Mac');
  const gpus = [...new Set(data.modules.flatMap((m) => gpusOf(m).map((g) => neutral(gpuName(g.name), 60))).filter(Boolean))];
  const parts = [
    `${neutral(name, 40)} ${neutral(who.version, 40)}`,
    neutral(os, 60),
    gpus.length ? neutral(gpus.join(', '), 100) : 'no GPU',
  ];
  return `[certify] ${neutral(parts.join(' · '), TITLE_LIMIT)}`;
}

// created_utc is checked by report.js: YYYY-MM-DDTHH:MM:SSZ.
const when = (utc) => `${utc.slice(0, 10)} ${utc.slice(11, 16)} UTC`;

function validity(ev) {
  if (ev.valid === true && ev.reasons.length === 0) return 'valid as evidence';
  const shown = ev.reasons.slice(0, REASONS).map((r) => code(r, 80)).join(', ');
  const more = ev.reasons.length > REASONS ? ` and ${ev.reasons.length - REASONS} more` : '';
  return `not valid as evidence${shown ? `: ${shown}${more}` : ''}`;
}

// kind is checked by report.js. With time: the header of one module with "app": null.
function moduleLine(m, withTime) {
  const head = `${code(m.package.name, 60)} ${code(m.package.version, 60)}${m.id ? ` · id ${code(m.id, 36)}` : ''} · ${m.kind} run`;
  const incomplete = ['cancelled', 'interrupted'].some((r) => m.evidence.reasons.includes(r)) ? ' · incomplete' : '';
  return `${head}${withTime ? ` · ${when(m.created_utc)}` : ''}${incomplete} · ${validity(m.evidence)}`;
}

function systemLines(data) {
  const first = (get) => data.modules.map(get).find((v) => v !== undefined);
  const os = first(osOf);
  const cpu = first((m) => (str(m.host?.cpu?.name) ? cpuName(m.host.cpu.name) : undefined));
  const ram = first((m) => (Number.isFinite(m.host?.memory_bytes) ? gigabytes(m.host.memory_bytes) : undefined));
  return [
    os !== undefined ? `- OS: ${code(os, 60)}` : null,
    cpu !== undefined ? `- CPU: ${code(cpu, 80)}` : null,
    ram !== undefined ? `- RAM: ${ram}` : null,
  ].filter((l) => l !== null);
}

const RESULT = { __proto__: null, pass: 'pass', fail: 'fail', 'record-only': 'record', partial: 'partial' };
const SKIPPED = { __proto__: null, busy: 'skipped (busy)', reviewed: 'skipped (already reviewed)' };
const shown = (it) => (it.result === 'skipped' ? SKIPPED[it.reason] : RESULT[it.result]) ?? code(it.result, 20);

const itemsOf = (m) => (Array.isArray(m.summary) ? m.summary : []);

function gpuCell(g) {
  const vram = Number.isFinite(g.vram_bytes) && g.vram_bytes >= 2 ** 30 ? ` ${gigabytes(g.vram_bytes)}` : '';
  return code(`${gpuName(g.name) || g.id}${vram}`, 100);
}

// The GPU cell of an item: the GPU of the same module report whose id is device, or "-" for null.
function deviceCell(it, gpus) {
  if (it.device === null) return '-';
  const g = gpus.find((x) => x.id === it.device);
  return g ? gpuCell(g) : code(it.device, 40);
}

// The GPU table of 4.2 part 4: the ep rows, each gpu-jpeg row under its ep row, then each GPU that
// no ep item names. A module with no summary (format 1.1.0 and earlier) gives no item rows.
function gpuRows(data) {
  const rows = [];
  const named = new Set();
  for (const m of data.modules) {
    const items = itemsOf(m);
    const gpus = gpusOf(m);
    const row = (it, label) => `| ${deviceCell(it, gpus)} | ${label} | ${shown(it)} |`;
    const same = (a, b) => a.name === b.name && a.device === b.device;
    // report.js allows at most 200 items in one module, so the nested loops stay small.
    for (const it of items) {
      if (it.group === 'ep') {
        named.add(it.device);
        rows.push(row(it, code(it.name, 80)));
        for (const j of items) if (j.group === 'gpu-jpeg' && same(j, it)) rows.push(row(j, `${code(j.name, 80)} GPU decode`));
      } else if (it.group === 'gpu-jpeg' && !items.some((e) => e.group === 'ep' && same(e, it))) {
        rows.push(row(it, `${code(it.name, 80)} GPU decode`)); // no ep item: keep it in its own place
      }
    }
  }
  // A file of format 1.1.0 has no summary: its EPs can have run, so "not checked" would be false.
  const rest = data.modules.some((m) => Array.isArray(m.summary)) ? 'not checked' : 'no summary in the report';
  const seen = new Set();
  for (const g of data.modules.flatMap(gpusOf)) {
    if (named.has(g.id) || seen.has(g.id)) continue;
    seen.add(g.id);
    rows.push(`| ${gpuCell(g)} | | ${rest} |`);
  }
  return rows;
}

// The benchmark table of 4.2 part 5. report.js checks that both figures are finite numbers.
const benchmarkRows = (data) => data.modules.flatMap((m) => itemsOf(m)
  .filter((it) => it.group === 'benchmark')
  .map((it) => `| ${deviceCell(it, gpusOf(m))} | ${code(it.name, 80)} | ${code(it.stage, 80)} | ${it.ms_per_frame.toFixed(1)} | ${it.fps.toFixed(1)} |`));

const cameraRows = (data) => data.modules.flatMap((m) => itemsOf(m)
  .filter((it) => it.group === 'camera')
  .map((it) => `| ${code(it.name, 80)} | ${shown(it)} |`));

// One row for each failed section, or for each failed check when a module has no sections.
function failedRows(data) {
  const rows = [];
  for (const m of data.modules) {
    const name = `${code(m.package.name, 60)}${m.id ? ` ${code(m.id, 36)}` : ''}`;
    const hasSections = Array.isArray(m.sections);
    for (const r of (hasSections ? m.sections : m.checks).filter((x) => x.result === 'fail')) {
      const mod = code(r.module, 80);
      rows.push(`| ${name} |${mod ? ` ${mod} ` : ' '}| ${testName(r.name)} | ${code(r.reason, 80)} |`);
    }
  }
  return rows;
}

function quote(note) {
  const lines = String(note).slice(0, NOTE_LIMIT * 2).split('\n');
  const kept = [];
  let used = 0;
  for (const line of lines) {
    const s = neutral(line, NOTE_LIMIT);
    if (used + s.length > NOTE_LIMIT) break;
    used += s.length;
    kept.push(`> ${s}`);
  }
  return kept.join('\n');
}

export function marker(hash) {
  return `<!-- skellycertify-report sha256:${hash} -->`;
}

// fileUrl is built by the relay (a permalink at the commit), not from the report.
export function buildBody({ data, hash, filePath, fileUrl, testMode }) {
  const single = data.modules.length === 1 && data.app === null;
  const start = when(data.modules.map((m) => m.created_utc).sort()[0]);
  const lists = [
    single ? [moduleLine(data.modules[0], true)] : data.modules.map((m) => `- ${moduleLine(m, false)}`),
    gpuRows(data), benchmarkRows(data), cameraRows(data), failedRows(data),
  ];
  const system = systemLines(data);
  const note = typeof data.note === 'string' && neutral(data.note, 10) ? ['Note of the person:', '', quote(data.note)] : [];
  const tail = [`Report file: [${filePath}](${fileUrl})`, `SHA-256: \`${hash}\``, '', marker(hash)];
  const make = (kept) => {
    const rows = (i) => lists[i].slice(0, kept[i]);
    const cut = (i) => (kept[i] < lists[i].length
      ? ['', `The table is shortened: ${kept[i]} of ${lists[i].length} rows. The report file holds all rows.`] : []);
    const table = (i, head) => (lists[i].length ? [head, head.replace(/[^|]+/g, '---'), ...rows(i), ...cut(i)] : []);
    const more = lists[0].length - kept[0];
    const header = single ? rows(0) : [
      data.app ? `${code(data.app.name, 40)} ${code(data.app.version, 40)} · ${start}` : start,
      '',
      ...rows(0),
      ...(more > 0 ? [`- and ${more} more modules (see the report file).`] : []),
    ];
    const cameras = lists[3].length ? table(3, '| Camera | Result |') : ['Cameras: not checked on this system.'];
    const failed = lists[4].length ? ['Failed checks:', '', ...table(4, '| Package | Module | Test | Reason |')] : [];
    return [
      testMode ? ['**Test of the relay.** This issue is never evidence.'] : [],
      header, system, table(1, '| GPU | Module | Result |'), table(2, '| GPU | Module | Stage | ms/frame | FPS |'),
      cameras, failed, note, tail,
    ].filter((p) => p.length).map((p) => p.join('\n')).join('\n\n');
  };
  const kept = lists.map((l, i) => (i === 0 ? Math.min(l.length, MODULE_LINES) : l.length));
  let body = make(kept);
  // Drop rows from the end: first the failed rows, then the benchmarks, the cameras, the GPUs and
  // the module lines. Each row takes its length and one "\n". CUT_ROOM makes room for the "shortened" line.
  for (const i of [4, 2, 3, 1, 0]) {
    if (body.length <= BODY_LIMIT) break;
    let excess = body.length - BODY_LIMIT + CUT_ROOM;
    while (kept[i] > 0 && excess > 0) excess -= lists[i][--kept[i]].length + 1;
    body = make(kept);
  }
  return body;
}
