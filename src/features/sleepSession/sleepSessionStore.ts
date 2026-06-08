import type { FileSystemPort } from "../storage/FileSystemPort";
import { indexedDbFileSystem } from "../storage/indexedDbFileSystem";
import type { SoundId } from "../sounds/soundCatalog";
import type {
  RecentSleepSoundConfig,
  SleepSoundConfigInput,
  SleepSoundConfigItem,
  SleepSessionModuleSelection,
} from "./sleepSessionTypes";

const RECENT_SLEEP_CONFIGS_PATH = "sleep-session/recent-configs.json";
export const MAX_RECENT_SLEEP_CONFIGS = 5;
export const DEFAULT_SLEEP_SESSION_MODULE_SELECTION: SleepSessionModuleSelection = {
  audiobook: false,
  video: false,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, volume));
}

function normalizeDurationMinutes(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes)) {
    return 30;
  }

  return Math.min(999, Math.max(1, Math.floor(durationMinutes)));
}

function normalizeConfigItems(
  items: readonly SleepSoundConfigItem[],
): SleepSoundConfigItem[] {
  const seenSoundIds = new Set<SoundId>();
  const nextItems: SleepSoundConfigItem[] = [];

  for (const item of items) {
    const soundId = item.soundId;
    const name = item.name.trim();
    if (!soundId || !name || seenSoundIds.has(soundId)) {
      continue;
    }

    seenSoundIds.add(soundId);
    nextItems.push({
      name,
      soundId,
      volume: normalizeVolume(item.volume),
    });
  }

  return nextItems;
}

function normalizeModuleSelection(
  value: Partial<SleepSessionModuleSelection> | undefined,
): SleepSessionModuleSelection {
  return {
    audiobook: value?.audiobook === true,
    video: value?.video === true,
  };
}

function createConfigTitle(items: readonly SleepSoundConfigItem[]): string {
  if (items.length === 0) {
    return "未选择声音";
  }

  if (items.length <= 3) {
    return items.map((item) => item.name).join(" / ");
  }

  return `${items.slice(0, 3).map((item) => item.name).join(" / ")} 等 ${items.length} 个声音`;
}

export function createSleepConfigId(
  items: readonly SleepSoundConfigItem[],
  enabledModules: SleepSessionModuleSelection =
    DEFAULT_SLEEP_SESSION_MODULE_SELECTION,
): string {
  const moduleKey = `audiobook:${enabledModules.audiobook ? 1 : 0}|video:${enabledModules.video ? 1 : 0}`;
  const itemKey = items
    .map(
      (item) =>
        `${encodeURIComponent(item.soundId)}:${Math.round(normalizeVolume(item.volume) * 100)}`,
    )
    .join("|");

  return `${itemKey}::${moduleKey}`;
}

function isStoredSleepConfigItem(value: unknown): value is SleepSoundConfigItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<SleepSoundConfigItem>;

  return (
    typeof item.soundId === "string" &&
    item.soundId.trim().length > 0 &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    isFiniteNumber(item.volume)
  );
}

function isStoredRecentSleepSoundConfig(
  value: unknown,
): value is RecentSleepSoundConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Partial<RecentSleepSoundConfig>;

  return (
    typeof config.id === "string" &&
    config.id.trim().length > 0 &&
    typeof config.title === "string" &&
    config.title.trim().length > 0 &&
    Array.isArray(config.items) &&
    config.items.length > 0 &&
    config.items.every(isStoredSleepConfigItem) &&
    (config.enabledModules === undefined ||
      (typeof config.enabledModules === "object" &&
        config.enabledModules !== null)) &&
    isFiniteNumber(config.durationMinutes) &&
    isFiniteNumber(config.createdAt) &&
    isFiniteNumber(config.updatedAt)
  );
}

function sortRecentConfigs(
  configs: readonly RecentSleepSoundConfig[],
): RecentSleepSoundConfig[] {
  return [...configs].sort((left, right) => right.updatedAt - left.updatedAt);
}

function normalizeStoredConfig(
  config: RecentSleepSoundConfig,
): RecentSleepSoundConfig | null {
  const items = normalizeConfigItems(config.items);
  if (items.length === 0) {
    return null;
  }

  const enabledModules = normalizeModuleSelection(config.enabledModules);
  const id = createSleepConfigId(items, enabledModules);

  return {
    createdAt: config.createdAt,
    durationMinutes: normalizeDurationMinutes(config.durationMinutes),
    enabledModules,
    id,
    items,
    title: createConfigTitle(items),
    updatedAt: config.updatedAt,
  };
}

function dedupeAndLimitConfigs(
  configs: readonly RecentSleepSoundConfig[],
): RecentSleepSoundConfig[] {
  const configById = new Map<string, RecentSleepSoundConfig>();

  for (const config of sortRecentConfigs(configs)) {
    if (!configById.has(config.id)) {
      configById.set(config.id, config);
    }
  }

  return [...configById.values()].slice(0, MAX_RECENT_SLEEP_CONFIGS);
}

async function loadRawRecentSleepConfigs(
  fs: FileSystemPort,
): Promise<RecentSleepSoundConfig[]> {
  if (!(await fs.exists(RECENT_SLEEP_CONFIGS_PATH))) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(await fs.readText(RECENT_SLEEP_CONFIGS_PATH));
    if (!Array.isArray(value)) {
      return [];
    }

    return dedupeAndLimitConfigs(
      value
        .filter(isStoredRecentSleepSoundConfig)
        .flatMap((config) => {
          const normalizedConfig = normalizeStoredConfig(config);

          return normalizedConfig ? [normalizedConfig] : [];
        }),
    );
  } catch {
    return [];
  }
}

async function saveRawRecentSleepConfigs(
  configs: readonly RecentSleepSoundConfig[],
  fs: FileSystemPort,
): Promise<void> {
  await fs.writeText(
    RECENT_SLEEP_CONFIGS_PATH,
    JSON.stringify(dedupeAndLimitConfigs(configs)),
  );
}

export async function listRecentSleepConfigs(
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<RecentSleepSoundConfig[]> {
  return loadRawRecentSleepConfigs(fs);
}

export async function saveRecentSleepConfig(
  input: SleepSoundConfigInput,
  fs: FileSystemPort = indexedDbFileSystem,
  now = Date.now(),
): Promise<RecentSleepSoundConfig> {
  const items = normalizeConfigItems(input.items);
  if (items.length === 0) {
    throw new Error("睡眠配置至少需要一个声音");
  }

  const enabledModules = normalizeModuleSelection(input.enabledModules);
  const id = createSleepConfigId(items, enabledModules);
  const recentConfigs = await loadRawRecentSleepConfigs(fs);
  const existingConfig = recentConfigs.find((config) => config.id === id);
  const nextConfig: RecentSleepSoundConfig = {
    createdAt: existingConfig?.createdAt ?? now,
    durationMinutes: normalizeDurationMinutes(input.durationMinutes),
    enabledModules,
    id,
    items,
    title: createConfigTitle(items),
    updatedAt: now,
  };
  const nextConfigs = existingConfig
    ? recentConfigs.map((config) =>
        config.id === id ? nextConfig : config,
      )
    : [nextConfig, ...recentConfigs];

  await saveRawRecentSleepConfigs(nextConfigs, fs);

  return nextConfig;
}

export async function deleteRecentSleepConfig(
  configId: string,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<RecentSleepSoundConfig[]> {
  const recentConfigs = await loadRawRecentSleepConfigs(fs);
  const nextConfigs = recentConfigs.filter((config) => config.id !== configId);

  await saveRawRecentSleepConfigs(nextConfigs, fs);

  return nextConfigs;
}
