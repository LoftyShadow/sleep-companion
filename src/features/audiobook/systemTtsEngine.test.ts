import { describe, expect, it, vi } from "vitest";
import { createSystemTtsEngine } from "./systemTtsEngine";

class FakeUtterance {
  lang = "";
  pitch = 1;
  rate = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(readonly text: string) {}
}

function createVoice(
  overrides: Partial<SpeechSynthesisVoice> = {},
): SpeechSynthesisVoice {
  return {
    default: false,
    lang: "zh-CN",
    localService: true,
    name: "系统女声",
    voiceURI: "voice:system",
    ...overrides,
  };
}

function createSpeechSynthesis(voices: SpeechSynthesisVoice[]) {
  return {
    addEventListener: vi.fn(),
    cancel: vi.fn(),
    dispatchEvent: vi.fn(),
    getVoices: vi.fn(() => voices),
    onvoiceschanged: null,
    pause: vi.fn(),
    paused: false,
    pending: false,
    removeEventListener: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn(),
    speaking: false,
  };
}

describe("createSystemTtsEngine", () => {
  it("lists system voices through the TTS port", async () => {
    const speechSynthesis = createSpeechSynthesis([
      createVoice({ default: true }),
    ]);
    const engine = createSystemTtsEngine({
      speechSynthesis: speechSynthesis as unknown as SpeechSynthesis,
    });

    await expect(engine.listVoices()).resolves.toEqual([
      {
        id: "voice:system",
        name: "系统女声",
        language: "zh-CN",
        isDefault: true,
        isLocal: true,
      },
    ]);
  });

  it("speaks with the selected voice and exposes playback controls", async () => {
    const voice = createVoice({ voiceURI: "voice:selected" });
    const speechSynthesis = createSpeechSynthesis([voice]);
    const onEnd = vi.fn();
    const engine = createSystemTtsEngine({
      createUtterance: (text) =>
        new FakeUtterance(text) as unknown as SpeechSynthesisUtterance,
      speechSynthesis: speechSynthesis as unknown as SpeechSynthesis,
    });

    const handle = await engine.speak({
      text: "你好。",
      voiceId: "voice:selected",
      rate: 1.3,
      onEnd,
    });
    const utterance = speechSynthesis.speak.mock.calls[0]?.[0] as
      | FakeUtterance
      | undefined;

    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(1);
    expect(utterance?.text).toBe("你好。");
    expect(utterance?.voice).toBe(voice);
    expect(utterance?.rate).toBe(1.3);

    utterance?.onend?.({} as SpeechSynthesisEvent);
    expect(onEnd).toHaveBeenCalledTimes(1);

    handle.pause();
    handle.resume();
    handle.cancel();

    expect(speechSynthesis.pause).toHaveBeenCalledTimes(1);
    expect(speechSynthesis.resume).toHaveBeenCalledTimes(1);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
  });

  it("reports unsupported environments", async () => {
    const engine = createSystemTtsEngine({ speechSynthesis: null });

    expect(engine.isSupported()).toBe(false);
    await expect(engine.listVoices()).rejects.toThrow("当前环境不支持系统 TTS");
  });
});
