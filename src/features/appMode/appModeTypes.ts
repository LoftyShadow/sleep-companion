export type AppMode = "mixer" | "sleep" | "audiobook" | "video";

interface AppModeOption {
  label: string;
  mode: AppMode;
}

export const APP_MODE_OPTIONS: AppModeOption[] = [
  { label: "声音", mode: "mixer" },
  { label: "睡眠", mode: "sleep" },
  { label: "听书", mode: "audiobook" },
  { label: "听视频", mode: "video" },
];

export const APP_MODE_WORKSPACE_LABELS: Record<AppMode, string> = {
  audiobook: "听书工作台",
  mixer: "声音工作台",
  sleep: "睡眠入口",
  video: "听视频工作台",
};
