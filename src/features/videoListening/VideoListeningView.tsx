import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  BilibiliSourceKind,
  createBilibiliPlaybackSource,
  type BilibiliPlaybackSource,
} from "./bilibiliVideo";
import {
  loadBilibiliMetadata,
  type BilibiliMetadata,
  type BilibiliMetadataLoader,
} from "./bilibiliMetadata";
import type {
  PlaybackControlState,
  PlaybackControlStatus,
} from "../playbackControl/playbackControlTypes";
import "./VideoListeningView.css";

const DEFAULT_VIDEO_INPUT = "";
const DEFAULT_LISTENING_VOLUME = 70;

interface VideoListeningViewProps {
  globalStopRequestId: number;
  metadataLoader?: BilibiliMetadataLoader;
  playbackControlRequestId?: number;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
}

function getVideoPlaybackControlStatus(
  videoSource: BilibiliPlaybackSource | null,
  isPlaybackMounted: boolean,
): PlaybackControlStatus {
  if (!videoSource) {
    return "unavailable";
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

  return isPlaybackMounted ? "暂停" : "播放";
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

  return isPlaybackMounted ? "已连接官方播放源" : "已暂停官方播放源";
}

export function VideoListeningView({
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

    setIsPlaybackMounted((currentValue) => {
      const nextValue = !currentValue;
      postLivePlayerCommand("play", nextValue);
      return nextValue;
    });
    setErrorMessage(null);
  }, [postLivePlayerCommand, videoSource]);

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
      canToggle: true,
      status: playbackControlStatus,
      summary: videoMetadata?.title ?? videoSource?.label ?? "未载入来源",
    });
  }, [
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

  async function handleLoadVideo() {
    const trimmedInput = videoInput.trim();
    if (!trimmedInput) {
      metadataRequestIdRef.current += 1;
      setVideoSource(null);
      setVideoMetadata(null);
      setIsMetadataLoading(false);
      setMetadataErrorMessage(null);
      setIsPlaybackMounted(false);
      setIsPlayerExpanded(false);
      setErrorMessage("请输入 B 站视频或直播链接");
      return;
    }

    const nextVideoSource = createBilibiliPlaybackSource(trimmedInput);
    if (!nextVideoSource) {
      metadataRequestIdRef.current += 1;
      setVideoSource(null);
      setVideoMetadata(null);
      setIsMetadataLoading(false);
      setMetadataErrorMessage(null);
      setIsPlaybackMounted(false);
      setIsPlayerExpanded(false);
      setErrorMessage("暂时只支持 B 站 BV、av、ep 和直播间链接");
      return;
    }

    setVideoSource(nextVideoSource);
    setVideoMetadata(null);
    setIsMetadataLoading(true);
    setMetadataErrorMessage(null);
    setIsPlaybackMounted(true);
    setIsPlayerExpanded(false);
    setErrorMessage(null);

    const requestId = metadataRequestIdRef.current + 1;
    metadataRequestIdRef.current = requestId;

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
                  type="url"
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
                {isPlaybackMounted ? "播放中" : "待命"}
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
                aria-pressed={videoSource ? isPlaybackMounted : false}
                disabled={!videoSource}
                onClick={handleTogglePlayback}
              >
                <span className="transport-glyph" aria-hidden="true" />
                <span>{isPlaybackMounted ? "暂停" : "播放"}</span>
              </button>
              <label className="video-volume-control">
                <span className="field-label">
                  <span>收听音量</span>
                  <strong>{listeningVolume}%</strong>
                </span>
                <input
                  aria-label="收听音量"
                  className="video-volume-range"
                  disabled={!canControlOfficialPlayer}
                  min="0"
                  max="100"
                  type="range"
                  value={listeningVolume}
                  onChange={(event) => {
                    handleListeningVolumeChange(
                      Number(event.currentTarget.value),
                    );
                  }}
                />
              </label>
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
            {videoSource && (isPlaybackMounted || canControlOfficialPlayer) ? (
              <>
                <iframe
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="video-player-frame"
                  key={videoSource.embedUrl}
                  ref={iframeRef}
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={videoSource.embedUrl}
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
      </div>
    </div>
  );
}
