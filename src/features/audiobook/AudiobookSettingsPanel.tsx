import { useId } from "react";
import type { TtsVoice } from "./TtsEnginePort";

interface AudiobookSettingsPanelProps {
  isEngineSupported: boolean;
  isLoadingVoices: boolean;
  rate: number;
  selectedVoiceId: string | null;
  voices: TtsVoice[];
  onRateChange: (rate: number) => void;
  onVoiceChange: (voiceId: string | null) => void;
}

export function AudiobookSettingsPanel({
  isEngineSupported,
  isLoadingVoices,
  rate,
  selectedVoiceId,
  voices,
  onRateChange,
  onVoiceChange,
}: AudiobookSettingsPanelProps) {
  const voiceSelectId = useId();
  const rateInputId = useId();

  return (
    <section className="audiobook-settings-panel" aria-label="朗读设置">
      <label className="field-label" htmlFor={voiceSelectId}>
        音色
      </label>
      <select
        className="audiobook-select"
        disabled={!isEngineSupported || isLoadingVoices}
        id={voiceSelectId}
        value={selectedVoiceId ?? ""}
        onChange={(event) => {
          onVoiceChange(event.currentTarget.value || null);
        }}
      >
        <option value="">
          {isLoadingVoices ? "正在读取音色" : "系统默认音色"}
        </option>
        {voices.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name} · {voice.language}
          </option>
        ))}
      </select>

      <label className="field-label rate-label" htmlFor={rateInputId}>
        <span>语速</span>
        <strong>{rate.toFixed(1)}x</strong>
      </label>
      <input
        className="audiobook-range"
        id={rateInputId}
        max="1.8"
        min="0.6"
        step="0.1"
        type="range"
        value={rate}
        onChange={(event) => {
          onRateChange(Number(event.currentTarget.value));
        }}
      />
    </section>
  );
}

