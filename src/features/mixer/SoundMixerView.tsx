import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCustomSounds } from "../customSounds/useCustomSounds";
import type { PlayerPort } from "../player/PlayerPort";
import { useSoundMixer } from "../player/useSoundMixer";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import {
  ASMR_SOUNDS,
  BUILT_IN_SOUNDS,
  isCustomSoundId,
  type SoundDefinition,
  type SoundId,
  WHITE_NOISE_SOUNDS,
} from "../sounds/soundCatalog";
import {
  ASMR_PRESET_GROUPS,
  DEFAULT_ASMR_PRESET,
  DEFAULT_SOUND_PRESET,
  PRESET_GROUPS,
  type SoundPreset,
} from "../sounds/soundPresets";
import {
  XMSLEEP_OTHER_CATEGORIES,
  XMSLEEP_OTHER_SOUNDS,
  XMSLEEP_WHITE_NOISE_SOUNDS,
  type XmsleepSoundCategory,
  type XmsleepSoundDefinition,
} from "../sounds/xmsleepSoundCatalog";
import { CustomAudioPanel } from "./CustomAudioPanel";
import { MixerHeader } from "./MixerHeader";
import { PlayerSummary } from "./PlayerSummary";
import { SoundGrid } from "./SoundGrid";
import { SoundLibrarySidebar } from "./SoundLibrarySidebar";
import {
  SOUND_LIBRARY_MODE_CONFIG,
  type SoundLibraryMode,
} from "./soundLibraryModes";
import "./SoundMixerView.css";

interface SoundMixerViewProps {
  globalStopRequestId: number;
  playbackControlRequestId?: number;
  player: PlayerPort;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
}

function countSoundsByCategory(sounds: XmsleepSoundDefinition[]) {
  const counts = new Map<string, number>();

  for (const sound of sounds) {
    counts.set(
      sound.xmsleepCategoryId,
      (counts.get(sound.xmsleepCategoryId) ?? 0) + 1,
    );
  }

  return counts;
}

function filterXmsleepSoundsByCategory(
  sounds: XmsleepSoundDefinition[],
  categoryId: string,
) {
  if (categoryId === "all") {
    return sounds;
  }

  return sounds.filter((sound) => sound.xmsleepCategoryId === categoryId);
}

function createOtherSoundQuickPreset(
  categoryId: string,
  categories: XmsleepSoundCategory[],
): SoundPreset {
  const selectedSounds = filterXmsleepSoundsByCategory(
    XMSLEEP_OTHER_SOUNDS,
    categoryId,
  );
  const categoryName =
    categoryId === "all"
      ? "全部"
      : (categories.find((category) => category.id === categoryId)?.name ??
        "当前分类");

  return {
    id: `other_sound_quick_mix_${categoryId}`,
    name: `${categoryName}快混`,
    description: "从其他声音当前分类中取前 3 个声音快速混音。",
    items: selectedSounds.slice(0, 3).map((sound, index) => ({
      soundId: sound.id,
      volume: [0.56, 0.38, 0.28][index] ?? 0.24,
    })),
  };
}

export function SoundMixerView({
  globalStopRequestId,
  playbackControlRequestId = 0,
  player,
  onPlaybackControlStateChange,
}: SoundMixerViewProps) {
  const [activeSoundMode, setActiveSoundMode] =
    useState<SoundLibraryMode>("sleep");
  const [activeOtherCategoryId, setActiveOtherCategoryId] = useState("all");
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
  const otherSoundCountsByCategory = useMemo(
    () => countSoundsByCategory(XMSLEEP_OTHER_SOUNDS),
    [],
  );
  const visibleSounds = useMemo(() => {
    const builtInSounds: SoundDefinition[] =
      activeSoundMode === "asmr"
        ? ASMR_SOUNDS
        : activeSoundMode === "other"
          ? filterXmsleepSoundsByCategory(
              XMSLEEP_OTHER_SOUNDS,
              activeOtherCategoryId,
            )
          : [...WHITE_NOISE_SOUNDS, ...XMSLEEP_WHITE_NOISE_SOUNDS];

    return [...builtInSounds, ...customSounds];
  }, [activeOtherCategoryId, activeSoundMode, customSounds]);
  const modeConfig = SOUND_LIBRARY_MODE_CONFIG[activeSoundMode];
  const presetGroups =
    activeSoundMode === "asmr"
      ? ASMR_PRESET_GROUPS
      : activeSoundMode === "other"
        ? []
        : PRESET_GROUPS;
  const presetCount = presetGroups.reduce(
    (count, group) => count + group.presets.length,
    0,
  );
  const categories: XmsleepSoundCategory[] = XMSLEEP_OTHER_CATEGORIES;
  const shouldShowSidebar = activeSoundMode === "other";
  const activeCategoryId = activeOtherCategoryId;
  const categoryHeadingId = "other-category-heading";
  const categoryLabel = "其他声音分类";
  const soundCountsByCategory = otherSoundCountsByCategory;
  const categorySounds = XMSLEEP_OTHER_SOUNDS;
  const handleCategoryChange = setActiveOtherCategoryId;
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
      await applyPreset(
        createOtherSoundQuickPreset(activeOtherCategoryId, categories),
      );
      return;
    }

    await toggleUnifiedPlayback();
  }, [
    activeSoundMode,
    activeOtherCategoryId,
    applyPreset,
    categories,
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
