import { useEffect, useId, useRef, useState } from "react";
import type { AudiobookChapter } from "./audiobookTypes";

interface AudiobookChapterNavigationProps {
  chapters: AudiobookChapter[];
  currentChapter: AudiobookChapter | null;
  currentChapterIndex: number;
  onChapterChange: (chapterIndex: number) => void;
  onNextChapter: () => void;
  onPreviousChapter: () => void;
}

export function AudiobookChapterNavigation({
  chapters,
  currentChapter,
  currentChapterIndex,
  onChapterChange,
  onNextChapter,
  onPreviousChapter,
}: AudiobookChapterNavigationProps) {
  const chapterListId = useId();
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const canSelectPreviousChapter = currentChapterIndex > 0;
  const canSelectNextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;
  const currentChapterTitle = currentChapter?.title ?? "未选择章节";
  const currentChapterMeta = currentChapter
    ? `${currentChapter.segmentCount} 段 · 第 ${
        currentChapterIndex + 1
      } / ${chapters.length} 章`
    : "暂无章节";

  useEffect(() => {
    if (!isChapterListOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !navigationRef.current?.contains(event.target)
      ) {
        setIsChapterListOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsChapterListOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isChapterListOpen]);

  function handleChapterChange(chapterIndex: number) {
    setIsChapterListOpen(false);
    onChapterChange(chapterIndex);
  }

  function handlePreviousChapter() {
    setIsChapterListOpen(false);
    onPreviousChapter();
  }

  function handleNextChapter() {
    setIsChapterListOpen(false);
    onNextChapter();
  }

  return (
    <div
      className="chapter-navigation"
      ref={navigationRef}
      aria-label="章节导航"
    >
      <div className="chapter-summary">
        <span className="chapter-summary-label">正在播放章节</span>
        <strong className="chapter-title">{currentChapterTitle}</strong>
        <span className="chapter-meta">{currentChapterMeta}</span>
      </div>

      <div className="chapter-controls">
        <div className="chapter-picker">
          <button
            aria-controls={chapterListId}
            aria-expanded={isChapterListOpen}
            aria-haspopup="listbox"
            aria-label={`选择章节，当前 ${currentChapterTitle}`}
            className="chapter-picker-button"
            type="button"
            onClick={() => {
              setIsChapterListOpen((isOpen) => !isOpen);
            }}
          >
            <span className="chapter-picker-text">
              <span className="chapter-picker-title">{currentChapterTitle}</span>
              <span className="chapter-picker-meta">
                {currentChapter?.segmentCount ?? 0} 段
              </span>
            </span>
            <span className="chapter-picker-chevron" aria-hidden="true" />
          </button>

          {isChapterListOpen ? (
            <div
              className="chapter-option-list"
              id={chapterListId}
              role="listbox"
              aria-label="章节列表"
            >
              {chapters.map((chapter, index) => {
                const isSelected = index === currentChapterIndex;

                return (
                  <button
                    aria-selected={isSelected}
                    className={`chapter-option${
                      isSelected ? " chapter-option-selected" : ""
                    }`}
                    key={chapter.id}
                    role="option"
                    type="button"
                    onClick={() => {
                      handleChapterChange(index);
                    }}
                  >
                    <span className="chapter-option-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="chapter-option-text">
                      <span className="chapter-option-title">
                        {chapter.title}
                      </span>
                      <span className="chapter-option-meta">
                        {chapter.segmentCount} 段
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <button
          className="secondary-control-button chapter-control-button"
          disabled={!canSelectPreviousChapter}
          type="button"
          onClick={handlePreviousChapter}
        >
          上一章
        </button>
        <button
          className="secondary-control-button chapter-control-button"
          disabled={!canSelectNextChapter}
          type="button"
          onClick={handleNextChapter}
        >
          下一章
        </button>
      </div>
    </div>
  );
}
