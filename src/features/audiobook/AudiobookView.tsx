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
  const stopAudiobook = audiobook.stop;

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    stopAudiobook();
  }, [globalStopRequestId, stopAudiobook]);

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
        <section className="audiobook-stage" aria-label="听书控制">
          <header className="audiobook-hero glass-panel">
            <div className="audiobook-header">
              <p className="app-kicker">{engine.label}</p>
              <h1>听书</h1>
              <p className="mix-summary">{book.title}</p>
            </div>

            <div className="audiobook-flow" aria-label="听书流程">
              <div className="audiobook-flow-step">
                <span>01</span>
                <strong>准备书稿</strong>
                <p>导入文件或直接编辑文本</p>
              </div>
              <div className="audiobook-flow-step">
                <span>02</span>
                <strong>选择朗读</strong>
                <p>确认音色与语速</p>
              </div>
              <div className="audiobook-flow-step">
                <span>03</span>
                <strong>跟随片段</strong>
                <p>按章节和段落继续收听</p>
              </div>
            </div>

            <div className="audiobook-hero-metrics" aria-label="听书概览">
              <span>{audiobook.segments.length} 个片段</span>
              <span>{audiobook.chapters.length || 1} 个章节</span>
              <span>{audiobook.progressPercent}% 进度</span>
            </div>
          </header>

          <aside className="audiobook-now glass-panel" aria-label="当前朗读">
            <div className="section-heading sound-section-heading">
              <div>
                <p className="app-kicker">主操作</p>
                <h2>朗读面板</h2>
              </div>
              <span className="section-meta">
                {audiobook.status === "playing" ? "朗读中" : "待命"}
              </span>
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
                <p className="app-kicker">书稿与声音</p>
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
