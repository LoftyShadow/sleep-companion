import { useId } from "react";
import type { AudiobookSegment } from "./audiobookTypes";

interface AudiobookReaderProps {
  bookText: string;
  currentSegmentIndex: number;
  progressPercent: number;
  segments: AudiobookSegment[];
  onBookTextChange: (text: string) => void;
  onPlaySegmentAt: (index: number) => void;
}

export function AudiobookReader({
  bookText,
  currentSegmentIndex,
  progressPercent,
  segments,
  onBookTextChange,
  onPlaySegmentAt,
}: AudiobookReaderProps) {
  const textInputId = useId();

  return (
    <section
      className="audiobook-reader glass-panel"
      aria-labelledby="audiobook-reader-heading"
    >
      <div className="section-heading sound-section-heading">
        <div>
          <p className="app-kicker">文本书稿</p>
          <h2 id="audiobook-reader-heading">朗读内容</h2>
        </div>
        <span className="section-meta">{progressPercent}%</span>
      </div>

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

      <div className="segment-list" aria-label="朗读片段">
        {segments.length === 0 ? (
          <p className="empty-segment-message" role="status">
            暂无可朗读片段
          </p>
        ) : (
          segments.map((segment, index) => {
            const isActive = index === currentSegmentIndex;

            return (
              <button
                aria-current={isActive ? "true" : undefined}
                className={`segment-button${
                  isActive ? " segment-button-active" : ""
                }`}
                key={segment.id}
                type="button"
                onClick={() => {
                  onPlaySegmentAt(index);
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
  );
}

