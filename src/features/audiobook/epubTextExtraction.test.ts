import { describe, expect, it } from "vitest";
import {
  extractChapterTitle,
  extractReadableText,
} from "./epubTextExtraction";
import { parseContentDocument } from "./epubXml";

describe("epubTextExtraction", () => {
  it("extracts top-level readable blocks and skips unsafe containers", () => {
    const document = parseContentDocument(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>文档标题</title>
    <style>.hidden { color: red; }</style>
  </head>
  <body>
    <nav>目录不朗读</nav>
    <h1>第一章</h1>
    <p>第一段 <span>补充</span>。</p>
    <blockquote><p>引用段落。</p></blockquote>
    <script>window.evil = true;</script>
  </body>
</html>`);

    expect(extractChapterTitle(document, "备用标题")).toBe("第一章");
    expect(extractReadableText(document)).toBe(
      ["第一章", "第一段 补充。", "引用段落。"].join("\n\n"),
    );
  });

  it("falls back to document title and whole-root text when no block exists", () => {
    const document = parseContentDocument(`
<html>
  <head><title>备用文档标题</title></head>
  <body><span>只有行内文本&nbsp;也可以朗读。</span></body>
</html>`);

    expect(extractChapterTitle(document, "第 1 章")).toBe("备用文档标题");
    expect(extractReadableText(document)).toBe("只有行内文本 也可以朗读。");
  });
});
