import { useMemo, useState } from "react";
import { useCustomSounds } from "../customSounds/useCustomSounds";
import type { PlayerPort } from "../player/PlayerPort";
import { useSoundMixer } from "../player/useSoundMixer";
import {
  ASMR_SOUNDS,
  BUILT_IN_SOUNDS,
  isCustomSoundId,
  type SoundId,
  WHITE_NOISE_SOUNDS,
} from "../sounds/soundCatalog";
import {
  ASMR_PRESET_GROUPS,
  DEFAULT_ASMR_PRESET,
  DEFAULT_SOUND_PRESET,
  PRESET_GROUPS,
} from "../sounds/soundPresets";
import { CustomAudioPanel } from "./CustomAudioPanel";
import { MixerHeader } from "./MixerHeader";
import { PlayerSummary } from "./PlayerSummary";
import { PresetGroups } from "./PresetGroups";
import { SoundGrid } from "./SoundGrid";
import {
  SOUND_LIBRARY_MODE_CONFIG,
  type SoundLibraryMode,
} from "./soundLibraryModes";
import "./SoundMixerView.css";

interface SoundMixerViewProps {
  player: PlayerPort;
}

export function SoundMixerView({ player }: SoundMixerViewProps) {
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
  const activeSummary = useMemo(() => {
    const activeSoundNames = sounds.reduce<string[]>((names, sound) => {
      if (playingSoundIds.has(sound.id)) {
        names.push(sound.name);
      }

      return names;
    }, []);

    return activeSoundNames.length > 0 ? activeSoundNames.join(" / ") : "待机";
  }, [playingSoundIds, sounds]);
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
    <div className="sound-mixer-view">
      {visibleErrorMessage ? (
        <p className="error-message" role="alert">
          {visibleErrorMessage}
        </p>
      ) : null}

      <div className="app-layout">
        <aside className="left-column">
          <MixerHeader
            activeSoundMode={activeSoundMode}
            activeSummary={activeSummary}
            isAnySoundPlaying={isAnySoundPlaying}
            modeConfig={modeConfig}
            onSoundModeChange={setActiveSoundMode}
          />

          <PlayerSummary
            activeSummary={activeSummary}
            isAnySoundPlaying={isAnySoundPlaying}
            playingSoundCount={playingSoundIds.size}
            transportLabel={transportLabel}
            visibleSoundCount={visibleSounds.length}
            onUnifiedPlayback={() => {
              void handleUnifiedPlayback();
            }}
          />

          <PresetGroups
            activePresetId={activePresetId}
            modeConfig={modeConfig}
            presetCount={presetCount}
            presetGroups={presetGroups}
            onApplyPreset={(preset) => {
              void applyPreset(preset);
            }}
          />
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

          <CustomAudioPanel
            customSoundCount={customSounds.length}
            customSoundMessage={customSoundMessage}
            isImportingCustomSound={isImportingCustomSound}
            onAddCustomSoundFiles={(files) => {
              void addCustomSoundFiles(files);
            }}
          />

          <SoundGrid
            playingSoundIds={playingSoundIds}
            sounds={visibleSounds}
            volumes={volumes}
            onRemoveCustomSound={(soundId) => {
              void handleRemoveCustomSound(soundId);
            }}
            onSetSoundVolume={(soundId, volume) => {
              void setSoundVolume(soundId, volume);
            }}
            onToggleSound={(soundId) => {
              void toggleSound(soundId);
            }}
          />
        </section>
      </div>
    </div>
  );
}
