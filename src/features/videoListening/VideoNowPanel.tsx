import type { RefObject } from "react";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";
import type { BilibiliMetadata } from "./bilibiliMetadata";
import { PlaybackGlyph } from "../shared/PlaybackGlyph";

interface VideoNowPanelProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: BilibiliDirectAudioSource | null;
  canUseOuterPlaybackButton: boolean;
  canUseOuterVolumeControl: boolean;
  isDirectAudioPlaying: boolean;
  isCurrentVideoFavorite: boolean;
  listeningVolume: number;
  loadedReferenceLabel: string | null;
  videoMetadata: BilibiliMetadata | null;
  videoPanelStatusText: string;
  videoStatusText: string;
  videoTransportLabel: string;
  onListeningVolumeChange: (volume: number) => void;
  onSaveCurrentVideo: () => void;
  onTogglePlayback: () => void;
}

export function VideoNowPanel({
  audioRef,
  audioSource,
  canUseOuterPlaybackButton,
  canUseOuterVolumeControl,
  isDirectAudioPlaying,
  isCurrentVideoFavorite,
  listeningVolume,
  loadedReferenceLabel,
  videoMetadata,
  videoPanelStatusText,
  videoStatusText,
  videoTransportLabel,
  onListeningVolumeChange,
  onSaveCurrentVideo,
  onTogglePlayback,
}: VideoNowPanelProps) {
  const canSaveCurrentVideo = Boolean(audioSource);
  const volumeInputId = "video-listening-volume";

  return (
    <section
      className="video-now glass-panel"
      aria-labelledby="video-player-heading"
    >
      <div className="section-heading sound-section-heading">
        <div>
          <h2 id="video-player-heading">收听面板</h2>
        </div>
        <span className="section-meta">{videoPanelStatusText}</span>
      </div>

      <section className="video-listening-controls" aria-label="收听控制">
        <audio
          aria-label="直连音频播放器"
          className="video-direct-audio"
          preload="none"
          ref={audioRef}
        />
        <button
          className="transport-button video-playback-button"
          type="button"
          aria-pressed={audioSource ? isDirectAudioPlaying : undefined}
          disabled={!canUseOuterPlaybackButton}
          onClick={onTogglePlayback}
        >
          <PlaybackGlyph isPlaying={isDirectAudioPlaying} />
          <span>{videoTransportLabel}</span>
        </button>
        <label className="video-volume-control" htmlFor={volumeInputId}>
          <span className="field-label">
            <span>收听音量</span>
            <strong>{listeningVolume}%</strong>
          </span>
          <input
            aria-label="收听音量"
            className="video-volume-range"
            disabled={!canUseOuterVolumeControl}
            id={volumeInputId}
            min="0"
            max="100"
            name="videoListeningVolume"
            title={
              canUseOuterVolumeControl
                ? "调整直连音频音量"
                : "载入直连音频后可调整音量"
            }
            type="range"
            value={listeningVolume}
            onChange={(event) => {
              onListeningVolumeChange(Number(event.currentTarget.value));
            }}
          />
        </label>
      </section>

      <div className="video-listening-card">
        <div className="video-cover-shell">
          {videoMetadata?.imageUrl ? (
            <img
              alt={`${videoMetadata.title} 封面`}
              className="video-cover-image"
              referrerPolicy="no-referrer"
              src={videoMetadata.imageUrl}
            />
          ) : (
            <span className="video-cover-placeholder" aria-hidden="true">
              B
            </span>
          )}
        </div>
        <div className="video-listening-copy">
          <p className="app-kicker">
            {audioSource ? "B 站直连音频" : "等待来源"}
          </p>
          <h3>{videoMetadata?.title ?? loadedReferenceLabel ?? "尚未载入"}</h3>
          <p>{videoStatusText}</p>
        </div>
        <button
          className="custom-audio-button video-favorite-save-button"
          type="button"
          disabled={!canSaveCurrentVideo}
          aria-pressed={isCurrentVideoFavorite}
          onClick={onSaveCurrentVideo}
        >
          {isCurrentVideoFavorite ? "已收藏" : "收藏视频"}
        </button>
      </div>

    </section>
  );
}
