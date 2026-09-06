# 部署指南（Deployment）

本应用是纯静态站点（HTML + JS + CSS 自包含，无后端），可部署到任意静态托管。

## 产物

```bash
pnpm build        # 输出 apps/editor/dist/
```

- 产物自包含：`index.html` + `assets/*.js`（871KB）+ `assets/*.css`（31KB）
- **相对路径**（`base: './'`）：托管到域名根或任意子路径（如 GitHub Pages 的 `/repo-name/`）均可
- 无外部 CDN 依赖，离线可用

## 方式 A：GitHub Pages（推荐，已配好 workflow）

仓库已包含 `.github/workflows/deploy.yml`：

1. 推送代码到 `main` 分支
2. GitHub Actions 自动构建并发布到 Pages
3. 首次使用需在仓库 Settings → Pages → Source 选 **GitHub Actions**

已处理：
- `.nojekyll` 防止 Jekyll 处理（跳过 `assets/_` 目录被忽略）
- `upload-pages-artifact` 上传 `apps/editor/dist`
- `concurrency` 防止并发部署冲突

## 方式 B：Vercel / Cloudflare Pages

1. 构建命令：`pnpm install && pnpm build`
2. 输出目录：`apps/editor/dist`
3. 无需额外配置（相对路径产物直接可用）

## 方式 C：本地预览

```bash
pnpm build
pnpm preview      # vp preview apps/editor
```

## 注意事项

- 数据存浏览器 IndexedDB，**不同域名互相隔离**——换域名部署会丢失已有数据
- 换域名后用户需重新导入备份（设置 → 数据备份）
- 建议在正式域名上提示用户定期导出备份（见 USER_GUIDE.md）
