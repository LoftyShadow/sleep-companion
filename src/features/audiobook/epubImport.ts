import {
  BlobReader,
  configure,
  TextWriter,
  ZipReader,
  type Entry,
  type FileEntry,
} from "@zip.js/zip.js";
import type { SegmentedAudiobookBook } from "./audiobookTypes";
import {
  readBookTitle,
  readContainerOpfPath,
  readManifest,
  readSpine,
} from "./epubPackage";
import { readEpubSegments } from "./epubSegments";
import { normalizeZipPath, parseXmlDocument } from "./epubXml";
import { getPlainTextBookTitle } from "./textSegmentation";

const EPUB_EXTENSION = ".epub";
const EPUB_MIME_TYPE = "application/epub+zip";
const CONTAINER_PATH = "META-INF/container.xml";

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
    const manifestItems = readManifest(opfDocument);
    const spineItems = readSpine(opfDocument);

    return {
      format: "epub",
      kind: "segmented",
      segments: await readEpubSegments({
        loadText: (path) => loadRequiredText(entryMap, path),
        manifestItems,
        opfPath,
        spineItems,
      }),
      title: readBookTitle(opfDocument, getPlainTextBookTitle(file.name)),
    };
  } finally {
    await zipReader.close();
  }
}
