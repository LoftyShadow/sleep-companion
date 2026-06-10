import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useCustomSoundPresets } from "../customSoundPresets/useCustomSoundPresets";
import { useCustomSounds } from "../customSounds/useCustomSounds";
import type { PlayerPort } from "../player/PlayerPort";
import { useSoundMixer } from "../player/useSoundMixer";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import {
  isCustomSoundId,
  type SoundDefinition,
  type SoundId,
} from "../sounds/soundCatalog";
import {
  ALL_PRESET_GROUPS,
  DEFAULT_SOUND_PRESET,
} from "../sounds/soundPresets";
import type {
  SleepSoundConfigItem,
  SleepSoundPlaybackRequest,
} from "../sleepSession/sleepSessionTypes";
import type { FileSystemPort } from "../storage/FileSystemPort";
import { ActiveMixPanel } from "./ActiveMixPanel";
import { CustomAudioPanel } from "./CustomAudioPanel";
import { MixPlanPanel } from "./MixPlanPanel";
import { MixerHeader } from "./MixerHeader";
import { SoundGrid } from "./SoundGrid";
import { useSoundLibraryState } from "./useSoundLibraryState";
import "./SoundMixerView.css";
import "./SoundMixerView.mobile.css";

const DEFAULT_SOUND_LIBRARY_PREVIEW_LIMIT = 24;

interface SoundLibraryStatusTextOptions {
  isSearchActive: boolean;
  matchedCount: number;
  shownCount: number;
  totalCount: number;
}

function normalizeSoundSearchText(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function getSoundLibraryStatusText({
  isSearchActive,
  matchedCount,
  shownCount,
  totalCount,
}: SoundLibraryStatusTextOptions) {
  if (isSearchActive) {
    return `搜索到 ${matchedCount} / ${totalCount} 个声音`;
  }

  if (shownCount < matchedCount) {
    return `优先展示 ${shownCount} / ${matchedCount} 个声音`;
  }

  return `显示 ${shownCount} 个声音`;
}

function getSoundSearchText(sound: SoundDefinition) {
  return [
    sound.name,
    sound.accessibleName,
    sound.id,
    sound.sourceKind,
    sound.xmsleepCategoryId,
    sound.xmsleepSourceId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

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
  const soundSearchId = useId();
  const soundSearchHintId = useId();
  const [isFullSoundLibraryVisible, setIsFullSoundLibraryVisible] =
    useState(false);
  const [soundSearchInput, setSoundSearchInput] = useState("");
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
    activeFilter,
    activeFilterId,
    filters,
    handleFilterChange,
    sounds,
    visibleSounds,
  } = useSoundLibraryState(customSounds);
  const soundSearchQuery = useMemo(
    () => normalizeSoundSearchText(soundSearchInput),
    [soundSearchInput],
  );
  const isSoundSearchActive = soundSearchQuery.length > 0;
  const matchingVisibleSounds = useMemo(() => {
    if (!isSoundSearchActive) {
      return visibleSounds;
    }

    return visibleSounds.filter((sound) =>
      getSoundSearchText(sound).includes(soundSearchQuery),
    );
  }, [isSoundSearchActive, soundSearchQuery, visibleSounds]);
  const shouldLimitSoundLibrary =
    !isSoundSearchActive &&
    !isFullSoundLibraryVisible &&
    matchingVisibleSounds.length > DEFAULT_SOUND_LIBRARY_PREVIEW_LIMIT;
  const librarySounds = shouldLimitSoundLibrary
    ? matchingVisibleSounds.slice(0, DEFAULT_SOUND_LIBRARY_PREVIEW_LIMIT)
    : matchingVisibleSounds;
  const soundLibraryStatusText = getSoundLibraryStatusText({
    isSearchActive: isSoundSearchActive,
    matchedCount: matchingVisibleSounds.length,
    shownCount: librarySounds.length,
    totalCount: visibleSounds.length,
  });
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
  const transportLabel = isAnySoundPlaying ? "停止播放" : "播放全局混音";
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
  const currentMixSoundIds = useMemo(
    () => (playingSoundIds.size > 0 ? [...playingSoundIds] : resumeSoundIds),
    [playingSoundIds, resumeSoundIds],
  );
  const activeSummary = useMemo(() => {
    const soundById = new Map(sounds.map((sound) => [sound.id, sound]));
    const activeSoundNames = currentMixSoundIds.flatMap((soundId) => {
      const sound = soundById.get(soundId);

      return sound ? [sound.name] : [];
    });

    return activeSoundNames.length > 0
      ? activeSoundNames.join(" / ")
      : "还没有选择声音";
  }, [currentMixSoundIds, sounds]);

  const handleApplyPreset = useCallback(
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

    await toggleUnifiedPlayback();
  }, [isAnySoundPlaying, stopAll, toggleUnifiedPlayback]);

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
          <ActiveMixPanel
            activeSummary={activeSummary}
            isAnySoundPlaying={isAnySoundPlaying}
            mixSoundIds={currentMixSoundIds}
            playingSoundIds={playingSoundIds}
            sounds={sounds}
            transportLabel={transportLabel}
            volumes={volumes}
            onUnifiedPlayback={() => {
              void handleUnifiedPlayback();
            }}
            onSetSoundVolume={handleSetSoundVolume}
            onToggleSound={handleToggleSound}
          />
        </section>

        <div className="mixer-content">
          <MixPlanPanel
            activePresetId={activePresetId}
            canSaveCurrentPreset={canSaveCurrentPreset}
            customPresetErrorMessage={customPresetErrorMessage}
            customPresetMessage={customPresetMessage}
            customPresets={customPresets}
            isLoadingCustomPresets={isLoadingCustomPresets}
            presetGroups={ALL_PRESET_GROUPS}
            onApplyPreset={handleApplyPreset}
            onRemoveCustomPreset={handleRemoveCustomPreset}
            onSaveCurrentPreset={handleSaveCurrentPreset}
          />

          <section
            className="right-column glass-panel"
            aria-labelledby="sounds-heading"
          >
            <div className="section-heading sound-section-heading">
              <div>
                <p className="app-kicker">全局声音库</p>
                <h2 id="sounds-heading">声音库</h2>
                <p className="sound-section-summary">{activeFilter.summary}</p>
              </div>
              <span className="section-meta">{soundLibraryStatusText}</span>
            </div>

            <MixerHeader
              activeFilterId={activeFilterId}
              filters={filters}
              onFilterChange={handleFilterChange}
            />

            <div className="sound-library-controls" role="search">
              <label className="field-label" htmlFor={soundSearchId}>
                查找声音
              </label>
              <div className="sound-library-search-row">
                <input
                  aria-describedby={soundSearchHintId}
                  className="sound-library-search-input"
                  id={soundSearchId}
                  name="soundLibrarySearch"
                  placeholder="搜索雨声、图书馆、ASMR"
                  type="search"
                  value={soundSearchInput}
                  onChange={(event) => {
                    setSoundSearchInput(event.currentTarget.value);
                  }}
                />
                {soundSearchInput ? (
                  <button
                    className="secondary-control-button sound-library-search-clear"
                    type="button"
                    onClick={() => {
                      setSoundSearchInput("");
                    }}
                  >
                    清空
                  </button>
                ) : null}
              </div>
              <div className="sound-library-result-bar" id={soundSearchHintId}>
                <span>{soundLibraryStatusText}</span>
                {!isSoundSearchActive &&
                matchingVisibleSounds.length > DEFAULT_SOUND_LIBRARY_PREVIEW_LIMIT ? (
                  <button
                    className="secondary-control-button sound-library-expand-button"
                    type="button"
                    onClick={() => {
                      setIsFullSoundLibraryVisible((isVisible) => !isVisible);
                    }}
                  >
                    {isFullSoundLibraryVisible
                      ? "收起完整库"
                      : `显示全部 ${matchingVisibleSounds.length} 个声音`}
                  </button>
                ) : null}
              </div>
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
              emptyMessage={
                isSoundSearchActive
                  ? "没有找到匹配的声音"
                  : "当前分类没有声音"
              }
              playingSoundIds={playingSoundIds}
              sounds={librarySounds}
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
