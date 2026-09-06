/**
 * @editor/core 入口
 *
 * 框架本体（纯 TS，不依赖 Vue）：
 * - plugin-system：插件框架（manifest / topology / plugin-manager / app-api）
 * - editor：编辑器装配（editor-factory）
 * - data：数据抽象接口（storage-provider / asset-resolver，实现在 @editor/infra）
 */
export * from './plugin-system'
export * from './editor-factory'
export * from './data/storage-provider'
