import { useId, useState } from "react";
import type { AudiobookPlaybackStatus } from "./audiobookTypes";
import {
  isSupportedPlainTextBookFile,
  readPlainTextBookFile,
} from "./textSegmentation";
import type { TtsEnginePort } from "./TtsEnginePort";
import { useAudiobookPlayer } from "./useAudiobookPlayer";

const DEFAULT_AUDIOBOOK_TITLE = "雨夜试读";
const DEFAULT_AUDIOBOOK_TEXT = `雨声落在窗外，房间里只剩下很轻的呼吸声。

她把书翻到折角的那一页，灯光停在纸面上，像一小片安静的湖。

如果今晚睡不着，就让声音慢慢读下去。读到句子变远，读到世界安静下来。`;

const STATUS_LABELS: Record<AudiobookPlaybackStatus, string> = {
  idle: "待机",
  loading: "准备朗读",
  playing: "朗读中",
  paused: "已暂停",
  ended: "已结束",
  error: "需要处理",
};

interface AppModeSwitcherProps {
  activeMode: "mixer" | "audiobook";
  onModeChange: (mode: "mixer" | "audiobook") => void;
}

interface AudiobookViewProps extends AppModeSwitcherProps {
  engine: TtsEnginePort;
}

function getPrimaryActionLabel(
  status: AudiobookPlaybackStatus,
  supportsPause: boolean,
): string {
  if (status === "playing") {
    return supportsPause ? "暂停" : "停止";
  }
  if (status === "paused") {
    return "继续";
  }
  if (status === "loading") {
    return "准备中";
  }
  return "播放";
}

export function AppModeSwitcher({
  activeMode,
  onModeChange,
}: AppModeSwitcherProps) {
  return (
    <nav className="app-mode-nav" aria-label="应用模式">
      <button
        aria-pressed={activeMode === "mixer"}
        className="app-mode-button"
        type="button"
        onClick={() => {
          onModeChange("mixer");
        }}
      >
        声音
      </button>
      <button
        aria-pressed={activeMode === "audiobook"}
        className="app-mode-button"
        type="button"
        onClick={() => {
          onModeChange("audiobook");
        }}
      >
        听书
      </button>
    </nav>
  );
}

export function AudiobookView({
  activeMode,
  engine,
  onModeChange,
}: AudiobookViewProps) {
  const [bookTitle, setBookTitle] = useState(DEFAULT_AUDIOBOOK_TITLE);
  const [bookText, setBookText] = useState(DEFAULT_AUDIOBOOK_TEXT);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);
  const titleInputId = useId();
  const textInputId = useId();
  const voiceSelectId = useId();
  const rateInputId = useId();
  const audiobook = useAudiobookPlayer({ text: bookText, engine });
  const canRead = audiobook.segments.length > 0 && audiobook.isEngineSupported;
  const isBusy = audiobook.status === "loading";
  const primaryActionLabel = getPrimaryActionLabel(
    audiobook.status,
    engine.supportsPause,
  );
  const visibleErrorMessage = importErrorMessage ?? audiobook.errorMessage;

  async function handleBookFiles(files: readonly File[]) {
    const file = files[0];
    if (!file) {
      return;
    }

    if (!isSupportedPlainTextBookFile(file)) {
      setImportMessage(null);
      setImportErrorMessage("第一版听书仅支持 txt 和 markdown 文本文件");
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    setImportErrorMessage(null);

    try {
      const book = await readPlainTextBookFile(file);
      setBookTitle(book.title);
      setBookText(book.text);
      setImportMessage(`已导入 ${book.title}`);
    } catch (error) {
      setImportErrorMessage(
        error instanceof Error ? error.message : "导入书稿失败",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handlePrimaryAction() {
    if (audiobook.status === "playing") {
      if (engine.supportsPause) {
        audiobook.pause();
        return;
      }

      audiobook.stop();
      return;
    }

    if (audiobook.status === "paused") {
      audiobook.resume();
      return;
    }

    void audiobook.play();
  }

  return (
    <main className="app-shell audiobook-shell">
      <AppModeSwitcher activeMode={activeMode} onModeChange={onModeChange} />

      {visibleErrorMessage ? (
        <p className="error-message" role="alert">
          {visibleErrorMessage}
        </p>
      ) : null}

      <div className="audiobook-layout">
        <aside className="audiobook-control glass-panel" aria-label="听书控制">
          <header className="audiobook-header">
            <p className="app-kicker">{engine.label}</p>
            <h1>听书</h1>
            <p className="mix-summary">{bookTitle}</p>
          </header>

          <section className="audiobook-status-panel" aria-label="朗读状态">
            <div>
              <p className="player-label">当前状态</p>
              <p className="player-title">{STATUS_LABELS[audiobook.status]}</p>
            </div>
            <span className="transport-status">
              {audiobook.segments.length > 0
                ? `${audiobook.currentSegmentIndex + 1} / ${audiobook.segments.length}`
                : "0 / 0"}
            </span>
          </section>

          <section className="audiobook-import-panel" aria-label="导入书稿">
            <label className="field-label" htmlFor={titleInputId}>
              书名
            </label>
            <input
              className="audiobook-title-input"
              id={titleInputId}
              type="text"
              value={bookTitle}
              onChange={(event) => {
                setBookTitle(event.currentTarget.value);
              }}
            />

            <label className="custom-audio-button audiobook-file-button">
              <span>{isImporting ? "导入中" : "导入文本"}</span>
              <input
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                aria-label="导入文本书稿"
                className="custom-audio-input"
                disabled={isImporting}
                type="file"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  void handleBookFiles(files);
                }}
              />
            </label>
            <p className="custom-audio-status" role="status">
              {importMessage ?? `${audiobook.segments.length} 个朗读片段`}
            </p>
          </section>

          <section className="audiobook-settings-panel" aria-label="朗读设置">
            <label className="field-label" htmlFor={voiceSelectId}>
              音色
            </label>
            <select
              className="audiobook-select"
              disabled={!audiobook.isEngineSupported || audiobook.isLoadingVoices}
              id={voiceSelectId}
              value={audiobook.selectedVoiceId ?? ""}
              onChange={(event) => {
                audiobook.selectVoice(event.currentTarget.value || null);
              }}
            >
              <option value="">
                {audiobook.isLoadingVoices ? "正在读取音色" : "系统默认音色"}
              </option>
              {audiobook.voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} · {voice.language}
                </option>
              ))}
            </select>

            <label className="field-label rate-label" htmlFor={rateInputId}>
              <span>语速</span>
              <strong>{audiobook.rate.toFixed(1)}x</strong>
            </label>
            <input
              className="audiobook-range"
              id={rateInputId}
              max="1.8"
              min="0.6"
              step="0.1"
              type="range"
              value={audiobook.rate}
              onChange={(event) => {
                audiobook.setRate(Number(event.currentTarget.value));
              }}
            />
          </section>

          <section className="audiobook-transport" aria-label="听书播放控制">
            <button
              className="secondary-control-button"
              disabled={!canRead || isBusy || audiobook.currentSegmentIndex === 0}
              type="button"
              onClick={() => {
                void audiobook.playPrevious();
              }}
            >
              上一段
            </button>
            <button
              aria-pressed={audiobook.status === "playing"}
              className="transport-button audiobook-primary-button"
              disabled={!canRead || isBusy}
              type="button"
              onClick={handlePrimaryAction}
            >
              <span className="transport-glyph" aria-hidden="true" />
              <span>{primaryActionLabel}</span>
            </button>
            <button
              className="secondary-control-button"
              disabled={
                !canRead ||
                isBusy ||
                audiobook.currentSegmentIndex >= audiobook.segments.length - 1
              }
              type="button"
              onClick={() => {
                void audiobook.playNext();
              }}
            >
              下一段
            </button>
            <button
              className="secondary-control-button stop-control-button"
              disabled={audiobook.status === "idle"}
              type="button"
              onClick={audiobook.stop}
            >
              停止
            </button>
          </section>
        </aside>

        <section
          className="audiobook-reader glass-panel"
          aria-labelledby="audiobook-reader-heading"
        >
          <div className="section-heading sound-section-heading">
            <div>
              <p className="app-kicker">文本书稿</p>
              <h2 id="audiobook-reader-heading">朗读内容</h2>
            </div>
            <span className="section-meta">{audiobook.progressPercent}%</span>
          </div>

          <label className="field-label" htmlFor={textInputId}>
            书稿文本
          </label>
          <textarea
            className="audiobook-textarea"
            id={textInputId}
            value={bookText}
            onChange={(event) => {
              setBookText(event.currentTarget.value);
            }}
          />

          <div className="segment-list" aria-label="朗读片段">
            {audiobook.segments.length === 0 ? (
              <p className="empty-segment-message" role="status">
                暂无可朗读片段
              </p>
            ) : (
              audiobook.segments.map((segment, index) => {
                const isActive = index === audiobook.currentSegmentIndex;

                return (
                  <button
                    aria-current={isActive ? "true" : undefined}
                    className={`segment-button${
                      isActive ? " segment-button-active" : ""
                    }`}
                    key={segment.id}
                    type="button"
                    onClick={() => {
                      void audiobook.playSegmentAt(index);
                    }}
                  >
                    <span className="segment-order">
                      {String(segment.order).padStart(2, "0")}
                    </span>
                    <span className="segment-text">{segment.text}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
