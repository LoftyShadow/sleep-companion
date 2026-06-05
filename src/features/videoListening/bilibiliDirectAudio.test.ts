import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBilibiliDirectAudioLoader,
  createBilibiliDirectAudioWebLoader,
} from "./bilibiliDirectAudio";

const TEST_DIRECT_AUDIO_SOURCE = {
  aid: "170001",
  audioUrl: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s",
  backupUrls: [],
  bandwidth: 128000,
  bvid: "BV1xx411c7mD",
  chapters: [
    {
      content: "第二段",
      fromSeconds: 120,
      imageUrl: "https://i0.hdslb.com/chapter-2.jpg",
      toSeconds: 180,
    },
    {
      content: "第一段",
      fromSeconds: 0,
      toSeconds: 120,
    },
  ],
  cid: "110002",
  codecs: "mp4a.40.2",
  coverUrl: "https://i0.hdslb.com/video.jpg",
  durationSeconds: 180,
  mimeType: "audio/mp4",
  title: "测试视频",
  videoBackupUrls: [],
  videoBandwidth: 800000,
  videoCodecs: "avc1.64001F",
  videoHeight: 720,
  videoMimeType: "video/mp4",
  videoTracks: [
    {
      backupUrls: [],
      bandwidth: 800000,
      codecs: "avc1.64001F",
      height: 720,
      id: "track-1",
      label: "720p · AVC · 800 kbps",
      mimeType: "video/mp4",
      url: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fv.m4s",
      width: 1280,
    },
  ],
  videoUrl: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fv.m4s",
  videoWidth: 1280,
};

describe("bilibiliDirectAudio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves direct audio through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue(TEST_DIRECT_AUDIO_SOURCE);
    const loadDirectAudio = createBilibiliDirectAudioLoader(invoke);

    await expect(
      loadDirectAudio({ kind: "bvid", value: "BV1xx411c7mD" }),
    ).resolves.toEqual({
      ...TEST_DIRECT_AUDIO_SOURCE,
      chapters: [
        {
          content: "第一段",
          fromSeconds: 0,
          imageUrl: undefined,
          toSeconds: 120,
        },
        {
          content: "第二段",
          fromSeconds: 120,
          imageUrl: "https://i0.hdslb.com/chapter-2.jpg",
          toSeconds: 180,
        },
      ],
    });
    expect(invoke).toHaveBeenCalledWith("resolve_bilibili_direct_audio", {
      reference: {
        kind: "bvid",
        value: "BV1xx411c7mD",
      },
    });
  });

  it("rejects malformed backend responses", async () => {
    const invoke = vi.fn().mockResolvedValue({
      audioUrl: "",
      title: "测试视频",
    });
    const loadDirectAudio = createBilibiliDirectAudioLoader(invoke);

    await expect(
      loadDirectAudio({ kind: "bvid", value: "BV1xx411c7mD" }),
    ).rejects.toThrow("B 站直连音频响应格式不正确");
  });

  it("resolves direct audio through the Web API", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(TEST_DIRECT_AUDIO_SOURCE), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const loadDirectAudio = createBilibiliDirectAudioWebLoader("");

    await expect(
      loadDirectAudio({ kind: "aid", value: "170001" }),
    ).resolves.toEqual({
      ...TEST_DIRECT_AUDIO_SOURCE,
      chapters: [
        {
          content: "第一段",
          fromSeconds: 0,
          imageUrl: undefined,
          toSeconds: 120,
        },
        {
          content: "第二段",
          fromSeconds: 120,
          imageUrl: "https://i0.hdslb.com/chapter-2.jpg",
          toSeconds: 180,
        },
      ],
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/bilibili/direct-audio?kind=aid&value=170001",
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });

  it("uses the Web API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "B 站直连音频不可用" }), {
          status: 502,
        }),
      ),
    );
    const loadDirectAudio = createBilibiliDirectAudioWebLoader("");

    await expect(
      loadDirectAudio({ kind: "bvid", value: "BV1xx411c7mD" }),
    ).rejects.toThrow("B 站直连音频不可用");
  });
});
