import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { useCustomSounds } from "./features/customSounds/useCustomSounds";
import { createPlayer } from "./features/player/createPlayer";
import type { PlayerPort } from "./features/player/PlayerPort";
import { useSoundMixer } from "./features/player/useSoundMixer";
import {
  BUILT_IN_SOUNDS,
  isCustomSoundId,
  type SoundId,
} from "./features/sounds/soundCatalog";
import {
  DEFAULT_SOUND_PRESET,
  PRESET_GROUPS,
} from "./features/sounds/soundPresets";

interface AppProps {
  player?: PlayerPort;
}

function SoundMixerView({ player }: { player: PlayerPort }) {
  const {
    addCustomSoundFiles,
    customSoundErrorMessage,
    customSoundMessage,
    customSounds,
    isImportingCustomSound,
    removeCustomSound,
  } = useCustomSounds();
  const sounds = useMemo(
    () => [...BUILT_IN_SOUNDS, ...customSounds],
    [customSounds],
  );
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
    sounds,
    player,
    defaultPreset: DEFAULT_SOUND_PRESET,
  });
  const activeSounds = sounds.filter((sound) =>
    playingSoundIds.has(sound.id),
  );
  const activeSoundNames = activeSounds.map((sound) => sound.name);
  const activeSummary =
    activeSoundNames.length > 0 ? activeSoundNames.join(" / ") : "待机";
  const transportLabel = isAnySoundPlaying ? "停止播放" : "播放预设";
  const visibleErrorMessage = errorMessage ?? customSoundErrorMessage;

  async function handleRemoveCustomSound(soundId: SoundId) {
    if (!isCustomSoundId(soundId)) {
      return;
    }

    if (playingSoundIds.has(soundId)) {
      await toggleSound(soundId);
    }

    await removeCustomSound(soundId);
  }

  return (
    <main className="app-shell">
      {visibleErrorMessage ? (
        <p className="error-message" role="alert">
          {visibleErrorMessage}
        </p>
      ) : null}

      <div className="app-layout">
        <aside className="left-column">
          <header className="app-header glass-panel" aria-label="播放总览">
            <div className="brand-block">
              <p className="app-kicker">XMSLEEP 风格声音调音台</p>
              <h1>白噪音</h1>
              <p className="mix-summary">
                {isAnySoundPlaying
                  ? activeSummary
                  : "选择预设或点一个声音开始播放"}
              </p>
            </div>
          </header>

          <aside className="player-card glass-panel" aria-label="播放控制">
            <div>
              <p className="player-label">当前播放</p>
              <p className="player-title">{activeSummary}</p>
            </div>
            <div className="player-actions">
              <span className="transport-status">
                {playingSoundIds.size} / {sounds.length}
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
          </aside>

          <section
            className="preset-section glass-panel"
            aria-labelledby="preset-heading"
          >
            <div className="section-heading">
              <div>
                <p className="app-kicker">快捷播放</p>
                <h2 id="preset-heading">一键混音</h2>
              </div>
              <span className="section-meta">{PRESET_GROUPS.length} 组预设</span>
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
        </aside>

        <section
          className="right-column glass-panel"
          aria-labelledby="sounds-heading"
        >
          <div className="section-heading sound-section-heading">
            <div>
              <p className="app-kicker">单独控制</p>
              <h2 id="sounds-heading">声音库</h2>
            </div>
            <span className="section-meta">{sounds.length} 个声音</span>
          </div>

          <section className="custom-audio-panel" aria-label="添加自定义音频">
            <div className="custom-audio-copy">
              <p className="app-kicker">本地音频</p>
              <h3>添加自定义音频</h3>
              <p>
                支持常见音频文件，导入后会保存在本机，并和内置声音一起播放。
              </p>
              <p className="custom-audio-status" role="status">
                {customSoundMessage ?? `${customSounds.length} 个自定义音频`}
              </p>
            </div>
            <label className="custom-audio-button">
              <span>{isImportingCustomSound ? "添加中" : "添加音频"}</span>
              <input
                accept="audio/*,.aac,.flac,.m4a,.mp3,.ogg,.wav,.webm"
                aria-label="添加自定义音频"
                className="custom-audio-input"
                disabled={isImportingCustomSound}
                multiple
                type="file"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  void addCustomSoundFiles(files);
                }}
              />
            </label>
          </section>

          <section className="sound-grid" aria-label="声音库">
            {sounds.map((sound) => {
              const isPlaying = playingSoundIds.has(sound.id);
              const volume = volumes[sound.id] ?? 0.5;
              const volumePercent = Math.round(volume * 100);
              const isCustomSound = isCustomSoundId(sound.id);

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
                    <span className="sound-art-wrap" aria-hidden="true">
                      <img className="sound-art" src={sound.imageSrc} alt="" />
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

                  {isCustomSound ? (
                    <button
                      aria-label={`删除自定义音频${sound.name}`}
                      className="sound-delete-button"
                      type="button"
                      onClick={() => {
                        void handleRemoveCustomSound(sound.id);
                      }}
                    >
                      移除
                    </button>
                  ) : null}
                </article>
              );
            })}
          </section>
        </section>
      </div>
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
        <h1>白噪音</h1>
        <p role="status">正在准备播放器</p>
      </main>
    );
  }

  return <SoundMixerView player={activePlayer} />;
}

export default App;
