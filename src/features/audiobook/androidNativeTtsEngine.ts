import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type {
  TtsEnginePort,
  TtsPlaybackHandle,
  TtsSpeakInput,
  TtsVoice,
} from "./TtsEnginePort";
import { normalizeSpeechRate } from "./TtsEnginePort";

type InvokeFn = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface NativeTtsVoice {
  id: string;
  name: string;
  language: string;
  isDefault: boolean;
  isLocal: boolean;
}

function formatAndroidTtsError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Android 系统 TTS 朗读失败";
}

export function createAndroidNativeTtsEngine(
  invoke: InvokeFn = tauriInvoke,
): TtsEnginePort {
  let activeRequestId = 0;
  let isSpeaking = false;

  function cancelActiveSpeech() {
    activeRequestId += 1;
    if (!isSpeaking) {
      return;
    }

    isSpeaking = false;
    void invoke("plugin:native-tts|cancel").catch(() => undefined);
  }

  return {
    engineId: "android-native-tts",
    label: "Android 系统 TTS",
    supportsPause: false,

    isSupported() {
      return true;
    },

    async listVoices() {
      const voices = (await invoke(
        "plugin:native-tts|listVoices",
      )) as NativeTtsVoice[];

      return voices.map<TtsVoice>((voice) => ({
        id: voice.id,
        name: voice.name,
        language: voice.language,
        isDefault: voice.isDefault,
        isLocal: voice.isLocal,
      }));
    },

    speak(input: TtsSpeakInput): Promise<TtsPlaybackHandle> {
      const requestId = activeRequestId + 1;
      activeRequestId = requestId;
      isSpeaking = true;

      void invoke("plugin:native-tts|speak", {
        input: {
          text: input.text,
          voiceId: input.voiceId,
          language: input.language,
          rate: normalizeSpeechRate(input.rate),
          pitch: input.pitch,
          volume: input.volume,
        },
      })
        .then(() => {
          if (activeRequestId === requestId) {
            isSpeaking = false;
            input.onEnd?.();
          }
        })
        .catch((error: unknown) => {
          if (activeRequestId === requestId) {
            isSpeaking = false;
            input.onError?.(formatAndroidTtsError(error));
          }
        });

      return Promise.resolve({
        pause() {
          cancelActiveSpeech();
        },
        resume() {
          return;
        },
        cancel() {
          cancelActiveSpeech();
        },
      });
    },

    cancel() {
      cancelActiveSpeech();
    },

    destroy() {
      cancelActiveSpeech();
    },
  };
}
