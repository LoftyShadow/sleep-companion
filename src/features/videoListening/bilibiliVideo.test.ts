import { describe, expect, it } from "vitest";
import {
  buildBilibiliPlayerUrl,
  createBilibiliVideoSource,
  parseBilibiliVideoInput,
} from "./bilibiliVideo";

describe("bilibiliVideo", () => {
  it("parses BV video links", () => {
    expect(
      parseBilibiliVideoInput(
        "https://www.bilibili.com/video/BV1xx411c7mD/?spm_id_from=333",
      ),
    ).toEqual({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
  });

  it("parses av video links", () => {
    expect(
      parseBilibiliVideoInput("https://www.bilibili.com/video/av170001"),
    ).toEqual({
      kind: "aid",
      value: "170001",
    });
  });

  it("parses episode links", () => {
    expect(
      parseBilibiliVideoInput("https://www.bilibili.com/bangumi/play/ep12345"),
    ).toEqual({
      kind: "ep",
      value: "12345",
    });
  });

  it("parses direct identifiers", () => {
    expect(parseBilibiliVideoInput("BV1xx411c7mD")).toEqual({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
    expect(parseBilibiliVideoInput("av170001")).toEqual({
      kind: "aid",
      value: "170001",
    });
    expect(parseBilibiliVideoInput("ep12345")).toEqual({
      kind: "ep",
      value: "12345",
    });
  });

  it("rejects unsupported links", () => {
    expect(parseBilibiliVideoInput("https://example.com/video/BV1xx411c7mD")).toBe(
      null,
    );
    expect(parseBilibiliVideoInput("https://b23.tv/shortlink")).toBe(null);
  });

  it("builds official player urls", () => {
    expect(
      buildBilibiliPlayerUrl({ kind: "bvid", value: "BV1xx411c7mD" }),
    ).toBe(
      "https://player.bilibili.com/player.html?autoplay=1&bvid=BV1xx411c7mD",
    );
    expect(buildBilibiliPlayerUrl({ kind: "aid", value: "170001" })).toBe(
      "https://player.bilibili.com/player.html?autoplay=1&aid=170001",
    );
    expect(buildBilibiliPlayerUrl({ kind: "ep", value: "12345" })).toBe(
      "https://player.bilibili.com/player.html?autoplay=1&episodeId=12345",
    );
  });

  it("creates a display source for valid input", () => {
    expect(createBilibiliVideoSource("BV1xx411c7mD")).toEqual({
      embedUrl:
        "https://player.bilibili.com/player.html?autoplay=1&bvid=BV1xx411c7mD",
      label: "BV BV1xx411c7mD",
      reference: {
        kind: "bvid",
        value: "BV1xx411c7mD",
      },
    });
  });
});
