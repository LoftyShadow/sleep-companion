import { describe, expect, it } from "vitest";
import {
  getPlainTextBookTitle,
  isSupportedPlainTextBookFile,
  segmentBookText,
} from "./textSegmentation";

describe("segmentBookText", () => {
  it("splits plain text into ordered readable segments", () => {
    const segments = segmentBookText("第一段。\n\n第二段。第二句。", {
      targetLength: 7,
      hardLimit: 20,
    });

    expect(segments).toEqual([
      { id: "segment-1", order: 1, text: "第一段。" },
      { id: "segment-2", order: 2, text: "第二段。" },
      { id: "segment-3", order: 3, text: "第二句。" },
    ]);
  });

  it("hard splits very long text without sentence boundaries", () => {
    const segments = segmentBookText("一".repeat(12), {
      targetLength: 5,
      hardLimit: 5,
    });

    expect(segments.map((segment) => segment.text)).toEqual([
      "一".repeat(5),
      "一".repeat(5),
      "一".repeat(2),
    ]);
  });

  it("uses shorter default segments for long readable text", () => {
    const segments = segmentBookText("一".repeat(181));

    expect(segments.map((segment) => segment.text.length)).toEqual([180, 1]);
  });

  it("uses sentence segmentation without splitting common English abbreviations", () => {
    const segments = segmentBookText("Dr. Lin arrived. It rained.", {
      language: "en",
      targetLength: 14,
      hardLimit: 40,
    });

    expect(segments.map((segment) => segment.text)).toEqual([
      "Dr. Lin arrived.",
      "It rained.",
    ]);
  });

  it("ignores blank text", () => {
    expect(segmentBookText(" \n\n\t ")).toEqual([]);
  });
});

describe("plain text book file helpers", () => {
  it("accepts text and markdown files", () => {
    expect(
      isSupportedPlainTextBookFile(
        new File(["book"], "睡前故事.txt", { type: "text/plain" }),
      ),
    ).toBe(true);
    expect(
      isSupportedPlainTextBookFile(
        new File(["book"], "睡前故事.md", { type: "" }),
      ),
    ).toBe(true);
    expect(
      isSupportedPlainTextBookFile(
        new File(["book"], "睡前故事.epub", {
          type: "application/epub+zip",
        }),
      ),
    ).toBe(false);
  });

  it("uses the file name as the default book title", () => {
    expect(getPlainTextBookTitle("我的书稿.markdown")).toBe("我的书稿");
    expect(getPlainTextBookTitle(".txt")).toBe("未命名书稿");
  });
});
