import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import { useCustomSoundPresets } from "./useCustomSoundPresets";

describe("useCustomSoundPresets", () => {
  it("loads, saves and removes custom presets", async () => {
    const fileSystem = createMemoryFileSystem();
    const { result } = renderHook(() => useCustomSoundPresets(fileSystem));

    await waitFor(() => {
      expect(result.current.isLoadingCustomPresets).toBe(false);
    });
    expect(result.current.customPresets).toEqual([]);

    await act(async () => {
      await result.current.saveCurrentPreset([
        { soundId: "heavy_rain", volume: 0.62 },
      ]);
    });

    expect(result.current.customPresetMessage).toBe("已保存为自定义配置");
    expect(result.current.customPresets).toHaveLength(1);
    expect(result.current.customPresets[0].items).toEqual([
      { soundId: "heavy_rain", volume: 0.62 },
    ]);

    await act(async () => {
      await result.current.removeCustomPreset(result.current.customPresets[0].id);
    });

    expect(result.current.customPresetMessage).toBe("已删除自定义配置");
    expect(result.current.customPresets).toEqual([]);
  });
});
