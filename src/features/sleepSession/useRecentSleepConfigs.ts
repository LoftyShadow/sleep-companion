import { useCallback, useEffect, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import {
  deleteRecentSleepConfig,
  listRecentSleepConfigs,
  saveRecentSleepConfig,
} from "./sleepSessionStore";
import type {
  RecentSleepSoundConfig,
  SleepSoundConfigInput,
} from "./sleepSessionTypes";

interface UseRecentSleepConfigsResult {
  errorMessage: string | null;
  isLoading: boolean;
  recentConfigs: RecentSleepSoundConfig[];
  removeRecentConfig: (configId: string) => Promise<void>;
  saveRecentConfig: (
    input: SleepSoundConfigInput,
  ) => Promise<RecentSleepSoundConfig>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useRecentSleepConfigs(
  fileSystem?: FileSystemPort,
): UseRecentSleepConfigsResult {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentConfigs, setRecentConfigs] = useState<RecentSleepSoundConfig[]>(
    [],
  );

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    void listRecentSleepConfigs(fileSystem)
      .then((configs) => {
        if (!isActive) {
          return;
        }

        setRecentConfigs(configs);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setRecentConfigs([]);
        setErrorMessage(getErrorMessage(error, "读取最近配置失败"));
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fileSystem]);

  const saveRecentConfig = useCallback(
    async (input: SleepSoundConfigInput) => {
      setErrorMessage(null);

      try {
        const nextConfig = await saveRecentSleepConfig(input, fileSystem);
        const configs = await listRecentSleepConfigs(fileSystem);

        setRecentConfigs(configs);

        return nextConfig;
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "保存最近配置失败"));
        throw error;
      }
    },
    [fileSystem],
  );

  const removeRecentConfig = useCallback(
    async (configId: string) => {
      setErrorMessage(null);

      try {
        const configs = await deleteRecentSleepConfig(configId, fileSystem);

        setRecentConfigs(configs);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "删除最近配置失败"));
      }
    },
    [fileSystem],
  );

  return {
    errorMessage,
    isLoading,
    recentConfigs,
    removeRecentConfig,
    saveRecentConfig,
  };
}
