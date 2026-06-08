import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import { SleepTimerControl } from "../sleepTimer/SleepTimerControl";
import type { SleepTimerStatus } from "../sleepTimer/SleepTimerControl";
import type { FileSystemPort } from "../storage/FileSystemPort";
import { RecentSleepConfigList } from "./RecentSleepConfigList";
import type {
  RecentSleepSoundConfig,
  SleepSessionModuleSelection,
  SleepSoundConfigItem,
} from "./sleepSessionTypes";
import { useRecentSleepConfigs } from "./useRecentSleepConfigs";
import { useSleepSessionActions } from "./useSleepSessionActions";
import {
  formatCurrentConfigSummary,
  getModuleStatusText,
} from "./sleepSessionViewModel";
import "./SleepSessionView.css";

interface SleepSessionViewProps {
  currentConfigItems: SleepSoundConfigItem[];
  durationMinutes: number;
  fileSystem?: FileSystemPort;
  moduleStates: {
    audiobook: PlaybackControlState;
    video: PlaybackControlState;
  };
  remainingSeconds: number;
  status: SleepTimerStatus;
  onCancelTimer: () => void;
  onCanUseModule: (moduleId: keyof SleepSessionModuleSelection) => boolean;
  onDurationChange: (durationMinutes: number) => void;
  onOpenSoundConfig: () => void;
  onPrepareModule: (moduleId: "audiobook" | "video") => void;
  onStartModules: (modules: SleepSessionModuleSelection) => void;
  onStartTimer: (durationMinutes?: number) => void;
  onUseConfig: (config: RecentSleepSoundConfig) => void;
}

export function SleepSessionView({
  currentConfigItems,
  durationMinutes,
  fileSystem,
  moduleStates,
  remainingSeconds,
  status,
  onCancelTimer,
  onCanUseModule,
  onDurationChange,
  onOpenSoundConfig,
  onPrepareModule,
  onStartModules,
  onStartTimer,
  onUseConfig,
}: SleepSessionViewProps) {
  const {
    errorMessage,
    isLoading,
    recentConfigs,
    removeRecentConfig,
    saveRecentConfig,
  } = useRecentSleepConfigs(fileSystem);
  const {
    actionMessage,
    canStartSession,
    enabledModules,
    handleModuleChange,
    handleSaveCurrentConfig,
    handleStartCurrentSession,
    handleUseRecentConfig,
    hasCurrentConfig,
  } = useSleepSessionActions({
    currentConfigItems,
    durationMinutes,
    onCanUseModule,
    onDurationChange,
    onStartModules,
    onStartTimer,
    onUseConfig,
    saveRecentConfig,
  });
  const currentSummary = formatCurrentConfigSummary(currentConfigItems);

  return (
    <div className="sleep-session-view">
      <section className="sleep-session-hero glass-panel" aria-label="睡眠入口">
        <div className="sleep-session-hero__copy">
          <p className="app-kicker">睡眠</p>
          <h1>今晚的会话</h1>
          <p>{currentSummary}</p>
        </div>

        <div className="sleep-session-current">
          <span>当前配置</span>
          <strong>
            {hasCurrentConfig ? `${currentConfigItems.length} 个声音` : "未选择"}
          </strong>
        </div>

        <div className="sleep-session-actions">
          <button
            className="sleep-session-primary-button"
            disabled={!canStartSession}
            type="button"
            onClick={() => {
              void handleStartCurrentSession();
            }}
          >
            开始睡眠
          </button>
          <button
            className="sleep-session-secondary-button"
            disabled={!hasCurrentConfig}
            type="button"
            onClick={() => {
              void handleSaveCurrentConfig();
            }}
          >
            保存配置
          </button>
        </div>
      </section>

      <section
        className="sleep-session-config-overview glass-panel"
        aria-label="当前声音配置"
      >
        <div className="section-heading">
          <div>
            <p className="app-kicker">声音配置</p>
            <h2>在声音页修改</h2>
          </div>
          <span className="section-meta">{currentConfigItems.length} 个声音</span>
        </div>

        <div className="sleep-session-config-overview__body">
          <p>{currentSummary}</p>
          <button
            className="sleep-session-secondary-button"
            type="button"
            onClick={onOpenSoundConfig}
          >
            去声音页配置
          </button>
        </div>
      </section>

      <section className="sleep-session-modules glass-panel" aria-label="会话模块">
        <div className="section-heading">
          <div>
            <p className="app-kicker">会话模块</p>
            <h2>一起播放</h2>
          </div>
        </div>

        {(["audiobook", "video"] as const).map((moduleId) => {
          const state = moduleStates[moduleId];
          const moduleLabel = moduleId === "audiobook" ? "听书" : "听视频";
          const isEnabled = enabledModules[moduleId];
          const isUnavailable = state.status === "unavailable";

          return (
            <article className="sleep-session-module" key={moduleId}>
              <label className="sleep-session-module-toggle">
                <input
                  checked={isEnabled}
                  type="checkbox"
                  onChange={(event) => {
                    handleModuleChange(moduleId, event.currentTarget.checked);
                  }}
                />
                <span>{moduleLabel}</span>
              </label>
              <div className="sleep-session-module__copy">
                <strong>{getModuleStatusText(state)}</strong>
                <p>{state.summary}</p>
              </div>
              <button
                className="sleep-session-secondary-button"
                type="button"
                onClick={() => {
                  onPrepareModule(moduleId);
                }}
              >
                {isUnavailable ? "去准备" : "打开"}
              </button>
            </article>
          );
        })}
      </section>

      <SleepTimerControl
        durationMinutes={durationMinutes}
        remainingSeconds={remainingSeconds}
        status={status}
        onCancel={onCancelTimer}
        onDurationChange={onDurationChange}
        onStart={onStartTimer}
      />

      {errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="custom-audio-status" role="status">
          {actionMessage}
        </p>
      ) : null}

      <RecentSleepConfigList
        configs={recentConfigs}
        isLoading={isLoading}
        onCanUseModule={onCanUseModule}
        onRemoveConfig={(configId) => {
          void removeRecentConfig(configId);
        }}
        onUseConfig={(config) => {
          void handleUseRecentConfig(config);
        }}
      />
    </div>
  );
}
