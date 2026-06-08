import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import type {
  RecentSleepSoundConfig,
  SleepSessionModuleSelection,
  SleepSoundConfigItem,
} from "./sleepSessionTypes";

export type SleepSessionModuleId = keyof SleepSessionModuleSelection;
export type CanUseSleepSessionModule = (
  moduleId: SleepSessionModuleId,
) => boolean;

export function formatConfigMeta(config: RecentSleepSoundConfig): string {
  const enabledModules = [
    config.enabledModules.audiobook ? "听书" : null,
    config.enabledModules.video ? "听视频" : null,
  ].filter(Boolean);
  const moduleText =
    enabledModules.length > 0 ? ` · ${enabledModules.join(" / ")}` : "";

  return `${config.items.length} 个声音 · ${config.durationMinutes} 分钟${moduleText}`;
}

export function formatConfigTime(updatedAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(updatedAt));
}

export function formatCurrentConfigSummary(
  items: readonly SleepSoundConfigItem[],
): string {
  if (items.length === 0) {
    return "先到声音页选择声音组合，也可以在这里决定是否纳入听书和听视频。";
  }

  if (items.length <= 3) {
    return items.map((item) => item.name).join(" / ");
  }

  return `${items.slice(0, 3).map((item) => item.name).join(" / ")} 等 ${items.length} 个声音`;
}

export function getModuleStatusText(state: PlaybackControlState): string {
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

export function canStartSleepModules(
  modules: SleepSessionModuleSelection,
  canUseModule: CanUseSleepSessionModule,
): boolean {
  return (
    (!modules.audiobook || canUseModule("audiobook")) &&
    (!modules.video || canUseModule("video"))
  );
}
