import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import {
  deleteBilibiliCreator,
  listBilibiliCreators,
  markBilibiliCreatorFetched,
  upsertBilibiliCreator,
} from "./bilibiliCreatorStore";

describe("bilibiliCreatorStore", () => {
  it("saves and lists creators", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliCreator(
      { avatarUrl: "https://i0.hdslb.com/avatar.jpg", mid: "123456", name: "测试UP" },
      fileSystem,
      100,
    );

    await expect(listBilibiliCreators(fileSystem)).resolves.toEqual([
      {
        addedAt: 100,
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        lastFetchedAt: undefined,
        mid: "123456",
        name: "测试UP",
        updatedAt: 100,
      },
    ]);
  });

  it("updates duplicate creators instead of appending", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliCreator(
      { mid: "123456", name: "旧名称" },
      fileSystem,
      100,
    );
    await upsertBilibiliCreator(
      { mid: "123456", name: "新名称" },
      fileSystem,
      200,
    );

    const creators = await listBilibiliCreators(fileSystem);

    expect(creators).toHaveLength(1);
    expect(creators[0]).toEqual(
      expect.objectContaining({
        addedAt: 100,
        mid: "123456",
        name: "新名称",
        updatedAt: 200,
      }),
    );
  });

  it("marks creator fetched and deletes creators", async () => {
    const fileSystem = createMemoryFileSystem();

    await upsertBilibiliCreator({ mid: "123456", name: "测试UP" }, fileSystem, 100);
    await markBilibiliCreatorFetched(
      "123456",
      { avatarUrl: "https://i0.hdslb.com/avatar.jpg", mid: "123456", name: "测试UP" },
      fileSystem,
      300,
    );

    expect((await listBilibiliCreators(fileSystem))[0]).toEqual(
      expect.objectContaining({
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        lastFetchedAt: 300,
      }),
    );

    await deleteBilibiliCreator("123456", fileSystem);

    await expect(listBilibiliCreators(fileSystem)).resolves.toEqual([]);
  });
});
