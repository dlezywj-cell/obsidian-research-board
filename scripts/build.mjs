import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, join, dirname, extname, basename } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '..');
const vaultRoot = resolve(process.env.KNOWLEDGE_BASE_DIR || join(siteRoot, '..', '投资研究库'));
const outputRoot = resolve(siteRoot, 'docs');
// 2026-10-10：`07 一级项目` 整体移出公开白名单，与 scripts/export-source.mjs 保持一致。
// 该目录为第三方保密材料，完整副本存于私有仓库 dlezywj-cell/obsidian-research-private。
// 2026-10-10（用户明确授权）：新增「外部观点」子目录 `04 观点与复盘/01 时间线/外部观点`；
// `04 观点与复盘/` 其余子目录仍不发布。两个脚本的 allowedRoots 必须同改。
const allowedRoots = ['01 公司研究', '02 行业研究', '03 信息卡片', '10 英语练习', '04 观点与复盘/01 时间线/外部观点'];

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
  if (relativePath.startsWith('04 观点与复盘/01 时间线/外部观点/')) return '外部观点';
  if (relativePath.startsWith('10 英语练习/')) return '英语';
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
  // 信息卡片必须明确标为“已处理”；公司研究、行业研究、外部观点及英语练习完整保留。
  if (category === '信息卡片' && frontmatter.status !== '已处理') continue;
  // 发布时刻：取笔记文件在库内的最后写入时间（mtime）。
  // 用于同一天内的次序——「最新发布的排在最前」。文件缺失时退化为空串，排到该日末尾。
  let updatedAt = '';
  try { updatedAt = (await stat(file)).mtime.toISOString(); } catch { updatedAt = ''; }
  notes.push({
    id: path.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''),
    title: titleOf(body, file),
    category,
    path,
    date: frontmatter.date || '',
    updatedAt,
    status: frontmatter.status || '',
    importance: frontmatter.importance || '',
    companies: normalizeList(frontmatter.companies),
    industries: normalizeList(frontmatter.industries),
    topics: normalizeList(frontmatter.topics),
    tags: normalizeList(frontmatter.tags),
    content: body,
  });
}
// 排序：① 日期倒序（近的在前）→ ② 同日按发布时刻（文件 mtime）倒序（最新发布的在前）
// → ③ 兜底按标题 zh-CN 升序，保证 mtime 相同（同批落库）时次序稳定可复现。
notes.sort((a, b) => (b.date || '').localeCompare(a.date || '')
  || (b.updatedAt || '').localeCompare(a.updatedAt || '')
  || a.title.localeCompare(b.title, 'zh-CN'));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const asset of ['index.html', 'app.js', 'styles.css', 'mobile.css']) {
  await writeFile(join(outputRoot, asset), await readFile(join(siteRoot, 'site', asset), 'utf8'));
}
await writeFile(join(outputRoot, 'data.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  policy: '仅发布公司研究、行业研究、外部观点与英语练习，以及状态为“已处理”的信息卡片。',
  notes,
}, null, 2));
await writeFile(join(outputRoot, '.nojekyll'), '');
console.log(`已生成 ${notes.length} 篇公开笔记：${outputRoot}`);
