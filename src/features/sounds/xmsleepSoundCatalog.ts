import xmsleepSoundsManifest from "./xmsleepSoundsManifest.json";
import type { SoundDefinition } from "./soundCatalog";

export type XmsleepSoundId = `xmsleep_${string}`;

export interface XmsleepSoundCategory {
  id: string;
  name: string;
  order: number;
}

export interface XmsleepSoundDefinition extends SoundDefinition {
  id: XmsleepSoundId;
  xmsleepCategoryId: string;
  xmsleepCategoryName: string;
  xmsleepSourceId: string;
}

function toLegalResourceName(value: string): string {
  const normalizedValue = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (normalizedValue.length === 0) {
    throw new Error(`无法为 XMSLEEP 音源生成资源名：${value}`);
  }

  return /^[a-z]/.test(normalizedValue)
    ? normalizedValue
    : `sound_${normalizedValue}`;
}

export function toXmsleepSoundId(sourceId: string): XmsleepSoundId {
  return `xmsleep_${toLegalResourceName(sourceId)}`;
}

export const XMSLEEP_SOUND_CATEGORIES: XmsleepSoundCategory[] =
  xmsleepSoundsManifest.categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      order: category.order,
    }))
    .sort((firstCategory, secondCategory) => {
      return firstCategory.order - secondCategory.order;
    });

const xmsleepCategoryNamesById = new Map(
  XMSLEEP_SOUND_CATEGORIES.map((category) => [category.id, category.name]),
);

export const XMSLEEP_EXISTING_SOUND_SOURCE_IDS = [
  "heavy-rain",
  "campfire",
  "wind",
  "birds",
  "thunderstorm",
  "walk-in-snow",
  "walk-on-leaves",
  "walk-on-gravel",
  "rain-on-car-roof",
  "rain-on-umbrella",
  "office",
  "library",
  "rowing-boat",
  "keyboard",
  "typewriter",
  "paper",
  "clock",
  "boiling-water",
  "bubbles",
  "ear-cleaning-1",
  "ear-cleaning-2",
] as const;

export const XMSLEEP_WHITE_NOISE_SOUND_SOURCE_IDS = ["cafe"] as const;

export const XMSLEEP_OTHER_EXCLUDED_SOUND_SOURCE_IDS = [
  ...XMSLEEP_EXISTING_SOUND_SOURCE_IDS,
  ...XMSLEEP_WHITE_NOISE_SOUND_SOURCE_IDS,
] as const;

const xmsleepWhiteNoiseSoundSourceIdSet = new Set<string>(
  XMSLEEP_WHITE_NOISE_SOUND_SOURCE_IDS,
);

const xmsleepOtherExcludedSoundSourceIdSet = new Set<string>(
  XMSLEEP_OTHER_EXCLUDED_SOUND_SOURCE_IDS,
);

export const XMSLEEP_SOUNDS: XmsleepSoundDefinition[] =
  xmsleepSoundsManifest.sounds.map((sound) => {
    const resourceName = toLegalResourceName(sound.id);
    const soundId = toXmsleepSoundId(sound.id);

    return {
      id: soundId,
      name: sound.name,
      accessibleName: `${sound.name}，${xmsleepCategoryNamesById.get(sound.category) ?? sound.category}，XMSLEEP`,
      sourceKind: "built-in",
      androidResourceName: soundId,
      imageSrc: `/images/sounds/xmsleep/${resourceName}.webp`,
      sources: [
        {
          src: `/audio/xmsleep/${sound.category}/${resourceName}.ogg`,
          type: "audio/ogg",
        },
      ],
      xmsleepCategoryId: sound.category,
      xmsleepCategoryName:
        xmsleepCategoryNamesById.get(sound.category) ?? sound.category,
      xmsleepSourceId: sound.id,
    };
  });

export const XMSLEEP_OTHER_SOUNDS: XmsleepSoundDefinition[] =
  XMSLEEP_SOUNDS.filter(
    (sound) =>
      !xmsleepOtherExcludedSoundSourceIdSet.has(sound.xmsleepSourceId),
  );

export const XMSLEEP_WHITE_NOISE_SOUNDS: XmsleepSoundDefinition[] =
  XMSLEEP_SOUNDS.filter((sound) =>
    xmsleepWhiteNoiseSoundSourceIdSet.has(sound.xmsleepSourceId),
  );

const xmsleepOtherCategoryIdSet = new Set(
  XMSLEEP_OTHER_SOUNDS.map((sound) => sound.xmsleepCategoryId),
);

export const XMSLEEP_OTHER_CATEGORIES: XmsleepSoundCategory[] =
  XMSLEEP_SOUND_CATEGORIES.filter((category) =>
    xmsleepOtherCategoryIdSet.has(category.id),
  );
