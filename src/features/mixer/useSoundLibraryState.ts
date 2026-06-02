import { useMemo, useState } from "react";
import {
  ASMR_SOUNDS,
  BUILT_IN_SOUNDS,
  type SoundDefinition,
  WHITE_NOISE_SOUNDS,
} from "../sounds/soundCatalog";
import {
  ASMR_PRESET_GROUPS,
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
import {
  SOUND_LIBRARY_MODE_CONFIG,
  type SoundLibraryMode,
} from "./soundLibraryModes";

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

export function useSoundLibraryState(customSounds: SoundDefinition[]) {
  const [activeSoundMode, setActiveSoundMode] =
    useState<SoundLibraryMode>("sleep");
  const [activeOtherCategoryId, setActiveOtherCategoryId] = useState("all");
  const sounds = useMemo(
    () => [...BUILT_IN_SOUNDS, ...customSounds],
    [customSounds],
  );
  const soundCountsByCategory = useMemo(
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
  const activeOtherSoundQuickPreset = useMemo(
    () => createOtherSoundQuickPreset(activeOtherCategoryId, categories),
    [activeOtherCategoryId, categories],
  );

  return {
    activeCategoryId: activeOtherCategoryId,
    activeOtherSoundQuickPreset,
    activeSoundMode,
    categories,
    categoryHeadingId: "other-category-heading",
    categoryLabel: "其他声音分类",
    categorySounds: XMSLEEP_OTHER_SOUNDS,
    handleCategoryChange: setActiveOtherCategoryId,
    modeConfig,
    presetCount,
    presetGroups,
    setActiveSoundMode,
    shouldShowSidebar: activeSoundMode === "other",
    soundCountsByCategory,
    sounds,
    visibleSounds,
  };
}

