import type {
  TtsEnginePort,
  TtsPlaybackHandle,
  TtsSpeakInput,
  TtsVoice,
} from "./TtsEnginePort";
import { normalizeSpeechRate } from "./TtsEnginePort";

interface CreateSystemTtsEngineOptions {
  speechSynthesis?: SpeechSynthesis | null;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}

function getDefaultSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function getDefaultUtterance(text: string): SpeechSynthesisUtterance {
  return new SpeechSynthesisUtterance(text);
}

function getVoiceId(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || `${voice.name}:${voice.lang}`;
}

function mapVoice(voice: SpeechSynthesisVoice): TtsVoice {
  return {
    id: getVoiceId(voice),
    name: voice.name,
    language: voice.lang,
    isDefault: voice.default,
    isLocal: voice.localService,
  };
}

function waitForVoices(speechSynthesis: SpeechSynthesis): Promise<TtsVoice[]> {
  const currentVoices = speechSynthesis.getVoices();
  if (currentVoices.length > 0) {
    return Promise.resolve(currentVoices.map(mapVoice));
  }

  return new Promise((resolve) => {
    let isSettled = false;

    const settle = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      speechSynthesis.removeEventListener("voiceschanged", settle);
      resolve(speechSynthesis.getVoices().map(mapVoice));
    };

    speechSynthesis.addEventListener("voiceschanged", settle);
    globalThis.setTimeout(settle, 600);
  });
}

export function createSystemTtsEngine(
  options: CreateSystemTtsEngineOptions = {},
): TtsEnginePort {
  const speechSynthesis =
    options.speechSynthesis === undefined
      ? getDefaultSpeechSynthesis()
      : options.speechSynthesis;
  const createUtterance = options.createUtterance ?? getDefaultUtterance;

  function ensureSupported(): SpeechSynthesis {
    if (!speechSynthesis) {
      throw new Error("当前环境不支持系统 TTS");
    }

    return speechSynthesis;
  }

  return {
    engineId: "system-speech-synthesis",
    label: "系统 TTS",
    supportsPause: true,

    isSupported() {
      return Boolean(speechSynthesis);
    },

    listVoices() {
      return Promise.resolve().then(() => waitForVoices(ensureSupported()));
    },

    speak(input: TtsSpeakInput): Promise<TtsPlaybackHandle> {
      return Promise.resolve().then(() => {
        const activeSpeechSynthesis = ensureSupported();
        const voices = activeSpeechSynthesis.getVoices();
        const utterance = createUtterance(input.text);
        const voice =
          voices.find((candidate) => getVoiceId(candidate) === input.voiceId) ??
          null;

        utterance.voice = voice;
        utterance.lang = voice?.lang ?? input.language ?? "zh-CN";
        utterance.rate = normalizeSpeechRate(input.rate);
        utterance.pitch = input.pitch ?? 1;
        utterance.volume = input.volume ?? 1;
        utterance.onend = () => {
          input.onEnd?.();
        };
        utterance.onerror = (event) => {
          input.onError?.(
            event.error
              ? `系统 TTS 朗读失败：${event.error}`
              : "系统 TTS 朗读失败",
          );
        };

        activeSpeechSynthesis.speak(utterance);

        return {
          pause() {
            activeSpeechSynthesis.pause();
          },
          resume() {
            activeSpeechSynthesis.resume();
          },
          cancel() {
            activeSpeechSynthesis.cancel();
          },
        };
      });
    },

    cancel() {
      speechSynthesis?.cancel();
    },

    destroy() {
      speechSynthesis?.cancel();
    },
  };
}
