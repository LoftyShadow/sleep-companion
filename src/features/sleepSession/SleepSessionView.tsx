import { useState } from "react";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import { SleepTimerControl } from "../sleepTimer/SleepTimerControl";
import type { SleepTimerStatus } from "../sleepTimer/SleepTimerControl";
import type { FileSystemPort } from "../storage/FileSystemPort";
import {
  DEFAULT_SLEEP_SESSION_MODULE_SELECTION,
} from "./sleepSessionStore";
import { useRecentSleepConfigs } from "./useRecentSleepConfigs";
import type {
  RecentSleepSoundConfig,
  SleepSessionModuleSelection,
  SleepSoundConfigItem,
} from "./sleepSessionTypes";
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
  onDurationChange: (durationMinutes: number) => void;
  onOpenSoundConfig: () => void;
  onPrepareModule: (moduleId: "audiobook" | "video") => void;
  onStartModules: (modules: SleepSessionModuleSelection) => void;
  onStartTimer: (durationMinutes?: number) => void;
  onUseConfig: (config: RecentSleepSoundConfig) => void;
}

function formatConfigMeta(config: RecentSleepSoundConfig): string {
  const enabledModules = [
    config.enabledModules.audiobook ? "听书" : null,
    config.enabledModules.video ? "听视频" : null,
  ].filter(Boolean);
  const moduleText =
    enabledModules.length > 0 ? ` · ${enabledModules.join(" / ")}` : "";

  return `${config.items.length} 个声音 · ${config.durationMinutes} 分钟${moduleText}`;
}

function formatConfigTime(updatedAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(updatedAt));
}

function formatCurrentConfigSummary(items: SleepSoundConfigItem[]): string {
  if (items.length === 0) {
    return "先到声音页选择声音组合，也可以在这里决定是否纳入听书和听视频。";
  }

  if (items.length <= 3) {
    return items.map((item) => item.name).join(" / ");
  }

  return `${items.slice(0, 3).map((item) => item.name).join(" / ")} 等 ${items.length} 个声音`;
}

function getModuleStatusText(state: PlaybackControlState): string {
  if (state.status === "unavailable") {
    return "未准备";
  }
  if (state.status === "playing") {
    return "播放中";
  }
  if (state.status === "loading") {
    return "准备中";
  }
  if (state.status === "paused") {
    return "已暂停";
  }
  if (state.status === "loaded") {
    return "已载入";
  }

  return "待机";
}

export function SleepSessionView({
  currentConfigItems,
  durationMinutes,
  fileSystem,
  moduleStates,
  remainingSeconds,
  status,
  onCancelTimer,
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [enabledModules, setEnabledModules] =
    useState<SleepSessionModuleSelection>(
      DEFAULT_SLEEP_SESSION_MODULE_SELECTION,
    );
  const hasCurrentConfig = currentConfigItems.length > 0;
  const canStartSelectedAudiobook =
    !enabledModules.audiobook ||
    (moduleStates.audiobook.canToggle &&
      moduleStates.audiobook.status !== "unavailable");
  const canStartSelectedVideo =
    !enabledModules.video ||
    (moduleStates.video.canToggle && moduleStates.video.status !== "unavailable");
  const canStartSession =
    hasCurrentConfig && canStartSelectedAudiobook && canStartSelectedVideo;
  const currentSummary = formatCurrentConfigSummary(currentConfigItems);

  async function persistCurrentConfig() {
    return saveRecentConfig({
      durationMinutes,
      enabledModules,
      items: currentConfigItems,
    });
  }

  async function handleStartCurrentSession() {
    if (!canStartSession) {
      return;
    }

    const config = await persistCurrentConfig();

    onUseConfig(config);
    onStartModules(config.enabledModules);
    onStartTimer(config.durationMinutes);
    setActionMessage("已使用当前配置开始睡眠");
  }

  async function handleSaveCurrentConfig() {
    if (!hasCurrentConfig) {
      return;
    }

    await persistCurrentConfig();
    setActionMessage("已保存到最近配置");
  }

  async function handleUseRecentConfig(config: RecentSleepSoundConfig) {
    setEnabledModules(config.enabledModules);

    const nextConfig = await saveRecentConfig({
      durationMinutes: config.durationMinutes,
      enabledModules: config.enabledModules,
      items: config.items,
    });

    onDurationChange(nextConfig.durationMinutes);
    onUseConfig(nextConfig);
    onStartModules(nextConfig.enabledModules);
    onStartTimer(nextConfig.durationMinutes);
    setActionMessage("已复用最近配置开始睡眠");
  }

  function handleModuleChange(
    moduleId: keyof SleepSessionModuleSelection,
    isEnabled: boolean,
  ) {
    setEnabledModules((modules) => ({
      ...modules,
      [moduleId]: isEnabled,
    }));
  }

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

      <section className="sleep-session-recent glass-panel" aria-label="最近配置">
        <div className="section-heading">
          <div>
            <p className="app-kicker">最近配置</p>
            <h2>直接复用</h2>
          </div>
          <span className="section-meta">{recentConfigs.length} / 5</span>
        </div>

        {isLoading ? (
          <p className="sleep-session-empty" role="status">
            正在读取最近配置
          </p>
        ) : null}

        {!isLoading && recentConfigs.length === 0 ? (
          <p className="sleep-session-empty">最近还没有保存过睡眠配置。</p>
        ) : null}

        <div className="sleep-session-config-list">
          {recentConfigs.map((config) => (
            <article className="sleep-session-config" key={config.id}>
              <div className="sleep-session-config__copy">
                <h3>{config.title}</h3>
                <p>{formatConfigMeta(config)}</p>
                <span>{formatConfigTime(config.updatedAt)}</span>
              </div>
              <div className="sleep-session-config__actions">
                <button
                  className="sleep-session-config-button"
                  type="button"
                  onClick={() => {
                    void handleUseRecentConfig(config);
                  }}
                >
                  复用
                </button>
                <button
                  className="sleep-session-delete-button"
                  type="button"
                  onClick={() => {
                    void removeRecentConfig(config.id);
                  }}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
