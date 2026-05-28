import { useEffect, useState } from "react";
import "./App.css";
import { createPlayer } from "./features/player/createPlayer";
import type { PlayerPort } from "./features/player/PlayerPort";
import { useSoundMixer } from "./features/player/useSoundMixer";
import { BUILT_IN_SOUNDS } from "./features/sounds/soundCatalog";
import {
  DEFAULT_SOUND_PRESET,
  PRESET_GROUPS,
} from "./features/sounds/soundPresets";

interface AppProps {
  player?: PlayerPort;
}

function SoundMixerView({ player }: { player: PlayerPort }) {
  const {
    playingSoundIds,
    volumes,
    errorMessage,
    activePresetId,
    applyPreset,
    isAnySoundPlaying,
    toggleUnifiedPlayback,
    toggleSound,
    setSoundVolume,
  } = useSoundMixer({
    sounds: BUILT_IN_SOUNDS,
    player,
    defaultPreset: DEFAULT_SOUND_PRESET,
  });
  const activeSoundNames = BUILT_IN_SOUNDS.filter((sound) =>
    playingSoundIds.has(sound.id),
  ).map((sound) => sound.name);
  const activeSummary =
    activeSoundNames.length > 0 ? activeSoundNames.join(" / ") : "待机";
  const transportLabel = isAnySoundPlaying ? "停止播放" : "播放预设";

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="播放总览">
        <div className="brand-block">
          <p className="app-kicker">睡眠声音调音台</p>
          <h1>Sleep Companion</h1>
          <p className="mix-summary">{activeSummary}</p>
        </div>

        <div className="transport-panel">
          <span className="transport-status">
            {playingSoundIds.size} / {BUILT_IN_SOUNDS.length}
          </span>
          <button
            aria-label={transportLabel}
            aria-pressed={isAnySoundPlaying}
            className="transport-button"
            type="button"
            onClick={() => {
              void toggleUnifiedPlayback();
            }}
          >
            <span className="transport-glyph" aria-hidden="true" />
            <span>{transportLabel}</span>
          </button>
        </div>
      </header>

      {errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="preset-section" aria-labelledby="preset-heading">
        <div className="section-heading">
          <p className="app-kicker">场景预设</p>
          <h2 id="preset-heading">一键混音</h2>
        </div>

        <div className="preset-groups">
          {PRESET_GROUPS.map((group) => (
            <section
              aria-labelledby={`preset-group-${group.id}`}
              className="preset-group"
              key={group.id}
            >
              <h3 id={`preset-group-${group.id}`}>{group.name}</h3>
              <div className="preset-list">
                {group.presets.map((preset) => {
                  const isActive = activePresetId === preset.id;

                  return (
                    <button
                      aria-label={`应用预设${preset.name}`}
                      aria-pressed={isActive}
                      className={`preset-button${
                        isActive ? " preset-button-active" : ""
                      }`}
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        void applyPreset(preset);
                      }}
                    >
                      <span className="preset-topline">
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-count">
                          {preset.items.length} 声音
                        </span>
                      </span>
                      <span className="preset-description">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="section-heading sound-section-heading">
        <p className="app-kicker">单独控制</p>
        <h2>声音</h2>
      </section>

      <section className="sound-grid" aria-label="内置声音">
        {BUILT_IN_SOUNDS.map((sound) => {
          const isPlaying = playingSoundIds.has(sound.id);
          const volume = volumes[sound.id] ?? 0.5;
          const volumePercent = Math.round(volume * 100);

          return (
            <article
              className={`sound-card${isPlaying ? " sound-card-playing" : ""}`}
              key={sound.id}
            >
              <button
                aria-label={sound.name}
                aria-pressed={isPlaying}
                className="sound-toggle"
                type="button"
                onClick={() => {
                  void toggleSound(sound.id);
                }}
              >
                <span className="sound-name">{sound.name}</span>
                <span aria-hidden="true" className="sound-state">
                  {isPlaying ? "播放中" : "已暂停"}
                </span>
              </button>

              <label className="volume-control">
                <span>
                  音量 <strong>{volumePercent}%</strong>
                </span>
                <input
                  aria-label={`${sound.name}音量`}
                  max="100"
                  min="0"
                  type="range"
                  value={volumePercent}
                  onChange={(event) => {
                    void setSoundVolume(
                      sound.id,
                      Number(event.currentTarget.value) / 100,
                    );
                  }}
                />
              </label>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function App({ player }: AppProps) {
  const [runtimePlayer, setRuntimePlayer] = useState<PlayerPort | null>(null);

  useEffect(() => {
    if (player) {
      return undefined;
    }

    let isMounted = true;
    let createdPlayer: PlayerPort | null = null;

    void createPlayer().then((nextPlayer) => {
      if (!isMounted) {
        nextPlayer.destroy();
        return;
      }
      createdPlayer = nextPlayer;
      setRuntimePlayer(nextPlayer);
    });

    return () => {
      isMounted = false;
      createdPlayer?.destroy();
    };
  }, [player]);

  const activePlayer = player ?? runtimePlayer;

  if (!activePlayer) {
    return (
      <main className="app-shell app-loading">
        <p className="app-kicker">睡眠声音</p>
        <h1>Sleep Companion</h1>
        <p role="status">正在准备播放器</p>
      </main>
    );
  }

  return <SoundMixerView player={activePlayer} />;
}

export default App;
