/**
 * 弹窗桥：prompt（通用文本输入）/ 链接双输入 / 图片（URL+上传）。
 * onMounted 注册 setTextPrompt/setLinkPrompt/setImagePrompt，编辑器插件经桥弹窗。
 */
import { ref, onMounted } from "vue";
import { setTextPrompt, setLinkPrompt, setImagePrompt } from "@editor/plugins-editor";
import { useShell } from "./useShell";

export function useDialogs() {
  const { boot, statusText } = useShell();

  /** 通用文本输入对话框（链接/图片 URL；替代 window.prompt） */
  const promptDialog = ref<{ title: string; placeholder: string; initialValue: string; confirmText: string } | null>(null);
  const promptResolve = ref<((v: string | null) => void) | null>(null);
  function onPromptConfirm(value: string) {
    const r = promptResolve.value;
    promptDialog.value = null;
    r?.(value);
  }
  function onPromptCancel() {
    const r = promptResolve.value;
    promptDialog.value = null;
    r?.(null);
  }

  /** 双输入链接对话框（文案 + 地址） */
  const linkDialog = ref<{ title: string; textLabel: string; urlLabel: string; confirmText: string } | null>(null);
  const linkForm = ref({ text: "", url: "" });
  const linkResolve = ref<((v: { text: string; href: string } | null) => void) | null>(null);
  function onLinkConfirm(payload: { text: string; url: string }) {
    const r = linkResolve.value;
    linkDialog.value = null;
    r?.({ text: payload.text, href: payload.url });
  }
  function onLinkCancel() {
    const r = linkResolve.value;
    linkDialog.value = null;
    r?.(null);
  }

  /** 插入图片弹窗（URL 或本地文件上传，M4.1） */
  const imageDialog = ref<{ title: string; confirmText: string } | null>(null);
  const imageForm = ref({ src: "" });
  const imageResolve = ref<((v: { src: string } | null) => void) | null>(null);
  async function onImageFilePicked(file: File) {
    if (!file) return;
    const imgMgr = (boot.value?.api as never as Record<string, unknown>).imageManager as
      | { saveImageFile?: (docId: string, f: File) => Promise<string> }
      | undefined;
    const docId = boot.value?.getCurrentDocId();
    if (!imgMgr?.saveImageFile || !docId) {
      statusText.value = "请先新建文档，再上传图片";
      return;
    }
    try {
      const rel = await imgMgr.saveImageFile(docId, file);
      imageForm.value.src = rel;
      statusText.value = `图片已上传：${rel}`;
    } catch (e) {
      statusText.value = `上传失败：${e instanceof Error ? e.message : String(e)}`;
    }
  }
  function onImageConfirm() {
    const r = imageResolve.value;
    imageDialog.value = null;
    r?.({ src: imageForm.value.src.trim() });
  }
  function onImageCancel() {
    const r = imageResolve.value;
    imageDialog.value = null;
    r?.(null);
  }

  /** 注册插件桥（App onMounted 调用；boot 已初始化） */
  function registerPromptBridges() {
    setImagePrompt((opts) => {
      imageForm.value = { src: "" };
      imageDialog.value = { title: opts.title, confirmText: opts.confirmText || "插入" };
      return new Promise((resolve) => { imageResolve.value = resolve; });
    });
    setLinkPrompt((opts) => {
      const selText = window.getSelection()?.toString() ?? "";
      linkForm.value = { text: opts.initialText || selText, url: "" };
      linkDialog.value = {
        title: opts.title,
        textLabel: opts.textLabel,
        urlLabel: opts.urlLabel,
        confirmText: opts.confirmText || "确定",
      };
      return new Promise((resolve) => { linkResolve.value = resolve; });
    });
    setTextPrompt((opts) => {
      promptDialog.value = {
        title: opts.title,
        placeholder: opts.placeholder ?? "",
        initialValue: opts.initialValue ?? "",
        confirmText: opts.confirmText ?? "确定",
      };
      return new Promise((resolve) => { promptResolve.value = resolve; });
    });
  }

  return {
    promptDialog, onPromptConfirm, onPromptCancel,
    linkDialog, linkForm, onLinkConfirm, onLinkCancel,
    imageDialog, imageForm, onImageFilePicked, onImageConfirm, onImageCancel,
    registerPromptBridges,
  };
}
