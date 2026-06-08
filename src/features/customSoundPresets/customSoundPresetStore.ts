import type { FileSystemPort } from "../storage/FileSystemPort";
import { indexedDbFileSystem } from "../storage/indexedDbFileSystem";
import type {
  SoundPreset,
  SoundPresetItem,
} from "../sounds/soundPresets";
import type { SoundId } from "../sounds/soundCatalog";

const CUSTOM_SOUND_PRESETS_PATH = "sound-presets/custom-presets.json";
export const MAX_CUSTOM_SOUND_PRESETS = 12;

export interface CustomSoundPreset extends SoundPreset {
  createdAt: number;
  id: `custom_preset:${string}`;
  updatedAt: number;
}

export interface CustomSoundPresetInput {
  items: SoundPresetItem[];
  name?: string;
}

function normalizeVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, volume));
}

function normalizePresetItems(items: readonly SoundPresetItem[]): SoundPresetItem[] {
  const seenSoundIds = new Set<SoundId>();
  const nextItems: SoundPresetItem[] = [];

  for (const item of items) {
    if (!item.soundId || seenSoundIds.has(item.soundId)) {
      continue;
    }

    seenSoundIds.add(item.soundId);
    nextItems.push({
      soundId: item.soundId,
      volume: normalizeVolume(item.volume),
    });
  }

  return nextItems;
}

function createCustomPresetId(now: number): CustomSoundPreset["id"] {
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2)}`;

  return `custom_preset:${token}`;
}

function createPresetName(
  name: string | undefined,
  index: number,
): string {
  const normalizedName = name?.trim();
  if (normalizedName) {
    return normalizedName.slice(0, 32);
  }

  return `我的混音 ${index}`;
}

function createPresetDescription(items: readonly SoundPresetItem[]): string {
  return `跨全部声音的 ${items.length} 个声音组合。`;
}

function isStoredPresetItem(value: unknown): value is SoundPresetItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<SoundPresetItem>;

  return (
    typeof item.soundId === "string" &&
    item.soundId.trim().length > 0 &&
    typeof item.volume === "number" &&
    Number.isFinite(item.volume)
  );
}

function isStoredCustomSoundPreset(value: unknown): value is CustomSoundPreset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preset = value as Partial<CustomSoundPreset>;

  return (
    typeof preset.id === "string" &&
    preset.id.startsWith("custom_preset:") &&
    typeof preset.name === "string" &&
    preset.name.trim().length > 0 &&
    typeof preset.description === "string" &&
    Array.isArray(preset.items) &&
    preset.items.length > 0 &&
    preset.items.every(isStoredPresetItem) &&
    typeof preset.createdAt === "number" &&
    Number.isFinite(preset.createdAt) &&
    typeof preset.updatedAt === "number" &&
    Number.isFinite(preset.updatedAt)
  );
}

function normalizeStoredPreset(
  preset: CustomSoundPreset,
): CustomSoundPreset | null {
  const items = normalizePresetItems(preset.items);
  if (items.length === 0) {
    return null;
  }

  return {
    createdAt: preset.createdAt,
    description: preset.description.trim() || createPresetDescription(items),
    id: preset.id,
    items,
    name: preset.name.trim().slice(0, 32) || "我的混音",
    updatedAt: preset.updatedAt,
  };
}

function sortPresets(presets: readonly CustomSoundPreset[]): CustomSoundPreset[] {
  return [...presets].sort((left, right) => right.updatedAt - left.updatedAt);
}

function limitPresets(presets: readonly CustomSoundPreset[]): CustomSoundPreset[] {
  return sortPresets(presets).slice(0, MAX_CUSTOM_SOUND_PRESETS);
}

async function loadRawCustomSoundPresets(
  fs: FileSystemPort,
): Promise<CustomSoundPreset[]> {
  if (!(await fs.exists(CUSTOM_SOUND_PRESETS_PATH))) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(await fs.readText(CUSTOM_SOUND_PRESETS_PATH));
    if (!Array.isArray(value)) {
      return [];
    }

    return limitPresets(
      value
        .filter(isStoredCustomSoundPreset)
        .flatMap((preset) => {
          const normalizedPreset = normalizeStoredPreset(preset);

          return normalizedPreset ? [normalizedPreset] : [];
        }),
    );
  } catch {
    return [];
  }
}

async function saveRawCustomSoundPresets(
  presets: readonly CustomSoundPreset[],
  fs: FileSystemPort,
): Promise<void> {
  await fs.writeText(
    CUSTOM_SOUND_PRESETS_PATH,
    JSON.stringify(limitPresets(presets)),
  );
}

export async function listCustomSoundPresets(
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<CustomSoundPreset[]> {
  return loadRawCustomSoundPresets(fs);
}

export async function saveCustomSoundPreset(
  input: CustomSoundPresetInput,
  fs: FileSystemPort = indexedDbFileSystem,
  now = Date.now(),
): Promise<CustomSoundPreset> {
  const items = normalizePresetItems(input.items);
  if (items.length === 0) {
    throw new Error("全局混音至少需要一个声音");
  }

  const presets = await loadRawCustomSoundPresets(fs);
  const nextPreset: CustomSoundPreset = {
    createdAt: now,
    description: createPresetDescription(items),
    id: createCustomPresetId(now),
    items,
    name: createPresetName(input.name, presets.length + 1),
    updatedAt: now,
  };

  await saveRawCustomSoundPresets([nextPreset, ...presets], fs);

  return nextPreset;
}

export async function deleteCustomSoundPreset(
  presetId: CustomSoundPreset["id"],
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<CustomSoundPreset[]> {
  const presets = await loadRawCustomSoundPresets(fs);
  const nextPresets = presets.filter((preset) => preset.id !== presetId);

  await saveRawCustomSoundPresets(nextPresets, fs);

  return nextPresets;
}
