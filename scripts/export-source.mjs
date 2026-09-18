import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { resolve, join, relative, extname, dirname } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '..');
const vaultRoot = resolve(process.env.KNOWLEDGE_BASE_DIR || join(siteRoot, '..', '投资研究库'));
const exportRoot = resolve(process.env.KNOWLEDGE_EXPORT_DIR || join(siteRoot, '..', '公开知识资料'));
const allowedRoots = ['01 公司研究', '02 行业研究', '03 信息卡片', '07 一级项目'];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : extname(entry.name) === '.md' ? [path] : [];
  }))).flat();
}

async function isProcessedCard(file) {
  const first = (await readFile(file, 'utf8')).slice(0, 3000);
  return /^status:\s*已处理\s*$/m.test(first);
}

async function isProcessedProject(file) {
  const first = (await readFile(file, 'utf8')).slice(0, 3000);
  const frontmatter = first.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  return /^status:\s*已处理\s*$/m.test(frontmatter);
}

async function copyReferencedLocalImages(file) {
  const markdown = await readFile(file, 'utf8');
  const references = [...markdown.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|data:|#)/i.test(reference)) continue;
    const source = resolve(dirname(file), decodeURI(reference));
    const sourceRelative = relative(vaultRoot, source);
    if (sourceRelative.startsWith('..') || sourceRelative === '') continue;
    try {
      await mkdir(join(exportRoot, dirname(sourceRelative)), { recursive: true });
      await cp(source, join(exportRoot, sourceRelative));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      console.warn(`未找到图片，保留原链接：${reference}`);
    }
  }
}

// 仅清空本脚本管理的白名单目录，保留私有资料仓自身的 Git 元数据与仓库配置。
await mkdir(exportRoot, { recursive: true });
let count = 0;
for (const root of allowedRoots) {
  await rm(join(exportRoot, root), { recursive: true, force: true });
  for (const file of await walk(join(vaultRoot, root))) {
    if (root === '03 信息卡片' && !(await isProcessedCard(file))) continue;
    if (root === '07 一级项目' && !(await isProcessedProject(file))) continue;
    const destination = join(exportRoot, relative(vaultRoot, file));
    await mkdir(join(destination, '..'), { recursive: true });
    await cp(file, destination);
    await copyReferencedLocalImages(file);
    count += 1;
  }
}
await mkdir(join(exportRoot, '.github'), { recursive: true });
console.log(`已导出 ${count} 篇白名单笔记：${exportRoot}`);
