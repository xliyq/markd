/**
 * 编辑器命令桥（顶部工具栏 / 链接图片输入框 共用）
 *
 * 背景：milkdown 的 commandsCtx 只在编辑器插件 ctx 内可拿，
 * App.vue（应用壳）拿不到。本模块提供模块级桥接：
 *   - bindCommands()：由 tooltip/slash 插件创建时注册（拿到 commandsCtx）
 *   - runCommand()：App 工具栏调用
 *   - setTextPrompt()：App 注册自绘输入框（替代 window.prompt）
 *   - requestText()：插件内发起输入请求（替代 window.prompt）
 */
import { commandsCtx } from '@milkdown/kit/core'

/** 命令执行器（CommandManager.call 契约） */
type CommandCaller = (key: unknown, payload?: unknown) => boolean

let cm: CommandCaller | null = null

/** 由编辑器插件创建时注册（tooltip/slash 插件在 ctx 初始化阶段调用） */
export function bindCommands(caller: CommandCaller): void {
  cm = caller
}

/** App 工具栏执行编辑器命令；无编辑器/未注册时静默失败 */
export function runCommand(key: unknown, payload?: unknown): boolean {
  if (!cm) return false
  return cm(key, payload)
}

/** 文本输入请求（替代 window.prompt）：App 层注册自绘 InputDialog */
interface TextPromptOptions {
  title: string
  placeholder?: string
  initialValue?: string
  confirmText?: string
}
type TextPromptHandler = (opts: TextPromptOptions) => Promise<string | null>

let promptHandler: TextPromptHandler | null = null

export function setTextPrompt(handler: TextPromptHandler): void {
  promptHandler = handler
}

/** 插件内请求用户输入（如链接/图片 URL）；无处理器时返回 null */
export function requestText(opts: TextPromptOptions): Promise<string | null> {
  if (!promptHandler) return Promise.resolve(null)
  return promptHandler(opts)
}

/** 链接输入请求（文案 + 地址双字段，对齐官方插入链接体验） */
export interface LinkPromptOptions {
  title: string
  textLabel: string
  urlLabel: string
  /** 选中文本预填（App 层读取选区后补全） */
  initialText: string
  confirmText?: string
}
export interface LinkResult {
  text: string
  href: string
}
type LinkPromptHandler = (opts: LinkPromptOptions) => Promise<LinkResult | null>

let linkHandler: LinkPromptHandler | null = null

/** App 层注册双输入链接对话框 */
export function setLinkPrompt(handler: LinkPromptHandler): void {
  linkHandler = handler
}

/** 插件内发起链接输入请求（文案 + 地址）；无处理器时返回 null */
export function requestLink(opts: LinkPromptOptions): Promise<LinkResult | null> {
  if (!linkHandler) return Promise.resolve(null)
  return linkHandler(opts)
}

/** 图片输入请求（URL 或 本地文件上传）：App 层实现 URL 输入 + 文件选择 */
export interface ImagePromptOptions {
  title: string
  confirmText?: string
}
export interface ImageResult {
  /** 图片地址：http(s) URL 或 assets/xxx 相对路径（上传落库） */
  src: string
}
type ImagePromptHandler = (opts: ImagePromptOptions) => Promise<ImageResult | null>

let imageHandler: ImagePromptHandler | null = null

export function setImagePrompt(handler: ImagePromptHandler): void {
  imageHandler = handler
}

export function requestImage(opts: ImagePromptOptions): Promise<ImageResult | null> {
  if (!imageHandler) return Promise.resolve(null)
  return imageHandler(opts)
}
