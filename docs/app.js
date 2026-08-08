const state = { notes: [], query: '', category: '全部' };
let controlsTimer;
const $ = (selector) => document.querySelector(selector);
const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const categories = ['全部', '公司研究', '行业研究', '信息卡片'];

function chips(values) { return values?.length ? `<div class="chips">${values.map((x) => `<span>${escape(x)}</span>`).join('')}</div>` : ''; }
function excerpt(markdown) { return markdown.replace(/^#{1,6}\s+/gm, '').replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, '$2$1').replace(/[*_>`]/g, '').replace(/\s+/g, ' ').slice(0, 150); }
function markdown(markdownText) {
  return escape(markdownText)
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>').replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>').replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>').replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, '<span class="wikilink">$2$1</span>')
    .replace(/^(?!<h|<ul|<li|<\/ul|<table|<tr|<td|<th|<\/)(.+)$/gm, '<p>$1</p>');
}
function filtered() {
  const needle = state.query.trim().toLowerCase();
  return state.notes.filter((note) => {
    const categoryMatch = state.category === '全部' || note.category === state.category;
    const haystack = [note.title, note.content, note.path, ...note.companies, ...note.industries, ...note.topics, ...note.tags].join(' ').toLowerCase();
    return categoryMatch && (!needle || haystack.includes(needle));
  });
}
function render() {
  const notes = filtered();
  $('#result-count').textContent = `找到 ${notes.length} 篇笔记`;
  $('#notes').innerHTML = notes.map((note, index) => `<button class="note-card" data-index="${state.notes.indexOf(note)}">
    <div class="note-meta"><span class="badge ${note.category}">${note.category}</span><time>${escape(note.date || '日期未标注')}</time></div>
    <h2>${escape(note.title)}</h2><p>${escape(excerpt(note.content))}${note.content.length > 150 ? '…' : ''}</p>
    ${chips([...note.companies, ...note.industries, ...note.topics].slice(0, 5))}
    <small>${escape(note.path)}</small></button>`).join('') || '<p class="empty">没有匹配的笔记。</p>';
  document.querySelectorAll('.note-card').forEach((card) => card.addEventListener('click', () => openNote(state.notes[card.dataset.index])));
}
function openNote(note) {
  const bodyWithoutTitle = note.content.replace(/^#\s+.+\r?\n+/, '');
  $('#note-detail').innerHTML = `<div class="note-meta"><span class="badge ${note.category}">${note.category}</span><time>${escape(note.date || '日期未标注')}</time></div><h1>${escape(note.title)}</h1>${chips([...note.companies, ...note.industries, ...note.topics, ...note.tags])}<p class="path">${escape(note.path)}</p><div class="markdown">${markdown(bodyWithoutTitle)}</div>`;
  const dialog = $('#note-dialog');
  clearTimeout(controlsTimer);
  dialog.classList.remove('controls-visible');
  dialog.querySelector('article').scrollTop = 0;
  dialog.showModal();
}
function init(data) {
  state.notes = data.notes;
  $('#summary').textContent = `${data.notes.length} 篇可检索笔记，专注于公司、行业与已处理信息。`;
  $('#updated').textContent = `生成于 ${new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}`;
  $('#filters').innerHTML = categories.map((category) => `<button class="filter ${category === state.category ? 'selected' : ''}" data-category="${category}">${category}</button>`).join('');
  $('#stats').innerHTML = categories.slice(1).map((category) => `<div><b>${data.notes.filter((n) => n.category === category).length}</b><span>${category}</span></div>`).join('');
  document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.category; document.querySelectorAll('.filter').forEach((x) => x.classList.toggle('selected', x === button)); render(); }));
  $('#search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  $('#close').addEventListener('click', () => $('#note-dialog').close());
  $('#note-dialog article').addEventListener('scroll', (event) => {
    const dialog = $('#note-dialog');
    dialog.classList.add('controls-visible');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => dialog.classList.remove('controls-visible'), 1700);
  });
  $('#note-dialog').addEventListener('click', (event) => { if (event.target === $('#note-dialog')) $('#note-dialog').close(); });
  render();
}
fetch('data.json', { cache: 'no-store' }).then((response) => response.json()).then(init).catch(() => { $('#summary').textContent = '数据尚未生成，请先运行构建。'; });
