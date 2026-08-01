import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, join, dirname, extname, basename } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '..');
const vaultRoot = resolve(process.env.KNOWLEDGE_BASE_DIR || join(siteRoot, '..', '投资研究库'));
const outputRoot = resolve(siteRoot, 'docs');
const allowedRoots = ['01 公司研究', '02 行业研究', '03 信息卡片'];

function parseScalar(value) {
  const clean = value.trim().replace(/^['"]|['"]$/g, '');
  if (/^\[.*\]$/.test(clean)) return clean.slice(1, -1).split(',').map((item) => parseScalar(item)).filter(Boolean);
  return clean;
}

function parseFrontmatter(raw) {
  const matched = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  // 部分历史笔记漏写了 frontmatter 的结束线；只在紧随一级标题时兼容读取。
  const legacyEnd = !matched && raw.startsWith('---\n') ? raw.search(/\r?\n\r?\n(?=#\s)/) : -1;
  if (!matched && legacyEnd === -1) return [{}, raw];
  const header = matched ? matched[1] : raw.slice(4, legacyEnd);
  const body = matched ? raw.slice(matched[0].length) : raw.slice(legacyEnd).trim();
  const frontmatter = {};
  let activeKey = null;
  for (const line of header.split(/\r?\n/)) {
    const property = line.match(/^([\w-]+):\s*(.*)$/);
    if (property) {
      activeKey = property[1];
      frontmatter[activeKey] = property[2] ? parseScalar(property[2]) : [];
      continue;
    }
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && activeKey && Array.isArray(frontmatter[activeKey])) frontmatter[activeKey].push(parseScalar(item[1]));
  }
  return [frontmatter, body.trim()];
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(entries.map(async (entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(file);
    return extname(entry.name).toLowerCase() === '.md' ? [file] : [];
  }));
  return children.flat();
}

function typeFor(relativePath) {
  if (relativePath.startsWith('01 公司研究/')) return '公司研究';
  if (relativePath.startsWith('02 行业研究/')) return '行业研究';
  return '信息卡片';
}

function titleOf(body, file) {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(file, '.md');
}

function normalizeList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

const allFiles = (await Promise.all(allowedRoots.map((path) => filesIn(join(vaultRoot, path))))).flat();
const notes = [];
for (const file of allFiles) {
  const raw = await readFile(file, 'utf8');
  const [frontmatter, body] = parseFrontmatter(raw);
  const path = relative(vaultRoot, file).split('\\').join('/');
  const category = typeFor(path);
  // 信息卡片必须明确标为“已处理”；公司与行业研究完整保留。
  if (category === '信息卡片' && frontmatter.status !== '已处理') continue;
  notes.push({
    id: path.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''),
    title: titleOf(body, file),
    category,
    path,
    date: frontmatter.date || '',
    status: frontmatter.status || '',
    importance: frontmatter.importance || '',
    companies: normalizeList(frontmatter.companies),
    industries: normalizeList(frontmatter.industries),
    topics: normalizeList(frontmatter.topics),
    tags: normalizeList(frontmatter.tags),
    content: body,
  });
}
notes.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title, 'zh-CN'));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const asset of ['index.html', 'app.js', 'styles.css']) {
  await writeFile(join(outputRoot, asset), await readFile(join(siteRoot, 'site', asset), 'utf8'));
}
await writeFile(join(outputRoot, 'data.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  policy: '仅发布公司研究、行业研究和状态为“已处理”的信息卡片。',
  notes,
}, null, 2));
await writeFile(join(outputRoot, '.nojekyll'), '');
console.log(`已生成 ${notes.length} 篇公开笔记：${outputRoot}`);
