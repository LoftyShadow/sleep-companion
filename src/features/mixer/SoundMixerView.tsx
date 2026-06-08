import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCustomSoundPresets } from "../customSoundPresets/useCustomSoundPresets";
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
import type {
  SleepSoundConfigItem,
  SleepSoundPlaybackRequest,
} from "../sleepSession/sleepSessionTypes";
import type { FileSystemPort } from "../storage/FileSystemPort";
import { CustomAudioPanel } from "./CustomAudioPanel";
import { CustomPresetPanel } from "./CustomPresetPanel";
import { MixerHeader } from "./MixerHeader";
import { PlayerSummary } from "./PlayerSummary";
import { SoundGrid } from "./SoundGrid";
import { SoundLibrarySidebar } from "./SoundLibrarySidebar";
import { useSoundLibraryState } from "./useSoundLibraryState";
import "./SoundMixerView.css";
import "./SoundMixerView.mobile.css";

const ignoreCategoryChange = () => {};

interface SoundMixerViewProps {
  fileSystem?: FileSystemPort;
  globalStopRequestId: number;
  playbackControlRequestId?: number;
  player: PlayerPort;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
  onSleepConfigSnapshotChange?: (items: SleepSoundConfigItem[]) => void;
  sleepPlaybackRequest?: SleepSoundPlaybackRequest | null;
}

export function SoundMixerView({
  fileSystem,
  globalStopRequestId,
  playbackControlRequestId = 0,
  player,
  onPlaybackControlStateChange,
  onSleepConfigSnapshotChange,
  sleepPlaybackRequest = null,
}: SoundMixerViewProps) {
  const {
    customPresetErrorMessage,
    customPresetMessage,
    customPresets,
    isLoadingCustomPresets,
    removeCustomPreset,
    saveCurrentPreset,
  } = useCustomSoundPresets(fileSystem);
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
    playSoundConfig,
    stopAll,
    toggleUnifiedPlayback,
    toggleSound,
    setSoundVolume,
    resumeSoundIds,
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
  const handledSleepPlaybackRequestIdRef = useRef(0);
  const sleepConfigSnapshot = useMemo(() => {
    const fallbackSoundIds = playingSoundIds.size > 0
      ? [...playingSoundIds]
      : resumeSoundIds;

    return fallbackSoundIds.flatMap((soundId) => {
      const sound = sounds.find((candidate) => candidate.id === soundId);
      if (!sound) {
        return [];
      }

      return [
        {
          name: sound.name,
          soundId,
          volume: volumes[soundId] ?? 0.5,
        },
      ];
    });
  }, [playingSoundIds, resumeSoundIds, sounds, volumes]);
  const currentPresetItems = useMemo(
    () =>
      sleepConfigSnapshot.map((item) => ({
        soundId: item.soundId,
        volume: item.volume,
      })),
    [sleepConfigSnapshot],
  );
  const canSaveCurrentPreset = currentPresetItems.length > 0;

  const handleApplyPreset = useCallback(
    (preset: Parameters<typeof applyPreset>[0]) => {
      void applyPreset(preset);
    },
    [applyPreset],
  );

  const handleApplyCustomPreset = useCallback(
    (preset: Parameters<typeof applyPreset>[0]) => {
      void applyPreset(preset);
    },
    [applyPreset],
  );

  const handleSaveCurrentPreset = useCallback(() => {
    void saveCurrentPreset(currentPresetItems);
  }, [currentPresetItems, saveCurrentPreset]);

  const handleRemoveCustomPreset = useCallback(
    (presetId: Parameters<typeof removeCustomPreset>[0]) => {
      void removeCustomPreset(presetId);
    },
    [removeCustomPreset],
  );

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
    onSleepConfigSnapshotChange?.(sleepConfigSnapshot);
  }, [onSleepConfigSnapshotChange, sleepConfigSnapshot]);

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

  useEffect(() => {
    if (
      !sleepPlaybackRequest ||
      sleepPlaybackRequest.requestId === handledSleepPlaybackRequestIdRef.current
    ) {
      return;
    }

    handledSleepPlaybackRequestIdRef.current = sleepPlaybackRequest.requestId;
    void playSoundConfig(sleepPlaybackRequest.config.items);
  }, [playSoundConfig, sleepPlaybackRequest]);

  const handleRemoveCustomSound = useCallback(
    async (soundId: SoundId) => {
      if (!isCustomSoundId(soundId)) {
        return;
      }

      if (playingSoundIds.has(soundId)) {
        await toggleSound(soundId);
      }

      await removeCustomSound(soundId);
    },
    [playingSoundIds, removeCustomSound, toggleSound],
  );

  const handleRemoveCustomSoundRequest = useCallback(
    (soundId: SoundId) => {
      void handleRemoveCustomSound(soundId);
    },
    [handleRemoveCustomSound],
  );

  const handleSetSoundVolume = useCallback(
    (soundId: SoundId, volume: number) => {
      void setSoundVolume(soundId, volume);
    },
    [setSoundVolume],
  );

  const handleToggleSound = useCallback(
    (soundId: SoundId) => {
      void toggleSound(soundId);
    },
    [toggleSound],
  );

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
          <div className="sound-library-sidebar-stack">
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
                onApplyPreset={handleApplyPreset}
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
                onApplyPreset={handleApplyPreset}
                onCategoryChange={ignoreCategoryChange}
              />
            )}
            <CustomPresetPanel
              canSaveCurrentPreset={canSaveCurrentPreset}
              customPresetErrorMessage={customPresetErrorMessage}
              customPresetMessage={customPresetMessage}
              customPresets={customPresets}
              isLoadingCustomPresets={isLoadingCustomPresets}
              onApplyPreset={handleApplyCustomPreset}
              onRemoveCustomPreset={handleRemoveCustomPreset}
              onSaveCurrentPreset={handleSaveCurrentPreset}
            />
          </div>

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
              onRemoveCustomSound={handleRemoveCustomSoundRequest}
              onSetSoundVolume={handleSetSoundVolume}
              onToggleSound={handleToggleSound}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
