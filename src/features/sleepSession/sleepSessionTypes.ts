import type { SoundId } from "../sounds/soundCatalog";

export interface SleepSoundConfigItem {
  name: string;
  soundId: SoundId;
  volume: number;
}

export interface SleepSessionModuleSelection {
  audiobook: boolean;
  video: boolean;
}

export interface RecentSleepSoundConfig {
  createdAt: number;
  durationMinutes: number;
  enabledModules: SleepSessionModuleSelection;
  id: string;
  items: SleepSoundConfigItem[];
  title: string;
  updatedAt: number;
}

export interface SleepSoundConfigInput {
  durationMinutes: number;
  enabledModules: SleepSessionModuleSelection;
  items: SleepSoundConfigItem[];
}

export interface SleepSoundPlaybackRequest {
  config: RecentSleepSoundConfig;
  requestId: number;
}
