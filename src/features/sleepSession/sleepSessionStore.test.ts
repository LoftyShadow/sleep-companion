import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import {
  createSleepConfigId,
  listRecentSleepConfigs,
  saveRecentSleepConfig,
} from "./sleepSessionStore";

describe("sleepSessionStore", () => {
  it("returns an empty list when storage does not exist", async () => {
    const fileSystem = createMemoryFileSystem();

    await expect(listRecentSleepConfigs(fileSystem)).resolves.toEqual([]);
  });

  it("stores recent configs newest first and keeps only five", async () => {
    const fileSystem = createMemoryFileSystem();

    for (let index = 0; index < 6; index += 1) {
      await saveRecentSleepConfig(
        {
          durationMinutes: 30 + index,
          enabledModules: { audiobook: false, video: false },
          items: [
            {
              name: `声音 ${index}`,
              soundId: `custom:${index}`,
              volume: 0.5,
            },
          ],
        },
        fileSystem,
        1000 + index,
      );
    }

    const configs = await listRecentSleepConfigs(fileSystem);

    expect(configs).toHaveLength(5);
    expect(configs.map((config) => config.title)).toEqual([
      "声音 5",
      "声音 4",
      "声音 3",
      "声音 2",
      "声音 1",
    ]);
  });

  it("updates an existing config instead of creating duplicates", async () => {
    const fileSystem = createMemoryFileSystem();
    const input = {
      durationMinutes: 45,
      enabledModules: { audiobook: false, video: false },
      items: [
        { name: "大雨", soundId: "heavy_rain" as const, volume: 0.62 },
        { name: "雷声", soundId: "thunder" as const, volume: 0.18 },
      ],
    };

    await saveRecentSleepConfig(input, fileSystem, 1000);
    await saveRecentSleepConfig(
      { ...input, durationMinutes: 60 },
      fileSystem,
      2000,
    );

    const configs = await listRecentSleepConfigs(fileSystem);

    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({
      createdAt: 1000,
      durationMinutes: 60,
      id: createSleepConfigId(input.items),
      title: "大雨 / 雷声",
      updatedAt: 2000,
    });
  });

  it("falls back to an empty list for malformed storage content", async () => {
    const fileSystem = createMemoryFileSystem();

    await fileSystem.writeText("sleep-session/recent-configs.json", "{");

    await expect(listRecentSleepConfigs(fileSystem)).resolves.toEqual([]);
  });

  it("normalizes invalid volume and duration values", async () => {
    const fileSystem = createMemoryFileSystem();

    await saveRecentSleepConfig(
      {
        durationMinutes: -5,
        enabledModules: { audiobook: false, video: false },
        items: [
          { name: "大雨", soundId: "heavy_rain", volume: 2 },
          { name: "雷声", soundId: "thunder", volume: -1 },
        ],
      },
      fileSystem,
      1000,
    );

    const configs = await listRecentSleepConfigs(fileSystem);

    expect(configs[0].durationMinutes).toBe(1);
    expect(configs[0].items.map((item) => item.volume)).toEqual([1, 0]);
  });

  it("uses optional modules as part of the recent config identity", async () => {
    const fileSystem = createMemoryFileSystem();
    const items = [{ name: "大雨", soundId: "heavy_rain" as const, volume: 0.62 }];

    await saveRecentSleepConfig(
      {
        durationMinutes: 30,
        enabledModules: { audiobook: false, video: false },
        items,
      },
      fileSystem,
      1000,
    );
    await saveRecentSleepConfig(
      {
        durationMinutes: 30,
        enabledModules: { audiobook: true, video: false },
        items,
      },
      fileSystem,
      2000,
    );

    const configs = await listRecentSleepConfigs(fileSystem);

    expect(configs).toHaveLength(2);
    expect(configs.map((config) => config.enabledModules)).toEqual([
      { audiobook: true, video: false },
      { audiobook: false, video: false },
    ]);
  });
});
