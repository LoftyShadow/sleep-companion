export type SoundId =
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
  | "windmill";

export interface AudioSourceDefinition {
  src: string;
  type: "audio/ogg" | "audio/mpeg";
}

export interface SoundDefinition {
  id: SoundId;
  name: string;
  androidResourceName: string;
  sources: AudioSourceDefinition[];
}

export const BUILT_IN_SOUNDS: SoundDefinition[] = [
  {
    id: "heavy_rain",
    name: "大雨",
    androidResourceName: "heavy_rain",
    sources: [{ src: "/audio/heavy_rain.ogg", type: "audio/ogg" }],
  },
  {
    id: "campfire",
    name: "篝火",
    androidResourceName: "campfire",
    sources: [{ src: "/audio/campfire.ogg", type: "audio/ogg" }],
  },
  {
    id: "forest_birds",
    name: "林中鸟声",
    androidResourceName: "forest_birds",
    sources: [{ src: "/audio/forest_birds.ogg", type: "audio/ogg" }],
  },
  {
    id: "thunder",
    name: "雷声",
    androidResourceName: "thunder",
    sources: [{ src: "/audio/thunder.ogg", type: "audio/ogg" }],
  },
  {
    id: "wind",
    name: "风声",
    androidResourceName: "wind",
    sources: [{ src: "/audio/wind.ogg", type: "audio/ogg" }],
  },
  {
    id: "clock",
    name: "时钟",
    androidResourceName: "clock",
    sources: [{ src: "/audio/clock.ogg", type: "audio/ogg" }],
  },
  {
    id: "keyboard",
    name: "键盘",
    androidResourceName: "keyboard",
    sources: [{ src: "/audio/keyboard.ogg", type: "audio/ogg" }],
  },
  {
    id: "library",
    name: "图书馆",
    androidResourceName: "library",
    sources: [{ src: "/audio/library.ogg", type: "audio/ogg" }],
  },
  {
    id: "drifting",
    name: "漂流",
    androidResourceName: "drifting",
    sources: [{ src: "/audio/drifting.ogg", type: "audio/ogg" }],
  },
  {
    id: "heavy_rain_seg_0",
    name: "大雨片段",
    androidResourceName: "heavy_rain_seg_0",
    sources: [{ src: "/audio/heavy_rain_seg_0.ogg", type: "audio/ogg" }],
  },
  {
    id: "morning_coffee",
    name: "清晨咖啡",
    androidResourceName: "morning_coffee",
    sources: [{ src: "/audio/morning_coffee.ogg", type: "audio/ogg" }],
  },
  {
    id: "office",
    name: "办公室",
    androidResourceName: "office",
    sources: [{ src: "/audio/office.ogg", type: "audio/ogg" }],
  },
  {
    id: "rowing",
    name: "划船",
    androidResourceName: "rowing",
    sources: [{ src: "/audio/rowing.ogg", type: "audio/ogg" }],
  },
  {
    id: "snow_walking",
    name: "雪地行走",
    androidResourceName: "snow_walking",
    sources: [{ src: "/audio/snow_walking.ogg", type: "audio/ogg" }],
  },
  {
    id: "typewriter",
    name: "打字机",
    androidResourceName: "typewriter",
    sources: [{ src: "/audio/typewriter.ogg", type: "audio/ogg" }],
  },
  {
    id: "umbrella_rain",
    name: "伞下雨声",
    androidResourceName: "umbrella_rain",
    sources: [{ src: "/audio/umbrella_rain.ogg", type: "audio/ogg" }],
  },
  {
    id: "windmill",
    name: "风车",
    androidResourceName: "windmill",
    sources: [{ src: "/audio/windmill.ogg", type: "audio/ogg" }],
  },
];
