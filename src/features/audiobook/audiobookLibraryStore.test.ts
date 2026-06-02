import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type { AudiobookSegment, ImportedAudiobookBook } from "./audiobookTypes";
import {
  createAudiobookProgress,
  deleteStoredAudiobookBook,
  listAudiobookLibraryItems,
  loadStoredAudiobookBook,
  renameAudiobookBook,
  resolveAudiobookProgressSegmentIndex,
  saveImportedAudiobookBook,
  updateAudiobookBookProgress,
} from "./audiobookLibraryStore";

function createSegmentedBook(
  title = "测试书",
  coverImage?: Blob,
): ImportedAudiobookBook {
  return {
    author: "测试作者",
    ...(coverImage
      ? { coverImage: { blob: coverImage, type: "image/png" } }
      : {}),
    format: "epub",
    kind: "segmented",
    segments: [
      {
        chapterTitle: "第一章",
        id: "epub-1-1",
        order: 1,
        sourceHref: "OPS/Text/chapter1.xhtml",
        text: "第一段。",
      },
      {
        chapterTitle: "第二章",
        id: "epub-2-1",
        order: 2,
        sourceHref: "OPS/Text/chapter2.xhtml",
        text: "第二段。",
      },
    ],
    title,
  };
}

describe("audiobookLibraryStore", () => {
  it("saves imported books into library metadata and book content files", async () => {
    const fileSystem = createMemoryFileSystem();
    const storedBook = await saveImportedAudiobookBook(
      createSegmentedBook("有封面的书", new Blob(["cover"], { type: "image/png" })),
      "book.epub",
      fileSystem,
    );

    const items = await listAudiobookLibraryItems(fileSystem);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        author: "测试作者",
        chapterCount: 2,
        fileName: "book.epub",
        format: "epub",
        id: storedBook.item.id,
        segmentCount: 2,
        title: "有封面的书",
      }),
    );
    expect(items[0]?.cover).toEqual(
      expect.objectContaining({
        kind: "image",
        mimeType: "image/png",
      }),
    );

    const loadedBook = await loadStoredAudiobookBook(storedBook.item.id, fileSystem);

    expect(loadedBook?.book).toEqual(
      expect.objectContaining({
        author: "测试作者",
        kind: "segmented",
        title: "有封面的书",
      }),
    );
    expect(
      (loadedBook?.book.kind === "segmented" && loadedBook.book.coverImage) ||
        null,
    ).toBeNull();
  });

  it("updates progress without overwriting other books", async () => {
    const fileSystem = createMemoryFileSystem();
    const firstBook = await saveImportedAudiobookBook(
      createSegmentedBook("第一本"),
      "first.epub",
      fileSystem,
    );
    const secondBook = await saveImportedAudiobookBook(
      createSegmentedBook("第二本"),
      "second.epub",
      fileSystem,
    );
    const progress = createAudiobookProgress(
      firstBook.book.kind === "segmented" ? firstBook.book.segments : [],
      1,
      123,
    );

    await updateAudiobookBookProgress(firstBook.item.id, progress, fileSystem);

    const firstLoaded = await loadStoredAudiobookBook(firstBook.item.id, fileSystem);
    const secondLoaded = await loadStoredAudiobookBook(secondBook.item.id, fileSystem);

    expect(firstLoaded?.item.progress.segmentIndex).toBe(1);
    expect(firstLoaded?.item.progress.segmentId).toBe("epub-2-1");
    expect(secondLoaded?.item.progress.segmentIndex).toBe(0);
  });

  it("renames and deletes stored books", async () => {
    const fileSystem = createMemoryFileSystem();
    const storedBook = await saveImportedAudiobookBook(
      createSegmentedBook("旧书名"),
      "book.epub",
      fileSystem,
    );

    await renameAudiobookBook(storedBook.item.id, "新书名", fileSystem);

    expect((await loadStoredAudiobookBook(storedBook.item.id, fileSystem))?.item.title).toBe(
      "新书名",
    );

    await deleteStoredAudiobookBook(storedBook.item.id, fileSystem);

    expect(await listAudiobookLibraryItems(fileSystem)).toHaveLength(0);
    expect(await loadStoredAudiobookBook(storedBook.item.id, fileSystem)).toBeNull();
  });

  it("deletes only the selected stored book", async () => {
    const fileSystem = createMemoryFileSystem();
    const firstBook = await saveImportedAudiobookBook(
      createSegmentedBook("第一本"),
      "first.epub",
      fileSystem,
    );
    const secondBook = await saveImportedAudiobookBook(
      createSegmentedBook("第二本"),
      "second.epub",
      fileSystem,
    );

    await deleteStoredAudiobookBook(firstBook.item.id, fileSystem);

    expect(await loadStoredAudiobookBook(firstBook.item.id, fileSystem)).toBeNull();
    expect((await loadStoredAudiobookBook(secondBook.item.id, fileSystem))?.item.title).toBe(
      "第二本",
    );
  });

  it("resolves saved progress by segment id before falling back to index", () => {
    const segments: AudiobookSegment[] = [
      { id: "a", order: 1, text: "A" },
      { id: "b", order: 2, text: "B" },
    ];

    expect(
      resolveAudiobookProgressSegmentIndex(
        { percent: 50, segmentId: "b", segmentIndex: 0, updatedAt: 1 },
        segments,
      ),
    ).toBe(1);
    expect(
      resolveAudiobookProgressSegmentIndex(
        { percent: 50, segmentId: "missing", segmentIndex: 8, updatedAt: 1 },
        segments,
      ),
    ).toBe(1);
  });

  it("rejects empty rename titles", async () => {
    const fileSystem = createMemoryFileSystem();
    const storedBook = await saveImportedAudiobookBook(
      createSegmentedBook(),
      "book.epub",
      fileSystem,
    );

    await expect(
      renameAudiobookBook(storedBook.item.id, "   ", fileSystem),
    ).rejects.toThrow("书名不能为空");
  });
});
