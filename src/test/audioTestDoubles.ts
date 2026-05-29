import { vi } from "vitest";
import type {
  TtsEnginePort,
  TtsPlaybackHandle,
  TtsSpeakInput,
  TtsVoice,
} from "../features/audiobook/TtsEnginePort";
import type { PlayerPort } from "../features/player/PlayerPort";

const DEFAULT_TTS_VOICES: TtsVoice[] = [
  {
    id: "voice:default",
    name: "系统女声",
    language: "zh-CN",
    isDefault: true,
    isLocal: true,
  },
];

interface TtsEngineTestDoubleOptions {
  supportsPause?: boolean;
  voices?: TtsVoice[];
}

export function createPlayerPortTestDouble() {
  const play = vi.fn<PlayerPort["play"]>(() => Promise.resolve());
  const pause = vi.fn<PlayerPort["pause"]>(() => Promise.resolve());
  const setVolume = vi.fn<PlayerPort["setVolume"]>(() => Promise.resolve());
  const stopAll = vi.fn<PlayerPort["stopAll"]>(() => Promise.resolve());
  const getState = vi.fn<PlayerPort["getState"]>(() =>
    Promise.resolve({ sounds: [] }),
  );
  const destroy = vi.fn<PlayerPort["destroy"]>();
  const player: PlayerPort = {
    play,
    pause,
    setVolume,
    stopAll,
    getState,
    destroy,
  };

  return { destroy, getState, pause, play, player, setVolume, stopAll };
}

export function createTtsEngineTestDouble({
  supportsPause = true,
  voices = DEFAULT_TTS_VOICES,
}: TtsEngineTestDoubleOptions = {}) {
  const handleCancel = vi.fn();
  const handlePause = vi.fn();
  const handleResume = vi.fn();
  const handle: TtsPlaybackHandle = {
    cancel: handleCancel,
    pause: handlePause,
    resume: handleResume,
  };
  const cancel = vi.fn<TtsEnginePort["cancel"]>();
  const destroy = vi.fn<TtsEnginePort["destroy"]>();
  const isSupported = vi.fn<TtsEnginePort["isSupported"]>(() => true);
  const listVoices = vi.fn<TtsEnginePort["listVoices"]>(() =>
    Promise.resolve(voices),
  );
  let activeInput: TtsSpeakInput | null = null;
  const speak = vi.fn<TtsEnginePort["speak"]>((input) => {
    activeInput = input;
    return Promise.resolve(handle);
  });
  const engine: TtsEnginePort = {
    engineId: "test-system",
    label: "测试系统 TTS",
    supportsPause,
    isSupported,
    listVoices,
    speak,
    cancel,
    destroy,
  };

  return {
    activeInput: () => activeInput,
    cancel,
    complete() {
      activeInput?.onEnd?.();
    },
    engine,
    handleCancel,
    handlePause,
    handleResume,
    isSupported,
    listVoices,
    speak,
  };
}
