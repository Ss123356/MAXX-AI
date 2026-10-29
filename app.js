'use strict';
/* MAXX AI frontend. Demo mode only: no AI service, no API keys in the browser. */
const $ = s => document.querySelector(s);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const KEY = 'maxx.frontend.v1';
const SUGGESTIONS = [
  ['Write and create', 'Help me write a short story about a lighthouse keeper.'],
  ['Learn something new', 'Explain how neural networks learn, step by step.'],
  ['Code and debug', 'Write a Python function that removes duplicates from a list.'],
  ['Analyze an idea', 'Analyze the strengths and risks of a student study-planner app.']];
let state = load(), files = [], busy = null, job = 0;
const chat = () => state.chats.find(c => c.id === state.active);
const lastUser = c => { for (let i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].role === 'user') return i; return -1; };

/* ---- storage (browser-local demo storage; final app should use SQLite) ---- */
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.chats)) return s; } catch (e) { /* corrupted: start fresh */ }
  return { chats: [], active: null, collapsed: false, model: 'MAXX Standard' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Could not save: storage unavailable'); } }
function toast(t) { const n = el('div', 'toast', t); $('#toasts').append(n); setTimeout(() => n.remove(), 2200); }
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Copied to clipboard'); } catch (e) { toast('Copy failed: clipboard unavailable'); } }

/* ---- BACKEND INTEGRATION BOUNDARY ----
   Replace the demo branch with a call to your Python/PySide6 backend.
   window.maxxBackend.send is a hypothetical hook a future Qt WebChannel could provide;
   in a normal browser it is absent and the demo reply is used. */
function sendMessageToBackend(message, attachments) {
  if (window.maxxBackend && typeof window.maxxBackend.send === 'function') {
    return Promise.resolve(window.maxxBackend.send(message, attachments.map(f => f.name))).then(t => ({ text: String(t), demo: false }));
  }
  return new Promise(res => setTimeout(() => res({ demo: true,
    text: 'Demo response: placeholder text, not a real AI answer. You wrote:\n\n```text\n' + message.slice(0, 300) + '\n```\n\nConnect the Python backend to get real answers.' }), 900));
}

/* ---- rendering (DOM + textContent only, no innerHTML) ---- */
function render() {
  document.body.classList.toggle('collapsed', !!state.collapsed);
  renderHistory(); renderMessages(); setBusy();
  $('#title').textContent = chat() ? chat().title : 'New chat';
  $('#model').value = state.model;
}
function renderHistory() {
  const q = $('#search').value.trim().toLowerCase(), box = $('#history'); box.replaceChildren();
  const list = state.chats.filter(c => !q || (c.title + ' ' + c.messages.map(m => m.text).join(' ')).toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
  if (!list.length) { box.append(el('p', 'empty', q ? 'No matching chats' : 'No conversations yet')); return; }
  const day = 864e5, now = Date.now(), seen = new Set();
  const groups = [['Pinned', c => c.pinned], ['Today', c => now - c.updated < day], ['Yesterday', c => now - c.updated < 2 * day], ['Previous 7 Days', c => now - c.updated < 7 * day], ['Older', () => true]];
  for (const [name, fn] of groups) {
    const items = list.filter(c => !seen.has(c.id) && fn(c)); if (!items.length) continue;
    box.append(el('h3', 'grp', name));
    for (const c of items) {
      seen.add(c.id);
      const row = el('div', 'item' + (c.id === state.active ? ' on' : ''));
      const b = el('button', 't', c.title); b.onclick = () => { state.active = c.id; save(); render(); closeDrawer(); };
      const m = el('button', 'dots', '...'); m.setAttribute('aria-label', 'Conversation menu'); m.onclick = e => { e.stopPropagation(); openMenu(m, c); };
      row.append(b, m); box.append(row);
    }
  }
}
function openMenu(anchor, c) {
  closeMenu(); const m = el('div', 'menu'); m.id = 'menu';
  const actions = [
    ['Rename', () => { const t = prompt('Rename conversation', c.title); if (t && t.trim()) { c.title = t.trim().slice(0, 80); save(); render(); } }],
    [c.pinned ? 'Unpin' : 'Pin', () => { c.pinned = !c.pinned; save(); render(); }],
    ['Delete', () => { if (confirm('Delete this conversation?')) { state.chats = state.chats.filter(x => x !== c); if (state.active === c.id) state.active = null; save(); render(); toast('Conversation deleted'); } }]];
  actions.forEach(([l, f]) => { const b = el('button', null, l); b.onclick = () => { closeMenu(); f(); }; m.append(b); });
  document.body.append(m); const r = anchor.getBoundingClientRect(); m.style.top = r.bottom + 4 + 'px'; m.style.left = Math.min(r.left, innerWidth - 150) + 'px';
}
function closeMenu() { const m = $('#menu'); if (m) m.remove(); }
function renderMessages() {
  const box = $('#messages'), c = chat(); box.replaceChildren();
  if (!c || !c.messages.length) { box.append(welcome()); return; }
  c.messages.forEach((m, i) => box.append(msgNode(m, i, c)));
  if (busy) { const t = el('div', 'msg typing'); const i = el('img'); i.src = 'assets/maxx-mark.svg'; i.alt = 'MAXX AI is thinking'; t.append(i); box.append(t); }
  box.scrollTop = box.scrollHeight;
}
function welcome() {
  const w = el('div', 'welcome'), i = el('img', 'hero'); i.src = 'assets/maxx-mark.svg'; i.alt = 'MAXX AI logo';
  w.append(i, el('h2', null, 'What can I help you create?'), el('p', 'sub', 'Ask anything, or start with one of these.'));
  const g = el('div', 'cards');
  SUGGESTIONS.forEach(([t, p]) => { const b = el('button', 'card'); b.append(el('strong', null, t), el('span', null, p)); b.onclick = () => { $('#input').value = p; grow(); setBusy(); $('#input').focus(); }; g.append(b); });
  w.append(g); return w;
}
const act = (l, f) => { const b = el('button', 'act', l); b.onclick = f; return b; };
function msgNode(m, i, c) {
  const n = el('article', 'msg ' + m.role); n.append(el('div', 'who', m.role === 'user' ? 'You' : 'MAXX AI' + (m.demo ? ' (demo)' : '')));
  const body = el('div', 'body'); body.append(...md(m.text)); n.append(body);
  if (m.files && m.files.length) n.append(el('div', 'files', 'Attached: ' + m.files.join(', ')));
  const a = el('div', 'acts'); a.append(act('Copy', () => copy(m.text)));
  if (m.role === 'user' && i === lastUser(c)) a.append(act('Edit', editLast));
  if (m.role === 'assistant' && i === c.messages.length - 1) a.append(act('Retry', retry));
  a.append(act('Delete', () => { c.messages.splice(i, 1); save(); render(); })); n.append(a); return n;
}
/* tiny safe renderer: fenced code, "- " lists, "# " headings, paragraphs */
function md(t) {
  const out = [];
  String(t).split('```').forEach((seg, k) => {
    if (k % 2) {
      const nl = seg.indexOf('\n'), lang = nl < 0 ? 'text' : (seg.slice(0, nl).trim() || 'text'), code = (nl < 0 ? seg : seg.slice(nl + 1)).replace(/\n$/, '');
      const w = el('div', 'code'), h = el('div', 'ch'); h.append(el('span', null, lang), act('Copy code', () => copy(code)));
      const p = el('pre'); p.append(el('code', null, code)); w.append(h, p); out.push(w);
    } else seg.split(/\n{2,}/).forEach(p => {
      p = p.trim(); if (!p) return;
      if (/^- /.test(p)) { const u = el('ul'); p.split('\n').forEach(l => u.append(el('li', null, l.replace(/^- /, '')))); out.push(u); }
      else if (/^#{1,3} /.test(p)) out.push(el('h4', null, p.replace(/^#+ /, '')));
      else out.push(el('p', null, p));
    });
  });
  return out;
}

/* ---- sending ---- */
async function send(text) {
  text = text.trim(); if (!text || busy) return;
  let c = chat();
  if (!c) { c = { id: uid(), title: text.slice(0, 40), pinned: false, updated: Date.now(), messages: [] }; state.chats.push(c); state.active = c.id; }
  const fl = files; files = []; renderChips();
  c.messages.push({ role: 'user', text, files: fl.map(f => f.name), t: Date.now() }); // only file names are stored
  $('#input').value = ''; grow(); await reply(c, text, fl);
}
async function reply(c, text, fl) {
  const my = ++job; busy = c.id; save(); render();
  let msg;
  try { const r = await sendMessageToBackend(text, fl); msg = { role: 'assistant', text: r.text, demo: !!r.demo, t: Date.now() }; }
  catch (e) { msg = { role: 'assistant', text: 'Error: ' + ((e && e.message) || 'request failed') + '. Check your connection and retry.', t: Date.now() }; }
  if (job !== my) return; // stopped by the user
  c.messages.push(msg); busy = null; c.updated = Date.now(); save(); render();
}
function stop() { job++; busy = null; render(); toast('Generation stopped'); }
function editLast() { const c = chat(), i = c ? lastUser(c) : -1; if (busy || i < 0) return; $('#input').value = c.messages[i].text; c.messages.length = i; save(); render(); grow(); setBusy(); $('#input').focus(); }
function retry() { const c = chat(); if (!c || busy) return; if (c.messages.at(-1) && c.messages.at(-1).role === 'assistant') c.messages.pop(); const i = lastUser(c); if (i >= 0) reply(c, c.messages[i].text, []); }

/* ---- composer ---- */
function grow() { const t = $('#input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }
function setBusy() { const b = $('#send'); b.textContent = busy ? '\u25A0' : '\u2191'; b.setAttribute('aria-label', busy ? 'Stop generating' : 'Send message'); b.disabled = !busy && !$('#input').value.trim(); }
function renderChips() {
  const box = $('#chips'); box.replaceChildren();
  files.forEach((f, i) => { const c = el('span', 'chip', f.name + ' '), x = el('button', null, 'x'); x.setAttribute('aria-label', 'Remove ' + f.name); x.onclick = () => { files.splice(i, 1); renderChips(); }; c.append(x); box.append(c); });
}
$('#input').addEventListener('input', () => { grow(); setBusy(); });
$('#input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send($('#input').value); } });
$('#send').onclick = () => busy ? stop() : send($('#input').value);
$('#attach').onclick = () => $('#file').click();
$('#file').onchange = e => { files.push(...e.target.files); e.target.value = ''; renderChips(); };

/* ---- chrome ---- */
const isMobile = () => innerWidth <= 760;
function closeDrawer() { document.body.classList.remove('open'); }
function newChat() { state.active = null; save(); render(); closeDrawer(); $('#input').focus(); }
function clearAll() { if (confirm('Delete ALL conversations? This cannot be undone.')) { state.chats = []; state.active = null; save(); render(); toast('All conversations cleared'); } }
$('#newChat').onclick = newChat;
$('#toggle').onclick = () => { if (isMobile()) document.body.classList.toggle('open'); else { state.collapsed = !state.collapsed; save(); render(); } };
$('#backdrop').onclick = closeDrawer;
$('#search').oninput = renderHistory;
$('#model').onchange = e => { state.model = e.target.value; save(); toast('Model set to ' + state.model + ' (UI only)'); };
$('#clearAll').onclick = clearAll;
$('#clearAll2').onclick = e => { e.preventDefault(); $('#settings').close(); clearAll(); };
$('#openSettings').onclick = () => $('#settings').showModal();
$('#exportBtn').onclick = () => {
  const c = chat(); if (!c || !c.messages.length) return toast('Nothing to export yet');
  const txt = '# ' + c.title + '\n\n' + c.messages.map(m => '**' + (m.role === 'user' ? 'You' : 'MAXX AI') + ':** ' + m.text).join('\n\n');
  const a = el('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/markdown' })); a.download = c.title.replace(/[^\w-]+/g, '_') + '.md'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Exported as Markdown');
};
document.addEventListener('click', closeMenu);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMenu(); closeDrawer(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
});
render();
