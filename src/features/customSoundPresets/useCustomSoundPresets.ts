import { useCallback, useEffect, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { SoundPresetItem } from "../sounds/soundPresets";
import {
  deleteCustomSoundPreset,
  listCustomSoundPresets,
  saveCustomSoundPreset,
  type CustomSoundPreset,
} from "./customSoundPresetStore";

interface UseCustomSoundPresetsResult {
  customPresetErrorMessage: string | null;
  customPresetMessage: string | null;
  customPresets: CustomSoundPreset[];
  isLoadingCustomPresets: boolean;
  removeCustomPreset: (presetId: CustomSoundPreset["id"]) => Promise<void>;
  saveCurrentPreset: (items: SoundPresetItem[]) => Promise<CustomSoundPreset>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useCustomSoundPresets(
  fileSystem?: FileSystemPort,
): UseCustomSoundPresetsResult {
  const [customPresets, setCustomPresets] = useState<CustomSoundPreset[]>([]);
  const [isLoadingCustomPresets, setIsLoadingCustomPresets] = useState(true);
  const [customPresetMessage, setCustomPresetMessage] = useState<string | null>(
    null,
  );
  const [customPresetErrorMessage, setCustomPresetErrorMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isActive = true;

    setIsLoadingCustomPresets(true);
    void listCustomSoundPresets(fileSystem)
      .then((presets) => {
        if (!isActive) {
          return;
        }

        setCustomPresets(presets);
        setCustomPresetErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setCustomPresets([]);
        setCustomPresetErrorMessage(
          getErrorMessage(error, "读取自定义配置失败"),
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCustomPresets(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fileSystem]);

  const saveCurrentPreset = useCallback(
    async (items: SoundPresetItem[]) => {
      setCustomPresetMessage(null);
      setCustomPresetErrorMessage(null);

      try {
        const preset = await saveCustomSoundPreset({ items }, fileSystem);
        const presets = await listCustomSoundPresets(fileSystem);

        setCustomPresets(presets);
        setCustomPresetMessage("已保存为自定义配置");

        return preset;
      } catch (error) {
        setCustomPresetErrorMessage(
          getErrorMessage(error, "保存自定义配置失败"),
        );
        throw error;
      }
    },
    [fileSystem],
  );

  const removeCustomPreset = useCallback(
    async (presetId: CustomSoundPreset["id"]) => {
      setCustomPresetMessage(null);
      setCustomPresetErrorMessage(null);

      try {
        const presets = await deleteCustomSoundPreset(presetId, fileSystem);

        setCustomPresets(presets);
        setCustomPresetMessage("已删除自定义配置");
      } catch (error) {
        setCustomPresetErrorMessage(
          getErrorMessage(error, "删除自定义配置失败"),
        );
      }
    },
    [fileSystem],
  );

  return {
    customPresetErrorMessage,
    customPresetMessage,
    customPresets,
    isLoadingCustomPresets,
    removeCustomPreset,
    saveCurrentPreset,
  };
}
