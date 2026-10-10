# 投资研究知识看板（私有）

从本地 Obsidian 知识库生成的纯静态网页。**2026-10-10 起不再对外公开**：原公开看板仓库已转为
private、Pages 随之下线，本仓库改为在 Vercel 上部署一个**需要登录才能打开**的私有看板。

网页构建时只会读取：

- `01 公司研究/`
- `02 行业研究/`
- `03 信息卡片/` 中 frontmatter 标记为 `status: 已处理` 的笔记
- `10 英语练习/` 中的 Markdown 笔记

工作计划、收件箱、系统记录、附件、观点复盘、产品技术、宏观策略和模板均不在读取白名单中；构建程序无法读取这些目录。

⚠️ `07 一级项目/` 自 2026-10-10 起**整体移出白名单**：该目录存放第三方保密材料（BP、法律/财务尽调、高管会议纪要、股东会决议、融资计划等），
完整副本改由私有仓库 `dlezywj-cell/obsidian-research-private`（本地克隆 `~/Obsidian/私有研究资料`）留存。
构建程序不再读取该目录，`status: 已处理` 也不再具有发布效力。

## 本地更新

在本目录运行：

```bash
npm run build
npm run dev
```

默认从相邻的 `投资研究库` 读取内容。若资料库另有位置，可在构建时设置 `KNOWLEDGE_BASE_DIR`。

## 私有部署（Vercel）

云端没有本机知识库，而 `scripts/build.mjs` 需要读 `投资研究库` 才能运行，所以**云端不构建**：
`docs/` 由本地 `npm run build` 生成并提交进仓库，Vercel 只负责静态发布。
`vercel.json` 已声明跳过依赖安装与构建、输出目录指向 `docs/`。

首次部署：

1. 用 GitHub 账号登录 <https://vercel.com>（Hobby 免费套餐即可，个人用途）。
2. Add New… → Project → 授权 Vercel 访问 GitHub，选择 `obsidian-research-board` 仓库。
3. 框架预设与构建参数会被 `vercel.json` 覆盖，直接 Deploy。
4. 部署完成后进入 **Settings → Deployment Protection**，把 **Vercel Authentication**
   的范围选为 **All Deployments**（免费）——此后访问部署域名会要求登录有权限的 Vercel 账号，
   达到「只有自己能打开」。手机与电脑各登录一次，之后靠 cookie 长期免登录。

### 内容更新流程

`docs/` 不会自动重建（云端没有源库）。知识库有改动后，在本地跑：

```bash
cd ~/Obsidian/公开知识看板
npm run build
git add docs && git commit -m "更新看板产物" && git push
```

推送后 Vercel 自动重新部署。

> ⚠️ 部署域名在公网，但受 Deployment Protection 保护，**未登录访客只会看到登录页**。
> 不要为图方便关掉保护——那等同于回到公开状态。

> 📌 `.github/workflows/publish.yml` 与 GitHub Pages 相关的部署方式**已停用并删除**：
> 它依赖 `github-pages` 环境和公开 Pages，且需要从私有源仓 checkout 构建。
> GitHub Pages 在 Free/Pro 套餐下**无法做到站点私有**（只有 Enterprise Cloud 可以），
> 因此在线看板改走 Vercel。

## 历史：原公开发布结构（已停用）

早期使用两个仓库：`公开知识资料`（私有导出仓）+ 本仓库（公开网页仓），由 GitHub Actions
checkout 私有源仓后构建并发布至 GitHub Pages。该链路已于 2026-10-10 整体关停。
