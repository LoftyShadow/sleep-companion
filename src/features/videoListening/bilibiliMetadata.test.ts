import { describe, expect, it, vi } from "vitest";
import { createBilibiliMetadataLoader } from "./bilibiliMetadata";

describe("bilibiliMetadata", () => {
  it("loads metadata through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      imageUrl: "https://i0.hdslb.com/cover.jpg",
      title: "视频标题",
    });
    const loadMetadata = createBilibiliMetadataLoader(invoke);

    await expect(
      loadMetadata({ kind: "bvid", value: "BV1xx411c7mD" }),
    ).resolves.toEqual({
      imageUrl: "https://i0.hdslb.com/cover.jpg",
      title: "视频标题",
    });
    expect(invoke).toHaveBeenCalledWith("fetch_bilibili_metadata", {
      reference: { kind: "bvid", value: "BV1xx411c7mD" },
    });
  });

  it("rejects invalid metadata response shapes", async () => {
    const invoke = vi.fn().mockResolvedValue({ imageUrl: 123 });
    const loadMetadata = createBilibiliMetadataLoader(invoke);

    await expect(
      loadMetadata({ kind: "live", value: "24678311" }),
    ).rejects.toThrow("B 站元信息响应格式不正确");
  });
});
