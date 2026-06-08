import { useCallback, useMemo, useState } from "react";
import {
  ASMR_SOUNDS,
  BUILT_IN_SOUNDS,
  type SoundDefinition,
  WHITE_NOISE_SOUNDS,
} from "../sounds/soundCatalog";
import {
  XMSLEEP_OTHER_CATEGORIES,
  XMSLEEP_OTHER_SOUNDS,
  XMSLEEP_WHITE_NOISE_SOUNDS,
  type XmsleepSoundDefinition,
} from "../sounds/xmsleepSoundCatalog";
import {
  BASE_SOUND_LIBRARY_FILTER_CONFIG,
  getXmsleepCategoryIdFromFilterId,
  isXmsleepFilterId,
  toXmsleepFilterId,
  type SoundLibraryFilterId,
  type SoundLibraryFilterOption,
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

export function useSoundLibraryState(customSounds: SoundDefinition[]) {
  const [activeFilterId, setActiveFilterId] =
    useState<SoundLibraryFilterId>("all");
  const sounds = useMemo(
    () => [...BUILT_IN_SOUNDS, ...customSounds],
    [customSounds],
  );
  const whiteNoiseSounds = useMemo(
    () => [...WHITE_NOISE_SOUNDS, ...XMSLEEP_WHITE_NOISE_SOUNDS],
    [],
  );
  const soundCountsByCategory = useMemo(
    () => countSoundsByCategory(XMSLEEP_OTHER_SOUNDS),
    [],
  );
  const allLibrarySounds = useMemo(
    () => [
      ...whiteNoiseSounds,
      ...ASMR_SOUNDS,
      ...XMSLEEP_OTHER_SOUNDS,
      ...customSounds,
    ],
    [customSounds, whiteNoiseSounds],
  );
  const filters: SoundLibraryFilterOption[] = useMemo(
    () => [
      {
        ...BASE_SOUND_LIBRARY_FILTER_CONFIG.all,
        count: allLibrarySounds.length,
      },
      {
        ...BASE_SOUND_LIBRARY_FILTER_CONFIG.sleep,
        count: whiteNoiseSounds.length,
      },
      {
        ...BASE_SOUND_LIBRARY_FILTER_CONFIG.asmr,
        count: ASMR_SOUNDS.length,
      },
      ...XMSLEEP_OTHER_CATEGORIES.map((category) => ({
        id: toXmsleepFilterId(category.id),
        label: category.name,
        summary: `XMSLEEP · ${category.name}`,
        count: soundCountsByCategory.get(category.id) ?? 0,
      })),
      {
        ...BASE_SOUND_LIBRARY_FILTER_CONFIG.custom,
        count: customSounds.length,
      },
    ],
    [
      allLibrarySounds.length,
      customSounds.length,
      soundCountsByCategory,
      whiteNoiseSounds.length,
    ],
  );
  const visibleSounds = useMemo(() => {
    if (activeFilterId === "sleep") {
      return whiteNoiseSounds;
    }

    if (activeFilterId === "asmr") {
      return ASMR_SOUNDS;
    }

    if (isXmsleepFilterId(activeFilterId)) {
      return filterXmsleepSoundsByCategory(
        XMSLEEP_OTHER_SOUNDS,
        getXmsleepCategoryIdFromFilterId(activeFilterId),
      );
    }

    if (activeFilterId === "custom") {
      return customSounds;
    }

    return allLibrarySounds;
  }, [activeFilterId, allLibrarySounds, customSounds, whiteNoiseSounds]);
  const activeFilter = filters.find((filter) => filter.id === activeFilterId) ??
    {
      ...BASE_SOUND_LIBRARY_FILTER_CONFIG.all,
      count: allLibrarySounds.length,
    };
  const handleFilterChange = useCallback((filterId: SoundLibraryFilterId) => {
    setActiveFilterId(filterId);
  }, []);

  return {
    activeFilter,
    activeFilterId,
    filters,
    handleFilterChange,
    sounds,
    visibleSounds,
  };
}
