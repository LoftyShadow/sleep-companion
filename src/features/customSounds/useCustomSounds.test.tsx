import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredCustomSound } from "./customSoundStore";
import {
  createCustomSoundDefinition,
  deleteStoredCustomSound,
  isSupportedCustomAudioFile,
  listStoredCustomSounds,
  saveCustomSoundFile,
  validateCustomSoundFilesForImport,
} from "./customSoundStore";
import { useCustomSounds } from "./useCustomSounds";

vi.mock("./customSoundStore", () => ({
  createCustomSoundDefinition: vi.fn(
    (record: StoredCustomSound, objectUrl: string) => ({
      id: record.id,
      name: record.name,
      sourceKind: "custom",
      imageSrc: "/images/sounds/typewriter.webp",
      sources: [{ src: objectUrl, type: record.type }],
    }),
  ),
  deleteStoredCustomSound: vi.fn(),
  isSupportedCustomAudioFile: vi.fn(),
  listStoredCustomSounds: vi.fn(),
  saveCustomSoundFile: vi.fn(),
  validateCustomSoundFilesForImport: vi.fn(),
}));

function createRecord(id: `custom:${string}`, name: string): StoredCustomSound {
  return {
    id,
    name,
    type: "audio/mpeg",
    blob: new Blob(["audio"], { type: "audio/mpeg" }),
    createdAt: 1,
  };
}

describe("useCustomSounds", () => {
  beforeEach(() => {
    let objectUrlIndex = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        objectUrlIndex += 1;
        return `blob:test-${objectUrlIndex}`;
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    vi.mocked(listStoredCustomSounds).mockResolvedValue([]);
    vi.mocked(isSupportedCustomAudioFile).mockReturnValue(true);
    vi.mocked(saveCustomSoundFile).mockResolvedValue(
      createRecord("custom:default", "默认音频"),
    );
    vi.mocked(validateCustomSoundFilesForImport).mockResolvedValue(undefined);
    vi.mocked(deleteStoredCustomSound).mockResolvedValue(undefined);
  });

  it("loads stored custom sounds as playable sound definitions", async () => {
    vi.mocked(listStoredCustomSounds).mockResolvedValue([
      createRecord("custom:stored", "已保存音频"),
    ]);

    const { result } = renderHook(() => useCustomSounds());

    await waitFor(() => {
      expect(result.current.isLoadingCustomSounds).toBe(false);
    });

    expect(result.current.customSounds).toEqual([
      {
        id: "custom:stored",
        name: "已保存音频",
        sourceKind: "custom",
        imageSrc: "/images/sounds/typewriter.webp",
        sources: [{ src: "blob:test-1", type: "audio/mpeg" }],
      },
    ]);
    expect(createCustomSoundDefinition).toHaveBeenCalledTimes(1);
  });

  it("keeps successfully imported files visible when one file fails", async () => {
    vi.mocked(saveCustomSoundFile).mockImplementation((file) => {
      if (file.name === "bad.mp3") {
        return Promise.reject(new Error("写入失败"));
      }

      return Promise.resolve(createRecord("custom:ok", "成功音频"));
    });
    const { result } = renderHook(() => useCustomSounds());

    await waitFor(() => {
      expect(result.current.isLoadingCustomSounds).toBe(false);
    });

    let importedCount = 0;
    await act(async () => {
      const importedSounds = await result.current.addCustomSoundFiles([
        new File(["audio"], "ok.mp3", { type: "audio/mpeg" }),
        new File(["audio"], "bad.mp3", { type: "audio/mpeg" }),
      ]);
      importedCount = importedSounds.length;
    });

    expect(importedCount).toBe(1);
    expect(result.current.customSounds).toHaveLength(1);
    expect(result.current.customSoundMessage).toBe("已添加 1 个自定义音频");
    expect(result.current.customSoundErrorMessage).toBe(
      "有 1 个音频添加失败：bad.mp3",
    );
  });

  it("stops importing when custom sound validation fails", async () => {
    vi.mocked(validateCustomSoundFilesForImport).mockRejectedValue(
      new Error("本地存储空间不足，请移除一些自定义音频后再添加"),
    );
    const { result } = renderHook(() => useCustomSounds());

    await waitFor(() => {
      expect(result.current.isLoadingCustomSounds).toBe(false);
    });

    let importedCount = 0;
    await act(async () => {
      const importedSounds = await result.current.addCustomSoundFiles([
        new File(["audio"], "huge.mp3", { type: "audio/mpeg" }),
      ]);
      importedCount = importedSounds.length;
    });

    expect(importedCount).toBe(0);
    expect(saveCustomSoundFile).not.toHaveBeenCalled();
    expect(result.current.customSoundErrorMessage).toBe(
      "本地存储空间不足，请移除一些自定义音频后再添加",
    );
  });
});
