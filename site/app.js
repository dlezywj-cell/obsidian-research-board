const state = { notes: [], query: '', category: '全部' };
let controlsTimer;
const $ = (selector) => document.querySelector(selector);
const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const categories = ['全部', '公司研究', '行业研究', '信息卡片'];

function chips(values) { return values?.length ? `<div class="chips">${values.map((x) => `<span>${escape(x)}</span>`).join('')}</div>` : ''; }
function excerpt(markdown) { return markdown.replace(/^#{1,6}\s+/gm, '').replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, '$2$1').replace(/[*_>`]/g, '').replace(/\s+/g, ' ').slice(0, 150); }
// 行内格式：图片 → 粗体 → 行内代码 → 双链 → 标准链接。
function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" referrerpolicy="no-referrer">')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, '<span class="wikilink">$2$1</span>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)\n]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}
function isTableDivider(line = '') {
  return /^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(line);
}
// 逐行块级解析：代码围栏、表格、标题、分隔线、图片、引用块、无序/有序列表、段落。
// 所有块级判定都要求从第 0 列开始，与库内正文（含公众号原文转存）的既有排版保持一致。
function markdown(markdownText) {
  const lines = escape(markdownText).split('\n');
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/.test(line)) {
      const buffer = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) { buffer.push(lines[index]); index += 1; }
      output.push(`<pre><code>${buffer.join('&#10;')}</code></pre>`);
      continue;
    }
    if (/^\s*\|/.test(line) && isTableDivider(lines[index + 1])) {
      const heads = tableCells(line);
      const align = tableCells(lines[index + 1]).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
      });
      const style = (position) => (align[position] ? ` style="text-align:${align[position]}"` : '');
      const rows = [];
      let cursor = index + 2;
      while (cursor < lines.length && /^\s*\|/.test(lines[cursor])) { rows.push(tableCells(lines[cursor])); cursor += 1; }
      const head = heads.map((cell, position) => `<th${style(position)}>${cell}</th>`).join('');
      const body = rows.map((row) => `<tr>${heads.map((cell, position) => `<td${style(position)}>${row[position] ?? ''}</td>`).join('')}</tr>`).join('');
      output.push(`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      index = cursor - 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { output.push('<hr>'); continue; }
    if (/^!\[/.test(line)) { output.push(inline(line)); continue; }
    // 引用块：escape() 已把行首的 > 转成 &gt;，因此按实体匹配。
    if (/^&gt;/.test(line)) {
      const quotes = [];
      while (index < lines.length && /^&gt;/.test(lines[index])) {
        const text = lines[index].replace(/^&gt;[ \t]?/, '').trim();
        if (text) quotes.push(text);
        index += 1;
      }
      index -= 1;
      output.push(`<blockquote>${quotes.map((text) => `<p>${inline(text)}</p>`).join('')}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      index -= 1;
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      index -= 1;
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (!line.trim()) { output.push(''); continue; }
    output.push(`<p>${inline(line.trim())}</p>`);
  }
  return output.join('\n');
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
fetch('data.json').then((response) => response.json()).then(init).catch(() => { $('#summary').textContent = '数据尚未生成，请先运行构建。'; });
