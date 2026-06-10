import type { KeyboardEvent, ReactNode } from "react";

interface VideoLinkPanelProps {
  inputId: string;
  shortcutSlot?: ReactNode;
  sourceSummaryText: string;
  videoInput: string;
  onInputChange: (value: string) => void;
  onLoadVideo: () => void;
  onPasteVideoLink: () => void;
}

export function VideoLinkPanel({
  inputId,
  shortcutSlot,
  sourceSummaryText,
  videoInput,
  onInputChange,
  onLoadVideo,
  onPasteVideoLink,
}: VideoLinkPanelProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      onLoadVideo();
    }
  }

  return (
    <section
      className="video-link-panel glass-panel"
      aria-label="B 站视频或直播链接"
    >
      <div className="video-link-form">
        <h1 className="video-listening-title">听视频</h1>
        {shortcutSlot ? (
          <div className="video-link-shortcut-slot">{shortcutSlot}</div>
        ) : null}

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
              onInputChange(event.currentTarget.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            className="secondary-control-button video-paste-button"
            type="button"
            onClick={onPasteVideoLink}
          >
            粘贴
          </button>
          <button
            className="custom-audio-button video-load-button"
            type="button"
            onClick={onLoadVideo}
          >
            载入
          </button>
        </div>
        <div className="video-link-meta">
          <p className="video-link-hint">
            支持 BV 和 av 视频链接；直连模式暂不支持番剧和直播。
          </p>
          <p className="custom-audio-status" role="status">
            {sourceSummaryText}
          </p>
        </div>
      </div>
    </section>
  );
}
