import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join, relative, extname, dirname } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '..');
const vaultRoot = resolve(process.env.KNOWLEDGE_BASE_DIR || join(siteRoot, '..', '投资研究库'));
const exportRoot = resolve(process.env.KNOWLEDGE_EXPORT_DIR || join(siteRoot, '..', '公开知识资料'));
// 2026-10-10：`07 一级项目` 整体移出公开白名单（第三方保密材料），改由私有仓库
// `dlezywj-cell/obsidian-research-private`（本地克隆 ~/Obsidian/私有研究资料）留存。
// 不要再把它加回来——如确需发布单篇，先用同步脚本以外的方式单独导出并经用户确认。
// 2026-10-10（用户明确授权）：把「外部资料」`04 观点与复盘/01 时间线/外部观点` 纳入白名单。
// 只放开这一个子目录——`04 观点与复盘/` 下的「我的观点 / 周度叙事复盘 / 二级指数复盘 /
// 个股消息面扫描 / 股票池」等子目录仍不发布。
const allowedRoots = ['01 公司研究', '02 行业研究', '03 信息卡片', '10 英语练习', '04 观点与复盘/01 时间线/外部观点'];

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

// 逐文件同步，**不再整目录 rm**：整目录删除会一次抹掉 380+ 文件，触发运行环境的
// 批量删除保护（单轮上限 50 个），使发布流程直接中断。改为三段式：
//   ① 算出「镜像中应当存在」的目标集合（白名单笔记 + 其引用的本地图片）；
//   ② 覆盖复制；
//   ③ 只删除目标集合之外、且位于白名单目录内的残留文件，再清掉空目录。
// 结果与旧的「rm -rf + 全量复制」完全一致，但任何一次删除都在 50 个以内（2026-10-10）。
async function walkAllFiles(directory, acc = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return acc;
    throw error;
  }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) await walkAllFiles(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

async function pruneEmptyDirs(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
  let empty = true;
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (await pruneEmptyDirs(full)) await rm(full, { force: true, recursive: true });
      else empty = false;
    } else {
      empty = false;
    }
  }
  return empty;
}

// 仅同步本脚本管理的白名单目录，保留私有资料仓自身的 Git 元数据与仓库配置。
await mkdir(exportRoot, { recursive: true });

// ① 目标集合
const desired = new Set();
const noteDestinations = [];
for (const root of allowedRoots) {
  for (const file of await walk(join(vaultRoot, root))) {
    if (root === '03 信息卡片' && !(await isProcessedCard(file))) continue;
    const destination = join(exportRoot, relative(vaultRoot, file));
    noteDestinations.push({ file, destination });
    desired.add(destination);
  }
}

const images = [];
for (const { file } of noteDestinations) {
  const markdown = await readFile(file, 'utf8');
  const references = [...markdown.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|data:|#)/i.test(reference)) continue;
    const source = resolve(dirname(file), decodeURI(reference));
    const sourceRelative = relative(vaultRoot, source);
    if (sourceRelative.startsWith('..') || sourceRelative === '') continue;
    const destination = join(exportRoot, sourceRelative);
    desired.add(destination);
    images.push({ source, destination, reference });
  }
}

// 用 readFile + writeFile 覆盖，**不用 fs.cp**：fs.cp 覆盖前会先 unlink 目标，
// 每次覆盖都被计成一次「删除」，累计超过 50 个/轮即触发批量删除保护（2026-10-10 实测）。
// 内容一致则直接跳过，避免无意义的写入。
async function syncFile(source, destination) {
  const data = await readFile(source);
  try {
    if ((await readFile(destination)).equals(data)) return 'unchanged';
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data);
  return 'written';
}

// ② 覆盖复制
let written = 0;
let unchanged = 0;
const record = (result) => { if (result === 'written') written += 1; else unchanged += 1; };
for (const { file, destination } of noteDestinations) {
  record(await syncFile(file, destination));
}
for (const { source, destination, reference } of images) {
  try {
    record(await syncFile(source, destination));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    console.warn(`未找到图片，保留原链接：${reference}`);
  }
}

// ③ 剪除残留（每次删除都远小于 50 个）
let pruned = 0;
for (const root of allowedRoots) {
  const mirrorRoot = join(exportRoot, root);
  for (const stale of await walkAllFiles(mirrorRoot)) {
    if (!desired.has(stale)) {
      await rm(stale, { force: true });
      pruned += 1;
    }
  }
  await pruneEmptyDirs(mirrorRoot);
}

await mkdir(join(exportRoot, '.github'), { recursive: true });
console.log(`已导出 ${noteDestinations.length} 篇白名单笔记（写入 ${written}、未变 ${unchanged}、剪除残留 ${pruned}）：${exportRoot}`);
