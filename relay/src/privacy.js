// Privacy rules 1 to 11 of report-format.md section 6, as a pure function.
// Rules 12 to 15 are rules for the writer. A reader cannot check them.
// "String" means each key and each string value of the JSON object, and each line of the
// Markdown part (the text before the fenced json block).

const PATH_RE = /(?:\b[A-Za-z]:[\\/]|\\\\[^\\\s]|\/(?:home|Users|root)\/|~[\\/])/; // rule 1
const PRIVATE_KEYS = new Set([ // rule 2, compared in lower case
  'hostname', 'host_name', 'node', 'user', 'username', 'user_name', 'email', 'serial',
  'serial_number', 'uuid', 'mac', 'mac_address', 'bus_id', 'pci_bus_id', 'luid', 'ip', 'ip_address',
]);
const PCI_RE = /\b(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-7]\b/; // rule 3
const MAC_RE = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/; // rule 4
// Rule 5 gives no pattern. This is the usual local@domain.tld form.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}/;
const MAX_CHARS = 2000; // rules 6 and 11
const MEDIA_EXT = ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp', '.mp4', '.avi', '.mkv',
  '.mov', '.webm', '.wav', '.mp3', '.flac']; // rule 7, compared in lower case
const REASON_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/; // rule 9 (section 5.2)
const TRACEBACK = 'Traceback (most recent call last)'; // rule 10

// Characters as Python counts them (code points), so the writer and the relay agree.
const tooLong = (s) => s.length > MAX_CHARS && [...s].length > MAX_CHARS;
const isReason = (v) => typeof v === 'string' && REASON_RE.test(v);

// The lowest rule number (1 to 10) that one string breaks, or 0.
export function stringRule(s) {
  if (PATH_RE.test(s)) return 1;
  if (PCI_RE.test(s)) return 3;
  if (MAC_RE.test(s)) return 4;
  if (EMAIL_RE.test(s)) return 5;
  if (tooLong(s)) return 6;
  const lower = s.toLowerCase();
  if (MEDIA_EXT.some((e) => lower.endsWith(e))) return 7;
  if (s.includes(TRACEBACK)) return 10;
  return 0;
}

// Return the lowest rule number that the report breaks, or 0 when rules 1 to 11 hold.
// markdownLines: the lines before the json block. data: the parsed JSON object.
export function privacyRule(markdownLines, data) {
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
    take(stringRule(line));
    if (line.includes('![')) take(8);
  }
  walk(data);
  for (const m of Array.isArray(data?.modules) ? data.modules : []) {
    const reasons = m?.evidence?.reasons;
    if (Array.isArray(reasons) && !reasons.every(isReason)) take(9);
  }
  const note = data?.note;
  if (!(note === null || (typeof note === 'string' && !tooLong(note)))) take(11);
  return best;
}
