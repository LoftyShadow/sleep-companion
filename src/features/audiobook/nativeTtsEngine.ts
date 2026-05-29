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

function formatNativeTtsError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Linux 系统 TTS 朗读失败";
}

export function createLinuxNativeTtsEngine(
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
    void invoke("native_tts_cancel").catch(() => undefined);
  }

  return {
    engineId: "linux-native-tts",
    label: "Linux 系统 TTS",
    supportsPause: false,

    isSupported() {
      return true;
    },

    async listVoices() {
      const voices = (await invoke(
        "native_tts_list_voices",
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

      void invoke("native_tts_speak", {
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
            input.onError?.(formatNativeTtsError(error));
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
