import { useEffect, useId, useRef, useState } from "react";
import {
  BilibiliSourceKind,
  createBilibiliPlaybackSource,
  type BilibiliPlaybackSource,
} from "./bilibiliVideo";
import "./VideoListeningView.css";

const DEFAULT_VIDEO_INPUT = "";
const DEFAULT_LISTENING_VOLUME = 70;

interface VideoListeningViewProps {
  globalStopRequestId: number;
}

export function VideoListeningView({
  globalStopRequestId,
}: VideoListeningViewProps) {
  const inputId = useId();
  const [videoInput, setVideoInput] = useState(DEFAULT_VIDEO_INPUT);
  const [videoSource, setVideoSource] = useState<BilibiliPlaybackSource | null>(
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
  const canControlOfficialPlayer =
    videoSource?.sourceKind === BilibiliSourceKind.Live;

  function postLivePlayerCommand(type: string, value: unknown) {
    if (!canControlOfficialPlayer || !iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      `setPlayer-${JSON.stringify({ type, value })}`,
      "https://www.bilibili.com",
    );
  }

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    setVideoSource(null);
    setIsPlaybackMounted(false);
    setIsPlayerExpanded(false);
  }, [globalStopRequestId]);

  function handleLoadVideo() {
    const trimmedInput = videoInput.trim();
    if (!trimmedInput) {
      setVideoSource(null);
      setIsPlaybackMounted(false);
      setIsPlayerExpanded(false);
      setErrorMessage("请输入 B 站视频或直播链接");
      return;
    }

    const nextVideoSource = createBilibiliPlaybackSource(trimmedInput);
    if (!nextVideoSource) {
      setVideoSource(null);
      setIsPlaybackMounted(false);
      setIsPlayerExpanded(false);
      setErrorMessage("暂时只支持 B 站 BV、av、ep 和直播间链接");
      return;
    }

    setVideoSource(nextVideoSource);
    setIsPlaybackMounted(true);
    setIsPlayerExpanded(false);
    setErrorMessage(null);
  }

  function handleTogglePlayback() {
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
            <header className="video-listening-header">
              <p className="app-kicker">B 站官方播放器</p>
              <h1>听视频</h1>
              <p className="mix-summary">
                {videoSource?.label ?? "粘贴 B 站视频或直播链接后载入"}
              </p>
            </header>

            <div className="video-link-form">
              <div className="video-step-label">
                <span>01</span>
                <strong>载入来源</strong>
              </div>

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
                      handleLoadVideo();
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
              </div>
              <p className="video-link-hint">
                载入后会尝试自动播放，是否出声取决于浏览器和 B 站播放器。
              </p>
              <button
                className="custom-audio-button video-load-button"
                type="button"
                onClick={handleLoadVideo}
              >
                载入
              </button>
              <p className="custom-audio-status" role="status">
                {videoSource
                  ? `已载入 ${videoSource.label}`
                  : "支持 BV、av、ep 和直播间链接"}
              </p>
            </div>
          </section>

          <section
            className="video-now glass-panel"
            aria-labelledby="video-player-heading"
          >
            <div className="section-heading sound-section-heading">
              <div>
                <p className="app-kicker">音频收听</p>
                <h2 id="video-player-heading">收听面板</h2>
              </div>
              <span className="section-meta">
                {isPlaybackMounted ? "播放中" : "待命"}
              </span>
            </div>

            <div className="video-listening-card">
              <div className="video-listening-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="video-listening-copy">
                <p className="app-kicker">
                  {videoSource?.playerLabel ?? "等待来源"}
                </p>
                <h3>{videoSource?.label ?? "尚未载入"}</h3>
                <p>
                  {videoSource && isPlaybackMounted
                    ? "已连接官方播放源"
                    : videoSource
                      ? "已暂停官方播放源"
                      : "粘贴链接后开始收听"}
                </p>
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
              <p className="video-control-hint">
                {canControlOfficialPlayer
                  ? "音量会同步到 B 站直播播放器。"
                  : "普通视频外链未提供外部音量接口，请在官方播放源内调整音量。"}
              </p>
            </section>
          </section>
        </section>

        <section className="video-source-panel glass-panel">
          <div className="video-source-header">
            <div>
              <p className="app-kicker">官方来源</p>
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
