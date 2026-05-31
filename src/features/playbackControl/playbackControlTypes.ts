export type PlaybackControlStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "unavailable";

export interface PlaybackControlState {
  actionLabel: string;
  canToggle: boolean;
  status: PlaybackControlStatus;
  summary: string;
}

export type PlaybackModuleId = "mixer" | "audiobook" | "video";

export const PLAYBACK_MODULE_IDS: PlaybackModuleId[] = [
  "mixer",
  "audiobook",
  "video",
];

export const PLAYBACK_MODULE_LABELS: Record<PlaybackModuleId, string> = {
  audiobook: "听书",
  mixer: "声音",
  video: "听视频",
};

export const INITIAL_PLAYBACK_CONTROL_REQUEST_IDS: Record<
  PlaybackModuleId,
  number
> = {
  audiobook: 0,
  mixer: 0,
  video: 0,
};

export const DEFAULT_PLAYBACK_CONTROL_STATES: Record<
  PlaybackModuleId,
  PlaybackControlState
> = {
  audiobook: {
    actionLabel: "播放",
    canToggle: true,
    status: "idle",
    summary: "默认书稿待播放",
  },
  mixer: {
    actionLabel: "准备中",
    canToggle: false,
    status: "loading",
    summary: "正在准备播放器",
  },
  video: {
    actionLabel: "打开",
    canToggle: true,
    status: "unavailable",
    summary: "未载入来源",
  },
};
