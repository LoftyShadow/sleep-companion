import { useEffect, useRef, useState } from "react";
import { AudiobookImportPanel } from "./AudiobookImportPanel";
import { AudiobookReader } from "./AudiobookReader";
import { AudiobookSettingsPanel } from "./AudiobookSettingsPanel";
import { AudiobookStatusPanel } from "./AudiobookStatusPanel";
import { AudiobookTransport } from "./AudiobookTransport";
import type {
  AudiobookPlaybackStatus,
  ImportedAudiobookBook,
  PlainTextBook,
} from "./audiobookTypes";
import {
  isSupportedAudiobookBookFile,
  readAudiobookBookFile,
} from "./bookImport";
import type { TtsEnginePort } from "./TtsEnginePort";
import { useAudiobookPlayer } from "./useAudiobookPlayer";
import "./AudiobookView.css";

const DEFAULT_AUDIOBOOK_TITLE = "雨夜试读";
const DEFAULT_AUDIOBOOK_TEXT = `雨声落在窗外，房间里只剩下很轻的呼吸声。

她把书翻到折角的那一页，灯光停在纸面上，像一小片安静的湖。

如果今晚睡不着，就让声音慢慢读下去。读到句子变远，读到世界安静下来。`;
const DEFAULT_AUDIOBOOK_BOOK: PlainTextBook = {
  kind: "plain-text",
  text: DEFAULT_AUDIOBOOK_TEXT,
  title: DEFAULT_AUDIOBOOK_TITLE,
};

interface AudiobookViewProps {
  engine: TtsEnginePort;
  globalStopRequestId: number;
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
  engine,
  globalStopRequestId,
}: AudiobookViewProps) {
  const [book, setBook] = useState<ImportedAudiobookBook>(
    DEFAULT_AUDIOBOOK_BOOK,
  );
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);
  const audiobook = useAudiobookPlayer({
    engine,
    ...(book.kind === "plain-text"
      ? { text: book.text }
      : { segments: book.segments }),
  });
  const canRead = audiobook.segments.length > 0 && audiobook.isEngineSupported;
  const isBusy = audiobook.status === "loading";
  const primaryActionLabel = getPrimaryActionLabel(
    audiobook.status,
    engine.supportsPause,
  );
  const visibleErrorMessage = importErrorMessage ?? audiobook.errorMessage;
  const bookText = book.kind === "plain-text" ? book.text : null;
  const readerSourceLabel =
    book.kind === "plain-text"
      ? `${audiobook.segments.length} 个朗读片段`
      : `EPUB · ${audiobook.chapters.length} 章 · ${audiobook.segments.length} 个朗读片段`;
  const handledGlobalStopRequestIdRef = useRef(globalStopRequestId);

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    audiobook.stop();
  }, [audiobook, globalStopRequestId]);

  async function handleBookFiles(files: readonly File[]) {
    const file = files[0];
    if (!file) {
      return;
    }

    if (!isSupportedAudiobookBookFile(file)) {
      setImportMessage(null);
      setImportErrorMessage("听书支持 txt、markdown 和 EPUB 文件");
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    setImportErrorMessage(null);

    try {
      const importedBook = await readAudiobookBookFile(file);
      setBook(importedBook);
      setImportMessage(
        importedBook.kind === "segmented"
          ? `已导入 ${importedBook.title} · ${importedBook.segments.length} 段`
          : `已导入 ${importedBook.title}`,
      );
    } catch (error) {
      setImportErrorMessage(
        error instanceof Error ? error.message : "导入书稿失败",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleBookTitleChange(title: string) {
    setBook((currentBook) => ({ ...currentBook, title }));
  }

  function handleBookTextChange(text: string) {
    setBook((currentBook) =>
      currentBook.kind === "plain-text" ? { ...currentBook, text } : currentBook,
    );
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
    <div className="audiobook-view">
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
            <p className="mix-summary">{book.title}</p>
          </header>

          <AudiobookStatusPanel
            currentSegmentIndex={audiobook.currentSegmentIndex}
            segmentCount={audiobook.segments.length}
            status={audiobook.status}
          />

          <AudiobookImportPanel
            bookTitle={book.title}
            importMessage={importMessage}
            isImporting={isImporting}
            segmentCount={audiobook.segments.length}
            onBookFiles={(files) => {
              void handleBookFiles(files);
            }}
            onBookTitleChange={handleBookTitleChange}
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
          chapters={audiobook.chapters}
          currentChapter={audiobook.currentChapter}
          currentChapterIndex={audiobook.currentChapterIndex}
          currentSegmentIndex={audiobook.currentSegmentIndex}
          progressPercent={audiobook.progressPercent}
          segments={audiobook.segments}
          sourceLabel={readerSourceLabel}
          onBookTextChange={
            book.kind === "plain-text" ? handleBookTextChange : undefined
          }
          onChapterChange={(chapterIndex) => {
            void audiobook.playChapterAt(chapterIndex);
          }}
          onNextChapter={() => {
            void audiobook.playNextChapter();
          }}
          onPlaySegmentAt={(index) => {
            void audiobook.playSegmentAt(index);
          }}
          onPreviousChapter={() => {
            void audiobook.playPreviousChapter();
          }}
        />
      </div>
    </div>
  );
}
