import { useId, useState } from "react";
import {
  createBilibiliVideoSource,
  type BilibiliVideoSource,
} from "./bilibiliVideo";
import "./VideoListeningView.css";

const DEFAULT_VIDEO_INPUT = "";

export function VideoListeningView() {
  const inputId = useId();
  const [videoInput, setVideoInput] = useState(DEFAULT_VIDEO_INPUT);
  const [videoSource, setVideoSource] = useState<BilibiliVideoSource | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleLoadVideo() {
    const trimmedInput = videoInput.trim();
    if (!trimmedInput) {
      setVideoSource(null);
      setErrorMessage("请输入 B 站视频链接");
      return;
    }

    const nextVideoSource = createBilibiliVideoSource(trimmedInput);
    if (!nextVideoSource) {
      setVideoSource(null);
      setErrorMessage("暂时只支持 B 站 BV、av 和 ep 链接");
      return;
    }

    setVideoSource(nextVideoSource);
    setErrorMessage(null);
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
        <aside
          className="video-listening-control glass-panel"
          aria-label="听视频控制"
        >
          <header className="video-listening-header">
            <p className="app-kicker">B 站官方播放器</p>
            <h1>听视频</h1>
            <p className="mix-summary">
              {videoSource?.label ?? "粘贴 B 站链接后载入"}
            </p>
          </header>

          <section className="video-link-panel" aria-label="B 站视频链接">
            <label className="field-label" htmlFor={inputId}>
              视频链接
            </label>
            <div className="video-link-row">
              <input
                className="video-link-input"
                id={inputId}
                placeholder="https://www.bilibili.com/video/BV..."
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
              载入视频
            </button>
            <p className="custom-audio-status" role="status">
              {videoSource
                ? `已载入 ${videoSource.label}`
                : "支持 BV、av 和 ep 链接"}
            </p>
          </section>
        </aside>

        <section
          className="video-player-panel glass-panel"
          aria-labelledby="video-player-heading"
        >
          <div className="section-heading sound-section-heading">
            <div>
              <p className="app-kicker">官方嵌入播放</p>
              <h2 id="video-player-heading">视频播放</h2>
            </div>
            <span className="section-meta">B 站</span>
          </div>

          <div className="video-player-frame-shell">
            {videoSource ? (
              <iframe
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="video-player-frame"
                key={videoSource.embedUrl}
                referrerPolicy="strict-origin-when-cross-origin"
                src={videoSource.embedUrl}
                title={`B 站播放器 ${videoSource.label}`}
              />
            ) : (
              <div className="video-player-empty" role="status">
                <p>等待载入 B 站视频</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
