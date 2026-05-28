import type { SoundId } from "./soundCatalog";

export type SoundPresetId =
  | "rainy_night"
  | "campfire_rest"
  | "umbrella_sleep"
  | "library_focus"
  | "rainy_focus"
  | "office_focus"
  | "coffee_morning"
  | "forest_morning"
  | "soft_storm"
  | "quiet_water"
  | "snow_field"
  | "windmill_evening";

export type SoundPresetGroupId = "sleep" | "focus" | "nature";

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
      {
        id: "umbrella_sleep",
        name: "伞下入睡",
        description: "近处雨声搭配低风声，适合快速放松。",
        items: [
          { soundId: "umbrella_rain", volume: 0.56 },
          { soundId: "wind", volume: 0.16 },
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
      {
        id: "rainy_focus",
        name: "雨中工作",
        description: "中等雨声搭配图书馆环境声。",
        items: [
          { soundId: "heavy_rain", volume: 0.44 },
          { soundId: "library", volume: 0.28 },
        ],
      },
      {
        id: "office_focus",
        name: "办公室白噪",
        description: "办公室底噪加轻打字声，保持工作节奏。",
        items: [
          { soundId: "office", volume: 0.46 },
          { soundId: "typewriter", volume: 0.18 },
          { soundId: "clock", volume: 0.12 },
        ],
      },
      {
        id: "coffee_morning",
        name: "清晨咖啡",
        description: "咖啡馆氛围和键盘声，适合轻量任务。",
        items: [
          { soundId: "morning_coffee", volume: 0.5 },
          { soundId: "keyboard", volume: 0.2 },
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
      {
        id: "soft_storm",
        name: "远处雷雨",
        description: "雨声和低雷声形成包裹感。",
        items: [
          { soundId: "heavy_rain", volume: 0.52 },
          { soundId: "thunder", volume: 0.34 },
          { soundId: "wind", volume: 0.28 },
        ],
      },
      {
        id: "quiet_water",
        name: "安静水面",
        description: "漂流和划船声组合，形成柔和水面感。",
        items: [
          { soundId: "drifting", volume: 0.48 },
          { soundId: "rowing", volume: 0.26 },
        ],
      },
      {
        id: "snow_field",
        name: "雪地散步",
        description: "雪地脚步声叠加轻风，适合冷静下来。",
        items: [
          { soundId: "snow_walking", volume: 0.46 },
          { soundId: "wind", volume: 0.2 },
        ],
      },
      {
        id: "windmill_evening",
        name: "风车傍晚",
        description: "风车和风声形成稳定的自然背景。",
        items: [
          { soundId: "windmill", volume: 0.42 },
          { soundId: "wind", volume: 0.24 },
        ],
      },
    ],
  },
];

export const BUILT_IN_PRESETS: SoundPreset[] = PRESET_GROUPS.flatMap(
  (group) => group.presets,
);

export const DEFAULT_SOUND_PRESET = BUILT_IN_PRESETS[0];
