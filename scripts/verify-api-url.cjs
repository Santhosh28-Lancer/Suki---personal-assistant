// Dependency-free regression checks for the URL bug shown in the user's screenshot.
const { URL } = require('node:url');
function resolveApiUrl(raw) {
  const value = (raw ?? '').trim();
  if (!value) return null;
  let candidate = value;
  if (/^[\w.-]+:\d+(\/|$)/.test(candidate)) candidate = `http://${candidate}`;
  try { const parsed = new URL(candidate); return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString().replace(/\/$/, '') : null; }
  catch { return null; }
}
const cases = [
  ['', null], ['   ', null], ['192.168.0.8:8000/api/chat', 'http://192.168.0.8:8000/api/chat'],
  ['http://192.168.0.8:8000/api/chat', 'http://192.168.0.8:8000/api/chat'],
  ['https://example.com/api/chat', 'https://example.com/api/chat'], ['file:///tmp/a', null], ['not a url', null]
];
for (const [input, expected] of cases) {
  const actual = resolveApiUrl(input);
  if (actual !== expected) throw new Error(`${JSON.stringify(input)} => ${actual}; expected ${expected}`);
}
console.log(`PASS: ${cases.length} API URL regression cases`);
