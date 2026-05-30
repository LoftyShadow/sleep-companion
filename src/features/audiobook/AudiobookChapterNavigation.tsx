import { useMemo } from "react";
import { InlinePicker } from "../shared/InlinePicker";
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
  const canSelectPreviousChapter = currentChapterIndex > 0;
  const canSelectNextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;
  const currentChapterTitle = currentChapter?.title ?? "未选择章节";
  const currentChapterMeta = currentChapter
    ? `${currentChapter.segmentCount} 段 · 第 ${
        currentChapterIndex + 1
      } / ${chapters.length} 章`
    : "暂无章节";
  const chapterOptions = useMemo(
    () =>
      chapters.map((chapter) => ({
        id: chapter.id,
        meta: `${chapter.segmentCount} 段`,
        title: chapter.title,
      })),
    [chapters],
  );

  function handleChapterChange(chapterId: string) {
    const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (chapterIndex >= 0) {
      onChapterChange(chapterIndex);
    }
  }

  function handlePreviousChapter() {
    onPreviousChapter();
  }

  function handleNextChapter() {
    onNextChapter();
  }

  return (
    <div className="chapter-navigation" aria-label="章节导航">
      <div className="chapter-summary">
        <span className="chapter-summary-label">正在播放章节</span>
        <strong className="chapter-title">{currentChapterTitle}</strong>
        <span className="chapter-meta">{currentChapterMeta}</span>
      </div>

      <div className="chapter-controls">
        <div className="chapter-picker">
          <InlinePicker
            ariaLabel={`选择章节，当前 ${currentChapterTitle}`}
            listAriaLabel="章节列表"
            options={chapterOptions}
            selectedMeta={`${currentChapter?.segmentCount ?? 0} 段`}
            selectedOptionId={currentChapter?.id ?? null}
            selectedTitle={currentChapterTitle}
            onSelect={handleChapterChange}
          />
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
