import { describe, expect, it } from "vitest";
import type { AudiobookSegment } from "./audiobookTypes";
import {
  buildAudiobookChapters,
  findChapterIndexForSegment,
} from "./chapterGrouping";

describe("chapterGrouping", () => {
  it("groups EPUB segments by consecutive source href", () => {
    const segments: AudiobookSegment[] = [
      {
        chapterTitle: "第一章",
        id: "epub-1-1",
        order: 1,
        sourceHref: "OPS/Text/chapter1.xhtml",
        text: "第一章",
      },
      {
        chapterTitle: "第一章",
        id: "epub-1-2",
        order: 2,
        sourceHref: "OPS/Text/chapter1.xhtml",
        text: "第一段。",
      },
      {
        chapterTitle: "第二章",
        id: "epub-2-1",
        order: 3,
        sourceHref: "OPS/Text/chapter2.xhtml",
        text: "第二章",
      },
    ];

    expect(buildAudiobookChapters(segments)).toEqual([
      {
        endSegmentIndex: 1,
        id: "chapter-1",
        segmentCount: 2,
        sourceHref: "OPS/Text/chapter1.xhtml",
        startSegmentIndex: 0,
        title: "第一章",
      },
      {
        endSegmentIndex: 2,
        id: "chapter-2",
        segmentCount: 1,
        sourceHref: "OPS/Text/chapter2.xhtml",
        startSegmentIndex: 2,
        title: "第二章",
      },
    ]);
  });

  it("treats plain text segments as one full-text chapter", () => {
    const segments: AudiobookSegment[] = [
      {
        id: "segment-1",
        order: 1,
        text: "第一段。",
      },
      {
        id: "segment-2",
        order: 2,
        text: "第二段。",
      },
    ];

    expect(buildAudiobookChapters(segments)).toEqual([
      {
        endSegmentIndex: 1,
        id: "chapter-1",
        segmentCount: 2,
        startSegmentIndex: 0,
        title: "全文",
      },
    ]);
  });

  it("finds the chapter that owns a segment index", () => {
    const chapters = buildAudiobookChapters([
      {
        chapterTitle: "第一章",
        id: "epub-1-1",
        order: 1,
        sourceHref: "OPS/Text/chapter1.xhtml",
        text: "第一章",
      },
      {
        chapterTitle: "第一章",
        id: "epub-1-2",
        order: 2,
        sourceHref: "OPS/Text/chapter1.xhtml",
        text: "第一段。",
      },
      {
        chapterTitle: "第二章",
        id: "epub-2-1",
        order: 3,
        sourceHref: "OPS/Text/chapter2.xhtml",
        text: "第二章",
      },
    ]);

    expect(findChapterIndexForSegment(chapters, 0)).toBe(0);
    expect(findChapterIndexForSegment(chapters, 1)).toBe(0);
    expect(findChapterIndexForSegment(chapters, 2)).toBe(1);
    expect(findChapterIndexForSegment(chapters, 99)).toBe(0);
    expect(findChapterIndexForSegment([], 0)).toBe(-1);
  });
});
