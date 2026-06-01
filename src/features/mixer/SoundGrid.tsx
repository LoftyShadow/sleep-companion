import {
  isCustomSoundId,
  type SoundDefinition,
  type SoundId,
} from "../sounds/soundCatalog";
import { getSoundVolume, type VolumeState } from "../player/soundMixerState";
import "./SoundGrid.css";
import "./SoundGrid.mobile.css";

interface SoundGridProps {
  playingSoundIds: Set<SoundId>;
  sounds: SoundDefinition[];
  volumes: VolumeState;
  onRemoveCustomSound: (soundId: SoundId) => void;
  onSetSoundVolume: (soundId: SoundId, volume: number) => void;
  onToggleSound: (soundId: SoundId) => void;
}

export function SoundGrid({
  playingSoundIds,
  sounds,
  volumes,
  onRemoveCustomSound,
  onSetSoundVolume,
  onToggleSound,
}: SoundGridProps) {
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
          <article
            className={`sound-card${isPlaying ? " sound-card-playing" : ""}${
              isAsmrSound ? " sound-card-asmr" : ""
            }`}
            key={sound.id}
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
                  className={`sound-art${
                    isAsmrSound ? " sound-art-waveform" : ""
                  }`}
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

            <label className="volume-control">
              <span>
                音量 <strong>{volumePercent}%</strong>
              </span>
              <input
                aria-label={`${accessibleName}音量`}
                max="100"
                min="0"
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
      })}
    </section>
  );
}
