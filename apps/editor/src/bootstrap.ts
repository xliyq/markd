/**
 * 应用装配器（Bootstrap）
 *
 * Phase 2 —— 把全部 L1+L2 插件通过 PluginManager 装配进应用：
 * 1. 创建存储（DexieStorageProvider）
 * 2. 注册全部 L1（plugins-editor）+ L2（plugins-app）manifest
 * 3. inject storage 到 AppApi
 * 4. mountAll → L1 插件列表 + L2 模块
 * 5. createEditor（管理 AppApi.editor 句柄）
 */
import { PluginManager, createEditor } from '@editor/core'
import type { EditorInstance, EditorUploader } from '@editor/core'
import { imageBlockConfig } from '@milkdown/components/image-block'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { DexieStorageProvider } from '@editor/infra'
import { allL1Manifests } from '@editor/plugins-editor'
import { allAppManifests } from '@editor/plugins-app'
import { imageConfig } from '@editor/plugins-editor'
import type { AppApi, StorageProvider } from '@editor/core'
import { createDataSafetyModule } from '@editor/plugins-app'
import type { DataSafetyModule } from '@editor/plugins-app'

export interface AppBootstrap {
  storage: StorageProvider
  pm: PluginManager
  api: AppApi
  dataSafety: DataSafetyModule
  /** 当前编辑器实例（单文档视图） */
  editor: EditorInstance | null
  /** 挂载编辑器到 DOM 并装载文档 */
  mountEditor: (root: HTMLElement, content?: string, docId?: string) => Promise<EditorInstance>
  /** 卸载当前编辑器 */
  unmountEditor: () => Promise<void>
  /** 打开文档（联动：预存 docId，loader 挂载编辑器） */
  openDocument: (docId: string) => Promise<EditorInstance | null>
  /** 当前文档 id */
  getCurrentDocId: () => string | null
  /** 重算启停并应用差异（L1 新插件列表 + L2 差异挂载/卸载）；L1 变更后重建编辑器即即时生效 */
  rebuildPlugins: () => Promise<void>
  /** 持久化插件启停覆盖到 localStorage */
  persistPluginOverrides: () => void
  /** 清理（关闭数据库） */
  dispose: () => void
}

/** 应用启动入口 */
export async function bootstrapApp(): Promise<AppBootstrap> {
  // 1) 存储
  const storage = new DexieStorageProvider()

  // 2) 插件管理：注册全部 manifest（启停覆盖从 localStorage 恢复，插件开关持久化）
  const OVERRIDES_KEY = "milkdown.plugin-overrides"
  function loadPluginOverrides(): Record<string, boolean> {
    try {
      const raw = window.localStorage.getItem(OVERRIDES_KEY)
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  }
  const pm = new PluginManager({ enabledOverrides: loadPluginOverrides() })
  pm.registerAll([...allL1Manifests, ...allAppManifests])

  // 3) 注入 storage（编辑器创建后补注入 editor）
  pm.inject({ storage })

  // 4) 组装：L1 插件 → 供 createEditor；L2 模块 → 挂载（此时 storage 可用）
  const { milkdownPlugins } = pm.mountAll()
  /** 当前生效的 L1 插件列表（rebuildPlugins 后更新，编辑器重建时使用） */
  let activeL1 = milkdownPlugins
  /** 重算启停：更新 L1 列表 + L2 差异挂载/卸载（插件开关即时生效的装配端） */
  async function rebuildPlugins(): Promise<void> {
    activeL1 = pm.remountEnabled()
  }
  /** 持久化启停覆盖（localStorage） */
  function persistPluginOverrides(): void {
    try {
      window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(pm.enabledOverrides))
    } catch {
      /* storage 不可用时静默 */
    }
  }
  // 提取 AppApi（供外部读取 L2 暴露的能力）
  const api = pm['api'] as AppApi

  let editor: EditorInstance | null = null
  /** 当前打开的文档 id（编辑器内容归属） */
  let currentDocId: string | null = null
  /** 编辑器挂载根部（首次 mountEditor 时记录，openDocument 复用） */
  let mountedRoot: HTMLElement | null = null

  // ---- 数据安全（M7.5）：beforeunload 拦截 + 多标签冲突检测 ----
  // 共享一个 BroadcastChannel 实例（post/onMessage 必须同实例才互通）
  const conflictChannel = new BroadcastChannel('milkdown-editor')
  const dataSafety = createDataSafetyModule(api, {
    addBeforeUnload: (fn) => window.addEventListener('beforeunload', fn as EventListener),
    broadcast: {
      post: (msg) => conflictChannel.postMessage(msg),
      onMessage: (fn) => {
        conflictChannel.onmessage = (evt) => fn(evt.data)
      },
      close: () => conflictChannel.close(),
    },
  })

  // 冲突回调 → 事件转发（App.vue 订阅后弹提示）
  dataSafety.onConflict((payload) => pm.emit('doc:conflict', payload))

  async function unmountEditor(): Promise<void> {
    if (editor) {
      await editor.destroy()
      editor = null
      pm.inject({ editor: undefined })
    }
  }

  // 图片管理模块（mountAll 时挂到 api）：M4.2 落库入口
  const imgMgr = (api as unknown as Record<string, unknown>).imageManager as
    | {
        saveImageFile: (docId: string, file: File) => Promise<string>
        getBlobUrl: (docId: string, relPath: string) => Promise<string>
      }
    | undefined

  // 渲染层统一（ADR-021）：image 节点的自定义 NodeView 也需要 assets → blob URL 解析
  let imageConfigPlugin: MilkdownPlugin | null = null
  const buildImageConfigPlugin = (): MilkdownPlugin => {
    return (ctx) => {
      ctx.set(imageConfig.key, {
        proxyDomURL: (url: string) => {
          if (!url.startsWith('assets/') || !currentDocId || !imgMgr) return url
          return imgMgr.getBlobUrl(currentDocId, url).then((blobUrl) => blobUrl || url)
        },
      })
      return () => {}
    }
  }

  // 图片块渲染配置（M4.2a）：proxyDomURL 把 assets/xxx 解析为 blob URL（AssetResolver）
  // onUpload 覆盖文件选择器插入方式（M4.1）。闭包引用 currentDocId（挂载时更新）。
  let imageBlockConfigPlugin: MilkdownPlugin | null = null
  const buildImageBlockConfigPlugin = (): MilkdownPlugin => {
    return (ctx) => {
      ctx.set(imageBlockConfig.key, {
        // 仅代理 assets/ 相对路径；外部 URL（图床）直通
        proxyDomURL: (url: string) => {
          if (!url.startsWith('assets/') || !currentDocId || !imgMgr) return url
          return imgMgr.getBlobUrl(currentDocId, url).then((blobUrl) => blobUrl || url)
        },
        // 文件选择器插入（M4.1）：落库到当前文档，返回相对路径
        onUpload: async (file: File) => {
          if (!currentDocId || !imgMgr) return ''
          return imgMgr.saveImageFile(currentDocId, file)
        },
        // 其余字段用官方默认（图标/占位文案等）
        imageIcon: undefined,
        captionIcon: undefined,
        uploadButton: undefined,
        confirmButton: undefined,
        uploadPlaceholderText: '上传图片…',
        captionPlaceholderText: '输入说明…',
        maxWidth: undefined,
        maxHeight: undefined,
        onImageLoadError: undefined,
      } as never)
      return () => {}
    }
  }

  async function mountEditor(root: HTMLElement, content = '', docId?: string): Promise<EditorInstance> {
    if (editor) await unmountEditor()
    mountedRoot = root
    currentDocId = docId ?? null
    // 每次挂载重建配置插件（刷新 currentDocId 闭包）
    imageBlockConfigPlugin = buildImageBlockConfigPlugin()
    imageConfigPlugin = buildImageConfigPlugin()
    editor = await createEditor(root, content, {
      // image-block 配置插件追加在官方插件之后（setup 顺序保证 config 已注入）
      // imageConfig($ctx) 随 activeL1 注入后，set 插件再设值（NodeView get 发生在渲染期，晚于两者）
      plugins: [...activeL1, imageBlockConfigPlugin, imageConfigPlugin],
      // 变更 → 转发事件（autosave 已订阅 doc:changed 自动落库）
      onChange: (markdown) => {
        // 总是 emit（大纲/字数不依赖 docId）；autosave 内部会忽略无 docId 的变更
        if (currentDocId) dataSafety.markDirty(currentDocId)
        pm.emit('doc:changed', { docId: currentDocId, markdown })
      },
      // M4.2：图片文件 → 当前文档 assets 落库 → 返回 relPath（core 层构造 image node）
      uploader: async (files) => {
        if (!imgMgr || !currentDocId) return []
        const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
        return Promise.all(list.map((f) => imgMgr.saveImageFile(currentDocId!, f)))
      },
    })
    // 编辑器就绪后补注入
    pm.inject({ editor })
    return editor
  }

  /** 打开文档：加载内容 → 挂载编辑器（联动文档树） */
  async function openDocument(docId: string): Promise<EditorInstance | null> {
    const doc = await storage.getDocContent(docId)
    if (!mountedRoot) return null
    dataSafety.setCurrentDoc(docId)
    return mountEditor(mountedRoot, doc?.content ?? '', docId)
  }

  /** 当前文档 id（UI 层展示/保存用） */
  function getCurrentDocId(): string | null {
    return currentDocId
  }

  return {
    storage,
    pm,
    api,
    dataSafety,
    editor,
    mountEditor,
    unmountEditor,
    openDocument,
    getCurrentDocId,
    rebuildPlugins,
    persistPluginOverrides,
    dispose: () => {
      storage.dispose()
      dataSafety.dispose()
      pm.emit('app:dispose')
    },
  }
}
