import { describe, expect, it } from "vitest";
import {
  BilibiliSourceKind,
  createBilibiliPlaybackSource,
  parseBilibiliInput,
} from "./bilibiliVideo";

describe("bilibiliVideo", () => {
  it("parses BV video links", () => {
    expect(
      parseBilibiliInput(
        "https://www.bilibili.com/video/BV1xx411c7mD/?spm_id_from=333",
      ),
    ).toEqual({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
  });

  it("parses av video links", () => {
    expect(
      parseBilibiliInput("https://www.bilibili.com/video/av170001"),
    ).toEqual({
      kind: "aid",
      value: "170001",
    });
  });

  it("parses episode links", () => {
    expect(
      parseBilibiliInput("https://www.bilibili.com/bangumi/play/ep12345"),
    ).toEqual({
      kind: "ep",
      value: "12345",
    });
  });

  it("parses live room links", () => {
    expect(parseBilibiliInput("https://live.bilibili.com/23058")).toEqual({
      kind: "live",
      value: "23058",
    });
    expect(
      parseBilibiliInput("https://live.bilibili.com/blanc/23058?spm_id_from=333"),
    ).toEqual({
      kind: "live",
      value: "23058",
    });
  });

  it("parses direct identifiers", () => {
    expect(parseBilibiliInput("BV1xx411c7mD")).toEqual({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
    expect(parseBilibiliInput("av170001")).toEqual({
      kind: "aid",
      value: "170001",
    });
    expect(parseBilibiliInput("ep12345")).toEqual({
      kind: "ep",
      value: "12345",
    });
    expect(parseBilibiliInput("live23058")).toEqual({
      kind: "live",
      value: "23058",
    });
  });

  it("rejects unsupported links", () => {
    expect(parseBilibiliInput("https://example.com/video/BV1xx411c7mD")).toBe(
      null,
    );
    expect(parseBilibiliInput("https://b23.tv/shortlink")).toBe(null);
  });

  it("creates a display source for valid input", () => {
    expect(createBilibiliPlaybackSource("BV1xx411c7mD")).toEqual({
      embedUrl:
        "https://player.bilibili.com/player.html?autoplay=1&bvid=BV1xx411c7mD",
      label: "BV BV1xx411c7mD",
      playerLabel: "B 站视频播放器",
      reference: {
        kind: "bvid",
        value: "BV1xx411c7mD",
      },
      sourceKind: BilibiliSourceKind.Video,
    });
  });

  it("creates a live source for live room links", () => {
    expect(
      createBilibiliPlaybackSource("https://live.bilibili.com/23058"),
    ).toEqual({
      embedUrl:
        "https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=23058&mute=0",
      label: "直播间 23058",
      playerLabel: "B 站直播播放器",
      reference: {
        kind: "live",
        value: "23058",
      },
      sourceKind: BilibiliSourceKind.Live,
    });
  });
});
