# 投资研究知识看板

这是从本地 Obsidian 知识库生成的纯静态网页。网页构建时只会读取：

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

## GitHub 发布结构

建议使用两个仓库：

1. 私有资料仓：保存从本地导出的允许发布内容；不保存工作计划与一级项目（一级项目另存于独立的私有保密仓）。
2. 公开网页仓：保存本项目。GitHub Actions checkout 私有资料仓后运行构建，再将 `dist/` 发布至 GitHub Pages。

在公开网页仓的 GitHub 设置中添加：

- Repository variable：`KNOWLEDGE_SOURCE_REPOSITORY`，值为私有资料仓的 `账户名/仓库名`。
- Repository secret：`KNOWLEDGE_REPO_TOKEN`，值为一个仅具有该私有资料仓 Contents: Read 权限的 fine-grained personal access token。

私有资料仓仅同步：`01 公司研究/`、`02 行业研究/`、已处理的 `03 信息卡片/`，以及 `10 英语练习/`。即使错误放入其他目录，网页构建器也会拒绝读取。

公开网页会包含生成后的笔记正文，因此只有确定可公开的内容才应进入私有资料仓的发布分支。首次部署可直接将 `docs/` 设置为 GitHub Pages 的发布目录；配置好私有仓读取凭证后，再从 Actions 页面手动运行仓库附带的更新任务。
