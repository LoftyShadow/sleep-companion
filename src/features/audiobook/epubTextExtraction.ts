import { getFirstElementByLocalName } from "./epubXml";

const READABLE_BLOCK_NAMES = new Set([
  "blockquote",
  "dd",
  "dt",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "p",
  "pre",
  "td",
  "th",
]);

const SKIPPED_TEXT_CONTAINER_NAMES = new Set([
  "head",
  "metadata",
  "nav",
  "noscript",
  "script",
  "style",
  "svg",
]);

function cloneReadableRoot(contentDocument: Document): Element | null {
  const body = getFirstElementByLocalName(contentDocument, "body");
  const source = body ?? contentDocument.documentElement;
  const clone = source.cloneNode(true);

  return clone instanceof Element ? clone : null;
}

function normalizeReadableText(text: string): string {
  return text
    .replace(/\u00a0/gu, " ")
    .replace(/[ \t\f\v]+/gu, " ")
    .replace(/\s*\n\s*/gu, " ")
    .trim();
}

function removeSkippedElements(root: Element): void {
  for (const element of Array.from(root.getElementsByTagName("*"))) {
    if (SKIPPED_TEXT_CONTAINER_NAMES.has(element.localName.toLowerCase())) {
      element.remove();
    }
  }
}

function hasReadableBlockAncestor(element: Element, root: Element): boolean {
  let parent = element.parentElement;

  while (parent && parent !== root) {
    if (READABLE_BLOCK_NAMES.has(parent.localName.toLowerCase())) {
      return true;
    }

    parent = parent.parentElement;
  }

  return false;
}

export function extractReadableText(contentDocument: Document): string {
  const root = cloneReadableRoot(contentDocument);
  if (!root) {
    return "";
  }

  removeSkippedElements(root);

  const blockTexts = Array.from(root.getElementsByTagName("*"))
    .filter(
      (element) =>
        READABLE_BLOCK_NAMES.has(element.localName.toLowerCase()) &&
        !hasReadableBlockAncestor(element, root),
    )
    .map((element) => normalizeReadableText(element.textContent ?? ""))
    .filter((text) => text.length > 0);

  if (blockTexts.length > 0) {
    return blockTexts.join("\n\n");
  }

  return normalizeReadableText(root.textContent ?? "");
}

export function extractChapterTitle(
  contentDocument: Document,
  fallbackTitle: string,
): string {
  const headingTitle = ["h1", "h2", "h3", "h4", "h5", "h6"]
    .map((localName) =>
      getFirstElementByLocalName(contentDocument, localName)?.textContent?.trim(),
    )
    .find((title) => title && title.length > 0);
  const documentTitle = getFirstElementByLocalName(
    contentDocument,
    "title",
  )?.textContent?.trim();

  return headingTitle ?? documentTitle ?? fallbackTitle;
}
