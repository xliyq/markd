/**
 * 导出（M3.1 导出 Markdown zip）
 *
 * zip = .md 原文 + assets/ 文件夹（未配图床时，R15 决策）；
 * 已配图床（全部 remote）或文档无本地资产时导出纯 .md。
 *
 * Markdown 里引用 assets/xxx.png 相对路径（可移植，03 §3.3 双键设计），
 * zip 内 assets/ 保持同构，解压后相对引用不破。
 */
import JSZip from 'jszip'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import type { AppModuleManifest, AppApi } from '@editor/core'

export interface ExportOptions {
  /** 文档名称（作为 .md 文件名，默认取节点名） */
  name?: string
}

export interface ExportModule {
  /** 导出单文档为 zip（.md + assets/）并触发下载 */
  exportDoc: (docId: string, options?: ExportOptions) => Promise<number>
  /** 导出单文档为独立 HTML（自带样式可发布，M3.2）并触发下载 */
  exportHtml: (docId: string, options?: ExportOptions) => Promise<string>
}

/**
 * 构建导出 zip（纯函数，可单测）。
 * zip = {name}.md + assets/（T1 本地/base64；remote 跳过）
 */
export async function buildDocZip(
  storage: AppApi['storage'],
  docId: string,
  options?: ExportOptions,
): Promise<JSZip> {
  const st = storage
  if (!st) throw new Error('[export] storage 未注入')
  const node = await st.getNode(docId)
  const content = await st.getDocContent(docId)
  if (!content) throw new Error(`[export] 文档不存在: ${docId}`)

  const fileName = options?.name ?? node?.name ?? 'document'
  const zip = new JSZip()

  // .md 原文（唯一事实源）
  zip.file(`${fileName}.md`, content.content)

  // 本地资产：T1 local/base64 打包；remote 跳过（R15：配图床导出纯 .md）
  const assets = await st.listAssets(docId)
  for (const a of assets) {
    if (a.tier === 'remote') continue
    if (a.blob) {
      // Blob → ArrayBuffer：jszip 对非 Node 环境的 Blob 兼容不佳
      zip.file(a.relPath, await a.blob.arrayBuffer())
    } else if (a.base64) {
      zip.file(a.relPath, a.base64, { base64: true })
    }
  }

  return zip
}

export function createExportModule(api: AppApi): ExportModule {
  async function exportDoc(docId: string, options?: ExportOptions): Promise<number> {
    const zip = await buildDocZip(api.storage, docId, options)

    const node = await api.storage?.getNode(docId)
    const fileName = options?.name ?? node?.name ?? 'document'

    // 生成 blob 并触发下载
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    return (await api.storage?.listAssets(docId))?.length ?? 0
  }

  /**
   * 导出独立 HTML（M3.2）：markdown → remark → rehype → 完整 HTML（自带样式）。
   * 返回 HTML 字符串（调用方决定下载/预览）。
   */
  async function exportHtml(docId: string, options?: ExportOptions): Promise<string> {
    const doc = await api.storage?.getDocContent(docId)
    if (!doc) throw new Error(`[export] 文档不存在: ${docId}`)
    const node = await api.storage?.getNode(docId)
    const fileName = options?.name ?? node?.name ?? 'document'

    // GFM + HTML 转换管线（remark 11 时代工具链）
    const html = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(doc.content)

    // 独立完整 HTML（自带样式，可发布；CSS 与编辑器主题同源简化版）
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fileName)}</title>
  <style>
    body { max-width: 820px; margin: 0 auto; padding: 40px 24px; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; color: #2c2c2c; }
    h1, h2, h3, h4 { margin-top: 1.6em; margin-bottom: 0.6em; line-height: 1.3; }
    code { background: #f4f4f5; border-radius: 4px; padding: 2px 6px; font-size: 0.9em; }
    pre { background: #f4f4f5; border-radius: 8px; padding: 16px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #e5e5e5; margin: 0; padding: 4px 16px; color: #666; }
    table { border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; }
    th { background: #fafafa; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 32px 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
${String(html)}
</body>
</html>`
  }

  return { exportDoc, exportHtml }
}

/** 转义 HTML 特殊字符（标题/文件名安全） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const exportManifest: AppModuleManifest = {
  id: 'export',
  type: 'app',
  name: '导出',
  version: '1.0.0',
  description: '导出文档为 zip（.md + assets），M3.1',
  dependsOn: ['persistence'],
  defaultEnabled: true,
  mount: (api) => {
    const mod = createExportModule(api)
    ;(api as unknown as Record<string, unknown>).export = mod
    return { name: '导出', dispose: () => {
      delete (api as unknown as Record<string, unknown>).export
    } }
  },
}
