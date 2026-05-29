import {
  BlobReader,
  configure,
  TextWriter,
  ZipReader,
  type Entry,
  type FileEntry,
} from "@zip.js/zip.js";
import type {
  AudiobookSegment,
  SegmentedAudiobookBook,
} from "./audiobookTypes";
import { getPlainTextBookTitle, segmentBookText } from "./textSegmentation";

const EPUB_EXTENSION = ".epub";
const EPUB_MIME_TYPE = "application/epub+zip";
const CONTAINER_PATH = "META-INF/container.xml";
const PACKAGE_MEDIA_TYPE = "application/oebps-package+xml";
const XHTML_MEDIA_TYPES = new Set([
  "application/xhtml+xml",
  "application/x-dtbook+xml",
  "text/html",
]);
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
const XML_ENTITY_REPLACEMENTS: Record<string, string> = {
  bull: "&#8226;",
  copy: "&#169;",
  hellip: "&#8230;",
  laquo: "&#171;",
  ldquo: "&#8220;",
  lsquo: "&#8216;",
  mdash: "&#8212;",
  middot: "&#183;",
  nbsp: "&#160;",
  ndash: "&#8211;",
  raquo: "&#187;",
  reg: "&#174;",
  rdquo: "&#8221;",
  rsquo: "&#8217;",
  trade: "&#8482;",
};

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

interface SpineItem {
  idref: string;
  linear: string | null;
}

interface EpubZipEntryMap {
  exact: Map<string, FileEntry>;
  caseInsensitive: Map<string, FileEntry>;
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function isSupportedEpubBookFile(file: File): boolean {
  if (file.type.toLowerCase() === EPUB_MIME_TYPE) {
    return true;
  }

  return getFileExtension(file.name) === EPUB_EXTENSION;
}

function isFileEntry(entry: Entry): entry is FileEntry {
  return !entry.directory;
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/gu, "/").replace(/^\/+/u, "");
}

function createEntryMap(entries: Entry[]): EpubZipEntryMap {
  const exact = new Map<string, FileEntry>();
  const caseInsensitive = new Map<string, FileEntry>();

  for (const entry of entries) {
    if (!isFileEntry(entry)) {
      continue;
    }

    const normalizedName = normalizeZipPath(entry.filename);
    exact.set(normalizedName, entry);
    caseInsensitive.set(normalizedName.toLowerCase(), entry);
  }

  return { caseInsensitive, exact };
}

function findEntry(entryMap: EpubZipEntryMap, path: string): FileEntry | null {
  const normalizedPath = normalizeZipPath(path);

  return (
    entryMap.exact.get(normalizedPath) ??
    entryMap.caseInsensitive.get(normalizedPath.toLowerCase()) ??
    null
  );
}

async function loadRequiredText(
  entryMap: EpubZipEntryMap,
  path: string,
): Promise<string> {
  const entry = findEntry(entryMap, path);
  if (!entry) {
    throw new Error(`EPUB 缺少必要文件：${path}`);
  }

  if (entry.encrypted) {
    throw new Error("暂不支持加密或 DRM EPUB");
  }

  return entry.getData(new TextWriter("utf-8"));
}

function sanitizeXmlEntities(text: string): string {
  return text.replace(/&([a-z]+);/giu, (match, entityName: string) => {
    return XML_ENTITY_REPLACEMENTS[entityName.toLowerCase()] ?? match;
  });
}

function parseXmlDocument(text: string, label: string): Document {
  const document = new DOMParser().parseFromString(
    sanitizeXmlEntities(text),
    "application/xml",
  );
  const parserError = document.getElementsByTagName("parsererror")[0];

  if (parserError) {
    throw new Error(`EPUB 文件解析失败：${label}`);
  }

  return document;
}

function parseContentDocument(text: string): Document {
  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(
    sanitizeXmlEntities(text),
    "application/xhtml+xml",
  );

  if (!xmlDocument.getElementsByTagName("parsererror")[0]) {
    return xmlDocument;
  }

  return parser.parseFromString(text, "text/html");
}

function getElementsByLocalName(
  root: Document | Element,
  localName: string,
): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (element) => element.localName.toLowerCase() === localName,
  );
}

function getFirstElementByLocalName(
  root: Document | Element,
  localName: string,
): Element | null {
  return getElementsByLocalName(root, localName)[0] ?? null;
}

function getRequiredAttribute(
  element: Element,
  attributeName: string,
): string | null {
  const value = element.getAttribute(attributeName)?.trim();

  return value && value.length > 0 ? value : null;
}

function resolveZipHref(href: string, relativeTo: string): string {
  const cleanHref = href.split("#", 1)[0]?.trim() ?? "";
  const base = new URL(normalizeZipPath(relativeTo), "epub://book/");
  const resolved = new URL(cleanHref, base);

  return normalizeZipPath(decodeURI(resolved.pathname));
}

function readContainerOpfPath(containerDocument: Document): string {
  const rootFiles = getElementsByLocalName(containerDocument, "rootfile");
  const packageRootFile =
    rootFiles.find(
      (element) =>
        element.getAttribute("media-type")?.trim() === PACKAGE_MEDIA_TYPE,
    ) ?? rootFiles[0];
  const opfPath = packageRootFile
    ? getRequiredAttribute(packageRootFile, "full-path")
    : null;

  if (!opfPath) {
    throw new Error("EPUB 缺少 OPF package 文档");
  }

  return normalizeZipPath(opfPath);
}

function readBookTitle(opfDocument: Document, fallbackTitle: string): string {
  const metadata = getFirstElementByLocalName(opfDocument, "metadata");
  const title = metadata
    ? getFirstElementByLocalName(metadata, "title")?.textContent?.trim()
    : null;

  return title && title.length > 0 ? title : fallbackTitle;
}

function readManifest(opfDocument: Document): Map<string, ManifestItem> {
  const manifest = getFirstElementByLocalName(opfDocument, "manifest");
  const items = manifest ? getElementsByLocalName(manifest, "item") : [];
  const manifestItems = new Map<string, ManifestItem>();

  for (const item of items) {
    const id = getRequiredAttribute(item, "id");
    const href = getRequiredAttribute(item, "href");
    const mediaType = getRequiredAttribute(item, "media-type");

    if (!id || !href || !mediaType) {
      continue;
    }

    manifestItems.set(id, {
      href,
      id,
      mediaType: mediaType.toLowerCase(),
    });
  }

  if (manifestItems.size === 0) {
    throw new Error("EPUB 缺少 manifest 资源列表");
  }

  return manifestItems;
}

function readSpine(opfDocument: Document): SpineItem[] {
  const spine = getFirstElementByLocalName(opfDocument, "spine");
  const itemRefs = spine ? getElementsByLocalName(spine, "itemref") : [];
  const spineItems = itemRefs.flatMap((itemRef): SpineItem[] => {
    const idref = getRequiredAttribute(itemRef, "idref");

    return idref
      ? [
          {
            idref,
            linear: itemRef.getAttribute("linear")?.trim() ?? null,
          },
        ]
      : [];
  });

  if (spineItems.length === 0) {
    throw new Error("EPUB 缺少 spine 阅读顺序");
  }

  return spineItems;
}

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

function extractReadableText(contentDocument: Document): string {
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

function extractChapterTitle(
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

function selectReadableSpineItems(spineItems: SpineItem[]): SpineItem[] {
  const linearItems = spineItems.filter((item) => item.linear !== "no");

  return linearItems.length > 0 ? linearItems : spineItems;
}

async function readEpubSegments(
  entryMap: EpubZipEntryMap,
  opfPath: string,
  manifestItems: Map<string, ManifestItem>,
  spineItems: SpineItem[],
): Promise<AudiobookSegment[]> {
  const segments: AudiobookSegment[] = [];
  let chapterIndex = 0;

  for (const spineItem of selectReadableSpineItems(spineItems)) {
    const manifestItem = manifestItems.get(spineItem.idref);
    if (!manifestItem || !XHTML_MEDIA_TYPES.has(manifestItem.mediaType)) {
      continue;
    }

    const sourceHref = resolveZipHref(manifestItem.href, opfPath);
    const chapterDocument = parseContentDocument(
      await loadRequiredText(entryMap, sourceHref),
    );
    const fallbackTitle = `第 ${chapterIndex + 1} 章`;
    const chapterTitle = extractChapterTitle(chapterDocument, fallbackTitle);
    const chapterText = extractReadableText(chapterDocument);

    if (chapterText.length === 0) {
      chapterIndex += 1;
      continue;
    }

    segments.push(
      ...segmentBookText(chapterText, {
        chapterTitle,
        idPrefix: `epub-${chapterIndex + 1}`,
        sourceHref,
        startingOrder: segments.length + 1,
      }),
    );
    chapterIndex += 1;
  }

  if (segments.length === 0) {
    throw new Error("EPUB 中没有可朗读的正文");
  }

  return segments;
}

export async function readEpubBookFile(
  file: File,
): Promise<SegmentedAudiobookBook> {
  if (!isSupportedEpubBookFile(file)) {
    throw new Error("请选择 EPUB 电子书文件");
  }

  configure({ useCompressionStream: false, useWebWorkers: false });

  const zipReader = new ZipReader(new BlobReader(file));

  try {
    const entryMap = createEntryMap(await zipReader.getEntries());
    const containerDocument = parseXmlDocument(
      await loadRequiredText(entryMap, CONTAINER_PATH),
      CONTAINER_PATH,
    );
    const opfPath = readContainerOpfPath(containerDocument);
    const opfDocument = parseXmlDocument(
      await loadRequiredText(entryMap, opfPath),
      opfPath,
    );
    const title = readBookTitle(opfDocument, getPlainTextBookTitle(file.name));
    const manifestItems = readManifest(opfDocument);
    const spineItems = readSpine(opfDocument);

    return {
      format: "epub",
      kind: "segmented",
      segments: await readEpubSegments(
        entryMap,
        opfPath,
        manifestItems,
        spineItems,
      ),
      title,
    };
  } finally {
    await zipReader.close();
  }
}
