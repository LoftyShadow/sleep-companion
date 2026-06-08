import { useId } from "react";
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
  const panelClassName = [
    "video-source-panel",
    "glass-panel",
    audioSource ? "has-source" : "is-idle",
    isExpanded ? "is-expanded" : "is-collapsed",
    isVideoUnavailable ? "is-video-unavailable" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
