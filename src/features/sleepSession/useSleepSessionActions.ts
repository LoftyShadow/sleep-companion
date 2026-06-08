import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_SLEEP_SESSION_MODULE_SELECTION,
} from "./sleepSessionStore";
import type {
  RecentSleepSoundConfig,
  SleepSessionModuleSelection,
  SleepSoundConfigInput,
  SleepSoundConfigItem,
} from "./sleepSessionTypes";
import {
  canStartSleepModules,
  type CanUseSleepSessionModule,
  type SleepSessionModuleId,
} from "./sleepSessionViewModel";

interface UseSleepSessionActionsOptions {
  currentConfigItems: readonly SleepSoundConfigItem[];
  durationMinutes: number;
  onCanUseModule: CanUseSleepSessionModule;
  onDurationChange: (durationMinutes: number) => void;
  onStartModules: (modules: SleepSessionModuleSelection) => void;
  onStartTimer: (durationMinutes?: number) => void;
  onUseConfig: (config: RecentSleepSoundConfig) => void;
  saveRecentConfig: (
    input: SleepSoundConfigInput,
  ) => Promise<RecentSleepSoundConfig>;
}

interface UseSleepSessionActionsResult {
  actionMessage: string | null;
  canStartSession: boolean;
  enabledModules: SleepSessionModuleSelection;
  handleModuleChange: (
    moduleId: SleepSessionModuleId,
    isEnabled: boolean,
  ) => void;
  handleSaveCurrentConfig: () => Promise<void>;
  handleStartCurrentSession: () => Promise<void>;
  handleUseRecentConfig: (config: RecentSleepSoundConfig) => Promise<void>;
  hasCurrentConfig: boolean;
}

export function useSleepSessionActions({
  currentConfigItems,
  durationMinutes,
  onCanUseModule,
  onDurationChange,
  onStartModules,
  onStartTimer,
  onUseConfig,
  saveRecentConfig,
}: UseSleepSessionActionsOptions): UseSleepSessionActionsResult {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [enabledModules, setEnabledModules] =
    useState<SleepSessionModuleSelection>(
      DEFAULT_SLEEP_SESSION_MODULE_SELECTION,
    );
  const hasCurrentConfig = currentConfigItems.length > 0;
  const canStartSelectedModules = useMemo(
    () => canStartSleepModules(enabledModules, onCanUseModule),
    [enabledModules, onCanUseModule],
  );
  const canStartSession = hasCurrentConfig && canStartSelectedModules;

  const persistCurrentConfig = useCallback(
    () =>
      saveRecentConfig({
        durationMinutes,
        enabledModules,
        items: [...currentConfigItems],
      }),
    [
      currentConfigItems,
      durationMinutes,
      enabledModules,
      saveRecentConfig,
    ],
  );

  const handleStartCurrentSession = useCallback(async () => {
    if (!canStartSession) {
      return;
    }

    try {
      const config = await persistCurrentConfig();

      onUseConfig(config);
      onStartModules(config.enabledModules);
      onStartTimer(config.durationMinutes);
      setActionMessage("已使用当前配置开始睡眠");
    } catch {
      setActionMessage(null);
    }
  }, [
    canStartSession,
    onStartModules,
    onStartTimer,
    onUseConfig,
    persistCurrentConfig,
  ]);

  const handleSaveCurrentConfig = useCallback(async () => {
    if (!hasCurrentConfig) {
      return;
    }

    try {
      await persistCurrentConfig();
      setActionMessage("已保存到最近配置");
    } catch {
      setActionMessage(null);
    }
  }, [hasCurrentConfig, persistCurrentConfig]);

  const handleUseRecentConfig = useCallback(
    async (config: RecentSleepSoundConfig) => {
      if (!canStartSleepModules(config.enabledModules, onCanUseModule)) {
        return;
      }

      setEnabledModules(config.enabledModules);

      try {
        const nextConfig = await saveRecentConfig({
          durationMinutes: config.durationMinutes,
          enabledModules: config.enabledModules,
          items: config.items,
        });

        onDurationChange(nextConfig.durationMinutes);
        onUseConfig(nextConfig);
        onStartModules(nextConfig.enabledModules);
        onStartTimer(nextConfig.durationMinutes);
        setActionMessage("已复用最近配置开始睡眠");
      } catch {
        setActionMessage(null);
      }
    },
    [
      onCanUseModule,
      onDurationChange,
      onStartModules,
      onStartTimer,
      onUseConfig,
      saveRecentConfig,
    ],
  );

  const handleModuleChange = useCallback(
    (moduleId: SleepSessionModuleId, isEnabled: boolean) => {
      setEnabledModules((modules) => ({
        ...modules,
        [moduleId]: isEnabled,
      }));
    },
    [],
  );

  return {
    actionMessage,
    canStartSession,
    enabledModules,
    handleModuleChange,
    handleSaveCurrentConfig,
    handleStartCurrentSession,
    handleUseRecentConfig,
    hasCurrentConfig,
  };
}
