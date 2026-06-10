import { memo } from "react";
import {
  isCustomSoundId,
  type SoundDefinition,
  type SoundId,
} from "../sounds/soundCatalog";
import { getSoundVolume, type VolumeState } from "../player/soundMixerState";
import "./SoundGrid.css";
import "./SoundGrid.mobile.css";

function getSoundControlId(prefix: string, soundId: SoundId) {
  return `${prefix}-${soundId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

interface SoundGridProps {
  emptyMessage?: string;
  playingSoundIds: Set<SoundId>;
  sounds: SoundDefinition[];
  volumes: VolumeState;
  onRemoveCustomSound: (soundId: SoundId) => void;
  onSetSoundVolume: (soundId: SoundId, volume: number) => void;
  onToggleSound: (soundId: SoundId) => void;
}

interface SoundCardProps {
  accessibleName: string;
  isAsmrSound: boolean;
  isCustomSound: boolean;
  isPlaying: boolean;
  sound: SoundDefinition;
  volumePercent: number;
  onRemoveCustomSound: (soundId: SoundId) => void;
  onSetSoundVolume: (soundId: SoundId, volume: number) => void;
  onToggleSound: (soundId: SoundId) => void;
}

const SoundCard = memo(function SoundCard({
  accessibleName,
  isAsmrSound,
  isCustomSound,
  isPlaying,
  sound,
  volumePercent,
  onRemoveCustomSound,
  onSetSoundVolume,
  onToggleSound,
}: SoundCardProps) {
  const volumeInputId = getSoundControlId("sound-volume", sound.id);

  return (
    <article
      className={`sound-card${isPlaying ? " sound-card-playing" : ""}${
        isAsmrSound ? " sound-card-asmr" : ""
      }`}
    >
      <button
        aria-label={accessibleName}
        aria-pressed={isPlaying}
        className="sound-toggle"
        type="button"
        onClick={() => {
          onToggleSound(sound.id);
        }}
      >
        <span className="sound-art-wrap" aria-hidden="true">
          <img
            className={`sound-art${isAsmrSound ? " sound-art-waveform" : ""}`}
            src={sound.imageSrc}
            alt=""
          />
          <span className="sound-visualizer">
            <span />
            <span />
            <span />
          </span>
        </span>
        <span className="sound-copy">
          <span className="sound-name">{sound.name}</span>
          <span aria-hidden="true" className="sound-state">
            {isPlaying ? "播放中" : "已暂停"}
          </span>
        </span>
      </button>

      <label className="volume-control" htmlFor={volumeInputId}>
        <span>
          音量 <strong>{volumePercent}%</strong>
        </span>
        <input
          aria-label={`${accessibleName}音量`}
          id={volumeInputId}
          max="100"
          min="0"
          name={`soundVolume:${sound.id}`}
          type="range"
          value={volumePercent}
          onChange={(event) => {
            onSetSoundVolume(
              sound.id,
              Number(event.currentTarget.value) / 100,
            );
          }}
        />
      </label>

      {isCustomSound ? (
        <button
          aria-label={`删除自定义音频${sound.name}`}
          className="sound-delete-button"
          type="button"
          onClick={() => {
            onRemoveCustomSound(sound.id);
          }}
        >
          移除
        </button>
      ) : null}
    </article>
  );
});

export function SoundGrid({
  emptyMessage = "没有可显示的声音",
  playingSoundIds,
  sounds,
  volumes,
  onRemoveCustomSound,
  onSetSoundVolume,
  onToggleSound,
}: SoundGridProps) {
  if (sounds.length === 0) {
    return (
      <section className="sound-grid" aria-label="声音库">
        <p className="sound-grid-empty">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="sound-grid" aria-label="声音库">
      {sounds.map((sound) => {
        const isPlaying = playingSoundIds.has(sound.id);
        const volume = getSoundVolume(volumes, sound.id);
        const volumePercent = Math.round(volume * 100);
        const isCustomSound = isCustomSoundId(sound.id);
        const isAsmrSound = sound.id.startsWith("asmr_");
        const accessibleName = sound.accessibleName ?? sound.name;

        return (
          <SoundCard
            accessibleName={accessibleName}
            isAsmrSound={isAsmrSound}
            isCustomSound={isCustomSound}
            isPlaying={isPlaying}
            key={sound.id}
            sound={sound}
            volumePercent={volumePercent}
            onRemoveCustomSound={onRemoveCustomSound}
            onSetSoundVolume={onSetSoundVolume}
            onToggleSound={onToggleSound}
          />
        );
      })}
    </section>
  );
}
