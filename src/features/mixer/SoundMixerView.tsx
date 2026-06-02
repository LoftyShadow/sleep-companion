import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCustomSounds } from "../customSounds/useCustomSounds";
import type { PlayerPort } from "../player/PlayerPort";
import { useSoundMixer } from "../player/useSoundMixer";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import {
  isCustomSoundId,
  type SoundId,
} from "../sounds/soundCatalog";
import {
  DEFAULT_ASMR_PRESET,
  DEFAULT_SOUND_PRESET,
} from "../sounds/soundPresets";
import { CustomAudioPanel } from "./CustomAudioPanel";
import { MixerHeader } from "./MixerHeader";
import { PlayerSummary } from "./PlayerSummary";
import { SoundGrid } from "./SoundGrid";
import { SoundLibrarySidebar } from "./SoundLibrarySidebar";
import { useSoundLibraryState } from "./useSoundLibraryState";
import "./SoundMixerView.css";
import "./SoundMixerView.mobile.css";

interface SoundMixerViewProps {
  globalStopRequestId: number;
  playbackControlRequestId?: number;
  player: PlayerPort;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
}

export function SoundMixerView({
  globalStopRequestId,
  playbackControlRequestId = 0,
  player,
  onPlaybackControlStateChange,
}: SoundMixerViewProps) {
  const {
    addCustomSoundFiles,
    customSoundErrorMessage,
    customSoundMessage,
    customSounds,
    isImportingCustomSound,
    removeCustomSound,
  } = useCustomSounds();
  const {
    activeCategoryId,
    activeOtherSoundQuickPreset,
    activeSoundMode,
    categories,
    categoryHeadingId,
    categoryLabel,
    categorySounds,
    handleCategoryChange,
    modeConfig,
    presetCount,
    presetGroups,
    setActiveSoundMode,
    shouldShowSidebar,
    soundCountsByCategory,
    sounds,
    visibleSounds,
  } = useSoundLibraryState(customSounds);
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
  const handledGlobalStopRequestIdRef = useRef(globalStopRequestId);
  const handledPlaybackControlRequestIdRef = useRef(0);

  const handleUnifiedPlayback = useCallback(async () => {
    if (isAnySoundPlaying) {
      await stopAll();
      return;
    }

    if (activeSoundMode === "asmr") {
      await applyPreset(DEFAULT_ASMR_PRESET);
      return;
    }

    if (activeSoundMode === "other") {
      await applyPreset(activeOtherSoundQuickPreset);
      return;
    }

    await toggleUnifiedPlayback();
  }, [
    activeSoundMode,
    activeOtherSoundQuickPreset,
    applyPreset,
    isAnySoundPlaying,
    stopAll,
    toggleUnifiedPlayback,
  ]);

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    void stopAll();
  }, [globalStopRequestId, stopAll]);

  useEffect(() => {
    onPlaybackControlStateChange?.({
      actionLabel: isAnySoundPlaying ? "暂停" : "播放",
      canToggle: true,
      status: isAnySoundPlaying ? "playing" : "idle",
      summary: activeSummary,
    });
  }, [activeSummary, isAnySoundPlaying, onPlaybackControlStateChange]);

  useEffect(() => {
    if (
      playbackControlRequestId === 0 ||
      playbackControlRequestId === handledPlaybackControlRequestIdRef.current
    ) {
      return;
    }

    handledPlaybackControlRequestIdRef.current = playbackControlRequestId;
    void handleUnifiedPlayback();
  }, [handleUnifiedPlayback, playbackControlRequestId]);

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
        <section className="mixer-stage" aria-label="混音总览">
          <MixerHeader
            activeSoundMode={activeSoundMode}
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
        </section>

        <div className="mixer-content">
          {shouldShowSidebar ? (
            <SoundLibrarySidebar
              activeCategoryId={activeCategoryId}
              activePresetId={activePresetId}
              categories={categories}
              categoryHeadingId={categoryHeadingId}
              categoryLabel={categoryLabel}
              modeConfig={modeConfig}
              presetCount={presetCount}
              presetGroups={presetGroups}
              soundCountsByCategory={soundCountsByCategory}
              totalSoundCount={categorySounds.length}
              onApplyPreset={(preset) => {
                void applyPreset(preset);
              }}
              onCategoryChange={handleCategoryChange}
            />
          ) : (
            <SoundLibrarySidebar
              activeCategoryId="all"
              activePresetId={activePresetId}
              categories={[]}
              categoryHeadingId={`${activeSoundMode}-unused-category-heading`}
              categoryLabel={`${modeConfig.label}声音分类`}
              modeConfig={modeConfig}
              presetCount={presetCount}
              presetGroups={presetGroups}
              soundCountsByCategory={new Map()}
              totalSoundCount={0}
              onApplyPreset={(preset) => {
                void applyPreset(preset);
              }}
              onCategoryChange={() => {}}
            />
          )}

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
    </div>
  );
}
