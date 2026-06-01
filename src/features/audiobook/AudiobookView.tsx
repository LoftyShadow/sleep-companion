import { useCallback, useEffect, useRef, useState } from "react";
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
import type {
  PlaybackControlState,
  PlaybackControlStatus,
} from "../playbackControl/playbackControlTypes";
import "./AudiobookView.css";

const DEFAULT_AUDIOBOOK_BOOK: PlainTextBook = {
  kind: "plain-text",
  text: "",
  title: "",
};

interface AudiobookViewProps {
  engine: TtsEnginePort;
  globalStopRequestId: number;
  playbackControlRequestId?: number;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
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

function getAudiobookPlaybackControlStatus(
  status: AudiobookPlaybackStatus,
  canRead: boolean,
): PlaybackControlStatus {
  if (!canRead) {
    return "unavailable";
  }
  if (status === "loading") {
    return "loading";
  }
  if (status === "playing") {
    return "playing";
  }
  if (status === "paused") {
    return "paused";
  }

  return "idle";
}

function getAudiobookPlaybackControlSummary({
  canRead,
  currentSegmentIndex,
  isEngineSupported,
  segmentCount,
  status,
  title,
}: {
  canRead: boolean;
  currentSegmentIndex: number;
  isEngineSupported: boolean;
  segmentCount: number;
  status: AudiobookPlaybackStatus;
  title: string;
}): string {
  const readableTitle = title.trim() || "文本书稿";

  if (!canRead) {
    return isEngineSupported ? "没有可朗读文本" : "当前环境不支持系统 TTS";
  }

  if (status === "playing" || status === "paused" || status === "loading") {
    return `${readableTitle} · ${currentSegmentIndex + 1} / ${segmentCount}`;
  }

  return readableTitle;
}

export function AudiobookView({
  engine,
  globalStopRequestId,
  playbackControlRequestId = 0,
  onPlaybackControlStateChange,
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
  const audiobookStatus = audiobook.status;
  const pauseAudiobook = audiobook.pause;
  const playAudiobook = audiobook.play;
  const resumeAudiobook = audiobook.resume;
  const stopAudiobook = audiobook.stop;
  const canRead = audiobook.segments.length > 0 && audiobook.isEngineSupported;
  const isBusy = audiobookStatus === "loading";
  const primaryActionLabel = getPrimaryActionLabel(
    audiobookStatus,
    engine.supportsPause,
  );
  const visibleErrorMessage = importErrorMessage ?? audiobook.errorMessage;
  const bookText = book.kind === "plain-text" ? book.text : null;
  const readerSourceLabel =
    book.kind === "plain-text"
      ? `${audiobook.segments.length} 个朗读片段`
      : `EPUB · ${audiobook.chapters.length} 章 · ${audiobook.segments.length} 个朗读片段`;
  const handledGlobalStopRequestIdRef = useRef(globalStopRequestId);
  const handledPlaybackControlRequestIdRef = useRef(0);
  const handlePrimaryAction = useCallback(() => {
    if (audiobookStatus === "playing") {
      if (engine.supportsPause) {
        pauseAudiobook();
        return;
      }

      stopAudiobook();
      return;
    }

    if (audiobookStatus === "paused") {
      resumeAudiobook();
      return;
    }

    void playAudiobook();
  }, [
    audiobookStatus,
    engine.supportsPause,
    pauseAudiobook,
    playAudiobook,
    resumeAudiobook,
    stopAudiobook,
  ]);
  const playbackControlSummary = getAudiobookPlaybackControlSummary({
    canRead,
    currentSegmentIndex: audiobook.currentSegmentIndex,
    isEngineSupported: audiobook.isEngineSupported,
    segmentCount: audiobook.segments.length,
    status: audiobookStatus,
    title: book.title,
  });

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    stopAudiobook();
  }, [globalStopRequestId, stopAudiobook]);

  useEffect(() => {
    onPlaybackControlStateChange?.({
      actionLabel: primaryActionLabel,
      canToggle: canRead && !isBusy,
      status: getAudiobookPlaybackControlStatus(audiobookStatus, canRead),
      summary: playbackControlSummary,
    });
  }, [
    audiobookStatus,
    canRead,
    isBusy,
    onPlaybackControlStateChange,
    playbackControlSummary,
    primaryActionLabel,
  ]);

  useEffect(() => {
    if (
      playbackControlRequestId === 0 ||
      playbackControlRequestId === handledPlaybackControlRequestIdRef.current
    ) {
      return;
    }

    handledPlaybackControlRequestIdRef.current = playbackControlRequestId;
    handlePrimaryAction();
  }, [handlePrimaryAction, playbackControlRequestId]);

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

  return (
    <div className="audiobook-view">
      {visibleErrorMessage ? (
        <p className="error-message" role="alert">
          {visibleErrorMessage}
        </p>
      ) : null}

      <div className="audiobook-layout">
        <section className="audiobook-stage" aria-label="听书控制">
          <aside className="audiobook-now glass-panel" aria-label="当前朗读">
            <h1 className="audiobook-mode-title">听书</h1>
            <div className="audiobook-now-header">
              <div className="audiobook-now-titlebar">
                <h2>朗读面板</h2>
              </div>

              <div className="audiobook-metrics" aria-label="听书概览">
                <span>{audiobook.segments.length} 个片段</span>
                <span>{audiobook.chapters.length || 1} 个章节</span>
                <span>{audiobook.progressPercent}% 进度</span>
              </div>
            </div>

            <AudiobookStatusPanel
              currentSegmentIndex={audiobook.currentSegmentIndex}
              segmentCount={audiobook.segments.length}
              status={audiobook.status}
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
        </section>

        <div className="audiobook-workflow">
          <aside className="audiobook-setup glass-panel" aria-label="听书设置">
            <div className="section-heading sound-section-heading">
              <div>
                <h2>朗读准备</h2>
              </div>
              <span className="section-meta">
                {book.kind === "plain-text" ? "文本" : "EPUB"}
              </span>
            </div>

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
    </div>
  );
}
