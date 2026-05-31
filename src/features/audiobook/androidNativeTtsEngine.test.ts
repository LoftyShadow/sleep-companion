import { describe, expect, it, vi } from "vitest";
import { createAndroidNativeTtsEngine } from "./androidNativeTtsEngine";

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

async function flushAsyncWork() {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

function createInvoke(
  speakResult: Promise<unknown> = Promise.resolve(undefined),
) {
  return vi.fn((cmd: string) => {
    if (cmd === "plugin:native-tts|listVoices") {
      return Promise.resolve([
        {
          id: "android:voice:zh-cn",
          name: "中文",
          language: "zh-CN",
          isDefault: true,
          isLocal: true,
        },
      ]);
    }

    if (cmd === "plugin:native-tts|speak") {
      return speakResult;
    }

    return Promise.resolve(undefined);
  });
}

describe("createAndroidNativeTtsEngine", () => {
  it("lists Android system voices", async () => {
    const invoke = createInvoke();
    const engine = createAndroidNativeTtsEngine(invoke);

    await expect(engine.listVoices()).resolves.toEqual([
      {
        id: "android:voice:zh-cn",
        name: "中文",
        language: "zh-CN",
        isDefault: true,
        isLocal: true,
      },
    ]);
  });

  it("starts native speech and reports completion asynchronously", async () => {
    const deferredSpeak = createDeferred<unknown>();
    const invoke = createInvoke(deferredSpeak.promise);
    const engine = createAndroidNativeTtsEngine(invoke);
    const onEnd = vi.fn();

    const handle = await engine.speak({
      text: "雨声落在窗外。",
      voiceId: null,
      language: "zh-CN",
      rate: 1.3,
      onEnd,
    });

    await flushAsyncWork();

    expect(engine.supportsPause).toBe(false);
    expect(typeof handle.pause).toBe("function");
    expect(typeof handle.resume).toBe("function");
    expect(typeof handle.cancel).toBe("function");
    expect(invoke).toHaveBeenNthCalledWith(1, "plugin:native-tts|speak", {
      input: {
        text: "雨声落在窗外。",
        voiceId: null,
        language: "zh-CN",
        rate: 1.3,
        pitch: undefined,
        volume: undefined,
      },
    });

    deferredSpeak.resolve(undefined);
    await flushAsyncWork();

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("suppresses completion after cancellation", async () => {
    const deferredSpeak = createDeferred<unknown>();
    const invoke = createInvoke(deferredSpeak.promise);
    const engine = createAndroidNativeTtsEngine(invoke);
    const onEnd = vi.fn();

    const handle = await engine.speak({
      text: "第一段。",
      voiceId: "android:voice:zh-cn",
      language: "zh-CN",
      rate: 1,
      onEnd,
    });
    await flushAsyncWork();

    handle.cancel();
    deferredSpeak.resolve(undefined);
    await flushAsyncWork();

    expect(onEnd).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenLastCalledWith("plugin:native-tts|cancel");
  });

  it("does not call native cancel when no speech is active", () => {
    const invoke = createInvoke();
    const engine = createAndroidNativeTtsEngine(invoke);

    engine.cancel();
    engine.destroy();

    expect(invoke).not.toHaveBeenCalled();
  });

  it("reports native command failures", async () => {
    const invoke = createInvoke(Promise.reject(new Error("TTS 未初始化")));
    const engine = createAndroidNativeTtsEngine(invoke);
    const onError = vi.fn();

    await engine.speak({
      text: "第一段。",
      voiceId: null,
      language: "zh-CN",
      rate: 1,
      onError,
    });
    await flushAsyncWork();

    expect(onError).toHaveBeenCalledWith("TTS 未初始化");
  });
});
