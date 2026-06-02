import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomSoundId, SoundDefinition } from "../sounds/soundCatalog";
import {
  createCustomSoundDefinition,
  deleteStoredCustomSound,
  isSupportedCustomAudioFile,
  listStoredCustomSounds,
  saveCustomSoundFile,
  validateCustomSoundFilesForImport,
  type StoredCustomSound,
} from "./customSoundStore";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function revokeObjectUrl(objectUrl: string) {
  if (typeof URL !== "undefined" && "revokeObjectURL" in URL) {
    URL.revokeObjectURL(objectUrl);
  }
}

function canCreateObjectUrls(): boolean {
  return typeof URL !== "undefined" && "createObjectURL" in URL;
}

function createObjectUrl(blob: Blob): string {
  if (!canCreateObjectUrls()) {
    throw new Error("当前环境不支持本地音频 URL");
  }

  return URL.createObjectURL(blob);
}

export function useCustomSounds() {
  const objectUrlsRef = useRef(new Map<CustomSoundId, string>());
  const [customSounds, setCustomSounds] = useState<SoundDefinition[]>([]);
  const [isLoadingCustomSounds, setIsLoadingCustomSounds] = useState(true);
  const [isImportingCustomSound, setIsImportingCustomSound] = useState(false);
  const [customSoundMessage, setCustomSoundMessage] = useState<string | null>(
    null,
  );
  const [customSoundErrorMessage, setCustomSoundErrorMessage] = useState<
    string | null
  >(null);

  const createSoundFromRecord = useCallback((record: StoredCustomSound) => {
    const existingUrl = objectUrlsRef.current.get(record.id);
    const objectUrl = existingUrl ?? createObjectUrl(record.blob);
    objectUrlsRef.current.set(record.id, objectUrl);

    return createCustomSoundDefinition(record, objectUrl);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomSounds() {
      try {
        const records = await listStoredCustomSounds();
        if (!isMounted) {
          return;
        }
        setCustomSounds(records.map((record) => createSoundFromRecord(record)));
      } catch (error) {
        if (isMounted) {
          setCustomSoundErrorMessage(
            getErrorMessage(error, "读取自定义音频失败"),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCustomSounds(false);
        }
      }
    }

    void loadCustomSounds();

    return () => {
      isMounted = false;
      for (const objectUrl of objectUrlsRef.current.values()) {
        revokeObjectUrl(objectUrl);
      }
      objectUrlsRef.current.clear();
    };
  }, [createSoundFromRecord]);

  const addCustomSoundFiles = useCallback(
    async (files: readonly File[]) => {
      const audioFiles = Array.from(files);
      if (audioFiles.length === 0) {
        return [] as SoundDefinition[];
      }

      if (!canCreateObjectUrls()) {
        setCustomSoundErrorMessage("当前环境不支持本地音频 URL");
        setCustomSoundMessage(null);
        return [] as SoundDefinition[];
      }

      const unsupportedFile = audioFiles.find(
        (file) => !isSupportedCustomAudioFile(file),
      );
      if (unsupportedFile) {
        setCustomSoundErrorMessage(`不支持的音频文件：${unsupportedFile.name}`);
        setCustomSoundMessage(null);
        return [] as SoundDefinition[];
      }

      try {
        await validateCustomSoundFilesForImport(audioFiles);
      } catch (error) {
        setCustomSoundErrorMessage(
          getErrorMessage(error, "添加自定义音频失败"),
        );
        setCustomSoundMessage(null);
        return [] as SoundDefinition[];
      }

      setIsImportingCustomSound(true);
      setCustomSoundErrorMessage(null);
      setCustomSoundMessage(null);

      try {
        const importedSounds: SoundDefinition[] = [];
        const failedFileNames: string[] = [];

        for (const file of audioFiles) {
          try {
            const record = await saveCustomSoundFile(file);
            importedSounds.push(createSoundFromRecord(record));
          } catch {
            failedFileNames.push(file.name);
          }
        }

        if (importedSounds.length > 0) {
          setCustomSounds((current) => [...current, ...importedSounds]);
        }

        if (failedFileNames.length > 0) {
          setCustomSoundErrorMessage(
            `有 ${failedFileNames.length} 个音频添加失败：${failedFileNames.join("、")}`,
          );
        }

        setCustomSoundMessage(
          importedSounds.length > 0
            ? `已添加 ${importedSounds.length} 个自定义音频`
            : null,
        );
        return importedSounds;
      } catch (error) {
        setCustomSoundErrorMessage(
          getErrorMessage(error, "添加自定义音频失败"),
        );
        return [] as SoundDefinition[];
      } finally {
        setIsImportingCustomSound(false);
      }
    },
    [createSoundFromRecord],
  );

  const removeCustomSound = useCallback(async (soundId: CustomSoundId) => {
    setCustomSoundErrorMessage(null);
    setCustomSoundMessage(null);

    try {
      await deleteStoredCustomSound(soundId);
      const objectUrl = objectUrlsRef.current.get(soundId);
      if (objectUrl) {
        revokeObjectUrl(objectUrl);
        objectUrlsRef.current.delete(soundId);
      }
      setCustomSounds((current) =>
        current.filter((sound) => sound.id !== soundId),
      );
      setCustomSoundMessage("已移除自定义音频");
      return true;
    } catch (error) {
      setCustomSoundErrorMessage(
        getErrorMessage(error, "删除自定义音频失败"),
      );
      return false;
    }
  }, []);

  return {
    addCustomSoundFiles,
    customSoundErrorMessage,
    customSoundMessage,
    customSounds,
    isImportingCustomSound,
    isLoadingCustomSounds,
    removeCustomSound,
  };
}
