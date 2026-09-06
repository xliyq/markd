<template>
  <n-modal
    :show="show"
    preset="card"
    :style="{ width: '740px', maxWidth: '95vw' }"
    title="设置"
    :mask-closable="true"
    aria-label="设置"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="settings-shell">
      <n-menu
        class="settings-nav"
        :value="settingsTab"
        :options="settingsTabs"
        :root-indent="6"
        @update:value="(k: string) => emit('update:settingsTab', k)"
      />
      <div class="settings-body">
        <section v-show="settingsTab === 'general'" class="settings-section">
          <div class="settings-title">主题 · 外观</div>
          <n-radio-group :value="themeMode" size="small" @update:value="(v: string) => emit('themeModeChange', v)">
            <n-radio-button value="light">☀️ 亮色</n-radio-button>
            <n-radio-button value="dark">🌙 暗色</n-radio-button>
            <n-radio-button value="system">🌓 跟随系统</n-radio-button>
          </n-radio-group>
        </section>

        <section v-show="settingsTab === 'editor'" class="settings-section">
          <div class="settings-title">编辑区</div>
          <div class="settings-row">
            <span class="settings-label">字体大小</span>
            <n-select
              :value="editorPrefs.fontSize"
              :options="fontOptions"
              size="small"
              style="width: 150px"
              @update:value="(v: string) => emit('fontSize', v)"
            />
          </div>
          <div class="settings-row">
            <span class="settings-label">编辑区宽度</span>
            <n-select
              :value="editorPrefs.maxWidth"
              :options="widthOptions"
              size="small"
              style="width: 200px"
              @update:value="(v: string) => emit('maxWidth', v)"
            />
          </div>
        </section>

        <section v-show="settingsTab === 'plugins'" class="settings-section">
          <div class="settings-title">插件 <span class="settings-hint">（停用立即生效）</span></div>
          <div class="plugin-list">
            <div v-for="p in pluginSwitches" :key="p.id" class="plugin-row">
              <span class="plugin-name">{{ p.name }}</span>
              <code class="plugin-id">{{ p.id }}</code>
              <n-switch
                size="small"
                :value="p.enabled"
                :aria-label="`启用插件：${p.name}`"
                @update:value="emit('togglePlugin', p.id)"
              />
            </div>
          </div>
        </section>

        <section v-show="settingsTab === 'data'" class="settings-section">
          <div class="settings-title">数据备份</div>
          <div class="settings-desc">导出全部文档与设置（JSON），或从备份文件恢复。恢复会覆盖当前数据。</div>
          <div class="settings-actions">
            <n-button size="small" @click="emit('backup')">⬇ 导出备份</n-button>
            <n-button size="small" @click="restoreInput?.click()">⬆ 导入恢复</n-button>
            <input ref="restoreInput" type="file" accept=".json,application/json" style="display: none" @change="onRestoreFile" />
          </div>
        </section>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NModal, NMenu, NRadioGroup, NRadioButton, NSelect, NSwitch, NButton } from "naive-ui";

interface PluginSwitch {
  id: string;
  name: string;
  enabled: boolean;
}

defineProps<{
  show: boolean;
  settingsTab: string;
  settingsTabs: { label: string; key: string }[];
  themeMode: string;
  editorPrefs: { fontSize: string; maxWidth: string };
  fontOptions: { label: string; value: string }[];
  widthOptions: { label: string; value: string }[];
  pluginSwitches: PluginSwitch[];
}>();

const emit = defineEmits<{
  "update:show": [v: boolean];
  "update:settingsTab": [k: string];
  themeModeChange: [v: string];
  fontSize: [v: string];
  maxWidth: [v: string];
  togglePlugin: [id: string];
  backup: [];
  restore: [file: File];
}>();

const restoreInput = ref<HTMLInputElement>();
function onRestoreFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) emit("restore", f);
  (e.target as HTMLInputElement).value = "";
}
</script>

<style scoped>
.settings-shell { display: flex; height: min(560px, 72vh); gap: 12px; }
.settings-nav { width: 140px; border-right: 1px solid var(--border-soft); flex-shrink: 0; }
.settings-body { flex: 1; overflow-y: auto; padding: 4px 8px; }
.settings-section { margin-bottom: 18px; }
.settings-title { font-weight: 600; margin-bottom: 10px; }
.settings-hint { font-size: 12px; color: var(--text-muted); font-weight: 400; }
.settings-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.settings-label { width: 76px; color: var(--text-muted); font-size: 13px; flex-shrink: 0; }
.settings-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.settings-actions { display: flex; gap: 8px; }
.plugin-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--border-soft); }
.plugin-name { flex: 1; font-size: 13px; }
.plugin-id { font-size: 11px; color: var(--text-muted); }
</style>
