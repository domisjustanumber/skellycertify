// Privacy rules 1 to 11 and 17 to 20 of report-format.md section 6, as a pure function.
// Rules 12 to 16 are rules for the writer. A reader cannot check them.
// "String" means each key and each string value of the JSON object, and each line of the
// Markdown part (the text before the fenced json block).

import { KEPT, IPV4_RE } from './issue.js';

export { IPV4_RE }; // rule 20. issue.js holds it, because the issue prints a match as the writer does.

// Each pattern has bounded repeats or a start that only one position of a run can match, so a long
// string costs linear time. stringRule() also tests the length (rule 6) before any pattern.
export const PATH_RE = /(?:\b[A-Za-z]:[\\/]|\\\\[^\\\s]|\/(?:home|Users|root)\/|~[\\/])/; // rule 1
const PRIVATE_KEYS = new Set([ // rule 2, compared in lower case
  'hostname', 'host_name', 'node', 'user', 'username', 'user_name', 'email', 'serial',
  'serial_number', 'uuid', 'mac', 'mac_address', 'bus_id', 'pci_bus_id', 'luid', 'ip', 'ip_address',
]);
export const PCI_RE = /\b(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-7]\b/; // rule 3
export const MAC_RE = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/; // rule 4
// Rule 5 gives no pattern. This is the usual local@domain.tld form. The lookbehind lets a match
// start only at the first character of a local part, so a long run is scanned one time, not once per position.
export const EMAIL_RE = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}/;
const MAX_CHARS = 2000; // rules 6, 11 and 18
const MEDIA_EXT = ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp', '.mp4', '.avi', '.mkv',
  '.mov', '.webm', '.wav', '.mp3', '.flac']; // rule 7, compared in lower case
const REASON_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/; // rule 9 (section 5.2)
const TRACEBACK = 'Traceback (most recent call last)'; // rule 10
const MARKUP_RE = /<|\]\(|\]:|:\/\/|www\./i; // rule 17: the Markdown part needs none of these
const NOTE_RE = new RegExp(`^[\\n${KEPT}]*$`, 'u'); // rule 18: the characters that neutral() keeps, and the line feed
const LINK_RE = /:\/\/|www\./i; // rule 18

// Characters as Python counts them (code points), so the writer and the relay agree.
const tooLong = (s) => s.length > MAX_CHARS && [...s].length > MAX_CHARS;
const isReason = (v) => typeof v === 'string' && REASON_RE.test(v);
const cleanNote = (s) => !tooLong(s) && NOTE_RE.test(s) && !LINK_RE.test(s);

// The lowest rule number (1 to 10) that one string breaks, or 0. A string that breaks rule 6 gives
// 6 at once: no pattern runs on it.
export function stringRule(s) {
  if (tooLong(s)) return 6;
  if (PATH_RE.test(s)) return 1;
  if (PCI_RE.test(s)) return 3;
  if (MAC_RE.test(s)) return 4;
  if (EMAIL_RE.test(s)) return 5;
  const lower = s.toLowerCase();
  if (MEDIA_EXT.some((e) => lower.endsWith(e))) return 7;
  if (s.includes(TRACEBACK)) return 10;
  return 0;
}

// True when an object of the JSON text has the same key two times (rule 19). JSON.parse keeps
// only the last value, so the rules above would not see the first. The text already parsed.
export function duplicateKey(json) {
  const stack = []; // a Set of keys for each open object, null for each open list
  let isKey = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (c === '"') {
      let j = i + 1;
      while (j < json.length && json[j] !== '"') j += json[j] === '\\' ? 2 : 1;
      const keys = stack[stack.length - 1];
      if (isKey && keys) {
        const key = JSON.parse(json.slice(i, j + 1));
        if (keys.has(key)) return true;
        keys.add(key);
      }
      isKey = false;
      i = j;
    } else if (c === '{' || c === '[') {
      stack.push(c === '{' ? new Set() : null);
      isKey = c === '{';
    } else if (c === '}' || c === ']') {
      stack.pop();
    } else if (c === ',') {
      isKey = Boolean(stack[stack.length - 1]);
    }
  }
  return false;
}

// Return the lowest rule number that the report breaks, or 0 when each rule holds.
// markdownLines: the lines before the json block. data: the parsed JSON object. json: its text.
export function privacyRule(markdownLines, data, json = '') {
  let best = 0;
  const take = (r) => { if (r && (!best || r < best)) best = r; };
  const walk = (v) => {
    if (typeof v === 'string') take(stringRule(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) {
        take(PRIVATE_KEYS.has(k.toLowerCase()) ? 2 : stringRule(k));
        if (k === 'reason' && child !== null && !isReason(child)) take(9);
        walk(child);
      }
    }
  };
  for (const line of markdownLines) {
    const r = stringRule(line);
    take(r);
    if (line.includes('![')) take(8);
    if (r !== 6 && MARKUP_RE.test(line)) take(17);
    if (r !== 6 && IPV4_RE.test(line)) take(20);
  }
  walk(data);
  for (const m of Array.isArray(data?.modules) ? data.modules : []) {
    const reasons = m?.evidence?.reasons;
    if (Array.isArray(reasons) && !reasons.every(isReason)) take(9);
  }
  const note = data?.note;
  if (!(note === null || (typeof note === 'string' && !tooLong(note)))) take(11);
  else if (typeof note === 'string' && !cleanNote(note)) take(18);
  else if (typeof note === 'string' && IPV4_RE.test(note)) take(20);
  if (duplicateKey(json)) take(19);
  return best;
}
