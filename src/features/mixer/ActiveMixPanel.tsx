import { memo } from "react";
import { getSoundVolume, type VolumeState } from "../player/soundMixerState";
import { PlaybackGlyph } from "../shared/PlaybackGlyph";
import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
import "./ActiveMixPanel.css";
import "./ActiveMixPanel.mobile.css";

interface ActiveMixPanelProps {
  activeSummary: string;
  isAnySoundPlaying: boolean;
  mixSoundIds: SoundId[];
  playingSoundIds: Set<SoundId>;
  sounds: SoundDefinition[];
  transportLabel: string;
  volumes: VolumeState;
  onUnifiedPlayback: () => void;
  onSetSoundVolume: (soundId: SoundId, volume: number) => void;
  onToggleSound: (soundId: SoundId) => void;
}

interface ActiveMixItemProps {
  isPlaying: boolean;
  sound: SoundDefinition;
  volumePercent: number;
  onSetSoundVolume: (soundId: SoundId, volume: number) => void;
  onToggleSound: (soundId: SoundId) => void;
}

const ActiveMixItem = memo(function ActiveMixItem({
  isPlaying,
  sound,
  volumePercent,
  onSetSoundVolume,
  onToggleSound,
}: ActiveMixItemProps) {
  const accessibleName = sound.accessibleName ?? sound.name;

  return (
    <article className="active-mix-item">
      <button
        aria-label={`${isPlaying ? "暂停" : "播放"}当前混音声音${accessibleName}`}
        aria-pressed={isPlaying}
        className="active-mix-toggle"
        type="button"
        onClick={() => {
          onToggleSound(sound.id);
        }}
      >
        <span className="active-mix-thumb" aria-hidden="true">
          <img src={sound.imageSrc} alt="" />
        </span>
        <span className="active-mix-copy">
          <span className="active-mix-name">{sound.name}</span>
          <span className="active-mix-state">
            {isPlaying ? "播放中" : "待恢复"}
          </span>
        </span>
      </button>

      <label className="active-mix-volume">
        <span>
          音量 <strong>{volumePercent}%</strong>
        </span>
        <input
          aria-label={`当前混音${accessibleName}音量`}
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
    </article>
  );
});

export function ActiveMixPanel({
  activeSummary,
  isAnySoundPlaying,
  mixSoundIds,
  playingSoundIds,
  sounds,
  transportLabel,
  volumes,
  onUnifiedPlayback,
  onSetSoundVolume,
  onToggleSound,
}: ActiveMixPanelProps) {
  const soundById = new Map(sounds.map((sound) => [sound.id, sound]));
  const mixSounds = mixSoundIds.flatMap((soundId) => {
    const sound = soundById.get(soundId);

    return sound ? [sound] : [];
  });

  return (
    <section className="active-mix-panel glass-panel" aria-labelledby="active-mix-heading">
      <div className="active-mix-hero">
        <div className="active-mix-hero-copy">
          <p className="app-kicker">全局混音</p>
          <div className="active-mix-title-row">
            <h2 id="active-mix-heading">当前混音</h2>
            <span className="active-mix-playback-state">
              {isAnySoundPlaying ? "播放中" : "待恢复"}
            </span>
          </div>
          <p className="active-mix-summary">{activeSummary}</p>
        </div>

        <div className="active-mix-hero-actions" aria-label="当前混音播放控制">
          <span
            className="transport-status"
            aria-label={`正在播放 ${playingSoundIds.size} 个，当前混音 ${mixSounds.length} 个声音`}
          >
            {playingSoundIds.size} 播放 / {mixSounds.length} 已选
          </span>
          <button
            aria-label={transportLabel}
            aria-pressed={isAnySoundPlaying}
            className="transport-button active-mix-transport-button"
            type="button"
            onClick={onUnifiedPlayback}
          >
            <PlaybackGlyph isPlaying={isAnySoundPlaying} />
            <span>{transportLabel}</span>
          </button>
        </div>
      </div>

      {mixSounds.length > 0 ? (
        <div className="active-mix-list">
          {mixSounds.map((sound) => {
            const isPlaying = playingSoundIds.has(sound.id);
            const volumePercent = Math.round(getSoundVolume(volumes, sound.id) * 100);

            return (
              <ActiveMixItem
                isPlaying={isPlaying}
                key={sound.id}
                sound={sound}
                volumePercent={volumePercent}
                onSetSoundVolume={onSetSoundVolume}
                onToggleSound={onToggleSound}
              />
            );
          })}
        </div>
      ) : (
        <p className="active-mix-empty">
          还没有声音。选择一个混音方案，或从声音库点一个声音加入。
        </p>
      )}

      {!isAnySoundPlaying && mixSounds.length > 0 ? (
        <p className="active-mix-hint">这些声音会在点击播放全局混音时恢复。</p>
      ) : null}
    </section>
  );
}
