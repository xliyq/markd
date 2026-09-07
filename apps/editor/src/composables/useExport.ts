/**
 * 导出：zip / HTML / PDF（打印另存）/ Word（.doc）。
 */
import { useShell } from "./useShell";

export function useExport() {
  const { boot, statusText, activeDocId } = useShell();

  const exportOptions = [
    { label: "Markdown 打包（zip + 图片）", key: "zip" },
    { label: "HTML 页面", key: "html" },
    { label: "PDF（打印另存）", key: "pdf" },
    { label: "Word 文档（.doc）", key: "word" },
  ];

  function onExportSelect(key: string) {
    if (key === "zip") void onExport();
    else if (key === "html") void onExportHtml();
    else if (key === "pdf") void onExportPdf();
    else if (key === "word") void onExportWord();
  }

  async function onExport() {
    const mod = (boot.value?.api as never as Record<string, unknown>).export as { exportDoc: (docId: string) => Promise<number> } | undefined;
    if (!mod) return;
    if (!activeDocId.value) { statusText.value = "没有打开的文档"; return; }
    try {
      const n = await mod.exportDoc(activeDocId.value);
      statusText.value = `已导出（含 ${n} 个本地资源）`;
    } catch (e) {
      statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function onExportHtml() {
    const mod = (boot.value?.api as never as Record<string, unknown>).export as { exportHtml: (docId: string) => Promise<string> } | undefined;
    if (!mod) return;
    if (!activeDocId.value) { statusText.value = "没有打开的文档"; return; }
    try {
      const html = await mod.exportHtml(activeDocId.value);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      downloadBlob(blob, "document.html");
      statusText.value = "已导出 HTML";
    } catch (e) {
      statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function onExportPdf() {
    const mod = (boot.value?.api as never as Record<string, unknown>).export as { exportHtml: (docId: string) => Promise<string> } | undefined;
    if (!mod || !activeDocId.value) { statusText.value = "没有打开的文档"; return; }
    try {
      const html = await mod.exportHtml(activeDocId.value);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      if (!doc) { iframe.remove(); throw new Error("iframe 不可用"); }
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 500);
      }, 400);
      statusText.value = "已打开打印对话框，请选择「另存为 PDF」";
    } catch (e) {
      statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function onExportWord() {
    const mod = (boot.value?.api as never as Record<string, unknown>).export as { exportHtml: (docId: string) => Promise<string> } | undefined;
    if (!mod || !activeDocId.value) { statusText.value = "没有打开的文档"; return; }
    try {
      const html = await mod.exportHtml(activeDocId.value);
      const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
      const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "document";
      const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; color: #2c2c2c; }
h1, h2, h3, h4 { margin-top: 1.4em; margin-bottom: 0.5em; }
code { background: #f4f4f5; font-family: Consolas, monospace; }
pre { background: #f4f4f5; padding: 12px; }
blockquote { border-left: 4px solid #ccc; margin: 0; padding: 2px 14px; color: #666; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 6px 10px; }
img { max-width: 100%; }
</style>
</head>
<body>${body}</body>
</html>`;
      const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
      downloadBlob(blob, `${title}.doc`);
      statusText.value = "已导出 Word 文档";
    } catch (e) {
      statusText.value = `导出失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return { exportOptions, onExportSelect, onExport, onExportHtml, onExportPdf, onExportWord };
}

/** 触发浏览器下载 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
