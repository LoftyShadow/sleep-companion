import { describe, expect, it } from "vitest";
import type { TtsVoice } from "./TtsEnginePort";
import {
  detectSpeechLanguage,
  findPreferredVoiceId,
  getLanguageFamily,
} from "./speechLanguage";

const voices: TtsVoice[] = [
  {
    id: "voice:zh",
    isDefault: true,
    isLocal: true,
    language: "zh-CN",
    name: "中文",
  },
  {
    id: "voice:en",
    isDefault: false,
    isLocal: true,
    language: "en-US",
    name: "English",
  },
  {
    id: "voice:ja",
    isDefault: false,
    isLocal: true,
    language: "ja-JP",
    name: "日本語",
  },
];

describe("speechLanguage", () => {
  it("detects the dominant speech language family from text", () => {
    expect(detectSpeechLanguage("雨声落在窗外。")).toBe("zh-CN");
    expect(detectSpeechLanguage("Good night.")).toBe("en-US");
    expect(detectSpeechLanguage("おやすみ。")).toBe("ja-JP");
    expect(detectSpeechLanguage("안녕하세요.")).toBe("ko-KR");
  });

  it("normalizes Chinese voice families across common language tags", () => {
    expect(getLanguageFamily("zh-CN")).toBe("zh");
    expect(getLanguageFamily("cmn-Hans-CN")).toBe("zh");
    expect(getLanguageFamily("yue-HK")).toBe("zh");
    expect(getLanguageFamily("en-US")).toBe("en");
  });

  it("selects the default matching voice before other voices", () => {
    expect(findPreferredVoiceId(voices, "zh-CN")).toBe("voice:zh");
    expect(findPreferredVoiceId(voices, "en-GB")).toBe("voice:en");
    expect(findPreferredVoiceId(voices, "ko-KR")).toBeNull();
  });
});
