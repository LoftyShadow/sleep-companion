export type SoundLibraryMode = "sleep" | "asmr";

export interface SoundLibraryModeConfig {
  id: SoundLibraryMode;
  label: string;
  kicker: string;
  title: string;
  emptySummary: string;
  presetKicker: string;
  presetHeading: string;
  soundKicker: string;
  soundHeading: string;
  transportLabel: string;
}

export const SOUND_LIBRARY_MODES: SoundLibraryModeConfig[] = [
  {
    id: "sleep",
    label: "白噪音",
    kicker: "XMSLEEP 风格声音调音台",
    title: "白噪音",
    emptySummary: "选择预设或点一个声音开始播放",
    presetKicker: "快捷播放",
    presetHeading: "一键混音",
    soundKicker: "单独控制",
    soundHeading: "声音库",
    transportLabel: "播放预设",
  },
  {
    id: "asmr",
    label: "ASMR",
    kicker: "真实素材触发控制台",
    title: "ASMR 控制台",
    emptySummary: "选择触发组合或点一个近距离声音开始播放",
    presetKicker: "触发组合",
    presetHeading: "ASMR 预设",
    soundKicker: "真实素材",
    soundHeading: "ASMR 声音",
    transportLabel: "播放 ASMR",
  },
];

export const SOUND_LIBRARY_MODE_CONFIG = Object.fromEntries(
  SOUND_LIBRARY_MODES.map((mode) => [mode.id, mode]),
) as Record<SoundLibraryMode, SoundLibraryModeConfig>;

