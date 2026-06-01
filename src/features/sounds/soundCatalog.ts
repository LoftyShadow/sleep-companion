import {
  XMSLEEP_SOUNDS,
  type XmsleepSoundId,
} from "./xmsleepSoundCatalog";

export type BuiltInSoundId =
  | "heavy_rain"
  | "campfire"
  | "forest_birds"
  | "thunder"
  | "wind"
  | "clock"
  | "keyboard"
  | "library"
  | "drifting"
  | "heavy_rain_seg_0"
  | "morning_coffee"
  | "office"
  | "rowing"
  | "snow_walking"
  | "typewriter"
  | "umbrella_rain"
  | "windmill"
  | "asmr_ear_cleaning_soft"
  | "asmr_ear_cleaning_deep"
  | "asmr_paper_rub"
  | "asmr_keyboard_taps"
  | "asmr_typewriter_ticks"
  | "asmr_boiling_water"
  | "asmr_bubbles"
  | "asmr_gravel_steps"
  | "asmr_leaf_steps"
  | "asmr_car_roof_rain"
  | XmsleepSoundId;

export type CustomSoundId = `custom:${string}`;

export type SoundId = BuiltInSoundId | CustomSoundId;

export type SoundSourceKind = "built-in" | "custom";

export type AudioMimeType =
  | "audio/ogg"
  | "audio/mpeg"
  | "audio/wav"
  | "audio/mp4"
  | "audio/aac"
  | "audio/flac"
  | "audio/webm"
  | "audio/x-m4a"
  | (string & {});

export interface AudioSourceDefinition {
  src: string;
  type: AudioMimeType;
}

export interface SoundDefinition {
  id: SoundId;
  name: string;
  accessibleName?: string;
  sourceKind: SoundSourceKind;
  androidResourceName?: string;
  imageSrc: string;
  sources: AudioSourceDefinition[];
  xmsleepCategoryId?: string;
  xmsleepSourceId?: string;
}

export const WHITE_NOISE_SOUNDS: SoundDefinition[] = [
  {
    id: "heavy_rain",
    name: "大雨",
    sourceKind: "built-in",
    androidResourceName: "heavy_rain",
    imageSrc: "/images/sounds/heavy_rain.webp",
    sources: [{ src: "/audio/heavy_rain.ogg", type: "audio/ogg" }],
  },
  {
    id: "campfire",
    name: "篝火",
    sourceKind: "built-in",
    androidResourceName: "campfire",
    imageSrc: "/images/sounds/campfire.webp",
    sources: [{ src: "/audio/campfire.ogg", type: "audio/ogg" }],
  },
  {
    id: "forest_birds",
    name: "林中鸟声",
    sourceKind: "built-in",
    androidResourceName: "forest_birds",
    imageSrc: "/images/sounds/forest_birds.webp",
    sources: [{ src: "/audio/forest_birds.ogg", type: "audio/ogg" }],
  },
  {
    id: "thunder",
    name: "雷声",
    sourceKind: "built-in",
    androidResourceName: "thunder",
    imageSrc: "/images/sounds/thunder.webp",
    sources: [{ src: "/audio/thunder.ogg", type: "audio/ogg" }],
  },
  {
    id: "wind",
    name: "风声",
    sourceKind: "built-in",
    androidResourceName: "wind",
    imageSrc: "/images/sounds/wind.webp",
    sources: [{ src: "/audio/wind.ogg", type: "audio/ogg" }],
  },
  {
    id: "clock",
    name: "时钟",
    sourceKind: "built-in",
    androidResourceName: "clock",
    imageSrc: "/images/sounds/clock.webp",
    sources: [{ src: "/audio/clock.ogg", type: "audio/ogg" }],
  },
  {
    id: "keyboard",
    name: "键盘",
    sourceKind: "built-in",
    androidResourceName: "keyboard",
    imageSrc: "/images/sounds/keyboard.webp",
    sources: [{ src: "/audio/keyboard.ogg", type: "audio/ogg" }],
  },
  {
    id: "library",
    name: "图书馆",
    sourceKind: "built-in",
    androidResourceName: "library",
    imageSrc: "/images/sounds/library.webp",
    sources: [{ src: "/audio/library.ogg", type: "audio/ogg" }],
  },
  {
    id: "drifting",
    name: "漂流",
    sourceKind: "built-in",
    androidResourceName: "drifting",
    imageSrc: "/images/sounds/drifting.webp",
    sources: [{ src: "/audio/drifting.ogg", type: "audio/ogg" }],
  },
  {
    id: "heavy_rain_seg_0",
    name: "大雨片段",
    sourceKind: "built-in",
    androidResourceName: "heavy_rain_seg_0",
    imageSrc: "/images/sounds/heavy_rain_seg_0.webp",
    sources: [{ src: "/audio/heavy_rain_seg_0.ogg", type: "audio/ogg" }],
  },
  {
    id: "morning_coffee",
    name: "清晨咖啡",
    sourceKind: "built-in",
    androidResourceName: "morning_coffee",
    imageSrc: "/images/sounds/morning_coffee.webp",
    sources: [{ src: "/audio/morning_coffee.ogg", type: "audio/ogg" }],
  },
  {
    id: "office",
    name: "办公室",
    sourceKind: "built-in",
    androidResourceName: "office",
    imageSrc: "/images/sounds/office.webp",
    sources: [{ src: "/audio/office.ogg", type: "audio/ogg" }],
  },
  {
    id: "rowing",
    name: "划船",
    sourceKind: "built-in",
    androidResourceName: "rowing",
    imageSrc: "/images/sounds/rowing.webp",
    sources: [{ src: "/audio/rowing.ogg", type: "audio/ogg" }],
  },
  {
    id: "snow_walking",
    name: "雪地行走",
    sourceKind: "built-in",
    androidResourceName: "snow_walking",
    imageSrc: "/images/sounds/snow_walking.webp",
    sources: [{ src: "/audio/snow_walking.ogg", type: "audio/ogg" }],
  },
  {
    id: "typewriter",
    name: "打字机",
    sourceKind: "built-in",
    androidResourceName: "typewriter",
    imageSrc: "/images/sounds/typewriter.webp",
    sources: [{ src: "/audio/typewriter.ogg", type: "audio/ogg" }],
  },
  {
    id: "umbrella_rain",
    name: "伞下雨声",
    sourceKind: "built-in",
    androidResourceName: "umbrella_rain",
    imageSrc: "/images/sounds/umbrella_rain.webp",
    sources: [{ src: "/audio/umbrella_rain.ogg", type: "audio/ogg" }],
  },
  {
    id: "windmill",
    name: "风车",
    sourceKind: "built-in",
    androidResourceName: "windmill",
    imageSrc: "/images/sounds/windmill.webp",
    sources: [{ src: "/audio/windmill.ogg", type: "audio/ogg" }],
  },
];

export const ASMR_SOUNDS: SoundDefinition[] = [
  {
    id: "asmr_ear_cleaning_soft",
    name: "轻柔掏耳",
    sourceKind: "built-in",
    androidResourceName: "asmr_ear_cleaning_soft",
    imageSrc: "/images/sounds/asmr/asmr_ear_cleaning_soft.png",
    sources: [
      { src: "/audio/asmr/asmr_ear_cleaning_soft.ogg", type: "audio/ogg" },
    ],
  },
  {
    id: "asmr_ear_cleaning_deep",
    name: "深度掏耳",
    sourceKind: "built-in",
    androidResourceName: "asmr_ear_cleaning_deep",
    imageSrc: "/images/sounds/asmr/asmr_ear_cleaning_deep.png",
    sources: [
      { src: "/audio/asmr/asmr_ear_cleaning_deep.ogg", type: "audio/ogg" },
    ],
  },
  {
    id: "asmr_paper_rub",
    name: "纸张摩擦",
    sourceKind: "built-in",
    androidResourceName: "asmr_paper_rub",
    imageSrc: "/images/sounds/asmr/asmr_paper_rub.png",
    sources: [{ src: "/audio/asmr/asmr_paper_rub.ogg", type: "audio/ogg" }],
  },
  {
    id: "asmr_keyboard_taps",
    name: "键盘轻敲",
    sourceKind: "built-in",
    androidResourceName: "asmr_keyboard_taps",
    imageSrc: "/images/sounds/asmr/asmr_keyboard_taps.png",
    sources: [
      { src: "/audio/asmr/asmr_keyboard_taps.ogg", type: "audio/ogg" },
    ],
  },
  {
    id: "asmr_typewriter_ticks",
    name: "打字机触发",
    sourceKind: "built-in",
    androidResourceName: "asmr_typewriter_ticks",
    imageSrc: "/images/sounds/asmr/asmr_typewriter_ticks.png",
    sources: [
      { src: "/audio/asmr/asmr_typewriter_ticks.ogg", type: "audio/ogg" },
    ],
  },
  {
    id: "asmr_boiling_water",
    name: "沸水细响",
    sourceKind: "built-in",
    androidResourceName: "asmr_boiling_water",
    imageSrc: "/images/sounds/asmr/asmr_boiling_water.png",
    sources: [
      { src: "/audio/asmr/asmr_boiling_water.ogg", type: "audio/ogg" },
    ],
  },
  {
    id: "asmr_bubbles",
    name: "气泡声",
    sourceKind: "built-in",
    androidResourceName: "asmr_bubbles",
    imageSrc: "/images/sounds/asmr/asmr_bubbles.png",
    sources: [{ src: "/audio/asmr/asmr_bubbles.ogg", type: "audio/ogg" }],
  },
  {
    id: "asmr_gravel_steps",
    name: "碎石脚步",
    sourceKind: "built-in",
    androidResourceName: "asmr_gravel_steps",
    imageSrc: "/images/sounds/asmr/asmr_gravel_steps.png",
    sources: [
      { src: "/audio/asmr/asmr_gravel_steps.ogg", type: "audio/ogg" },
    ],
  },
  {
    id: "asmr_leaf_steps",
    name: "落叶脚步",
    sourceKind: "built-in",
    androidResourceName: "asmr_leaf_steps",
    imageSrc: "/images/sounds/asmr/asmr_leaf_steps.png",
    sources: [{ src: "/audio/asmr/asmr_leaf_steps.ogg", type: "audio/ogg" }],
  },
  {
    id: "asmr_car_roof_rain",
    name: "车顶雨点",
    sourceKind: "built-in",
    androidResourceName: "asmr_car_roof_rain",
    imageSrc: "/images/sounds/asmr/asmr_car_roof_rain.png",
    sources: [
      { src: "/audio/asmr/asmr_car_roof_rain.ogg", type: "audio/ogg" },
    ],
  },
];

export const BUILT_IN_SOUNDS: SoundDefinition[] = [
  ...WHITE_NOISE_SOUNDS,
  ...ASMR_SOUNDS,
  ...XMSLEEP_SOUNDS,
];

export function isCustomSoundId(soundId: SoundId): soundId is CustomSoundId {
  return soundId.startsWith("custom:");
}

export function isCustomSound(sound: SoundDefinition): boolean {
  return sound.sourceKind === "custom" || isCustomSoundId(sound.id);
}
