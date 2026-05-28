import { describe, expect, it, vi } from "vitest";
import { createPlayer } from "./createPlayer";

interface TestPlayer {
  kind: string;
}

describe("createPlayer", () => {
  it("uses the web player when platform is web", async () => {
    const web = { kind: "web" };
    const android = { kind: "android" };

    const player = await createPlayer<TestPlayer>({
      detectPlatform: () => Promise.resolve("web"),
      createWebPlayer: () => web,
      createAndroidPlayer: () => android,
    });

    expect(player).toBe(web);
  });

  it("uses the Android native player on Android", async () => {
    const web = { kind: "web" };
    const android = { kind: "android" };

    const player = await createPlayer<TestPlayer>({
      detectPlatform: () => Promise.resolve("android"),
      createWebPlayer: () => web,
      createAndroidPlayer: () => android,
    });

    expect(player).toBe(android);
  });

  it("falls back to web when platform detection fails", async () => {
    const web = { kind: "web" };

    const player = await createPlayer<TestPlayer>({
      detectPlatform: vi.fn(() => Promise.reject(new Error("no platform"))),
      createWebPlayer: () => web,
      createAndroidPlayer: () => ({ kind: "android" }),
    });

    expect(player).toBe(web);
  });
});
