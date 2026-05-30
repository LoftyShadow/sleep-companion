import { useId } from "react";
import type { AudiobookChapter, AudiobookSegment } from "./audiobookTypes";
import { AudiobookChapterNavigation } from "./AudiobookChapterNavigation";

interface AudiobookReaderProps {
  bookText: string | null;
  chapters: AudiobookChapter[];
  currentChapter: AudiobookChapter | null;
  currentChapterIndex: number;
  currentSegmentIndex: number;
  progressPercent: number;
  segments: AudiobookSegment[];
  sourceLabel: string;
  onBookTextChange?: (text: string) => void;
  onChapterChange: (chapterIndex: number) => void;
  onNextChapter: () => void;
  onPlaySegmentAt: (index: number) => void;
  onPreviousChapter: () => void;
}

export function AudiobookReader({
  bookText,
  chapters,
  currentChapter,
  currentChapterIndex,
  currentSegmentIndex,
  progressPercent,
  segments,
  sourceLabel,
  onBookTextChange,
  onChapterChange,
  onNextChapter,
  onPlaySegmentAt,
  onPreviousChapter,
}: AudiobookReaderProps) {
  const textInputId = useId();
  const isTextEditable = bookText !== null && onBookTextChange !== undefined;
  const visibleSegmentStartIndex = currentChapter?.startSegmentIndex ?? 0;
  const visibleSegments = currentChapter
    ? segments.slice(
        currentChapter.startSegmentIndex,
        currentChapter.endSegmentIndex + 1,
      )
    : segments;

  return (
    <section
      className="audiobook-reader glass-panel"
      aria-labelledby="audiobook-reader-heading"
    >
      <div className="section-heading sound-section-heading">
        <div>
          <p className="app-kicker">{isTextEditable ? "文本书稿" : "EPUB 书稿"}</p>
          <h2 id="audiobook-reader-heading">朗读内容</h2>
        </div>
        <span className="section-meta">{progressPercent}%</span>
      </div>

      {isTextEditable ? (
        <>
          <label className="field-label" htmlFor={textInputId}>
            书稿文本
          </label>
          <textarea
            className="audiobook-textarea"
            id={textInputId}
            value={bookText}
            onChange={(event) => {
              onBookTextChange(event.currentTarget.value);
            }}
          />
        </>
      ) : (
        <p className="audiobook-source-summary">{sourceLabel}</p>
      )}

      {chapters.length > 0 ? (
        <AudiobookChapterNavigation
          chapters={chapters}
          currentChapter={currentChapter}
          currentChapterIndex={currentChapterIndex}
          onChapterChange={onChapterChange}
          onNextChapter={onNextChapter}
          onPreviousChapter={onPreviousChapter}
        />
      ) : null}

      <div className="segment-list" aria-label="朗读片段">
        {visibleSegments.length === 0 ? (
          <p className="empty-segment-message" role="status">
            暂无可朗读片段
          </p>
        ) : (
          visibleSegments.map((segment, visibleIndex) => {
            const segmentIndex = visibleSegmentStartIndex + visibleIndex;
            const isActive = segmentIndex === currentSegmentIndex;

            return (
              <button
                aria-current={isActive ? "true" : undefined}
                className={`segment-button${
                  isActive ? " segment-button-active" : ""
                }`}
                key={segment.id}
                type="button"
                onClick={() => {
                  onPlaySegmentAt(segmentIndex);
                }}
              >
                <span className="segment-order">
                  {String(segment.order).padStart(2, "0")}
                </span>
                <span className="segment-text">
                  <span>{segment.text}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
