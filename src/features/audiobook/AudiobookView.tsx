import { useCallback, useEffect, useRef, useState } from "react";
import { AudiobookImportPanel } from "./AudiobookImportPanel";
import { AudiobookLibraryPanel } from "./AudiobookLibraryPanel";
import { AudiobookReader } from "./AudiobookReader";
import { AudiobookSettingsPanel } from "./AudiobookSettingsPanel";
import { AudiobookStatusPanel } from "./AudiobookStatusPanel";
import { AudiobookTransport } from "./AudiobookTransport";
import type {
  AudiobookPlaybackStatus,
} from "./audiobookTypes";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { TtsEnginePort } from "./TtsEnginePort";
import { useAudiobookLibrary } from "./useAudiobookLibrary";
import { useAudiobookPlayer } from "./useAudiobookPlayer";
import type {
  PlaybackControlState,
  PlaybackControlStatus,
} from "../playbackControl/playbackControlTypes";
import "./AudiobookView.css";

type AudiobookViewMode = "library" | "reader";

interface AudiobookViewProps {
  engine: TtsEnginePort;
  fileSystem?: FileSystemPort;
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

interface CurrentAudiobookControlBarProps {
  canRead: boolean;
  chapterCount: number;
  currentSegmentIndex: number;
  isBusy: boolean;
  mode: AudiobookViewMode;
  primaryActionLabel: string;
  progressPercent: number;
  segmentCount: number;
  status: AudiobookPlaybackStatus;
  title: string;
  onBackToLibrary: () => void;
  onEnterReader: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onPrimaryAction: () => void;
  onStop: () => void;
}

function CurrentAudiobookControlBar({
  canRead,
  chapterCount,
  currentSegmentIndex,
  isBusy,
  mode,
  primaryActionLabel,
  progressPercent,
  segmentCount,
  status,
  title,
  onBackToLibrary,
  onEnterReader,
  onNext,
  onPrevious,
  onPrimaryAction,
  onStop,
}: CurrentAudiobookControlBarProps) {
  const actionLabel = mode === "reader" ? "返回书架" : "进入内容";

  return (
    <section className="audiobook-stage" aria-label="听书控制">
      <aside className="audiobook-now glass-panel" aria-label="当前朗读">
        <div className="audiobook-now-header">
          <button
            className="secondary-control-button audiobook-view-toggle-button"
            type="button"
            onClick={mode === "reader" ? onBackToLibrary : onEnterReader}
          >
            {actionLabel}
          </button>

          <div className="audiobook-now-titlebar">
            <p className="app-kicker">正在朗读</p>
            <h1>{title.trim() || "未命名书稿"}</h1>
          </div>

          <div className="audiobook-metrics" aria-label="听书概览">
            <span>{chapterCount || 1} 章</span>
            <span>{segmentCount} 段</span>
            <span>{progressPercent}% 进度</span>
          </div>
        </div>

        <AudiobookStatusPanel
          currentSegmentIndex={currentSegmentIndex}
          segmentCount={segmentCount}
          status={status}
        />

        <AudiobookTransport
          canRead={canRead}
          currentSegmentIndex={currentSegmentIndex}
          isBusy={isBusy}
          primaryActionLabel={primaryActionLabel}
          segmentCount={segmentCount}
          status={status}
          onNext={onNext}
          onPrevious={onPrevious}
          onPrimaryAction={onPrimaryAction}
          onStop={onStop}
        />
      </aside>
    </section>
  );
}

export function AudiobookView({
  engine,
  fileSystem,
  globalStopRequestId,
  playbackControlRequestId = 0,
  onPlaybackControlStateChange,
}: AudiobookViewProps) {
  const [viewMode, setViewMode] = useState<AudiobookViewMode>("library");
  const library = useAudiobookLibrary(fileSystem);
  const book = library.visibleBook;
  const audiobook = useAudiobookPlayer({
    engine,
    initialSegmentIndex: library.activeInitialSegmentIndex,
    onProgressChange: ({ segment, segmentIndex }) => {
      void library.updateActiveProgress(segmentIndex, segment);
    },
    resetKey: library.activeBookId ?? "draft",
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
  const visibleErrorMessage = library.errorMessage ?? audiobook.errorMessage;
  const bookText =
    !library.activeBook && book.kind === "plain-text" ? book.text : null;
  const readerSourceLabel =
    book.kind === "plain-text"
      ? `文本 · ${audiobook.segments.length} 个朗读片段`
      : `EPUB · ${audiobook.chapters.length} 章 · ${audiobook.segments.length} 个朗读片段`;
  const readerSourceKicker =
    book.kind === "plain-text" ? "文本书稿" : "EPUB 书稿";
  const handledGlobalStopRequestIdRef = useRef(globalStopRequestId);
  const handledPlaybackControlRequestIdRef = useRef(0);
  const isReaderVisible = viewMode === "reader" && library.activeBookId !== null;
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

  function handleBookTitleChange(title: string) {
    void library.updateBookTitle(title);
  }

  function handleBookTextChange(text: string) {
    library.updateDraftText(text);
  }

  async function handleImportBookFiles(files: File[]) {
    const didImport = await library.importBookFiles(files);

    if (didImport) {
      setViewMode("reader");
    }
  }

  async function handleOpenBook(bookId: NonNullable<typeof library.activeBookId>) {
    if (bookId === library.activeBookId) {
      setViewMode("reader");
      return;
    }

    stopAudiobook();

    const didOpenBook = await library.openBook(bookId);
    if (didOpenBook) {
      setViewMode("reader");
    }
  }

  function handleDeleteBook(bookId: NonNullable<typeof library.activeBookId>) {
    if (bookId === library.activeBookId) {
      stopAudiobook();
      setViewMode("library");
    }

    void library.deleteBook(bookId);
  }

  return (
    <div className="audiobook-view">
      {visibleErrorMessage ? (
        <p className="error-message" role="alert">
          {visibleErrorMessage}
        </p>
      ) : null}

      <div
        className={
          isReaderVisible
            ? "audiobook-layout audiobook-layout-reader"
            : "audiobook-layout audiobook-layout-library"
        }
      >
        {library.activeBookId ? (
          <CurrentAudiobookControlBar
            canRead={canRead}
            chapterCount={audiobook.chapters.length}
            currentSegmentIndex={audiobook.currentSegmentIndex}
            isBusy={isBusy}
            mode={isReaderVisible ? "reader" : "library"}
            primaryActionLabel={primaryActionLabel}
            progressPercent={audiobook.progressPercent}
            segmentCount={audiobook.segments.length}
            status={audiobook.status}
            title={book.title}
            onBackToLibrary={() => {
              setViewMode("library");
            }}
            onEnterReader={() => {
              setViewMode("reader");
            }}
            onNext={() => {
              void audiobook.playNext();
            }}
            onPrevious={() => {
              void audiobook.playPrevious();
            }}
            onPrimaryAction={handlePrimaryAction}
            onStop={audiobook.stop}
          />
        ) : null}

        <AudiobookLibraryPanel
          activeBookId={library.activeBookId}
          coverObjectUrls={library.coverObjectUrls}
          importMessage={library.message}
          isImporting={library.isImporting}
          isLoading={library.isLoading}
          items={library.items}
          onBookFiles={(files) => {
            void handleImportBookFiles(files);
          }}
          onDeleteBook={handleDeleteBook}
          onOpenBook={(bookId) => {
            void handleOpenBook(bookId);
          }}
        />

        {isReaderVisible ? (
          <>
            <div className="audiobook-workflow">
              <aside className="audiobook-setup glass-panel" aria-label="听书设置">
                <div className="section-heading sound-section-heading">
                  <div>
                    <p className="app-kicker">设置</p>
                    <h2>朗读准备</h2>
                  </div>
                  <span className="section-meta">
                    {book.kind === "plain-text" ? "文本" : "EPUB"}
                  </span>
                </div>

                <AudiobookImportPanel
                  bookTitle={book.title}
                  importMessage={null}
                  isImporting={library.isImporting}
                  segmentCount={audiobook.segments.length}
                  onBookFiles={(files) => {
                    void handleImportBookFiles(files);
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
                sourceKicker={readerSourceKicker}
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
          </>
        ) : null}
      </div>
    </div>
  );
}
