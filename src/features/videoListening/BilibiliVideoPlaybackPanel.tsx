import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";
import {
  getCollapsedVideoText,
  getVideoButtonLabel,
  getVideoPanelStatus,
} from "./bilibiliVideoPlaybackUtils";
import { useBilibiliVideoPreview } from "./useBilibiliVideoPreview";
import { VideoProgressControls } from "./VideoProgressControls";
import { VideoSourceDetails } from "./VideoSourceDetails";

function getFullscreenElement(): Element | null {
  return document.fullscreenElement;
}

interface WebKitFullscreenVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen: () => void;
}

function isWebKitFullscreenVideoElement(
  video: HTMLVideoElement | null,
): video is WebKitFullscreenVideoElement {
  return Boolean(
    video &&
      "webkitEnterFullscreen" in video &&
      typeof video.webkitEnterFullscreen === "function",
  );
}

function getWebKitEnterFullscreen(
  video: HTMLVideoElement | null,
): (() => void) | null {
  if (!isWebKitFullscreenVideoElement(video)) {
    return null;
  }

  return () => {
    video.webkitEnterFullscreen();
  };
}

interface BilibiliVideoPlaybackPanelProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: BilibiliDirectAudioSource | null;
  currentTimeSeconds: number;
  durationSeconds: number;
  isAudioPlaying: boolean;
  isLoading: boolean;
  onSeek: (seconds: number) => void;
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
  const videoQualitySelectId = useId();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canUseInlineVideoFullscreen, setCanUseInlineVideoFullscreen] =
    useState(false);
  const {
    canExpandVideo,
    currentVideoTrack,
    handleQualityChange,
    handleToggleVideo,
    handleVideoError,
    isExpanded,
    isVideoUnavailable,
    seekVideoPreviewTo,
    selectedVideoTrackId,
    selectedVideoUrl,
    videoErrorMessage,
    videoRef,
    videoTracks,
  } = useBilibiliVideoPreview({
    audioRef,
    audioSource,
    isAudioPlaying,
  });
  const canUseStandardFullscreen =
    typeof document.fullscreenEnabled !== "boolean" ||
    document.fullscreenEnabled;
  const canUseFullscreen =
    isExpanded && Boolean(selectedVideoUrl) &&
    (canUseStandardFullscreen || canUseInlineVideoFullscreen);
  const panelClassName = [
    "video-source-panel",
    "glass-panel",
    audioSource ? "has-source" : "is-idle",
    isExpanded ? "is-expanded" : "is-collapsed",
    isVideoUnavailable ? "is-video-unavailable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const handleToggleFullscreen = useCallback(() => {
    if (!isExpanded || !selectedVideoUrl) {
      return;
    }

    if (getFullscreenElement()) {
      void document.exitFullscreen();
      return;
    }

    if (typeof frameRef.current?.requestFullscreen === "function") {
      void frameRef.current.requestFullscreen();
      return;
    }

    getWebKitEnterFullscreen(videoRef.current)?.();
  }, [isExpanded, selectedVideoUrl, videoRef]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(getFullscreenElement() === frameRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setCanUseInlineVideoFullscreen(
        isExpanded &&
        Boolean(selectedVideoUrl) &&
        Boolean(getWebKitEnterFullscreen(videoRef.current)),
    );
  }, [isExpanded, selectedVideoUrl, videoRef]);

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
            <label
              className="video-quality-control"
              htmlFor={videoQualitySelectId}
            >
              <span>画质</span>
              <select
                aria-label="视频画质"
                id={videoQualitySelectId}
                name="videoQuality"
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
          <button
            aria-controls={videoRegionId}
            aria-pressed={isFullscreen}
            className="secondary-control-button video-fullscreen-toggle"
            disabled={!canUseFullscreen}
            type="button"
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
        </div>
      </div>

      <VideoProgressControls
        audioSource={audioSource}
        currentTimeSeconds={currentTimeSeconds}
        durationSeconds={durationSeconds}
        onPreviewSeek={seekVideoPreviewTo}
        onSeek={onSeek}
      />

      <div
        aria-label="直连视频画面"
        className={
          isExpanded
            ? "video-player-frame-shell"
            : "video-player-frame-shell video-player-frame-shell-collapsed"
        }
        id={videoRegionId}
        ref={frameRef}
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

      <VideoSourceDetails
        audioSource={audioSource}
        canExpandVideo={canExpandVideo}
        currentVideoTrack={currentVideoTrack}
      />
    </section>
  );
}
