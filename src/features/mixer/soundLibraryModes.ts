export type BaseSoundLibraryFilterId = "all" | "sleep" | "asmr" | "custom";
export type XmsleepSoundLibraryFilterId = `xmsleep:${string}`;
export type SoundLibraryFilterId =
  | BaseSoundLibraryFilterId
  | XmsleepSoundLibraryFilterId;

export interface BaseSoundLibraryFilterConfig {
  id: BaseSoundLibraryFilterId;
  label: string;
  summary: string;
}

export interface SoundLibraryFilterOption {
  id: SoundLibraryFilterId;
  label: string;
  summary: string;
  count: number;
}

export const BASE_SOUND_LIBRARY_FILTER_CONFIG = {
  all: {
    id: "all",
    label: "全部",
    summary: "所有可加入全局混音的声音",
  },
  sleep: {
    id: "sleep",
    label: "白噪音",
    summary: "稳定底噪和自然环境声",
  },
  asmr: {
    id: "asmr",
    label: "ASMR",
    summary: "近距离触发音和细节声音",
  },
  custom: {
    id: "custom",
    label: "自定义音频",
    summary: "只查看你导入的本地声音",
  },
} satisfies Record<BaseSoundLibraryFilterId, BaseSoundLibraryFilterConfig>;

export function toXmsleepFilterId(
  categoryId: string,
): XmsleepSoundLibraryFilterId {
  return `xmsleep:${categoryId}`;
}

export function isXmsleepFilterId(
  filterId: SoundLibraryFilterId,
): filterId is XmsleepSoundLibraryFilterId {
  return filterId.startsWith("xmsleep:");
}

export function getXmsleepCategoryIdFromFilterId(
  filterId: XmsleepSoundLibraryFilterId,
) {
  return filterId.slice("xmsleep:".length);
}
