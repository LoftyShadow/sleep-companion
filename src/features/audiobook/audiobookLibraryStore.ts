import type { FileSystemPort } from "../storage/FileSystemPort";
import { indexedDbFileSystem } from "../storage/indexedDbFileSystem";
import type {
  AudiobookBookId,
  AudiobookCover,
  AudiobookLibraryItem,
  AudiobookProgress,
  AudiobookSegment,
  ImportedAudiobookBook,
  SegmentedAudiobookBook,
  StoredAudiobookBook,
  StoredAudiobookFormat,
} from "./audiobookTypes";
import { buildAudiobookChapters } from "./chapterGrouping";
import {
  isSupportedAudiobookBookFile,
  readAudiobookBookFile,
} from "./bookImport";
import { segmentBookText } from "./textSegmentation";

const LIBRARY_PATH = "audiobooks/library.json";
const BOOKS_DIRECTORY = "audiobooks/books";
const AUDIOBOOK_ID_PREFIX = "audiobook:";
const GENERATED_COVER_ACCENTS = [
  "#2d7d82",
  "#8b5e3c",
  "#6d7f3f",
  "#9a5148",
  "#4f6d9a",
  "#6f5c8f",
  "#7a6b35",
];

function getBookToken(bookId: AudiobookBookId): string {
  return bookId.slice(AUDIOBOOK_ID_PREFIX.length);
}

function getBookDirectory(bookId: AudiobookBookId): string {
  return `${BOOKS_DIRECTORY}/${getBookToken(bookId)}`;
}

function getBookPath(bookId: AudiobookBookId): string {
  return `${getBookDirectory(bookId)}/book.json`;
}

function getCoverPath(bookId: AudiobookBookId): string {
  return `${getBookDirectory(bookId)}/cover`;
}

function createAudiobookBookId(): AudiobookBookId {
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${AUDIOBOOK_ID_PREFIX}${token}`;
}

function getBookFormat(book: ImportedAudiobookBook): StoredAudiobookFormat {
  return book.kind === "plain-text" ? "plain-text" : "epub";
}

function getBookSegments(book: ImportedAudiobookBook): AudiobookSegment[] {
  return book.kind === "plain-text" ? segmentBookText(book.text) : book.segments;
}

function getBookAuthor(book: ImportedAudiobookBook): string | undefined {
  return book.kind === "segmented" ? book.author : undefined;
}

function clampSegmentIndex(segmentIndex: number, segmentCount: number): number {
  if (segmentCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(segmentIndex, 0), segmentCount - 1);
}

export function createAudiobookProgress(
  segments: readonly AudiobookSegment[],
  segmentIndex: number,
  now = Date.now(),
): AudiobookProgress {
  const safeSegmentIndex = clampSegmentIndex(segmentIndex, segments.length);
  const segment = segments[safeSegmentIndex] ?? null;

  return {
    percent:
      segments.length > 0
        ? Math.round(((safeSegmentIndex + 1) / segments.length) * 100)
        : 0,
    segmentId: segment?.id ?? null,
    segmentIndex: safeSegmentIndex,
    updatedAt: now,
    ...(segment?.chapterTitle ? { chapterTitle: segment.chapterTitle } : {}),
    ...(segment?.sourceHref ? { sourceHref: segment.sourceHref } : {}),
  };
}

export function resolveAudiobookProgressSegmentIndex(
  progress: AudiobookProgress,
  segments: readonly AudiobookSegment[],
): number {
  if (segments.length === 0) {
    return 0;
  }

  if (progress.segmentId) {
    const segmentIndex = segments.findIndex(
      (segment) => segment.id === progress.segmentId,
    );
    if (segmentIndex >= 0) {
      return segmentIndex;
    }
  }

  return clampSegmentIndex(progress.segmentIndex, segments.length);
}

function getCoverInitials(title: string): string {
  const normalizedTitle = title.trim();
  const firstCharacter = Array.from(normalizedTitle)[0];

  return firstCharacter ?? "书";
}

function createGeneratedCover(title: string): AudiobookCover {
  const normalizedTitle = title.trim() || "未命名书稿";
  const hash = Array.from(normalizedTitle).reduce(
    (total, character) => total + character.codePointAt(0)!,
    0,
  );
  const accent =
    GENERATED_COVER_ACCENTS[hash % GENERATED_COVER_ACCENTS.length] ??
    "#2d7d82";

  return {
    accent,
    initials: getCoverInitials(normalizedTitle),
    kind: "generated",
  };
}

function createLibraryItem({
  book,
  bookId,
  cover,
  fileName,
  now,
}: {
  book: ImportedAudiobookBook;
  bookId: AudiobookBookId;
  cover: AudiobookCover;
  fileName: string;
  now: number;
}): AudiobookLibraryItem {
  const segments = getBookSegments(book);
  const chapters = buildAudiobookChapters(segments);

  return {
    chapterCount: chapters.length,
    cover,
    createdAt: now,
    fileName,
    format: getBookFormat(book),
    id: bookId,
    lastOpenedAt: now,
    progress: createAudiobookProgress(segments, 0, now),
    segmentCount: segments.length,
    title: book.title,
    updatedAt: now,
    ...(getBookAuthor(book) ? { author: getBookAuthor(book) } : {}),
  };
}

function serializeBook(book: ImportedAudiobookBook): string {
  if (book.kind === "plain-text") {
    return JSON.stringify(book);
  }

  const serializableBook: SegmentedAudiobookBook = {
    ...(book.author ? { author: book.author } : {}),
    format: book.format,
    kind: book.kind,
    segments: book.segments,
    title: book.title,
  };

  return JSON.stringify(serializableBook);
}

async function loadLibraryItems(
  fs: FileSystemPort,
): Promise<AudiobookLibraryItem[]> {
  if (!(await fs.exists(LIBRARY_PATH))) {
    return [];
  }

  try {
    return JSON.parse(await fs.readText(LIBRARY_PATH)) as AudiobookLibraryItem[];
  } catch {
    return [];
  }
}

async function saveLibraryItems(
  fs: FileSystemPort,
  items: readonly AudiobookLibraryItem[],
): Promise<void> {
  await fs.writeText(LIBRARY_PATH, JSON.stringify(items));
}

function sortLibraryItems(
  items: readonly AudiobookLibraryItem[],
): AudiobookLibraryItem[] {
  return [...items].sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
}

function replaceLibraryItem(
  items: readonly AudiobookLibraryItem[],
  nextItem: AudiobookLibraryItem,
): AudiobookLibraryItem[] {
  return sortLibraryItems(
    items.map((item) => (item.id === nextItem.id ? nextItem : item)),
  );
}

export async function listAudiobookLibraryItems(
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<AudiobookLibraryItem[]> {
  return sortLibraryItems(await loadLibraryItems(fs));
}

export async function importAudiobookBookFile(
  file: File,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<StoredAudiobookBook> {
  if (!isSupportedAudiobookBookFile(file)) {
    throw new Error("听书支持 txt、markdown 和 EPUB 文件");
  }

  return saveImportedAudiobookBook(await readAudiobookBookFile(file), file.name, fs);
}

export async function saveImportedAudiobookBook(
  book: ImportedAudiobookBook,
  fileName: string,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<StoredAudiobookBook> {
  const now = Date.now();
  const bookId = createAudiobookBookId();
  const coverPath = getCoverPath(bookId);
  const cover: AudiobookCover =
    book.kind === "segmented" && book.coverImage
      ? {
          kind: "image",
          mimeType: book.coverImage.type,
          path: coverPath,
        }
      : createGeneratedCover(book.title);
  const item = createLibraryItem({ book, bookId, cover, fileName, now });
  const libraryItems = await loadLibraryItems(fs);

  await fs.writeText(getBookPath(bookId), serializeBook(book));
  if (book.kind === "segmented" && book.coverImage) {
    await fs.writeBinary(coverPath, book.coverImage.blob);
  }
  await saveLibraryItems(fs, sortLibraryItems([item, ...libraryItems]));

  return { book: JSON.parse(serializeBook(book)) as ImportedAudiobookBook, item };
}

export async function loadStoredAudiobookBook(
  bookId: AudiobookBookId,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<StoredAudiobookBook | null> {
  const libraryItems = await loadLibraryItems(fs);
  const item = libraryItems.find((candidate) => candidate.id === bookId);
  if (!item || !(await fs.exists(getBookPath(bookId)))) {
    return null;
  }

  return {
    book: JSON.parse(await fs.readText(getBookPath(bookId))) as ImportedAudiobookBook,
    item,
  };
}

export async function touchAudiobookBook(
  bookId: AudiobookBookId,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<AudiobookLibraryItem | null> {
  const libraryItems = await loadLibraryItems(fs);
  const item = libraryItems.find((candidate) => candidate.id === bookId);
  if (!item) {
    return null;
  }

  const nextItem: AudiobookLibraryItem = {
    ...item,
    lastOpenedAt: Date.now(),
  };

  await saveLibraryItems(fs, replaceLibraryItem(libraryItems, nextItem));

  return nextItem;
}

export async function renameAudiobookBook(
  bookId: AudiobookBookId,
  title: string,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<StoredAudiobookBook | null> {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length === 0) {
    throw new Error("书名不能为空");
  }

  const storedBook = await loadStoredAudiobookBook(bookId, fs);
  if (!storedBook) {
    return null;
  }

  const now = Date.now();
  const nextBook = { ...storedBook.book, title: normalizedTitle };
  const nextItem: AudiobookLibraryItem = {
    ...storedBook.item,
    title: normalizedTitle,
    updatedAt: now,
    ...(storedBook.item.cover.kind === "generated"
      ? { cover: createGeneratedCover(normalizedTitle) }
      : {}),
  };
  const libraryItems = await loadLibraryItems(fs);

  await fs.writeText(getBookPath(bookId), serializeBook(nextBook));
  await saveLibraryItems(fs, replaceLibraryItem(libraryItems, nextItem));

  return { book: nextBook, item: nextItem };
}

export async function updateAudiobookBookProgress(
  bookId: AudiobookBookId,
  progress: AudiobookProgress,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<AudiobookLibraryItem | null> {
  const libraryItems = await loadLibraryItems(fs);
  const item = libraryItems.find((candidate) => candidate.id === bookId);
  if (!item) {
    return null;
  }

  const now = Date.now();
  const nextItem: AudiobookLibraryItem = {
    ...item,
    lastOpenedAt: now,
    progress,
    updatedAt: now,
  };

  await saveLibraryItems(fs, replaceLibraryItem(libraryItems, nextItem));

  return nextItem;
}

export async function deleteStoredAudiobookBook(
  bookId: AudiobookBookId,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<AudiobookLibraryItem[]> {
  const libraryItems = await loadLibraryItems(fs);
  const nextItems = libraryItems.filter((item) => item.id !== bookId);

  await fs.deletePrefix(`${getBookDirectory(bookId)}/`);
  await saveLibraryItems(fs, sortLibraryItems(nextItems));

  return sortLibraryItems(nextItems);
}

export async function loadAudiobookCoverObjectUrl(
  item: AudiobookLibraryItem,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<string | null> {
  if (item.cover.kind !== "image") {
    return null;
  }

  const content = await fs.readBinary(item.cover.path);

  return URL.createObjectURL(new Blob([content], { type: item.cover.mimeType }));
}
