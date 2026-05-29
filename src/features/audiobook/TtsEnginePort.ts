export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  isDefault: boolean;
  isLocal: boolean;
}

export interface TtsSpeakInput {
  text: string;
  voiceId: string | null;
  language?: string;
  rate: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export interface TtsPlaybackHandle {
  pause(): void;
  resume(): void;
  cancel(): void;
}

export interface TtsEnginePort {
  readonly engineId: string;
  readonly label: string;
  readonly supportsPause: boolean;
  isSupported(): boolean;
  listVoices(): Promise<TtsVoice[]>;
  speak(input: TtsSpeakInput): Promise<TtsPlaybackHandle>;
  cancel(): void;
  destroy(): void;
}

export function normalizeSpeechRate(rate: number): number {
  return Math.min(1.8, Math.max(0.6, rate));
}
