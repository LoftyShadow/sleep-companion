import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import {
  BilibiliSourceKind,
  createBilibiliPlaybackSource,
  type BilibiliPlaybackSource,
} from "./bilibiliVideo";
import type {
  BilibiliCreatorVideo,
  BilibiliCreatorVideosLoader,
} from "./bilibiliCreator";
import { BilibiliCreatorPanel } from "./BilibiliCreatorPanel";
import {
  loadBilibiliMetadata,
  type BilibiliMetadata,
  type BilibiliMetadataLoader,
} from "./bilibiliMetadata";
import type {
  PlaybackControlState,
  PlaybackControlStatus,
} from "../playbackControl/playbackControlTypes";
import { PlaybackGlyph } from "../shared/PlaybackGlyph";
import "./VideoListeningView.css";

const DEFAULT_VIDEO_INPUT = "";
const DEFAULT_LISTENING_VOLUME = 70;

interface VideoListeningViewProps {
  creatorVideosLoader?: BilibiliCreatorVideosLoader;
  fileSystem?: FileSystemPort;
  globalStopRequestId: number;
  metadataLoader?: BilibiliMetadataLoader;
  playbackControlRequestId?: number;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
}

function usesOfficialFrameControls(videoSource: BilibiliPlaybackSource | null) {
  return videoSource?.sourceKind === BilibiliSourceKind.Video;
}

function getVideoPlaybackControlStatus(
  videoSource: BilibiliPlaybackSource | null,
  isPlaybackMounted: boolean,
): PlaybackControlStatus {
  if (!videoSource) {
    return "unavailable";
  }

  if (usesOfficialFrameControls(videoSource)) {
    return "loaded";
  }

  return isPlaybackMounted ? "playing" : "paused";
}

function getVideoPlaybackControlActionLabel(
  videoSource: BilibiliPlaybackSource | null,
  isPlaybackMounted: boolean,
): string {
  if (!videoSource) {
    return "打开";
  }

  if (usesOfficialFrameControls(videoSource)) {
    return "查看";
  }

  return isPlaybackMounted ? "暂停" : "播放";
}

function getVideoTransportButtonLabel(
  videoSource: BilibiliPlaybackSource | null,
  isPlaybackMounted: boolean,
): string {
  if (!videoSource) {
    return "播放";
  }

  if (usesOfficialFrameControls(videoSource)) {
    return "播放/暂停";
  }

  return isPlaybackMounted ? "暂停" : "播放";
}

function getVideoControlHintText(
  videoSource: BilibiliPlaybackSource | null,
): string {
  if (videoSource?.sourceKind === BilibiliSourceKind.Live) {
    return "播放和音量会同步到 B 站直播播放器。";
  }

  if (usesOfficialFrameControls(videoSource)) {
    return "普通视频请在官方播放器内播放、暂停和调音量。";
  }

  return "载入 B 站视频或直播后可收听。";
}

function getVideoStatusText({
  isMetadataLoading,
  isPlaybackMounted,
  metadataErrorMessage,
  videoSource,
}: {
  isMetadataLoading: boolean;
  isPlaybackMounted: boolean;
  metadataErrorMessage: string | null;
  videoSource: BilibiliPlaybackSource | null;
}): string {
  if (isMetadataLoading) {
    return "正在获取封面和标题";
  }

  if (metadataErrorMessage) {
    return metadataErrorMessage;
  }

  if (!videoSource) {
    return "粘贴链接后开始收听";
  }

  if (usesOfficialFrameControls(videoSource)) {
    return "官方播放器已载入";
  }

  return isPlaybackMounted ? "已连接官方播放源" : "已暂停官方播放源";
}

export function VideoListeningView({
  creatorVideosLoader,
  fileSystem,
  globalStopRequestId,
  metadataLoader = loadBilibiliMetadata,
  playbackControlRequestId = 0,
  onPlaybackControlStateChange,
}: VideoListeningViewProps) {
  const inputId = useId();
  const [videoInput, setVideoInput] = useState(DEFAULT_VIDEO_INPUT);
  const [videoSource, setVideoSource] = useState<BilibiliPlaybackSource | null>(
    null,
  );
  const [videoMetadata, setVideoMetadata] = useState<BilibiliMetadata | null>(
    null,
  );
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [metadataErrorMessage, setMetadataErrorMessage] = useState<string | null>(
    null,
  );
  const [isPlaybackMounted, setIsPlaybackMounted] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [listeningVolume, setListeningVolume] = useState(
    DEFAULT_LISTENING_VOLUME,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handledGlobalStopRequestIdRef = useRef(globalStopRequestId);
  const handledPlaybackControlRequestIdRef = useRef(0);
  const metadataRequestIdRef = useRef(0);
  const canControlOfficialPlayer =
    videoSource?.sourceKind === BilibiliSourceKind.Live;
  const usesOfficialVideoControls = Boolean(
    videoSource && usesOfficialFrameControls(videoSource),
  );
  const canUsePlaybackControlAction =
    !videoSource || canControlOfficialPlayer || usesOfficialVideoControls;
  const canUseOuterPlaybackButton = Boolean(
    videoSource && (canControlOfficialPlayer || usesOfficialVideoControls),
  );
  const canUseOuterVolumeControl = canControlOfficialPlayer;
  const playbackControlStatus = getVideoPlaybackControlStatus(
    videoSource,
    isPlaybackMounted,
  );

  const postLivePlayerCommand = useCallback((type: string, value: unknown) => {
    if (!canControlOfficialPlayer || !iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      `setPlayer-${JSON.stringify({ type, value })}`,
      "https://www.bilibili.com",
    );
  }, [canControlOfficialPlayer]);

  const handleTogglePlayback = useCallback(() => {
    if (!videoSource) {
      setErrorMessage("请先载入 B 站视频或直播链接");
      return;
    }

    if (usesOfficialFrameControls(videoSource)) {
      setIsPlaybackMounted(true);
      setIsPlayerExpanded(true);
      setErrorMessage(null);
      return;
    }

    const nextValue = !isPlaybackMounted;
    postLivePlayerCommand("play", nextValue);
    setIsPlaybackMounted(nextValue);
    setErrorMessage(null);
  }, [isPlaybackMounted, postLivePlayerCommand, videoSource]);

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    metadataRequestIdRef.current += 1;
    setVideoSource(null);
    setVideoMetadata(null);
    setIsMetadataLoading(false);
    setMetadataErrorMessage(null);
    setIsPlaybackMounted(false);
    setIsPlayerExpanded(false);
  }, [globalStopRequestId]);

  useEffect(() => {
    onPlaybackControlStateChange?.({
      actionLabel: getVideoPlaybackControlActionLabel(
        videoSource,
        isPlaybackMounted,
      ),
      canToggle: canUsePlaybackControlAction,
      status: playbackControlStatus,
      summary: videoMetadata?.title ?? videoSource?.label ?? "未载入来源",
    });
  }, [
    canUsePlaybackControlAction,
    isPlaybackMounted,
    videoMetadata,
    onPlaybackControlStateChange,
    playbackControlStatus,
    videoSource,
  ]);

  useEffect(() => {
    if (
      playbackControlRequestId === 0 ||
      playbackControlRequestId === handledPlaybackControlRequestIdRef.current
    ) {
      return;
    }

    handledPlaybackControlRequestIdRef.current = playbackControlRequestId;
    handleTogglePlayback();
  }, [handleTogglePlayback, playbackControlRequestId]);

  async function loadVideoSource(
    nextVideoSource: BilibiliPlaybackSource,
    metadataHint?: BilibiliMetadata,
  ) {
    setVideoSource(nextVideoSource);
    setVideoMetadata(metadataHint ?? null);
    setIsMetadataLoading(!metadataHint);
    setMetadataErrorMessage(null);
    setIsPlaybackMounted(true);
    setIsPlayerExpanded(true);
    setErrorMessage(null);

    const requestId = metadataRequestIdRef.current + 1;
    metadataRequestIdRef.current = requestId;
    if (metadataHint) {
      return;
    }

    try {
      const metadata = await metadataLoader(nextVideoSource.reference);
      if (metadataRequestIdRef.current !== requestId) {
        return;
      }

      setVideoMetadata(metadata);
    } catch {
      if (metadataRequestIdRef.current !== requestId) {
        return;
      }

      setMetadataErrorMessage("元信息暂不可用");
    } finally {
      if (metadataRequestIdRef.current === requestId) {
        setIsMetadataLoading(false);
      }
    }
  }

  function resetVideoSource(errorText: string) {
    metadataRequestIdRef.current += 1;
    setVideoSource(null);
    setVideoMetadata(null);
    setIsMetadataLoading(false);
    setMetadataErrorMessage(null);
    setIsPlaybackMounted(false);
    setIsPlayerExpanded(false);
    setErrorMessage(errorText);
  }

  async function handleLoadVideo() {
    const trimmedInput = videoInput.trim();
    if (!trimmedInput) {
      resetVideoSource("请输入 B 站视频或直播链接");
      return;
    }

    const nextVideoSource = createBilibiliPlaybackSource(trimmedInput);
    if (!nextVideoSource) {
      resetVideoSource("暂时只支持 B 站 BV、av、ep 和直播间链接");
      return;
    }

    await loadVideoSource(nextVideoSource);
  }

  function handleCreatorVideoSelect(video: BilibiliCreatorVideo) {
    const nextVideoSource = createBilibiliPlaybackSource(video.bvid);
    if (!nextVideoSource) {
      setErrorMessage("无法载入这个 B 站视频");
      return;
    }

    setVideoInput(video.bvid);
    void loadVideoSource(nextVideoSource, {
      imageUrl: video.coverUrl,
      title: video.title,
    });
  }

  function handlePlayerFrameLoad() {
    postLivePlayerCommand("changeVolume", { volume: listeningVolume });
    postLivePlayerCommand("play", isPlaybackMounted);
  }

  function handleListeningVolumeChange(nextVolume: number) {
    setListeningVolume(nextVolume);
    postLivePlayerCommand("changeVolume", { volume: nextVolume });
  }

  async function handlePasteVideoLink() {
    if (!navigator.clipboard?.readText) {
      setErrorMessage("当前环境不能读取剪贴板，请手动粘贴");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      setVideoInput(clipboardText);
      setErrorMessage(null);
    } catch {
      setErrorMessage("读取剪贴板失败，请手动粘贴");
    }
  }

  const videoStatusText = getVideoStatusText({
    isMetadataLoading,
    isPlaybackMounted,
    metadataErrorMessage,
    videoSource,
  });
  const videoPanelStatusText =
    videoSource && usesOfficialFrameControls(videoSource)
      ? "已载入"
      : isPlaybackMounted
        ? "播放中"
        : "待命";
  const videoTransportLabel = videoSource
    ? getVideoTransportButtonLabel(videoSource, isPlaybackMounted)
    : "播放";
  const videoControlHintText = getVideoControlHintText(videoSource);
  const frameEmbedUrl = videoSource?.embedUrl ?? "";
  const shouldShowOfficialPlayerFrame = Boolean(
    videoSource &&
      (usesOfficialFrameControls(videoSource) ||
        isPlaybackMounted ||
        canControlOfficialPlayer),
  );

  return (
    <div className="video-listening-view">
      {errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="video-listening-layout">
        <section className="video-listening-stage" aria-label="听视频控制">
          <section
            className="video-link-panel glass-panel"
            aria-label="B 站视频或直播链接"
          >
            <div className="video-link-form">
              <h1 className="video-listening-title">听视频</h1>

              <label className="field-label" htmlFor={inputId}>
                视频或直播链接
              </label>
              <div className="video-link-row">
                <input
                  className="video-link-input"
                  id={inputId}
                  placeholder="https://www.bilibili.com/video/BV... 或 https://live.bilibili.com/..."
                  type="text"
                  value={videoInput}
                  onChange={(event) => {
                    setVideoInput(event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleLoadVideo();
                    }
                  }}
                />
                <button
                  className="secondary-control-button video-paste-button"
                  type="button"
                  onClick={() => {
                    void handlePasteVideoLink();
                  }}
                >
                  粘贴
                </button>
                <button
                  className="custom-audio-button video-load-button"
                  type="button"
                  onClick={() => {
                    void handleLoadVideo();
                  }}
                >
                  载入
                </button>
              </div>
              <div className="video-link-meta">
                <p className="video-link-hint">
                  支持 BV、av、ep 和直播间链接；载入后会尝试自动播放。
                </p>
                <p className="custom-audio-status" role="status">
                  {videoSource ? `已载入 ${videoSource.label}` : "等待载入播放源"}
                </p>
              </div>
            </div>
          </section>

          <section
            className="video-now glass-panel"
            aria-labelledby="video-player-heading"
          >
            <div className="section-heading sound-section-heading">
              <div>
                <h2 id="video-player-heading">收听面板</h2>
              </div>
              <span className="section-meta">
                {videoPanelStatusText}
              </span>
            </div>

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
                  {videoSource?.playerLabel ?? "等待来源"}
                </p>
                <h3>{videoMetadata?.title ?? videoSource?.label ?? "尚未载入"}</h3>
                <p>{videoStatusText}</p>
              </div>
            </div>

            <section className="video-listening-controls" aria-label="收听控制">
              <button
                className="transport-button video-playback-button"
                type="button"
                aria-pressed={
                  canControlOfficialPlayer ? isPlaybackMounted : undefined
                }
                disabled={!canUseOuterPlaybackButton}
                onClick={handleTogglePlayback}
              >
                <PlaybackGlyph
                  isPlaying={canControlOfficialPlayer && isPlaybackMounted}
                />
                <span>{videoTransportLabel}</span>
              </button>
              <label className="video-volume-control">
                <span className="field-label">
                  <span>收听音量</span>
                  <strong>{listeningVolume}%</strong>
                </span>
                <input
                  aria-label="收听音量"
                  className="video-volume-range"
                  disabled={!canUseOuterVolumeControl}
                  min="0"
                  max="100"
                  title={
                    canUseOuterVolumeControl
                      ? "调整直播收听音量"
                      : "普通视频请在官方播放器内调整音量"
                  }
                  type="range"
                  value={listeningVolume}
                  onChange={(event) => {
                    handleListeningVolumeChange(
                      Number(event.currentTarget.value),
                    );
                  }}
                />
              </label>
              <p className="video-control-hint">{videoControlHintText}</p>
            </section>
          </section>
        </section>

        <section className="video-source-panel glass-panel">
          <div className="video-source-header">
            <div>
              <h2>官方播放源</h2>
            </div>
            <button
              className="secondary-control-button video-source-toggle"
              type="button"
              disabled={!videoSource}
              onClick={() => {
                setIsPlayerExpanded((currentValue) => !currentValue);
              }}
            >
              {isPlayerExpanded ? "收起播放源" : "展开播放源"}
            </button>
          </div>

          <div
            className={
              isPlayerExpanded
                ? "video-player-frame-shell"
                : "video-player-frame-shell video-player-frame-shell-collapsed"
            }
            aria-label="官方播放源"
          >
            {videoSource && shouldShowOfficialPlayerFrame ? (
              <>
                <iframe
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="video-player-frame"
                  key={frameEmbedUrl}
                  ref={iframeRef}
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={frameEmbedUrl}
                  title={`${videoSource.playerLabel} ${videoSource.label}`}
                  onLoad={handlePlayerFrameLoad}
                />
                {!isPlayerExpanded ? (
                  <div className="video-player-collapsed-cover" aria-hidden="true">
                    <span>画面已收起，继续收听声音</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="video-player-empty" role="status">
                <p>{videoSource ? "播放源已暂停" : "等待载入 B 站视频或直播"}</p>
              </div>
            )}
          </div>
        </section>

        <BilibiliCreatorPanel
          fileSystem={fileSystem}
          videosLoader={creatorVideosLoader}
          onVideoSelect={handleCreatorVideoSelect}
        />
      </div>
    </div>
  );
}
