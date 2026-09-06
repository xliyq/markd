/**
 * @editor/plugins-app —— L2 应用模块集合
 *
 * 每个模块一个目录（manifest + 模块工厂），统一经 export * 导出。
 * allAppManifests 供装配器批量注册。
 */
import { persistenceManifest } from './persistence'
import { autosaveManifest } from './autosave'
import { documentTreeManifest } from './document-tree'
import { exportManifest } from './export'
import { importManifest } from './import'
import { dataSafetyManifest } from './data-safety'
import { imageManagerManifest } from './image-manager'
import { themeManifest } from './theme'
import { backupManifest } from './backup'
import { versionsManifest } from './versions'
import { recycleBinManifest } from './recycle-bin'
import { searchManifest } from './search'
import { quotaManifest } from './quota'

export * from './persistence'
export * from './autosave'
export * from './document-tree'
export * from './export'
export * from './import'
export * from './data-safety'
export * from './image-manager'
export * from './theme'
export * from './backup'
export * from './versions'
export * from './recycle-bin'
export * from './search'
export * from './quota'
export * from './doc-stats'

/** 全部 L2 模块 manifest */
export const allAppManifests = [
  persistenceManifest,
  autosaveManifest,
  documentTreeManifest,
  exportManifest,
  importManifest,
  dataSafetyManifest,
  imageManagerManifest,
  themeManifest,
  backupManifest,
  versionsManifest,
  recycleBinManifest,
  searchManifest,
  quotaManifest,
]
