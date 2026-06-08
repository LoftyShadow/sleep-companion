import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import { indexedDbFileSystem } from "../storage/indexedDbFileSystem";
import type {
  AudiobookBookId,
  AudiobookLibraryItem,
  AudiobookSegment,
  ImportedAudiobookBook,
  PlainTextBook,
  StoredAudiobookBook,
} from "./audiobookTypes";
import {
  createAudiobookProgress,
  deleteStoredAudiobookBook,
  importAudiobookBookFile,
  listAudiobookLibraryItems,
  loadAudiobookCoverObjectUrl,
  loadStoredAudiobookBook,
  renameAudiobookBook,
  resolveAudiobookProgressSegmentIndex,
  touchAudiobookBook,
  updateAudiobookBookProgress,
} from "./audiobookLibraryStore";
import { segmentBookText } from "./textSegmentation";

const DEFAULT_AUDIOBOOK_DRAFT: PlainTextBook = {
  kind: "plain-text",
  text: "",
  title: "",
};

type CoverObjectUrls = Partial<Record<AudiobookBookId, string>>;

function getBookSegments(book: ImportedAudiobookBook): AudiobookSegment[] {
  return book.kind === "plain-text" ? segmentBookText(book.text) : book.segments;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export function useAudiobookLibrary(
  fileSystem: FileSystemPort = indexedDbFileSystem,
) {
  const [items, setItems] = useState<AudiobookLibraryItem[]>([]);
  const [activeBook, setActiveBook] = useState<ImportedAudiobookBook | null>(
    null,
  );
  const [activeItem, setActiveItem] = useState<AudiobookLibraryItem | null>(
    null,
  );
  const [activeInitialSegmentIndex, setActiveInitialSegmentIndex] = useState(0);
  const [draftBook, setDraftBook] =
    useState<PlainTextBook>(DEFAULT_AUDIOBOOK_DRAFT);
  const [coverObjectUrls, setCoverObjectUrls] = useState<CoverObjectUrls>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const activeBookId = activeItem?.id ?? null;
  const visibleBook = activeBook ?? draftBook;
  const activeSegments = useMemo(
    () => (activeBook ? getBookSegments(activeBook) : []),
    [activeBook],
  );

  const openStoredBook = useCallback(
    async (bookId: AudiobookBookId) => {
      const storedBook = await loadStoredAudiobookBook(bookId, fileSystem);
      if (!storedBook) {
        throw new Error("这本书已经不在书架中");
      }

      const touchedItem = await touchAudiobookBook(bookId, fileSystem);
      const nextItem = touchedItem ?? storedBook.item;
      const segments = getBookSegments(storedBook.book);

      if (!isMountedRef.current) {
        return;
      }

      setActiveBook(storedBook.book);
      setActiveItem(nextItem);
      setActiveInitialSegmentIndex(
        resolveAudiobookProgressSegmentIndex(nextItem.progress, segments),
      );
      setItems(await listAudiobookLibraryItems(fileSystem));
      setMessage(`继续收听 ${nextItem.title}`);
      setErrorMessage(null);
    },
    [fileSystem],
  );

  useEffect(() => {
    isMountedRef.current = true;

    async function loadLibrary() {
      setIsLoading(true);
      try {
        const libraryItems = await listAudiobookLibraryItems(fileSystem);
        if (!isMountedRef.current) {
          return;
        }

        setItems(libraryItems);
        if (libraryItems[0]) {
          await openStoredBook(libraryItems[0].id);
        }
        setErrorMessage(null);
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(getErrorMessage(error, "读取听书书架失败"));
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      isMountedRef.current = false;
    };
  }, [fileSystem, openStoredBook]);

  useEffect(() => {
    let isCancelled = false;
    const createdUrls: string[] = [];

    async function loadCoverUrls() {
      const nextCoverUrls: CoverObjectUrls = {};

      for (const item of items) {
        if (item.cover.kind !== "image") {
          continue;
        }

        try {
          const objectUrl = await loadAudiobookCoverObjectUrl(item, fileSystem);
          if (objectUrl) {
            createdUrls.push(objectUrl);
            nextCoverUrls[item.id] = objectUrl;
          }
        } catch {
          // 封面加载失败不影响书籍本身。
        }
      }

      if (!isCancelled) {
        setCoverObjectUrls(nextCoverUrls);
      } else {
        createdUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      }
    }

    void loadCoverUrls();

    return () => {
      isCancelled = true;
      createdUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [fileSystem, items]);

  const importBookFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) {
        return false;
      }

      setIsImporting(true);
      setMessage(null);
      setErrorMessage(null);

      try {
        let importedBookCount = 0;
        let latestStoredBook: StoredAudiobookBook | null = null;
        for (const file of files) {
          latestStoredBook = await importAudiobookBookFile(file, fileSystem);
          importedBookCount += 1;
        }
        const storedBook = latestStoredBook;
        if (!storedBook) {
          return false;
        }

        if (!isMountedRef.current) {
          return false;
        }

        setActiveBook(storedBook.book);
        setActiveItem(storedBook.item);
        setActiveInitialSegmentIndex(0);
        setItems(await listAudiobookLibraryItems(fileSystem));
        setMessage(
          importedBookCount > 1
            ? `已导入 ${importedBookCount} 本，当前打开 ${storedBook.item.title}`
            : storedBook.book.kind === "segmented"
              ? `已导入 ${storedBook.item.title} · ${storedBook.item.segmentCount} 段`
              : `已导入 ${storedBook.item.title}`,
        );
        return true;
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(getErrorMessage(error, "导入书稿失败"));
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsImporting(false);
        }
      }
    },
    [fileSystem],
  );

  const openBook = useCallback(
    async (bookId: AudiobookBookId) => {
      try {
        await openStoredBook(bookId);
        return true;
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(getErrorMessage(error, "打开书籍失败"));
        }
        return false;
      }
    },
    [openStoredBook],
  );

  const deleteBook = useCallback(
    async (bookId: AudiobookBookId) => {
      try {
        const nextItems = await deleteStoredAudiobookBook(bookId, fileSystem);
        if (!isMountedRef.current) {
          return;
        }

        setItems(nextItems);
        setMessage("已从书架移除");
        setErrorMessage(null);

        if (activeBookId === bookId) {
          setActiveBook(null);
          setActiveItem(null);
          setActiveInitialSegmentIndex(0);
          if (nextItems[0]) {
            await openStoredBook(nextItems[0].id);
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(getErrorMessage(error, "删除书籍失败"));
        }
      }
    },
    [activeBookId, fileSystem, openStoredBook],
  );

  const updateBookTitle = useCallback(
    async (title: string) => {
      if (!activeBookId) {
        setDraftBook((currentBook) => ({ ...currentBook, title }));
        return;
      }

      try {
        const renamedBook = await renameAudiobookBook(
          activeBookId,
          title,
          fileSystem,
        );
        if (!renamedBook || !isMountedRef.current) {
          return;
        }

        setActiveBook(renamedBook.book);
        setActiveItem(renamedBook.item);
        setItems(await listAudiobookLibraryItems(fileSystem));
        setErrorMessage(null);
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(getErrorMessage(error, "更新书名失败"));
        }
      }
    },
    [activeBookId, fileSystem],
  );

  const updateDraftText = useCallback((text: string) => {
    setDraftBook((currentBook) => ({ ...currentBook, text }));
  }, []);

  const updateActiveProgress = useCallback(
    async (segmentIndex: number, segment: AudiobookSegment) => {
      if (!activeBookId) {
        return;
      }

      const progress = createAudiobookProgress(
        activeSegments.length > 0 ? activeSegments : [segment],
        segmentIndex,
      );
      const nextItem = await updateAudiobookBookProgress(
        activeBookId,
        progress,
        fileSystem,
      );
      if (!nextItem || !isMountedRef.current) {
        return;
      }

      setActiveItem(nextItem);
      setItems(await listAudiobookLibraryItems(fileSystem));
    },
    [activeBookId, activeSegments, fileSystem],
  );

  return {
    activeBook,
    activeBookId,
    activeInitialSegmentIndex,
    activeItem,
    coverObjectUrls,
    deleteBook,
    draftBook,
    errorMessage,
    importBookFiles,
    isImporting,
    isLoading,
    items,
    message,
    openBook,
    updateActiveProgress,
    updateBookTitle,
    updateDraftText,
    visibleBook,
  };
}
