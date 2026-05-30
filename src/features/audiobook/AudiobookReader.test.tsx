import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AudiobookChapter, AudiobookSegment } from "./audiobookTypes";
import { AudiobookReader } from "./AudiobookReader";

function createSegments(count: number): AudiobookSegment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `segment-${index + 1}`,
    order: index + 1,
    text: `片段 ${index + 1}`,
  }));
}

function renderReader({
  currentSegmentIndex,
  segments = createSegments(11),
}: {
  currentSegmentIndex: number;
  segments?: AudiobookSegment[];
}) {
  const currentChapter: AudiobookChapter = {
    id: "chapter-1",
    title: "第一章",
    startSegmentIndex: 0,
    endSegmentIndex: segments.length - 1,
    segmentCount: segments.length,
  };

  const rendered = render(
    <AudiobookReader
      bookText={null}
      chapters={[currentChapter]}
      currentChapter={currentChapter}
      currentChapterIndex={0}
      currentSegmentIndex={currentSegmentIndex}
      progressPercent={50}
      segments={segments}
      sourceLabel="EPUB · 1 章 · 11 个朗读片段"
      onChapterChange={vi.fn()}
      onNextChapter={vi.fn()}
      onPlaySegmentAt={vi.fn()}
      onPreviousChapter={vi.fn()}
    />,
  );

  return {
    segmentList: screen.getByLabelText("朗读片段"),
    ...rendered,
  };
}

function mockScrollIntoView() {
  const scrollIntoView = vi.fn();
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollIntoView",
  );

  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  return {
    restore: () => {
      if (originalDescriptor) {
        Object.defineProperty(
          Element.prototype,
          "scrollIntoView",
          originalDescriptor,
        );
        return;
      }

      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: undefined,
      });
    },
    scrollIntoView,
  };
}

describe("AudiobookReader", () => {
  it("keeps the current chapter segments scrollable instead of forcing a centered start", () => {
    const { segmentList } = renderReader({ currentSegmentIndex: 0 });
    const segmentButtons = within(segmentList).getAllByRole("button");

    expect(segmentButtons).toHaveLength(11);
    expect(segmentButtons[0]).toHaveAttribute("aria-current", "true");
    expect(segmentButtons[0]).toHaveTextContent("01片段 1");
    expect(segmentButtons[10]).toHaveTextContent("11片段 11");
    expect(
      screen.getByRole("button", { name: "定位到当前正在阅读" }),
    ).toBeInTheDocument();
  });

  it("scrolls the current segment into view when playback moves", () => {
    const { restore, scrollIntoView } = mockScrollIntoView();

    try {
      const { rerender } = renderReader({ currentSegmentIndex: 0 });
      const segments = createSegments(11);
      const currentChapter: AudiobookChapter = {
        id: "chapter-1",
        title: "第一章",
        startSegmentIndex: 0,
        endSegmentIndex: segments.length - 1,
        segmentCount: segments.length,
      };

      rerender(
        <AudiobookReader
          bookText={null}
          chapters={[currentChapter]}
          currentChapter={currentChapter}
          currentChapterIndex={0}
          currentSegmentIndex={6}
          progressPercent={64}
          segments={segments}
          sourceLabel="EPUB · 1 章 · 11 个朗读片段"
          onChapterChange={vi.fn()}
          onNextChapter={vi.fn()}
          onPlaySegmentAt={vi.fn()}
          onPreviousChapter={vi.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "07片段 7" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(scrollIntoView).toHaveBeenLastCalledWith({
        block: "nearest",
        inline: "nearest",
      });
    } finally {
      restore();
    }
  });

  it("locates the current segment from the manual button", async () => {
    const user = userEvent.setup();
    const { restore, scrollIntoView } = mockScrollIntoView();

    try {
      renderReader({ currentSegmentIndex: 5 });
      scrollIntoView.mockClear();

      await user.click(
        screen.getByRole("button", { name: "定位到当前正在阅读" }),
      );

      expect(screen.getByRole("button", { name: "06片段 6" })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        inline: "nearest",
      });
    } finally {
      restore();
    }
  });

  it("auto locates the current segment after scrolling has stopped", () => {
    vi.useFakeTimers();
    const { restore, scrollIntoView } = mockScrollIntoView();

    try {
      const { segmentList } = renderReader({ currentSegmentIndex: 5 });
      scrollIntoView.mockClear();

      fireEvent.scroll(segmentList);
      vi.advanceTimersByTime(1999);

      expect(scrollIntoView).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        inline: "nearest",
      });
    } finally {
      restore();
      vi.useRealTimers();
    }
  });
});
