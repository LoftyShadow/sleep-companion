import type {
  BilibiliDirectAudioChapter,
  BilibiliDirectAudioSource,
  BilibiliDirectVideoTrack,
} from "./bilibiliDirectAudio";

interface SelectedVideoTrackState {
  sourceKey: string;
  trackId: string;
}

interface SelectedVideoSourceState extends SelectedVideoTrackState {
  index: number;
}

interface VideoPanelErrorState {
  message: string;
  sourceKey: string;
}

interface VideoPreviewFallbackContext {
  nextVideoTrackId: string;
  selectedVideoSourceIndex: number;
  selectedVideoTrackId: string;
  sourceCount: number;
  sourceKey: string;
}

interface VideoPreviewFallbackHandlers {
  setExpandedSourceKey: (sourceKey: string | null) => void;
  setSelectedVideoSource: (source: SelectedVideoSourceState) => void;
  setSelectedVideoTrack: (track: SelectedVideoTrackState) => void;
  setVideoError: (error: VideoPanelErrorState | null) => void;
}

type VideoPreviewFallbackAction =
  | {
      index: number;
      sourceKey: string;
      trackId: string;
      type: "source";
    }
  | {
      sourceKey: string;
      trackId: string;
      type: "track";
    }
  | {
      sourceKey: string;
      type: "unavailable";
    }
  | {
      type: "none";
    };

export const VIDEO_PREVIEW_FRAME_TIMEOUT_MS = 5000;
const VIDEO_PREVIEW_UNAVAILABLE_MESSAGE =
  "视频画面暂不可用，音频播放不受影响";

const HAVE_CURRENT_DATA_READY_STATE = 2;

export function formatBandwidth(bandwidth?: number): string {
  return bandwidth ? `${Math.round(bandwidth / 1000)} kbps` : "未知";
}

export function formatVideoResolution(
  track: BilibiliDirectVideoTrack | null,
): string {
  if (!track?.width || !track.height) {
    return "未知";
  }

  return `${track.width} x ${track.height}`;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      hours.toString(),
      minutes.toString().padStart(2, "0"),
      remainingSeconds.toString().padStart(2, "0"),
    ].join(":");
  }

  return [
    minutes.toString().padStart(2, "0"),
    remainingSeconds.toString().padStart(2, "0"),
  ].join(":");
}

function finiteSeconds(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getProgressDurationSeconds(
  audioSource: BilibiliDirectAudioSource | null,
  durationSeconds: number,
): number {
  return (
    finiteSeconds(durationSeconds) ||
    finiteSeconds(audioSource?.durationSeconds ?? 0)
  );
}

export function getCurrentChapterIndex(
  chapters: readonly BilibiliDirectAudioChapter[],
  currentTimeSeconds: number,
): number {
  if (chapters.length === 0) {
    return -1;
  }

  const currentSeconds = Math.max(0, currentTimeSeconds);
  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    if (chapters[index].fromSeconds <= currentSeconds) {
      return index;
    }
  }

  return 0;
}

export function getCollapsedVideoText(
  audioSource: BilibiliDirectAudioSource | null,
  isLoading: boolean,
  hasVideoSource: boolean,
  isVideoUnavailable: boolean,
): string {
  if (isLoading) {
    return "正在解析 B 站直连媒体";
  }

  if (!audioSource) {
    return "载入 BV 或 av 后可展开视频画面";
  }

  if (isVideoUnavailable) {
    return "已切回音频播放";
  }

  return hasVideoSource ? "视频画面已隐藏" : "当前视频画面不可用";
}

export function getVideoButtonLabel(
  audioSource: BilibiliDirectAudioSource | null,
  hasVideoSource: boolean,
  isExpanded: boolean,
  isVideoUnavailable: boolean,
): string {
  if (!audioSource) {
    return "待载入";
  }

  if (!hasVideoSource) {
    return "画面不可用";
  }

  if (isVideoUnavailable) {
    return "重试视频";
  }

  return isExpanded ? "隐藏视频" : "展开视频";
}

export function getVideoPanelStatus(
  audioSource: BilibiliDirectAudioSource | null,
  hasVideoSource: boolean,
  isExpanded: boolean,
  isLoading: boolean,
  isVideoUnavailable: boolean,
): string {
  if (isLoading) {
    return "解析中";
  }

  if (!audioSource) {
    return "待载入";
  }

  if (!hasVideoSource || isVideoUnavailable) {
    return "仅音频";
  }

  return isExpanded ? "画面显示中" : "画面隐藏";
}

function uniqueNonEmptyUrls(urls: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      urls
        .map((url) => url?.trim())
        .filter((url): url is string => Boolean(url)),
    ),
  );
}

function createFallbackVideoTrack(
  audioSource: BilibiliDirectAudioSource | null,
): BilibiliDirectVideoTrack | null {
  if (!audioSource?.videoUrl) {
    return null;
  }

  return {
    backupUrls: audioSource.videoBackupUrls,
    bandwidth: audioSource.videoBandwidth,
    codecs: audioSource.videoCodecs,
    height: audioSource.videoHeight,
    id: "default",
    label: audioSource.videoHeight ? `${audioSource.videoHeight}p` : "默认画质",
    mimeType: audioSource.videoMimeType,
    url: audioSource.videoUrl,
    width: audioSource.videoWidth,
  };
}

export function getVideoTracks(
  audioSource: BilibiliDirectAudioSource | null,
): BilibiliDirectVideoTrack[] {
  if (!audioSource) {
    return [];
  }

  if (audioSource.videoTracks.length > 0) {
    return audioSource.videoTracks;
  }

  const fallbackTrack = createFallbackVideoTrack(audioSource);

  return fallbackTrack ? [fallbackTrack] : [];
}

export function getVideoTrackSourceUrls(
  track: BilibiliDirectVideoTrack | null,
): string[] {
  if (!track) {
    return [];
  }

  return uniqueNonEmptyUrls([track.url, ...track.backupUrls]);
}

export function isInterruptedPlaybackError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getDecodedVideoFrameCount(video: HTMLVideoElement): number | null {
  const quality = video.getVideoPlaybackQuality?.();
  if (typeof quality?.totalVideoFrames === "number") {
    return quality.totalVideoFrames;
  }

  const webkitDecodedFrameCount = (video as {
    webkitDecodedFrameCount?: unknown;
  }).webkitDecodedFrameCount;

  return typeof webkitDecodedFrameCount === "number" &&
    Number.isFinite(webkitDecodedFrameCount)
    ? webkitDecodedFrameCount
    : null;
}

export function hasRenderedVideoFrame(video: HTMLVideoElement): boolean {
  const decodedFrameCount = getDecodedVideoFrameCount(video);
  if (decodedFrameCount !== null) {
    return decodedFrameCount > 0;
  }

  return (
    video.readyState >= HAVE_CURRENT_DATA_READY_STATE &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

export function getVideoPreviewFallbackAction({
  nextVideoTrackId,
  selectedVideoSourceIndex,
  selectedVideoTrackId,
  sourceCount,
  sourceKey,
}: VideoPreviewFallbackContext): VideoPreviewFallbackAction {
  if (!sourceKey) {
    return { type: "none" };
  }

  if (selectedVideoSourceIndex < sourceCount - 1) {
    return {
      index: selectedVideoSourceIndex + 1,
      sourceKey,
      trackId: selectedVideoTrackId,
      type: "source",
    };
  }

  if (nextVideoTrackId) {
    return {
      sourceKey,
      trackId: nextVideoTrackId,
      type: "track",
    };
  }

  return {
    sourceKey,
    type: "unavailable",
  };
}

export function applyVideoPreviewFallbackAction(
  action: VideoPreviewFallbackAction,
  handlers: VideoPreviewFallbackHandlers,
) {
  switch (action.type) {
    case "source":
      handlers.setVideoError(null);
      handlers.setSelectedVideoSource({
        index: action.index,
        sourceKey: action.sourceKey,
        trackId: action.trackId,
      });
      break;
    case "track":
      handlers.setVideoError(null);
      handlers.setSelectedVideoTrack({
        sourceKey: action.sourceKey,
        trackId: action.trackId,
      });
      handlers.setSelectedVideoSource({
        index: 0,
        sourceKey: action.sourceKey,
        trackId: action.trackId,
      });
      break;
    case "unavailable":
      handlers.setVideoError({
        message: VIDEO_PREVIEW_UNAVAILABLE_MESSAGE,
        sourceKey: action.sourceKey,
      });
      handlers.setExpandedSourceKey(null);
      break;
    case "none":
      break;
  }
}
