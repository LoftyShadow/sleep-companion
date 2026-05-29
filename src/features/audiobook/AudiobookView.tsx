import { useState } from "react";
import { AppModeSwitcher } from "../appMode/AppModeSwitcher";
import type { AppMode } from "../appMode/appModeTypes";
import { AudiobookImportPanel } from "./AudiobookImportPanel";
import { AudiobookReader } from "./AudiobookReader";
import { AudiobookSettingsPanel } from "./AudiobookSettingsPanel";
import { AudiobookStatusPanel } from "./AudiobookStatusPanel";
import { AudiobookTransport } from "./AudiobookTransport";
import type { AudiobookPlaybackStatus } from "./audiobookTypes";
import {
  isSupportedPlainTextBookFile,
  readPlainTextBookFile,
} from "./textSegmentation";
import type { TtsEnginePort } from "./TtsEnginePort";
import { useAudiobookPlayer } from "./useAudiobookPlayer";
import "./AudiobookView.css";

const DEFAULT_AUDIOBOOK_TITLE = "雨夜试读";
const DEFAULT_AUDIOBOOK_TEXT = `雨声落在窗外，房间里只剩下很轻的呼吸声。

她把书翻到折角的那一页，灯光停在纸面上，像一小片安静的湖。

如果今晚睡不着，就让声音慢慢读下去。读到句子变远，读到世界安静下来。`;

interface AudiobookViewProps {
  activeMode: AppMode;
  engine: TtsEnginePort;
  onModeChange: (mode: AppMode) => void;
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

          <AudiobookStatusPanel
            currentSegmentIndex={audiobook.currentSegmentIndex}
            segmentCount={audiobook.segments.length}
            status={audiobook.status}
          />

          <AudiobookImportPanel
            bookTitle={bookTitle}
            importMessage={importMessage}
            isImporting={isImporting}
            segmentCount={audiobook.segments.length}
            onBookFiles={(files) => {
              void handleBookFiles(files);
            }}
            onBookTitleChange={setBookTitle}
          />

          <AudiobookSettingsPanel
            isEngineSupported={audiobook.isEngineSupported}
            isLoadingVoices={audiobook.isLoadingVoices}
            rate={audiobook.rate}
            selectedVoiceId={audiobook.selectedVoiceId}
            voices={audiobook.voices}
            onRateChange={audiobook.setRate}
            onVoiceChange={audiobook.selectVoice}
          />

          <AudiobookTransport
            canRead={canRead}
            currentSegmentIndex={audiobook.currentSegmentIndex}
            isBusy={isBusy}
            primaryActionLabel={primaryActionLabel}
            segmentCount={audiobook.segments.length}
            status={audiobook.status}
            onNext={() => {
              void audiobook.playNext();
            }}
            onPrevious={() => {
              void audiobook.playPrevious();
            }}
            onPrimaryAction={handlePrimaryAction}
            onStop={audiobook.stop}
          />
        </aside>

        <AudiobookReader
          bookText={bookText}
          currentSegmentIndex={audiobook.currentSegmentIndex}
          progressPercent={audiobook.progressPercent}
          segments={audiobook.segments}
          onBookTextChange={setBookText}
          onPlaySegmentAt={(index) => {
            void audiobook.playSegmentAt(index);
          }}
        />
      </div>
    </main>
  );
}
