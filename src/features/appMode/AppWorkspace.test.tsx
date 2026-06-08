import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPlayerPortTestDouble,
  createTtsEngineTestDouble,
  mockHtmlMediaPlayback,
} from "../../test/audioTestDoubles";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { BilibiliAuthClient } from "../videoListening/bilibiliAuth";
import type { BilibiliDirectAudioLoader } from "../videoListening/bilibiliDirectAudio";
import { AppWorkspace } from "./AppWorkspace";

const TEST_AUDIOBOOK_TEXT = "用户自己的第一段。\n\n用户自己的第二段。";
const FIRST_TEST_AUDIOBOOK_SEGMENT = "用户自己的第一段。";
const TEST_BILIBILI_DIRECT_AUDIO_SOURCE = {
  aid: "170001",
  audioUrl: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s",
  backupUrls: [],
  bandwidth: 128000,
  bvid: "BV1xx411c7mD",
  chapters: [
    {
      content: "开场",
      fromSeconds: 0,
      toSeconds: 60,
    },
    {
      content: "雨声段落",
      fromSeconds: 60,
      toSeconds: 120,
    },
  ],
  cid: "110002",
  codecs: "mp4a.40.2",
  coverUrl: "https://i0.hdslb.com/video.jpg",
  durationSeconds: 120,
  mimeType: "audio/mp4",
  title: "视频测试标题",
  videoBackupUrls: [],
  videoBandwidth: 800000,
  videoCodecs: "avc1.64001F",
  videoHeight: 720,
  videoMimeType: "video/mp4",
  videoTracks: [
    {
      backupUrls: [],
      bandwidth: 800000,
      codecs: "avc1.64001F",
      height: 720,
      id: "track-1",
      label: "720p · AVC · 800 kbps",
      mimeType: "video/mp4",
      url: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fv.m4s",
      width: 1280,
    },
  ],
  videoUrl: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fv.m4s",
  videoWidth: 1280,
};

function createLoggedOutBilibiliAuthClient(): BilibiliAuthClient {
  return {
    createLoginQr: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({
      account: undefined,
      isLoggedIn: false,
    }),
    importCookies: vi.fn(),
    logout: vi.fn(),
    openWebLogin: vi.fn(),
    pollLoginQr: vi.fn(),
    syncWebLogin: vi.fn(),
  };
}

function createBilibiliDirectAudioLoaderTestDouble(): BilibiliDirectAudioLoader {
  return vi.fn().mockResolvedValue(TEST_BILIBILI_DIRECT_AUDIO_SOURCE);
}

function createWriteToggleFileSystem() {
  const memoryFileSystem = createMemoryFileSystem();
  let shouldFailWrite = false;
  const writeText = vi.fn<FileSystemPort["writeText"]>((path, content) => {
    if (shouldFailWrite) {
      return Promise.reject(new Error("存储写入失败"));
    }

    return memoryFileSystem.writeText(path, content);
  });
  const fileSystem: FileSystemPort = {
    ...memoryFileSystem,
    writeText,
  };

  return {
    fileSystem,
    setShouldFailWrite: (nextValue: boolean) => {
      shouldFailWrite = nextValue;
    },
    writeText,
  };
}

async function importAudiobookTextBook(
  user: ReturnType<typeof userEvent.setup>,
  text = TEST_AUDIOBOOK_TEXT,
) {
  await user.upload(
    screen.getByLabelText("添加听书书籍"),
    new File([text], "用户自己的书稿.txt", { type: "text/plain" }),
  );
}

async function waitForAudiobookSegments() {
  await waitFor(() => {
    expect(
      within(screen.getByLabelText("听书概览")).getByText("2 段"),
    ).toBeInTheDocument();
  });
}

async function startAmbientSoundAndAudiobookPlayback(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByRole("button", { name: "大雨" }));
  await user.click(screen.getByRole("button", { name: "听书" }));
  await importAudiobookTextBook(user);
  await user.click(screen.getByRole("button", { name: "播放" }));
}

describe("AppWorkspace", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps ambient sounds and audiobook playback independent across mode switches", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    const { cancel, engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        fileSystem={createMemoryFileSystem()}
        player={player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听书" }));

    expect(stopAll).not.toHaveBeenCalled();

    await importAudiobookTextBook(user);
    expect(await screen.findByText("系统女声 · zh-CN")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "播放" }));

    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: FIRST_TEST_AUDIOBOOK_SEGMENT,
        voiceId: "voice:default",
      }),
    );
    expect(stopAll).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "声音" }));

    expect(cancel).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("button", { name: "大雨" })).getByText("播放中"),
    ).toBeInTheDocument();
  });

  it("keeps ambient sounds playing when opening video listening", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        player={player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听视频" }));

    expect(screen.getByRole("heading", { name: "听视频" })).toBeInTheDocument();
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
    expect(stopAll).not.toHaveBeenCalled();
  });

  it("starts a sleep session from the current sound config", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "睡眠" }));

    const sleepPanel = screen.getByRole("region", { name: "睡眠" });
    expect(
      within(sleepPanel).getByRole("heading", { name: "今晚的会话" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "当前声音配置" })).getByText(
        "大雨",
      ),
    ).toBeInTheDocument();
    expect(
      within(sleepPanel).getByRole("button", { name: "去声音页配置" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "添加声音" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("大雨 音量")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("自定义"), {
      target: { value: "45" },
    });
    await user.click(screen.getByRole("button", { name: "开始睡眠" }));

    await waitFor(() => {
      expect(screen.getByRole("timer")).toHaveTextContent("剩余 45:00");
    });
    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
  });

  it("keeps detailed sound configuration in the sound mode", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "睡眠" }));
    const sleepPanel = screen.getByRole("region", { name: "睡眠" });

    expect(screen.queryByRole("combobox", { name: "添加声音" })).not.toBeInTheDocument();
    expect(
      within(sleepPanel).getByRole("button", { name: "去声音页配置" }),
    ).toBeInTheDocument();

    await user.click(
      within(sleepPanel).getByRole("button", { name: "去声音页配置" }),
    );

    expect(screen.getByRole("heading", { name: "声音库" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "篝火" }));
    fireEvent.change(screen.getByLabelText("篝火音量"), {
      target: { value: "23" },
    });
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("button", { name: "开始睡眠" }));

    await waitFor(() => {
      expect(play).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "campfire" }),
        0.23,
      );
    });
  });

  it("lets the sleep entry decide whether to include audiobook and video", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    const { engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));
    await importAudiobookTextBook(user);
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("checkbox", { name: "听书" }));
    await user.click(screen.getByRole("checkbox", { name: "听视频" }));
    expect(screen.getByRole("button", { name: "开始睡眠" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "听视频" }));
    await user.click(screen.getByRole("button", { name: "开始睡眠" }));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: FIRST_TEST_AUDIOBOOK_SEGMENT,
        }),
      );
    });
    expect(play).toHaveBeenCalled();
    expect(screen.getByText("未载入来源")).toBeInTheDocument();
  });

  it("does not pause an already playing audiobook when starting a sleep session", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    const { engine, handlePause, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={player}
        ttsEngine={engine}
      />,
    );

    await startAmbientSoundAndAudiobookPlayback(user);

    await waitFor(() => {
      expect(speak).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("checkbox", { name: "听书" }));
    await user.click(screen.getByRole("button", { name: "开始睡眠" }));

    await waitFor(() => {
      expect(screen.getByRole("timer")).toHaveTextContent("剩余 30:00");
      expect(play).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "heavy_rain" }),
        0.62,
      );
    });
    expect(handlePause).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("does not pause an already playing video when starting a sleep session", async () => {
    const media = mockHtmlMediaPlayback();
    const user = userEvent.setup();
    const loadDirectAudio = createBilibiliDirectAudioLoaderTestDouble();
    render(
      <AppWorkspace
        bilibiliDirectAudioLoader={loadDirectAudio}
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(
      await screen.findByRole("heading", { name: "视频测试标题" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    expect(
      await screen.findByRole("button", { name: "暂停听视频模块" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("checkbox", { name: "听视频" }));
    await user.click(screen.getByRole("button", { name: "开始睡眠" }));

    await waitFor(() => {
      expect(screen.getByRole("timer")).toHaveTextContent("剩余 30:00");
    });
    expect(media.pause).not.toHaveBeenCalled();
  });

  it("reuses and deletes a recent sleep config", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    const fileSystem = createMemoryFileSystem();
    render(<AppWorkspace fileSystem={fileSystem} player={player} />);

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("button", { name: "保存配置" }));

    expect(
      await within(screen.getByRole("region", { name: "最近配置" })).findByRole(
        "heading",
        { name: "大雨" },
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "声音" }));
    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("button", { name: "复用" }));

    await waitFor(() => {
      expect(stopAll).toHaveBeenCalledTimes(1);
      expect(play).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "heavy_rain" }),
        0.62,
      );
    });

    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(screen.getByText("最近还没有保存过睡眠配置。")).toBeInTheDocument();
  });

  it("disables a recent sleep config when a selected module is not ready", async () => {
    const user = userEvent.setup();
    const { player } = createPlayerPortTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("checkbox", { name: "听视频" }));
    await user.click(screen.getByRole("button", { name: "保存配置" }));

    const recentPanel = screen.getByRole("region", { name: "最近配置" });
    expect(
      await within(recentPanel).findByRole("heading", { name: "大雨" }),
    ).toBeInTheDocument();
    const reuseButton = within(recentPanel).getByRole("button", {
      name: "复用",
    });

    expect(reuseButton).toBeDisabled();
    fireEvent.click(reuseButton);
    expect(screen.getByRole("timer")).toHaveTextContent("未开启");
  });

  it("shows recent config save errors without starting a sleep session", async () => {
    const user = userEvent.setup();
    const { fileSystem, setShouldFailWrite } = createWriteToggleFileSystem();
    render(
      <AppWorkspace
        fileSystem={fileSystem}
        player={createPlayerPortTestDouble().player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    setShouldFailWrite(true);
    await user.click(screen.getByRole("button", { name: "开始睡眠" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("存储写入失败");
    expect(screen.getByRole("timer")).toHaveTextContent("未开启");
  });

  it("shows recent config delete errors without removing the visible config", async () => {
    const user = userEvent.setup();
    const { fileSystem, setShouldFailWrite } = createWriteToggleFileSystem();
    render(
      <AppWorkspace
        fileSystem={fileSystem}
        player={createPlayerPortTestDouble().player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "睡眠" }));
    await user.click(screen.getByRole("button", { name: "保存配置" }));

    const recentPanel = screen.getByRole("region", { name: "最近配置" });
    expect(
      await within(recentPanel).findByRole("heading", { name: "大雨" }),
    ).toBeInTheDocument();

    setShouldFailWrite(true);
    await user.click(within(recentPanel).getByRole("button", { name: "删除" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("存储写入失败");
    expect(
      within(recentPanel).getByRole("heading", { name: "大雨" }),
    ).toBeInTheDocument();
  });

  it("uses the floating control to play and pause ambient sounds", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(screen.getByRole("button", { name: "播放声音模块" }));

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(3);
    });

    await user.click(
      await screen.findByRole("button", { name: "暂停声音模块" }),
    );

    expect(stopAll).toHaveBeenCalledTimes(1);
  });

  it("uses the floating control to start and pause audiobook playback", async () => {
    const user = userEvent.setup();
    const { engine, handlePause, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(screen.getByRole("button", { name: "打开听书模块" }));
    await importAudiobookTextBook(user);
    await waitForAudiobookSegments();
    if (!screen.queryByRole("region", { name: "模块播放控制" })) {
      await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    }
    await user.click(await screen.findByRole("button", { name: "播放听书模块" }));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: FIRST_TEST_AUDIOBOOK_SEGMENT,
        }),
      );
    });

    await user.click(
      await screen.findByRole("button", { name: "暂停听书模块" }),
    );

    expect(handlePause).toHaveBeenCalledTimes(1);
  });

  it("plays regular Bilibili videos through the direct audio controls", async () => {
    const media = mockHtmlMediaPlayback();
    const user = userEvent.setup();
    const loadDirectAudio = createBilibiliDirectAudioLoaderTestDouble();
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        bilibiliDirectAudioLoader={loadDirectAudio}
        player={createPlayerPortTestDouble().player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(screen.getByRole("button", { name: "打开听视频模块" }));

    expect(screen.getByRole("heading", { name: "听视频" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(loadDirectAudio).toHaveBeenCalledWith({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
    expect(
      await screen.findByRole("heading", { name: "视频测试标题" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("直连音频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.audioUrl,
    );
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();
    expect(screen.getByText("视频画面已隐藏")).toBeInTheDocument();
    expect(screen.getByText("02:00")).toBeInTheDocument();
    expect(screen.getByLabelText("视频章节")).toHaveValue("0");
    expect(screen.queryByLabelText("直连视频播放器")).not.toBeInTheDocument();
    expect(media.play).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "展开视频" }));

    expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.videoUrl,
    );

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));

    const videoModuleButton = await screen.findByRole("button", {
      name: "暂停听视频模块",
    });
    expect(videoModuleButton).toBeEnabled();
    expect(videoModuleButton).toHaveTextContent("暂停");
    expect(screen.getAllByText("播放中").length).toBeGreaterThan(0);
  });

  it("saves, replays, and deletes a favorite Bilibili video", async () => {
    mockHtmlMediaPlayback();
    const user = userEvent.setup();
    const fileSystem = createMemoryFileSystem();
    const loadDirectAudio = createBilibiliDirectAudioLoaderTestDouble();
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        bilibiliDirectAudioLoader={loadDirectAudio}
        fileSystem={fileSystem}
        player={createPlayerPortTestDouble().player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听视频" }));
    expect(await screen.findByText("还没有收藏视频")).toBeInTheDocument();

    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(
      await screen.findByRole("heading", { name: "视频测试标题" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "收藏视频" }));

    expect(await screen.findByText("已收藏 1 个视频")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已收藏" })).toBeInTheDocument();

    const favoriteList = screen.getByLabelText("已收藏视频");
    await user.click(
      within(favoriteList).getByRole("button", {
        name: "播放收藏 视频测试标题",
      }),
    );

    await waitFor(() => {
      expect(loadDirectAudio).toHaveBeenCalledTimes(2);
    });
    expect(loadDirectAudio).toHaveBeenLastCalledWith({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });

    await user.click(
      within(favoriteList).getByRole("button", {
        name: "删除收藏 视频测试标题",
      }),
    );

    expect(await screen.findByText("还没有收藏视频")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("已收藏视频")).queryByRole("button", {
        name: /视频测试标题/u,
      }),
    ).not.toBeInTheDocument();
  });

  it("saves a Bilibili creator and plays a refreshed latest video", async () => {
    mockHtmlMediaPlayback();
    const user = userEvent.setup();
    const loadDirectAudio = createBilibiliDirectAudioLoaderTestDouble();
    const loadCreatorVideos = vi.fn().mockResolvedValue({
      creator: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: "123456",
        name: "测试UP",
      },
      videos: [
        {
          bvid: "BV1xx411c7mD",
          coverUrl: "https://i0.hdslb.com/video.jpg",
          durationSeconds: 62,
          playCount: 1024,
          publishedAt: 1710000000,
          title: "最新助眠视频",
        },
      ],
    });
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        bilibiliCreatorVideosLoader={loadCreatorVideos}
        bilibiliDirectAudioLoader={loadDirectAudio}
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听视频" }));
    expect(await screen.findByText("还没有保存 UP 主")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("UP 主主页或 mid"),
      "https://space.bilibili.com/123456",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(loadCreatorVideos).toHaveBeenCalledWith("123456", 12);
    });
    expect(
      (await screen.findAllByText("测试UP")).length,
    ).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: /最新助眠视频/u }),
    );

    expect(loadDirectAudio).toHaveBeenCalledWith({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
    expect(screen.getByLabelText("直连音频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.audioUrl,
    );
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();
    expect(screen.getAllByText("最新助眠视频").length).toBeGreaterThan(0);
  });

  it("uses the floating global button to pause active modules", async () => {
    const user = userEvent.setup();
    const { player, stopAll } = createPlayerPortTestDouble();
    const { engine, handlePause } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        fileSystem={createMemoryFileSystem()}
        player={player}
        ttsEngine={engine}
      />,
    );

    await startAmbientSoundAndAudiobookPlayback(user);
    await user.click(screen.getByRole("button", { name: "暂停全部" }));

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(handlePause).toHaveBeenCalledTimes(1);
  });

  it("uses the floating global button to start idle modules except unloaded video", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    const { engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "播放全部" }));

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(3);
    });
    expect(speak).not.toHaveBeenCalled();
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();
  });

  it("collapses the floating panel when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));

    expect(
      screen.getByRole("region", { name: "模块播放控制" }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("梦伴"));

    expect(
      screen.queryByRole("region", { name: "模块播放控制" }),
    ).not.toBeInTheDocument();
  });

  it("collapses the floating timer panel when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    expect(
      screen.getByRole("region", { name: "定时停止设置" }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("梦伴"));

    expect(
      screen.queryByRole("region", { name: "定时停止设置" }),
    ).not.toBeInTheDocument();
  });

  it("retracts and restores the floating playback dock", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "收回悬浮播放控制" }));

    expect(screen.queryByText("播放全部")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "播放全部" }));

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(3);
    });
    expect(
      screen.queryByRole("button", { name: "展开模块播放控制" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "展开定时停止设置" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开悬浮播放控制" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开悬浮播放控制" }));

    expect(screen.getByRole("button", { name: "暂停全部" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开模块播放控制" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开定时停止设置" }),
    ).toBeInTheDocument();
  });

  it("switches between floating timer and module panels", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    expect(
      screen.getByRole("region", { name: "定时停止设置" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));

    expect(
      screen.getByRole("region", { name: "模块播放控制" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "定时停止设置" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    expect(
      screen.getByRole("region", { name: "定时停止设置" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "模块播放控制" }),
    ).not.toBeInTheDocument();
  });

  it("stops sounds, audiobook, and video when the sleep timer ends", async () => {
    mockHtmlMediaPlayback();
    const user = userEvent.setup();
    const loadDirectAudio = createBilibiliDirectAudioLoaderTestDouble();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    const { cancel, engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        bilibiliDirectAudioLoader={loadDirectAudio}
        fileSystem={createMemoryFileSystem()}
        player={player}
        ttsEngine={engine}
      />,
    );

    await startAmbientSoundAndAudiobookPlayback(user);
    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: FIRST_TEST_AUDIOBOOK_SEGMENT,
      }),
    );
    expect(screen.getByLabelText("直连音频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.audioUrl,
    );

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "展开定时停止设置" }));
    fireEvent.change(screen.getByLabelText("自定义"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    expect(screen.getByRole("timer")).toHaveTextContent("剩余 05:00");

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(screen.getByRole("timer")).toHaveTextContent("已停止全部播放");
    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("直连音频播放器")).not.toHaveAttribute("src");
  });

  it("supports timer presets and custom range in the floating timer panel", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    const timerPanel = screen.getByRole("region", { name: "定时停止设置" });
    expect(
      within(timerPanel).getByRole("button", { name: "15分钟" }),
    ).toBeInTheDocument();

    await user.click(
      within(timerPanel).getByRole("button", { name: "15分钟" }),
    );
    expect(within(timerPanel).getByLabelText("自定义")).toHaveValue("15");

    fireEvent.change(within(timerPanel).getByLabelText("自定义"), {
      target: { value: "7" },
    });
    expect(
      within(timerPanel).getByText("自定义 7 分钟"),
    ).toBeInTheDocument();
  });

  it("resets the workspace scroll position when switching modes", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AppWorkspace player={createPlayerPortTestDouble().player} />,
    );
    const shell = container.querySelector(".app-shell") as HTMLElement;
    shell.scrollTop = 420;
    document.documentElement.scrollTop = 420;
    document.body.scrollTop = 420;

    await user.click(screen.getByRole("button", { name: "听书" }));

    expect(shell.scrollTop).toBe(0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it("shows the scroll indicator only while the workspace is scrolling", () => {
    vi.useFakeTimers();
    const { container } = render(
      <AppWorkspace player={createPlayerPortTestDouble().player} />,
    );
    const shell = container.querySelector(".app-shell") as HTMLElement;
    Object.defineProperty(shell, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(shell, "scrollHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(shell, "scrollTop", {
      configurable: true,
      value: 80,
    });

    fireEvent.scroll(shell);

    const indicator = container.querySelector(".app-scroll-indicator");
    expect(indicator).toHaveClass("is-visible");

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(indicator).not.toHaveClass("is-visible");
  });
});
