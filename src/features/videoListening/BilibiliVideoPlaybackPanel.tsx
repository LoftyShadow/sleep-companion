import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";

interface BilibiliVideoPlaybackPanelProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: BilibiliDirectAudioSource | null;
  isAudioPlaying: boolean;
  isLoading: boolean;
}

function formatBandwidth(bandwidth?: number): string {
  return bandwidth ? `${Math.round(bandwidth / 1000)} kbps` : "未知";
}

function formatVideoResolution(source: BilibiliDirectAudioSource): string {
  if (!source.videoWidth || !source.videoHeight) {
    return "未知";
  }

  return `${source.videoWidth} x ${source.videoHeight}`;
}

function getCollapsedVideoText(
  audioSource: BilibiliDirectAudioSource | null,
  isLoading: boolean,
): string {
  if (isLoading) {
    return "正在解析 B 站直连媒体";
  }

  if (!audioSource) {
    return "载入 BV 或 av 后可展开视频画面";
  }

  return audioSource.videoUrl ? "视频画面已隐藏" : "当前视频画面不可用";
}

function getVideoButtonLabel(
  audioSource: BilibiliDirectAudioSource | null,
  isExpanded: boolean,
): string {
  if (!audioSource) {
    return "待载入";
  }

  if (!audioSource.videoUrl) {
    return "画面不可用";
  }

  return isExpanded ? "隐藏视频" : "展开视频";
}

function getVideoPanelStatus(
  audioSource: BilibiliDirectAudioSource | null,
  isExpanded: boolean,
  isLoading: boolean,
): string {
  if (isLoading) {
    return "解析中";
  }

  if (!audioSource) {
    return "待载入";
  }

  if (!audioSource.videoUrl) {
    return "仅音频";
  }

  return isExpanded ? "画面显示中" : "画面隐藏";
}

export function BilibiliVideoPlaybackPanel({
  audioRef,
  audioSource,
  isAudioPlaying,
  isLoading,
}: BilibiliVideoPlaybackPanelProps) {
  const videoRegionId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceKey = audioSource
    ? `${audioSource.bvid}:${audioSource.cid}:${audioSource.audioUrl}`
    : "";
  const [expandedSourceKey, setExpandedSourceKey] = useState<string | null>(
    null,
  );
  const [videoError, setVideoError] = useState<{
    message: string;
    sourceKey: string;
  } | null>(
    null,
  );
  const videoUrl = audioSource?.videoUrl;
  const canExpandVideo = Boolean(videoUrl);
  const isExpanded = Boolean(
    canExpandVideo && sourceKey && expandedSourceKey === sourceKey,
  );
  const videoErrorMessage =
    videoError?.sourceKey === sourceKey ? videoError.message : null;
  const panelClassName = [
    "video-source-panel",
    "glass-panel",
    audioSource ? "has-source" : "is-idle",
    isExpanded ? "is-expanded" : "is-collapsed",
  ].join(" ");

  useEffect(() => {
    if (!isExpanded || !videoUrl) {
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

    void video.play().catch(() => {
      setVideoError({
        message: "视频画面暂不可用",
        sourceKey,
      });
    });
  }, [audioRef, isAudioPlaying, isExpanded, sourceKey, videoUrl]);

  function handleToggleVideo() {
    if (!canExpandVideo || !sourceKey) {
      return;
    }

    setVideoError(null);
    setExpandedSourceKey((currentValue) =>
      currentValue === sourceKey ? null : sourceKey,
    );
  }

  return (
    <section className={panelClassName}>
      <div className="video-source-header">
        <div>
          <h2>视频画面</h2>
          <p className="video-source-subtitle">
            {getVideoPanelStatus(audioSource, isExpanded, isLoading)}
          </p>
        </div>
        <button
          aria-controls={videoRegionId}
          aria-expanded={isExpanded}
          className="secondary-control-button video-source-toggle"
          disabled={!canExpandVideo}
          type="button"
          onClick={handleToggleVideo}
        >
          {getVideoButtonLabel(audioSource, isExpanded)}
        </button>
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
        {isExpanded && videoUrl ? (
          <video
            aria-label="直连视频播放器"
            className="video-native-player"
            key={videoUrl}
            muted
            playsInline
            preload="metadata"
            ref={videoRef}
            src={videoUrl}
            title={audioSource?.title}
            onError={() => {
              setVideoError({
                message: "视频画面暂不可用",
                sourceKey,
              });
            }}
          />
        ) : (
          <div className="video-player-collapsed-cover" role="status">
            <span>{getCollapsedVideoText(audioSource, isLoading)}</span>
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
                {audioSource.videoUrl
                  ? audioSource.videoMimeType ??
                    audioSource.videoCodecs ??
                    "视频轨"
                  : "无可用视频轨"}
              </dd>
            </div>
            <div>
              <dt>分辨率</dt>
              <dd>{audioSource.videoUrl ? formatVideoResolution(audioSource) : "无"}</dd>
            </div>
            <div>
              <dt>视频码率</dt>
              <dd>
                {audioSource.videoUrl
                  ? formatBandwidth(audioSource.videoBandwidth)
                  : "无"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
