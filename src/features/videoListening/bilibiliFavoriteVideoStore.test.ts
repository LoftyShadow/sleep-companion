import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import {
  deleteBilibiliFavoriteVideo,
  listBilibiliFavoriteVideos,
  upsertBilibiliFavoriteVideo,
} from "./bilibiliFavoriteVideoStore";

describe("bilibiliFavoriteVideoStore", () => {
  it("saves and lists favorite videos", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliFavoriteVideo(
      {
        aid: "170001",
        bvid: "BV1xx411c7mD",
        coverUrl: "https://i0.hdslb.com/video.jpg",
        durationSeconds: 62,
        playCount: 1024,
        publishedAt: 1710000000,
        source: "manual",
        title: "测试视频",
      },
      fileSystem,
      100,
    );

    await expect(listBilibiliFavoriteVideos(fileSystem)).resolves.toEqual([
      {
        addedAt: 100,
        aid: "170001",
        bvid: "BV1xx411c7mD",
        coverUrl: "https://i0.hdslb.com/video.jpg",
        durationSeconds: 62,
        playCount: 1024,
        publishedAt: 1710000000,
        source: "manual",
        title: "测试视频",
        updatedAt: 100,
      },
    ]);
  });

  it("updates duplicate favorite videos instead of appending", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliFavoriteVideo(
      { bvid: "BV1xx411c7mD", title: "旧标题" },
      fileSystem,
      100,
    );
    await upsertBilibiliFavoriteVideo(
      {
        bvid: "BV1xx411c7mD",
        durationSeconds: 120,
        source: "direct",
        title: "新标题",
      },
      fileSystem,
      200,
    );

    const favoriteVideos = await listBilibiliFavoriteVideos(fileSystem);

    expect(favoriteVideos).toHaveLength(1);
    expect(favoriteVideos[0]).toEqual(
      expect.objectContaining({
        addedAt: 100,
        bvid: "BV1xx411c7mD",
        durationSeconds: 120,
        source: "direct",
        title: "新标题",
        updatedAt: 200,
      }),
    );
  });

  it("sorts by latest update and deletes favorite videos", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliFavoriteVideo(
      { bvid: "BV1aa411c7mD", title: "较早视频" },
      fileSystem,
      100,
    );
    await upsertBilibiliFavoriteVideo(
      { bvid: "BV1bb411c7mD", title: "较新视频" },
      fileSystem,
      300,
    );

    expect((await listBilibiliFavoriteVideos(fileSystem)).map((video) => video.bvid))
      .toEqual(["BV1bb411c7mD", "BV1aa411c7mD"]);

    await deleteBilibiliFavoriteVideo("BV1bb411c7mD", fileSystem);

    await expect(listBilibiliFavoriteVideos(fileSystem)).resolves.toEqual([
      expect.objectContaining({
        bvid: "BV1aa411c7mD",
        title: "较早视频",
      }),
    ]);
  });

  it("falls back to an empty list for malformed storage content", async () => {
    const fileSystem = createMemoryFileSystem();

    await fileSystem.writeText(
      "video-listening/bilibili-favorite-videos.json",
      "{",
    );

    await expect(listBilibiliFavoriteVideos(fileSystem)).resolves.toEqual([]);
  });

  it("does not persist direct media urls", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliFavoriteVideo(
      {
        aid: "170001",
        bvid: "BV1xx411c7mD",
        coverUrl: "https://i0.hdslb.com/video.jpg",
        title: "测试视频",
      },
      fileSystem,
      100,
    );

    const storedText = await fileSystem.readText(
      "video-listening/bilibili-favorite-videos.json",
    );

    expect(storedText).not.toContain("audioUrl");
    expect(storedText).not.toContain("videoUrl");
    expect(storedText).not.toContain("backupUrls");
    expect(storedText).not.toContain("SESSDATA");
    expect(storedText).not.toContain("bili_jct");
  });
});
