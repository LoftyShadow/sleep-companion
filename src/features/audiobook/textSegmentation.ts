import type { AudiobookSegment, PlainTextBook } from "./audiobookTypes";

const SUPPORTED_TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);
const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);
const SENTENCE_CHUNK_PATTERN = /[^。！？；;.!?]+[。！？；;.!?]*/gu;
const DEFAULT_TARGET_LENGTH = 240;
const DEFAULT_HARD_LIMIT = 380;
const COMMON_ENGLISH_ABBREVIATIONS = new Set([
  "dr.",
  "mr.",
  "mrs.",
  "ms.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "etc.",
]);

interface SentenceSegment {
  segment: string;
}

interface SegmenterLike {
  segment(input: string): Iterable<SentenceSegment>;
}

interface IntlWithOptionalSegmenter {
  Segmenter?: new (
    locale?: string | string[],
    options?: { granularity: "sentence" },
  ) => SegmenterLike;
}

interface SegmentBookTextOptions {
  targetLength?: number;
  hardLimit?: number;
  language?: string;
  idPrefix?: string;
  startingOrder?: number;
  chapterTitle?: string;
  sourceHref?: string;
}

export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function normalizeParagraph(paragraph: string): string {
  return paragraph.replace(/[ \t\f\v]+/g, " ").replace(/\n+/g, " ").trim();
}

function hardSplitText(text: string, hardLimit: number): string[] {
  const parts: string[] = [];
  for (let start = 0; start < text.length; start += hardLimit) {
    const part = text.slice(start, start + hardLimit).trim();
    if (part.length > 0) {
      parts.push(part);
    }
  }
  return parts;
}

function endsWithCommonEnglishAbbreviation(text: string): boolean {
  const match = text.match(/[A-Za-z.]+$/u);
  return match ? COMMON_ENGLISH_ABBREVIATIONS.has(match[0].toLowerCase()) : false;
}

function shouldInsertJoinSpace(left: string, right: string): boolean {
  return /[A-Za-z0-9.!?]$/u.test(left) && /^[A-Za-z0-9]/u.test(right);
}

function joinSentenceChunks(left: string, right: string): string {
  return `${left}${shouldInsertJoinSpace(left, right) ? " " : ""}${right}`;
}

function mergeAbbreviationSegments(segments: string[]): string[] {
  const mergedSegments: string[] = [];
  let current = "";

  for (const segment of segments) {
    current = current.length > 0 ? joinSentenceChunks(current, segment) : segment;

    if (!endsWithCommonEnglishAbbreviation(current)) {
      mergedSegments.push(current);
      current = "";
    }
  }

  if (current.length > 0) {
    mergedSegments.push(current);
  }

  return mergedSegments;
}

function splitSentences(paragraph: string, language?: string): string[] {
  const Segmenter = (globalThis.Intl as IntlWithOptionalSegmenter).Segmenter;

  if (Segmenter) {
    const segmenter = new Segmenter(language, { granularity: "sentence" });
    const segments = Array.from(segmenter.segment(paragraph), ({ segment }) =>
      segment.trim(),
    ).filter((segment) => segment.length > 0);

    if (segments.length > 0) {
      return mergeAbbreviationSegments(segments);
    }
  }

  return mergeAbbreviationSegments(
    (paragraph.match(SENTENCE_CHUNK_PATTERN) ?? [paragraph])
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0),
  );
}

function splitParagraph(
  paragraph: string,
  targetLength: number,
  hardLimit: number,
  language?: string,
): string[] {
  const chunks = splitSentences(paragraph, language);
  const segments: string[] = [];
  let current = "";

  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (chunk.length === 0) {
      continue;
    }

    if (chunk.length > hardLimit) {
      if (current.length > 0) {
        segments.push(current);
        current = "";
      }
      segments.push(...hardSplitText(chunk, hardLimit));
      continue;
    }

    const next =
      current.length > 0 ? joinSentenceChunks(current, chunk) : chunk;
    if (current.length > 0 && next.length > targetLength) {
      segments.push(current);
      current = chunk;
      continue;
    }

    current = next;
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

export function isSupportedPlainTextBookFile(file: File): boolean {
  if (file.type && SUPPORTED_TEXT_MIME_TYPES.has(file.type.toLowerCase())) {
    return true;
  }

  return SUPPORTED_TEXT_EXTENSIONS.has(getFileExtension(file.name));
}

export function getPlainTextBookTitle(fileName: string): string {
  const extension = getFileExtension(fileName);
  const nameWithoutExtension = extension
    ? fileName.slice(0, -extension.length)
    : fileName;
  const normalizedName = nameWithoutExtension.trim();

  return normalizedName.length > 0 ? normalizedName : "未命名书稿";
}

export async function readPlainTextBookFile(file: File): Promise<PlainTextBook> {
  if (!isSupportedPlainTextBookFile(file)) {
    throw new Error("第一版听书仅支持 txt 和 markdown 文本文件");
  }

  return {
    kind: "plain-text",
    title: getPlainTextBookTitle(file.name),
    text: await file.text(),
  };
}

export function segmentBookText(
  text: string,
  options: SegmentBookTextOptions = {},
): AudiobookSegment[] {
  const targetLength = options.targetLength ?? DEFAULT_TARGET_LENGTH;
  const hardLimit = options.hardLimit ?? DEFAULT_HARD_LIMIT;
  const language = options.language;
  const idPrefix = options.idPrefix ?? "segment";
  const startingOrder = options.startingOrder ?? 1;
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/u)
    .map(normalizeParagraph)
    .filter((paragraph) => paragraph.length > 0);

  const segmentTexts = paragraphs.flatMap((paragraph) =>
    splitParagraph(paragraph, targetLength, hardLimit, language),
  );

  return segmentTexts.map((segmentText, index) => {
    const order = startingOrder + index;

    return {
      id: `${idPrefix}-${index + 1}`,
      order,
      text: segmentText,
      ...(options.chapterTitle ? { chapterTitle: options.chapterTitle } : {}),
      ...(options.sourceHref ? { sourceHref: options.sourceHref } : {}),
    };
  });
}
