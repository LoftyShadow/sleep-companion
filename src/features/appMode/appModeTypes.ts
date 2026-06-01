export type AppMode = "mixer" | "audiobook" | "video" | "account";

interface AppModeOption {
  label: string;
  mode: AppMode;
}

export const APP_MODE_OPTIONS: AppModeOption[] = [
  { label: "声音", mode: "mixer" },
  { label: "听书", mode: "audiobook" },
  { label: "听视频", mode: "video" },
  { label: "我的", mode: "account" },
];

export const APP_MODE_WORKSPACE_LABELS: Record<AppMode, string> = {
  account: "我的",
  audiobook: "听书工作台",
  mixer: "声音工作台",
  video: "听视频工作台",
};
