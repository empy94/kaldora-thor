const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const output = path.join(root, 'build', 'firefox-extension');
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync(path.join(__dirname, 'game-adapter.cjs'), 'utf8');
const start = source.indexOf('function inputs()');
const end = source.indexOf('let snapshot, currentPage;');
if (start < 0 || end <= start) throw new Error('Game adapter source not found');
const page = `(() => {
${source.slice(start,end)}
let active = false;
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (event.data?.type === 'kaldora-thor-init') { active = true; return; }
  if (event.data?.type !== 'kaldora-thor-request') return;
  const { id, command } = event.data;
  if (!active) {
    if (command != null || !/^#thor=[a-f0-9]{64}$/.test(location.hash)) return;
    active = true;
  }
  let result;
  try {
    result = command == null ? view(inputs) : Boolean(valid(command) && action(command));
  } catch {
    result = command == null ? { online:false } : false;
  }
  window.postMessage({ type: 'kaldora-thor-reply', id, result }, location.origin);
});
})();`;
fs.writeFileSync(path.join(output,'game.js'),page);
for (const file of ['manifest.json', 'content.js', 'background.js'])
  fs.copyFileSync(path.join(root, 'extension', file),path.join(output,file));
