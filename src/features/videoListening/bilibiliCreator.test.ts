import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBilibiliCreatorWebVideosLoader,
  createBilibiliCreatorVideosLoader,
  parseBilibiliCreatorInput,
} from "./bilibiliCreator";

describe("bilibiliCreator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses creator mids from space links and direct mids", () => {
    expect(parseBilibiliCreatorInput("123456")).toBe("123456");
    expect(parseBilibiliCreatorInput("https://space.bilibili.com/123456")).toBe(
      "123456",
    );
    expect(
      parseBilibiliCreatorInput("https://space.bilibili.com/123456/video"),
    ).toBe("123456");
    expect(parseBilibiliCreatorInput("https://www.bilibili.com/123456")).toBe(
      "123456",
    );
  });

  it("rejects unsupported creator inputs", () => {
    expect(parseBilibiliCreatorInput("")).toBeNull();
    expect(parseBilibiliCreatorInput("space123456")).toBeNull();
    expect(parseBilibiliCreatorInput("https://example.com/123456")).toBeNull();
  });

  it("loads creator videos through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      creator: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: "123456",
        name: "测试UP",
      },
      hasMore: true,
      page: 2,
      pageSize: 5,
      totalCount: 18,
      totalPages: 4,
      videos: [
        {
          bvid: "BV1xx411c7mD",
          coverUrl: "https://i0.hdslb.com/video.jpg",
          durationSeconds: 62,
          playCount: 1024,
          publishedAt: 1710000000,
          title: "最新视频",
        },
      ],
    });
    const loadVideos = createBilibiliCreatorVideosLoader(invoke);

    await expect(loadVideos("123456", { page: 2, pageSize: 5 })).resolves.toEqual({
      creator: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: "123456",
        name: "测试UP",
      },
      hasMore: true,
      page: 2,
      pageSize: 5,
      totalCount: 18,
      totalPages: 4,
      videos: [
        {
          aid: undefined,
          bvid: "BV1xx411c7mD",
          coverUrl: "https://i0.hdslb.com/video.jpg",
          durationSeconds: 62,
          playCount: 1024,
          publishedAt: 1710000000,
          title: "最新视频",
        },
      ],
    });
    const [command, args] = invoke.mock.calls[0] as [
      string,
      {
        fingerprint: Record<string, string>;
        mid: string;
        page: number;
        pageSize: number;
      },
    ];
    expect(command).toBe("fetch_bilibili_creator_videos");
    expect(args.mid).toBe("123456");
    expect(args.page).toBe(2);
    expect(args.pageSize).toBe(5);
    expect(typeof args.fingerprint.dmCoverImgStr).toBe("string");
    expect(typeof args.fingerprint.dmImgInter).toBe("string");
    expect(typeof args.fingerprint.dmImgList).toBe("string");
    expect(typeof args.fingerprint.dmImgStr).toBe("string");
  });

  it("loads creator videos through the Web API outside Tauri", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          creator: {
            mid: "15810",
            name: "Mr.Quin",
          },
          hasMore: true,
          page: 3,
          pageSize: 5,
          totalCount: 18,
          totalPages: 4,
          videos: [
            {
              bvid: "BV1g5Vh63EqE",
              publishedAt: 1780279200,
              title: "摸鱼禁止&Mr.Quin十周年新品服饰发布会",
            },
          ],
        }),
      ),
    });
    vi.stubGlobal("fetch", fetchMock);
    const loadVideos = createBilibiliCreatorWebVideosLoader("");

    await expect(loadVideos("15810", { page: 3, pageSize: 5 })).resolves.toEqual({
      creator: {
        avatarUrl: undefined,
        mid: "15810",
        name: "Mr.Quin",
      },
      hasMore: true,
      page: 3,
      pageSize: 5,
      totalCount: 18,
      totalPages: 4,
      videos: [
        {
          aid: undefined,
          bvid: "BV1g5Vh63EqE",
          coverUrl: undefined,
          durationSeconds: undefined,
          playCount: undefined,
          publishedAt: 1780279200,
          title: "摸鱼禁止&Mr.Quin十周年新品服饰发布会",
        },
      ],
    });
    const requestedUrl = new URL(
      fetchMock.mock.calls[0]?.[0] as string,
      "http://localhost",
    );
    expect(requestedUrl.pathname).toBe("/api/bilibili/creator-videos");
    expect(requestedUrl.searchParams.get("mid")).toBe("15810");
    expect(requestedUrl.searchParams.get("page")).toBe("3");
    expect(requestedUrl.searchParams.get("pageSize")).toBe("5");
    expect(requestedUrl.searchParams.get("dmImgStr")).toBeTruthy();
    expect(requestedUrl.searchParams.get("dmCoverImgStr")).toBeTruthy();
  });

  it("rejects invalid creator video response shapes", async () => {
    const invoke = vi.fn().mockResolvedValue({
      creator: { mid: "123456", name: "测试UP" },
      page: 1,
      pageSize: 5,
      videos: [{ title: "缺少 BV" }],
    });
    const loadVideos = createBilibiliCreatorVideosLoader(invoke);

    await expect(loadVideos("123456")).rejects.toThrow(
      "B 站 UP 主视频响应格式不正确",
    );
  });
});
