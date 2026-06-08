import type { SoundId } from "./soundCatalog";

export type SoundPresetId =
  | "rainy_night"
  | "campfire_rest"
  | "library_focus"
  | "forest_morning"
  | "asmr_ear_care"
  | "asmr_desktop_taps"
  | "asmr_liquid_close"
  | "asmr_texture_walk"
  | `custom_preset:${string}`;

export type SoundPresetGroupId = "sleep" | "focus" | "nature" | "asmr";

export interface SoundPresetItem {
  soundId: SoundId;
  volume: number;
}

export interface SoundPreset {
  id: SoundPresetId;
  name: string;
  description: string;
  items: SoundPresetItem[];
}

export interface SoundPresetGroup {
  id: SoundPresetGroupId;
  name: string;
  presets: SoundPreset[];
}

export const PRESET_GROUPS: SoundPresetGroup[] = [
  {
    id: "sleep",
    name: "入睡",
    presets: [
      {
        id: "rainy_night",
        name: "雨夜放松",
        description: "稳定雨声加一点远雷和低风声。",
        items: [
          { soundId: "heavy_rain", volume: 0.62 },
          { soundId: "thunder", volume: 0.18 },
          { soundId: "wind", volume: 0.24 },
        ],
      },
      {
        id: "campfire_rest",
        name: "篝火休息",
        description: "篝火作为主声，叠加轻风弱化空旷感。",
        items: [
          { soundId: "campfire", volume: 0.58 },
          { soundId: "wind", volume: 0.2 },
        ],
      },
    ],
  },
  {
    id: "focus",
    name: "专注",
    presets: [
      {
        id: "library_focus",
        name: "图书馆专注",
        description: "图书馆底噪搭配轻键盘和时钟节奏。",
        items: [
          { soundId: "library", volume: 0.5 },
          { soundId: "keyboard", volume: 0.22 },
          { soundId: "clock", volume: 0.16 },
        ],
      },
    ],
  },
  {
    id: "nature",
    name: "自然",
    presets: [
      {
        id: "forest_morning",
        name: "清晨森林",
        description: "鸟声为主，加入轻风保持自然层次。",
        items: [
          { soundId: "forest_birds", volume: 0.52 },
          { soundId: "wind", volume: 0.18 },
        ],
      },
    ],
  },
];

export const ASMR_PRESET_GROUPS: SoundPresetGroup[] = [
  {
    id: "asmr",
    name: "ASMR",
    presets: [
      {
        id: "asmr_ear_care",
        name: "近耳清理",
        description: "两段掏耳素材为主，轻轻叠一点纸张摩擦。",
        items: [
          { soundId: "asmr_ear_cleaning_soft", volume: 0.42 },
          { soundId: "asmr_ear_cleaning_deep", volume: 0.28 },
          { soundId: "asmr_paper_rub", volume: 0.14 },
        ],
      },
      {
        id: "asmr_desktop_taps",
        name: "桌面敲击",
        description: "键盘、打字机和纸张形成轻节奏触发。",
        items: [
          { soundId: "asmr_keyboard_taps", volume: 0.34 },
          { soundId: "asmr_typewriter_ticks", volume: 0.2 },
          { soundId: "asmr_paper_rub", volume: 0.18 },
        ],
      },
      {
        id: "asmr_liquid_close",
        name: "液体微声",
        description: "沸水、气泡和车顶雨点组合出连续细响。",
        items: [
          { soundId: "asmr_boiling_water", volume: 0.32 },
          { soundId: "asmr_bubbles", volume: 0.24 },
          { soundId: "asmr_car_roof_rain", volume: 0.2 },
        ],
      },
      {
        id: "asmr_texture_walk",
        name: "颗粒行走",
        description: "碎石脚步和落叶脚步形成颗粒摩擦层次。",
        items: [
          { soundId: "asmr_gravel_steps", volume: 0.28 },
          { soundId: "asmr_leaf_steps", volume: 0.24 },
        ],
      },
    ],
  },
];

export const ALL_PRESET_GROUPS: SoundPresetGroup[] = [
  ...PRESET_GROUPS,
  ...ASMR_PRESET_GROUPS,
];

export const BUILT_IN_PRESETS: SoundPreset[] = ALL_PRESET_GROUPS.flatMap(
  (group) => group.presets,
);

export const DEFAULT_SOUND_PRESET = PRESET_GROUPS[0].presets[0];

export const DEFAULT_ASMR_PRESET = ASMR_PRESET_GROUPS[0].presets[0];
