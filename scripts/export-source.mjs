import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { resolve, join, relative, extname } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '..');
const vaultRoot = resolve(process.env.KNOWLEDGE_BASE_DIR || join(siteRoot, '..', '投资研究库'));
const exportRoot = resolve(process.env.KNOWLEDGE_EXPORT_DIR || join(siteRoot, '..', '公开知识资料'));
const allowedRoots = ['01 公司研究', '02 行业研究', '03 信息卡片'];

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

// 仅清空本脚本管理的白名单目录，保留私有资料仓自身的 Git 元数据与仓库配置。
await mkdir(exportRoot, { recursive: true });
let count = 0;
for (const root of allowedRoots) {
  await rm(join(exportRoot, root), { recursive: true, force: true });
  for (const file of await walk(join(vaultRoot, root))) {
    if (root === '03 信息卡片' && !(await isProcessedCard(file))) continue;
    const destination = join(exportRoot, relative(vaultRoot, file));
    await mkdir(join(destination, '..'), { recursive: true });
    await cp(file, destination);
    count += 1;
  }
}
await mkdir(join(exportRoot, '.github'), { recursive: true });
console.log(`已导出 ${count} 篇白名单笔记：${exportRoot}`);
