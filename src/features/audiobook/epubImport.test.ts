import { describe, expect, it } from "vitest";
import { createMinimalEpubFile } from "../../test/epubTestDoubles";
import { isSupportedEpubBookFile, readEpubBookFile } from "./epubImport";

describe("epubImport", () => {
  it("accepts EPUB files by MIME type or extension", () => {
    expect(
      isSupportedEpubBookFile(
        new File([""], "book.epub", { type: "application/epub+zip" }),
      ),
    ).toBe(true);
    expect(
      isSupportedEpubBookFile(new File([""], "book.epub", { type: "" })),
    ).toBe(true);
    expect(
      isSupportedEpubBookFile(new File([""], "book.txt", { type: "" })),
    ).toBe(false);
  });

  it("reads EPUB spine documents into ordered audiobook segments", async () => {
    const book = await readEpubBookFile(await createMinimalEpubFile());

    expect(book.title).toBe("测试 EPUB");
    expect(book.kind).toBe("segmented");
    expect(book.format).toBe("epub");
    expect(book.segments.map((segment) => segment.text)).toEqual([
      "第一章",
      "第一段。",
      "第二段。",
      "第二章",
      "第三段。第四段。",
    ]);
    expect(book.segments.map((segment) => segment.order)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(book.segments[0]).toEqual(
      expect.objectContaining({
        chapterTitle: "第一章",
        id: "epub-1-1",
        sourceHref: "OPS/Text/chapter1.xhtml",
      }),
    );
    expect(book.segments.map((segment) => segment.text)).not.toContain(
      "封面不应该被朗读。",
    );
  });
});
