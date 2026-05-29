import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  AppModeSwitcher,
  AudiobookView,
} from "./features/audiobook/AudiobookView";
import { createTtsEngine } from "./features/audiobook/createTtsEngine";
import type { TtsEnginePort } from "./features/audiobook/TtsEnginePort";
import { useCustomSounds } from "./features/customSounds/useCustomSounds";
import { createPlayer } from "./features/player/createPlayer";
import type { PlayerPort } from "./features/player/PlayerPort";
import { useSoundMixer } from "./features/player/useSoundMixer";
import {
  ASMR_SOUNDS,
  BUILT_IN_SOUNDS,
  isCustomSoundId,
  type SoundId,
  WHITE_NOISE_SOUNDS,
} from "./features/sounds/soundCatalog";
import {
  ASMR_PRESET_GROUPS,
  DEFAULT_ASMR_PRESET,
  DEFAULT_SOUND_PRESET,
  PRESET_GROUPS,
} from "./features/sounds/soundPresets";

interface AppProps {
  player?: PlayerPort;
  ttsEngine?: TtsEnginePort;
}

type AppMode = "mixer" | "audiobook";
type SoundLibraryMode = "sleep" | "asmr";

interface SoundLibraryModeConfig {
  id: SoundLibraryMode;
  label: string;
  kicker: string;
  title: string;
  emptySummary: string;
  presetKicker: string;
  presetHeading: string;
  soundKicker: string;
  soundHeading: string;
  transportLabel: string;
}

const SOUND_LIBRARY_MODES: SoundLibraryModeConfig[] = [
  {
    id: "sleep",
    label: "白噪音",
    kicker: "XMSLEEP 风格声音调音台",
    title: "白噪音",
    emptySummary: "选择预设或点一个声音开始播放",
    presetKicker: "快捷播放",
    presetHeading: "一键混音",
    soundKicker: "单独控制",
    soundHeading: "声音库",
    transportLabel: "播放预设",
  },
  {
    id: "asmr",
    label: "ASMR",
    kicker: "真实素材触发控制台",
    title: "ASMR 控制台",
    emptySummary: "选择触发组合或点一个近距离声音开始播放",
    presetKicker: "触发组合",
    presetHeading: "ASMR 预设",
    soundKicker: "真实素材",
    soundHeading: "ASMR 声音",
    transportLabel: "播放 ASMR",
  },
];

const SOUND_LIBRARY_MODE_CONFIG = Object.fromEntries(
  SOUND_LIBRARY_MODES.map((mode) => [mode.id, mode]),
) as Record<SoundLibraryMode, SoundLibraryModeConfig>;

function SoundMixerView({
  activeAppMode,
  onModeChange,
  player,
}: {
  activeAppMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  player: PlayerPort;
}) {
  const [activeSoundMode, setActiveSoundMode] =
    useState<SoundLibraryMode>("sleep");
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
  const visibleSounds = useMemo(
    () => [
      ...(activeSoundMode === "asmr" ? ASMR_SOUNDS : WHITE_NOISE_SOUNDS),
      ...customSounds,
    ],
    [activeSoundMode, customSounds],
  );
  const modeConfig = SOUND_LIBRARY_MODE_CONFIG[activeSoundMode];
  const presetGroups =
    activeSoundMode === "asmr" ? ASMR_PRESET_GROUPS : PRESET_GROUPS;
  const presetCount = presetGroups.reduce(
    (count, group) => count + group.presets.length,
    0,
  );
  const {
    playingSoundIds,
    volumes,
    errorMessage,
    activePresetId,
    applyPreset,
    isAnySoundPlaying,
    stopAll,
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
  const transportLabel = isAnySoundPlaying
    ? "停止播放"
    : modeConfig.transportLabel;
  const visibleErrorMessage = errorMessage ?? customSoundErrorMessage;

  async function handleUnifiedPlayback() {
    if (isAnySoundPlaying) {
      await stopAll();
      return;
    }

    if (activeSoundMode === "asmr") {
      await applyPreset(DEFAULT_ASMR_PRESET);
      return;
    }

    await toggleUnifiedPlayback();
  }

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
      <AppModeSwitcher
        activeMode={activeAppMode}
        onModeChange={onModeChange}
      />

      {visibleErrorMessage ? (
        <p className="error-message" role="alert">
          {visibleErrorMessage}
        </p>
      ) : null}

      <div className="app-layout">
        <aside className="left-column">
          <header className="app-header glass-panel" aria-label="播放总览">
            <div className="brand-block">
              <div
                aria-label="声音模式"
                className="mode-switch"
                role="group"
              >
                {SOUND_LIBRARY_MODES.map((mode) => (
                  <button
                    aria-pressed={activeSoundMode === mode.id}
                    className="mode-switch-button"
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setActiveSoundMode(mode.id);
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="app-kicker">{modeConfig.kicker}</p>
              <h1>{modeConfig.title}</h1>
              <p className="mix-summary">
                {isAnySoundPlaying
                  ? activeSummary
                  : modeConfig.emptySummary}
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
                {playingSoundIds.size} / {visibleSounds.length}
              </span>
              <button
                aria-label={transportLabel}
                aria-pressed={isAnySoundPlaying}
                className="transport-button"
                type="button"
                onClick={() => {
                  void handleUnifiedPlayback();
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
                <p className="app-kicker">{modeConfig.presetKicker}</p>
                <h2 id="preset-heading">{modeConfig.presetHeading}</h2>
              </div>
              <span className="section-meta">{presetCount} 个组合</span>
            </div>

            <div className="preset-groups">
              {presetGroups.map((group) => (
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
              <p className="app-kicker">{modeConfig.soundKicker}</p>
              <h2 id="sounds-heading">{modeConfig.soundHeading}</h2>
            </div>
            <span className="section-meta">{visibleSounds.length} 个声音</span>
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
            {visibleSounds.map((sound) => {
              const isPlaying = playingSoundIds.has(sound.id);
              const volume = volumes[sound.id] ?? 0.5;
              const volumePercent = Math.round(volume * 100);
              const isCustomSound = isCustomSoundId(sound.id);
              const isAsmrSound = sound.id.startsWith("asmr_");

              return (
                <article
                  className={`sound-card${
                    isPlaying ? " sound-card-playing" : ""
                  }${isAsmrSound ? " sound-card-asmr" : ""}`}
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

function App({ player, ttsEngine }: AppProps) {
  const [activeAppMode, setActiveAppMode] = useState<AppMode>("mixer");
  const [runtimePlayer, setRuntimePlayer] = useState<PlayerPort | null>(null);
  const audiobookEngine = useMemo(
    () => ttsEngine ?? createTtsEngine(),
    [ttsEngine],
  );
  const handleAppModeChange = useCallback((mode: AppMode) => {
    setActiveAppMode(mode);
  }, []);

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

  useEffect(() => {
    if (activeAppMode === "audiobook") {
      void activePlayer?.stopAll();
    }
  }, [activeAppMode, activePlayer]);

  if (activeAppMode === "audiobook") {
    return (
      <AudiobookView
        activeMode={activeAppMode}
        engine={audiobookEngine}
        onModeChange={handleAppModeChange}
      />
    );
  }

  if (!activePlayer) {
    return (
      <main className="app-shell app-loading">
        <AppModeSwitcher
          activeMode={activeAppMode}
          onModeChange={handleAppModeChange}
        />
        <p className="app-kicker">睡眠声音</p>
        <h1>白噪音</h1>
        <p role="status">正在准备播放器</p>
      </main>
    );
  }

  return (
    <SoundMixerView
      activeAppMode={activeAppMode}
      player={activePlayer}
      onModeChange={handleAppModeChange}
    />
  );
}

export default App;
