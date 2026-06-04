import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBilibiliDirectAudioLoader,
  createBilibiliDirectAudioWebLoader,
} from "./bilibiliDirectAudio";

const TEST_DIRECT_AUDIO_SOURCE = {
  aid: "170001",
  audioUrl: "/api/bilibili/audio-proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s",
  backupUrls: [],
  bandwidth: 128000,
  bvid: "BV1xx411c7mD",
  cid: "110002",
  codecs: "mp4a.40.2",
  coverUrl: "https://i0.hdslb.com/video.jpg",
  mimeType: "audio/mp4",
  title: "测试视频",
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
    ).resolves.toEqual(TEST_DIRECT_AUDIO_SOURCE);
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
    ).resolves.toEqual(TEST_DIRECT_AUDIO_SOURCE);
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
