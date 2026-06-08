import type { RecentSleepSoundConfig } from "./sleepSessionTypes";
import {
  canStartSleepModules,
  formatConfigMeta,
  formatConfigTime,
  type CanUseSleepSessionModule,
} from "./sleepSessionViewModel";

interface RecentSleepConfigListProps {
  configs: RecentSleepSoundConfig[];
  isLoading: boolean;
  onCanUseModule: CanUseSleepSessionModule;
  onRemoveConfig: (configId: RecentSleepSoundConfig["id"]) => void;
  onUseConfig: (config: RecentSleepSoundConfig) => void;
}

export function RecentSleepConfigList({
  configs,
  isLoading,
  onCanUseModule,
  onRemoveConfig,
  onUseConfig,
}: RecentSleepConfigListProps) {
  return (
    <section className="sleep-session-recent glass-panel" aria-label="最近配置">
      <div className="section-heading">
        <div>
          <p className="app-kicker">最近配置</p>
          <h2>直接复用</h2>
        </div>
        <span className="section-meta">{configs.length} / 5</span>
      </div>

      {isLoading ? (
        <p className="sleep-session-empty" role="status">
          正在读取最近配置
        </p>
      ) : null}

      {!isLoading && configs.length === 0 ? (
        <p className="sleep-session-empty">最近还没有保存过睡眠配置。</p>
      ) : null}

      <div className="sleep-session-config-list">
        {configs.map((config) => (
          <article className="sleep-session-config" key={config.id}>
            <div className="sleep-session-config__copy">
              <h3>{config.title}</h3>
              <p>{formatConfigMeta(config)}</p>
              <span>{formatConfigTime(config.updatedAt)}</span>
            </div>
            <div className="sleep-session-config__actions">
              <button
                className="sleep-session-config-button"
                disabled={!canStartSleepModules(config.enabledModules, onCanUseModule)}
                type="button"
                onClick={() => {
                  onUseConfig(config);
                }}
              >
                复用
              </button>
              <button
                className="sleep-session-delete-button"
                type="button"
                onClick={() => {
                  onRemoveConfig(config.id);
                }}
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
