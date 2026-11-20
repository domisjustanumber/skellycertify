// Build the issue title and body from the facts of a report. Each function is pure.
// Each report string is untrusted. neutral() keeps only letters, digits, marks, spaces and a few
// signs: no "@" (mention), no "#" (issue link), no "<" or ">" (HTML), no "[", "]", "!", "|", "`", "*".
// It breaks "://" and "www." so that GitHub makes no link.

import { RESULTS } from './report.js';

export const BODY_LIMIT = 65536; // characters of an issue body on GitHub
const TITLE_LIMIT = 200; // GitHub allows 256; keep a margin
const NOTE_LIMIT = 2000;
const MODULE_LINES = 100;

export function neutral(value, max = 120) {
  let s = String(value ?? '').normalize('NFKC');
  s = s.replace(/[^\p{L}\p{M}\p{N} .,:;_+=()'%/?·-]+/gu, ' ');
  s = s.replace(/:\/\//g, ': //').replace(/\bwww\./gi, 'www .');
  s = s.replace(/\s+/g, ' ').trim();
  const chars = [...s];
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : s;
}

// A report value in an inline code span: GitHub makes no mention, link or HTML inside it.
const code = (value, max) => {
  const s = neutral(value, max);
  return s ? `\`${s}\`` : '';
};

const unique = (list) => [...new Set(list.filter(Boolean))];

export function buildTitle(data) {
  const first = data.modules[0];
  const who = data.app ?? first.package;
  const os = first.host?.os?.label ?? first.host?.os?.name ?? 'unknown OS';
  const gpus = unique(data.modules.flatMap((m) => (Array.isArray(m.host?.gpus) ? m.host.gpus : []).map((g) => neutral(g?.name, 60))));
  const parts = [
    `${neutral(who.name, 40)} ${neutral(who.version, 40)}`,
    neutral(os, 60),
    gpus.length ? neutral(gpus.join(', '), 100) : 'no GPU',
  ];
  return `[certify] ${neutral(parts.join(' · '), TITLE_LIMIT)}`;
}

function moduleLine(m) {
  // The count of the checks for each result that occurs, in the order of RESULTS.
  const counts = RESULTS.map((r) => [m.checks.filter((c) => c.result === r).length, r]).filter(([n]) => n > 0).map(([n, r]) => `${n} ${r}`).join(', ');
  const head = `- ${code(m.package.name, 60)} ${code(m.package.version, 60)}${m.id ? ` · id ${code(m.id, 36)}` : ''}${counts ? ` · ${counts}` : ''}:`;
  if (m.evidence.valid === true && m.evidence.reasons.length === 0) return `${head} valid as evidence.`;
  const reasons = m.evidence.reasons.map((r) => code(r, 80)).join(', ');
  return `${head} not valid as evidence${reasons ? `: ${reasons}` : ''}.`;
}

// One row for each failed section, or for each failed check when a module has no sections.
function tableRows(data) {
  const rows = [];
  for (const m of data.modules) {
    const name = `${code(m.package.name, 60)}${m.id ? ` ${code(m.id, 36)}` : ''}`;
    const hasSections = Array.isArray(m.sections);
    for (const r of (hasSections ? m.sections : m.checks).filter((x) => x.result === 'fail')) {
      const label = hasSections ? code(`${r.id}. ${r.name}`, 80) : code(r.name, 128);
      rows.push(`| ${name} | ${label} | ${code(r.result, 20)} | ${code(r.reason, 80)} |`);
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
  const first = data.modules[0];
  const app = data.app ? `app ${code(data.app.name, 40)} ${code(data.app.version, 40)}` : 'one package';
  const head = [
    testMode ? '**Test of the relay.** This issue is never evidence.\n' : null,
    `Certify report sent through the relay: ${app}, created ${code(first.created_utc, 20)} (UTC).`,
    '',
    ...data.modules.slice(0, MODULE_LINES).map(moduleLine),
    data.modules.length > MODULE_LINES ? `- and ${data.modules.length - MODULE_LINES} more modules (see the report file).` : null,
    '',
  ].filter((l) => l !== null);
  const note = typeof data.note === 'string' && neutral(data.note, 10) ? ['### Note', '', quote(data.note), ''] : [];
  const tail = [
    `Report file: [${filePath}](${fileUrl})`,
    `SHA-256: \`${hash}\``,
    '',
    marker(hash),
  ];
  const rows = tableRows(data);
  const shortened = (n) => `The table is shortened: ${n} of ${rows.length} rows. The report file holds all rows.`;
  const make = (kept) => {
    const table = rows.length
      ? ['| Module | Section or check | Result | Reason |', '|---|---|---|---|', ...kept]
      : ['No failed section or check.'];
    if (kept.length < rows.length) table.push('', shortened(kept.length));
    return [...head, ...table, '', ...note, ...tail].join('\n');
  };
  const body = make(rows);
  if (body.length <= BODY_LIMIT) return body;
  // Drop rows from the end. Make room for the shortened line. Each row takes its length and one "\n".
  let excess = body.length - BODY_LIMIT + 2 + shortened(rows.length).length;
  let n = rows.length;
  while (n > 0 && excess > 0) excess -= rows[--n].length + 1;
  return make(rows.slice(0, n));
}
