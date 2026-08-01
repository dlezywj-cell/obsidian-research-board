# 投资研究知识看板

这是从本地 Obsidian 知识库生成的纯静态网页。网页构建时只会读取：

- `01 公司研究/`
- `02 行业研究/`
- `03 信息卡片/` 中 frontmatter 标记为 `status: 已处理` 的笔记

工作计划、一级项目、收件箱、系统记录、附件、观点复盘、产品技术、宏观策略和模板均不在读取白名单中；构建程序无法读取这些目录。

## 本地更新

在本目录运行：

```bash
npm run build
npm run dev
```

默认从相邻的 `投资研究库` 读取内容。若资料库另有位置，可在构建时设置 `KNOWLEDGE_BASE_DIR`。

## GitHub 发布结构

建议使用两个仓库：

1. 私有资料仓：保存从本地导出的允许发布内容；不保存工作计划与一级项目。
2. 公开网页仓：保存本项目。GitHub Actions checkout 私有资料仓后运行构建，再将 `dist/` 发布至 GitHub Pages。

在公开网页仓的 GitHub 设置中添加：

- Repository variable：`KNOWLEDGE_SOURCE_REPOSITORY`，值为私有资料仓的 `账户名/仓库名`。
- Repository secret：`KNOWLEDGE_REPO_TOKEN`，值为一个仅具有该私有资料仓 Contents: Read 权限的 fine-grained personal access token。

私有资料仓只需要同步这三个目录：`01 公司研究/`、`02 行业研究/`、`03 信息卡片/`。即使错误放入了其他目录，网页构建器也会拒绝读取。

公开网页会包含生成后的笔记正文，因此只有确定可公开的内容才应进入私有资料仓的发布分支。首次部署可直接将 `docs/` 设置为 GitHub Pages 的发布目录；配置好私有仓读取凭证后，再从 Actions 页面手动运行仓库附带的更新任务。
