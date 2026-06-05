import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import type {
  BilibiliDirectAudioChapter,
  BilibiliDirectAudioSource,
  BilibiliDirectVideoTrack,
} from "./bilibiliDirectAudio";

interface BilibiliVideoPlaybackPanelProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: BilibiliDirectAudioSource | null;
  currentTimeSeconds: number;
  durationSeconds: number;
  isAudioPlaying: boolean;
  isLoading: boolean;
  onSeek: (seconds: number) => void;
}

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

const VIDEO_PREVIEW_FRAME_TIMEOUT_MS = 5000;
const HAVE_CURRENT_DATA_READY_STATE = 2;
const VIDEO_PREVIEW_UNAVAILABLE_MESSAGE =
  "视频画面暂不可用，音频播放不受影响";

function formatBandwidth(bandwidth?: number): string {
  return bandwidth ? `${Math.round(bandwidth / 1000)} kbps` : "未知";
}

function formatVideoResolution(track: BilibiliDirectVideoTrack | null): string {
  if (!track?.width || !track.height) {
    return "未知";
  }

  return `${track.width} x ${track.height}`;
}

function formatPlaybackTime(seconds: number): string {
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

function getProgressDurationSeconds(
  audioSource: BilibiliDirectAudioSource | null,
  durationSeconds: number,
): number {
  return finiteSeconds(durationSeconds) || finiteSeconds(audioSource?.durationSeconds ?? 0);
}

function getCurrentChapterIndex(
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

function getCollapsedVideoText(
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

function getVideoButtonLabel(
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

function getVideoPanelStatus(
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

function getVideoTracks(
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

function getVideoTrackSourceUrls(
  track: BilibiliDirectVideoTrack | null,
): string[] {
  if (!track) {
    return [];
  }

  return uniqueNonEmptyUrls([track.url, ...track.backupUrls]);
}

function isInterruptedPlaybackError(error: unknown): boolean {
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

function hasRenderedVideoFrame(video: HTMLVideoElement): boolean {
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

function getVideoPreviewFallbackAction({
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

function applyVideoPreviewFallbackAction(
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

function handleVideoPreviewFailure(
  context: VideoPreviewFallbackContext,
  handlers: VideoPreviewFallbackHandlers,
) {
  applyVideoPreviewFallbackAction(
    getVideoPreviewFallbackAction(context),
    handlers,
  );
}

export function BilibiliVideoPlaybackPanel({
  audioRef,
  audioSource,
  currentTimeSeconds,
  durationSeconds,
  isAudioPlaying,
  isLoading,
  onSeek,
}: BilibiliVideoPlaybackPanelProps) {
  const videoRegionId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const latestPlaybackRef = useRef({
    isExpanded: false,
    sourceKey: "",
    videoUrl: "",
  });
  const sourceKey = audioSource
    ? `${audioSource.bvid}:${audioSource.cid}:${audioSource.audioUrl}`
    : "";
  const chapters = useMemo(
    () => audioSource?.chapters ?? [],
    [audioSource],
  );
  const videoTracks = getVideoTracks(audioSource);
  const [expandedSourceKey, setExpandedSourceKey] = useState<string | null>(
    null,
  );
  const [selectedVideoTrack, setSelectedVideoTrack] = useState({
    sourceKey: "",
    trackId: "",
  });
  const [selectedVideoSource, setSelectedVideoSource] = useState({
    index: 0,
    sourceKey: "",
    trackId: "",
  });
  const [videoError, setVideoError] = useState<VideoPanelErrorState | null>(
    null,
  );
  const selectedVideoTrackId =
    selectedVideoTrack.sourceKey === sourceKey &&
    videoTracks.some((track) => track.id === selectedVideoTrack.trackId)
      ? selectedVideoTrack.trackId
      : (videoTracks[0]?.id ?? "");
  const currentVideoTrackIndex = videoTracks.findIndex(
    (track) => track.id === selectedVideoTrackId,
  );
  const currentVideoTrack =
    currentVideoTrackIndex >= 0 ? videoTracks[currentVideoTrackIndex] : null;
  const nextVideoTrackId =
    currentVideoTrackIndex >= 0
      ? (videoTracks[currentVideoTrackIndex + 1]?.id ?? "")
      : "";
  const videoSourceUrls = getVideoTrackSourceUrls(currentVideoTrack);
  const selectedVideoSourceIndex =
    selectedVideoSource.sourceKey === sourceKey &&
    selectedVideoSource.trackId === selectedVideoTrackId &&
    videoSourceUrls.length > 0
      ? Math.min(selectedVideoSource.index, videoSourceUrls.length - 1)
      : 0;
  const selectedVideoUrl = videoSourceUrls[selectedVideoSourceIndex];
  const progressDurationSeconds = getProgressDurationSeconds(
    audioSource,
    durationSeconds,
  );
  const safeCurrentTimeSeconds =
    progressDurationSeconds > 0
      ? Math.min(Math.max(0, currentTimeSeconds), progressDurationSeconds)
      : Math.max(0, currentTimeSeconds);
  const canSeek = Boolean(audioSource && progressDurationSeconds > 0);
  const currentChapterIndex = getCurrentChapterIndex(
    chapters,
    safeCurrentTimeSeconds,
  );
  const canExpandVideo = videoTracks.length > 0;
  const isVideoUnavailable = videoError?.sourceKey === sourceKey;
  const isExpanded = Boolean(
    canExpandVideo &&
      sourceKey &&
      expandedSourceKey === sourceKey &&
      !isVideoUnavailable,
  );
  const videoErrorMessage =
    isVideoUnavailable ? videoError.message : null;
  const panelClassName = [
    "video-source-panel",
    "glass-panel",
    audioSource ? "has-source" : "is-idle",
    isExpanded ? "is-expanded" : "is-collapsed",
    isVideoUnavailable ? "is-video-unavailable" : "",
  ].filter(Boolean).join(" ");

  useEffect(() => {
    latestPlaybackRef.current = {
      isExpanded,
      sourceKey,
      videoUrl: selectedVideoUrl ?? "",
    };
  }, [isExpanded, selectedVideoUrl, sourceKey]);

  useEffect(() => {
    if (!isExpanded || !selectedVideoUrl) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const audio = audioRef.current;
    video.muted = true;
    video.volume = 0;

    if (audio && Number.isFinite(audio.currentTime)) {
      try {
        video.currentTime = audio.currentTime;
      } catch {
        // 浏览器可能在 metadata 尚未载入时拒绝设置 currentTime。
      }
    }

    if (!isAudioPlaying) {
      video.pause();
      return;
    }

    const previewTimeoutId = window.setTimeout(() => {
      const latestPlayback = latestPlaybackRef.current;
      const latestVideo = videoRef.current;
      if (
        !latestPlayback.isExpanded ||
        latestPlayback.sourceKey !== sourceKey ||
        latestPlayback.videoUrl !== selectedVideoUrl ||
        !latestVideo ||
        hasRenderedVideoFrame(latestVideo)
      ) {
        return;
      }

      handleVideoPreviewFailure(
        {
          nextVideoTrackId,
          selectedVideoSourceIndex,
          selectedVideoTrackId,
          sourceCount: videoSourceUrls.length,
          sourceKey,
        },
        {
          setExpandedSourceKey,
          setSelectedVideoSource,
          setSelectedVideoTrack,
          setVideoError,
        },
      );
    }, VIDEO_PREVIEW_FRAME_TIMEOUT_MS);

    void video.play().catch((error: unknown) => {
      if (isInterruptedPlaybackError(error)) {
        return;
      }

      const latestPlayback = latestPlaybackRef.current;
      if (
        !latestPlayback.isExpanded ||
        latestPlayback.sourceKey !== sourceKey ||
        latestPlayback.videoUrl !== selectedVideoUrl
      ) {
        return;
      }

      handleVideoPreviewFailure(
        {
          nextVideoTrackId,
          selectedVideoSourceIndex,
          selectedVideoTrackId,
          sourceCount: videoSourceUrls.length,
          sourceKey,
        },
        {
          setExpandedSourceKey,
          setSelectedVideoSource,
          setSelectedVideoTrack,
          setVideoError,
        },
      );
    });

    return () => {
      window.clearTimeout(previewTimeoutId);
    };
  }, [
    audioRef,
    isAudioPlaying,
    isExpanded,
    nextVideoTrackId,
    selectedVideoSourceIndex,
    selectedVideoTrackId,
    selectedVideoUrl,
    sourceKey,
    videoSourceUrls.length,
  ]);

  function handleToggleVideo() {
    if (!canExpandVideo || !sourceKey) {
      return;
    }

    if (isVideoUnavailable) {
      setSelectedVideoSource({
        index: 0,
        sourceKey,
        trackId: selectedVideoTrackId,
      });
      setVideoError(null);
      setExpandedSourceKey(sourceKey);
      return;
    }

    setVideoError(null);
    setExpandedSourceKey((currentValue) =>
      currentValue === sourceKey ? null : sourceKey,
    );
  }

  function handleQualityChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!sourceKey) {
      return;
    }

    setVideoError(null);
    setSelectedVideoTrack({
      sourceKey,
      trackId: event.currentTarget.value,
    });
    setSelectedVideoSource({
      index: 0,
      sourceKey,
      trackId: event.currentTarget.value,
    });
  }

  function seekVideoPreviewTo(seconds: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    try {
      video.currentTime = seconds;
    } catch {
      // 浏览器可能在 metadata 尚未载入时拒绝设置 currentTime。
    }
  }

  function handleProgressChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSeconds = Number(event.currentTarget.value);
    if (!Number.isFinite(nextSeconds)) {
      return;
    }

    const targetSeconds =
      progressDurationSeconds > 0
        ? Math.min(Math.max(0, nextSeconds), progressDurationSeconds)
        : Math.max(0, nextSeconds);
    onSeek(targetSeconds);
    seekVideoPreviewTo(targetSeconds);
  }

  function handleChapterChange(event: ChangeEvent<HTMLSelectElement>) {
    const chapterIndex = Number(event.currentTarget.value);
    const chapter = Number.isInteger(chapterIndex)
      ? chapters[chapterIndex]
      : undefined;
    if (!chapter) {
      return;
    }

    onSeek(chapter.fromSeconds);
    seekVideoPreviewTo(chapter.fromSeconds);
  }

  function handleVideoError() {
    handleVideoPreviewFailure(
      {
        nextVideoTrackId,
        selectedVideoSourceIndex,
        selectedVideoTrackId,
        sourceCount: videoSourceUrls.length,
        sourceKey,
      },
      {
        setExpandedSourceKey,
        setSelectedVideoSource,
        setSelectedVideoTrack,
        setVideoError,
      },
    );
  }

  return (
    <section className={panelClassName}>
      <div className="video-source-header">
        <div>
          <h2>视频画面</h2>
          <p className="video-source-subtitle">
            {getVideoPanelStatus(
              audioSource,
              canExpandVideo,
              isExpanded,
              isLoading,
              isVideoUnavailable,
            )}
          </p>
        </div>
        <div className="video-source-actions">
          {videoTracks.length > 1 ? (
            <label className="video-quality-control">
              <span>画质</span>
              <select
                aria-label="视频画质"
                value={selectedVideoTrackId}
                onChange={handleQualityChange}
              >
                {videoTracks.map((track, index) => (
                  <option key={track.id} value={track.id}>
                    {index === 0 ? `${track.label}（默认）` : track.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            aria-controls={videoRegionId}
            aria-expanded={isExpanded}
            className="secondary-control-button video-source-toggle"
            disabled={!canExpandVideo}
            type="button"
            onClick={handleToggleVideo}
          >
            {getVideoButtonLabel(
              audioSource,
              canExpandVideo,
              isExpanded,
              isVideoUnavailable,
            )}
          </button>
        </div>
      </div>

      <div className="video-progress-shell" aria-label="播放进度">
        <div className="video-progress-time-row">
          <span>{formatPlaybackTime(safeCurrentTimeSeconds)}</span>
          <span>{formatPlaybackTime(progressDurationSeconds)}</span>
        </div>
        <div className="video-progress-range-shell">
          <input
            aria-label="播放进度"
            className="video-progress-range"
            disabled={!canSeek}
            max={Math.max(1, progressDurationSeconds)}
            min="0"
            step="1"
            type="range"
            value={Math.min(safeCurrentTimeSeconds, Math.max(1, progressDurationSeconds))}
            onChange={handleProgressChange}
          />
          {canSeek && chapters.length > 0 ? (
            <div className="video-progress-markers" aria-hidden="true">
              {chapters.map((chapter) => (
                <span
                  key={`${chapter.fromSeconds}:${chapter.content}`}
                  style={{
                    left: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (chapter.fromSeconds / progressDurationSeconds) * 100,
                      ),
                    )}%`,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
        {chapters.length > 0 ? (
          <label className="video-chapter-control">
            <span>章节</span>
            <select
              aria-label="视频章节"
              value={currentChapterIndex >= 0 ? String(currentChapterIndex) : ""}
              onChange={handleChapterChange}
            >
              {chapters.map((chapter, index) => (
                <option
                  key={`${chapter.fromSeconds}:${chapter.content}`}
                  value={index}
                >
                  {formatPlaybackTime(chapter.fromSeconds)} · {chapter.content}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div
        aria-label="直连视频画面"
        className={
          isExpanded
            ? "video-player-frame-shell"
            : "video-player-frame-shell video-player-frame-shell-collapsed"
        }
        id={videoRegionId}
      >
        {isExpanded && selectedVideoUrl ? (
          <video
            aria-label="直连视频播放器"
            className="video-native-player"
            key={selectedVideoUrl}
            muted
            playsInline
            preload="metadata"
            ref={videoRef}
            src={selectedVideoUrl}
            title={audioSource?.title}
            onError={handleVideoError}
          />
        ) : (
          <div className="video-player-collapsed-cover" role="status">
            <span>
              {getCollapsedVideoText(
                audioSource,
                isLoading,
                canExpandVideo,
                isVideoUnavailable,
              )}
            </span>
          </div>
        )}
      </div>

      {videoErrorMessage ? (
        <p className="video-frame-error" role="status">
          {videoErrorMessage}
        </p>
      ) : null}

      {audioSource ? (
        <div className="video-direct-source-shell" aria-label="直连媒体源">
          <dl className="video-direct-source-list">
            <div>
              <dt>BV</dt>
              <dd>{audioSource.bvid}</dd>
            </div>
            <div>
              <dt>av</dt>
              <dd>{audioSource.aid}</dd>
            </div>
            <div>
              <dt>cid</dt>
              <dd>{audioSource.cid}</dd>
            </div>
            <div>
              <dt>音频</dt>
              <dd>{audioSource.mimeType ?? audioSource.codecs ?? "音频轨"}</dd>
            </div>
            <div>
              <dt>音频码率</dt>
              <dd>{formatBandwidth(audioSource.bandwidth)}</dd>
            </div>
            <div>
              <dt>视频</dt>
              <dd>
                {canExpandVideo
                  ? currentVideoTrack?.mimeType ??
                    currentVideoTrack?.codecs ??
                    "视频轨"
                  : "无可用视频轨"}
              </dd>
            </div>
            <div>
              <dt>分辨率</dt>
              <dd>
                {canExpandVideo ? formatVideoResolution(currentVideoTrack) : "无"}
              </dd>
            </div>
            <div>
              <dt>视频码率</dt>
              <dd>
                {canExpandVideo
                  ? formatBandwidth(currentVideoTrack?.bandwidth)
                  : "无"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
