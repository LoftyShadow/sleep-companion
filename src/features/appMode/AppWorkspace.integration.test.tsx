import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPlayerPortTestDouble,
  createTtsEngineTestDouble,
  mockHtmlMediaPlayback,
} from "../../test/audioTestDoubles";
import { createMinimalEpubFile } from "../../test/epubTestDoubles";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type { BilibiliAuthClient } from "../videoListening/bilibiliAuth";
import type { BilibiliDirectAudioLoader } from "../videoListening/bilibiliDirectAudio";
import { AppWorkspace } from "./AppWorkspace";

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
  coverUrl: "https://i0.hdslb.com/video-cover.jpg",
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

describe("AppWorkspace integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  function renderVideoWorkspace() {
    const bilibiliDirectAudioLoader = createBilibiliDirectAudioLoaderTestDouble();
    const user = userEvent.setup();
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        bilibiliDirectAudioLoader={bilibiliDirectAudioLoader}
        player={createPlayerPortTestDouble().player}
      />,
    );

    return { bilibiliDirectAudioLoader, user };
  }

  async function loadDirectAudioVideo(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    return screen.findByLabelText("直连音频播放器");
  }

  it("renders the built-in sound grid", () => {
    render(
      <AppWorkspace
        bilibiliAuthClient={createLoggedOutBilibiliAuthClient()}
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "白噪音" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "一键混音" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "入睡" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用预设雨夜放松" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 个组合")).toBeInTheDocument();
    expect(screen.getByText("添加自定义音频")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "大雨" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图书馆" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "伞下雨声" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "咖啡厅，场所，XMSLEEP" }),
    ).toBeInTheDocument();
    expect(screen.getByText("选文件后自动导入")).toBeInTheDocument();
    expect(screen.getByLabelText("添加自定义音频")).toBeInTheDocument();
  });

  it("saves, applies and deletes a custom sound preset", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace fileSystem={createMemoryFileSystem()} player={player} />);

    await user.click(screen.getByRole("button", { name: "篝火" }));
    fireEvent.change(screen.getByLabelText("篝火音量"), {
      target: { value: "23" },
    });
    await user.click(screen.getByRole("button", { name: "保存当前配置" }));

    expect(await screen.findByText("已保存为自定义配置")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "我的配置" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用配置我的配置 1" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "应用配置我的配置 1" }));

    await waitFor(() => {
      expect(stopAll).toHaveBeenCalledTimes(1);
      expect(play).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "campfire" }),
        0.23,
      );
    });

    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(await screen.findByText("已删除自定义配置")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "应用配置我的配置 1" }),
    ).not.toBeInTheDocument();
  });

  it("saves and applies one custom configuration across sound modes", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(
      <AppWorkspace fileSystem={createMemoryFileSystem()} player={player} />,
    );

    await user.click(screen.getByRole("button", { name: "篝火" }));
    fireEvent.change(screen.getByLabelText("篝火音量"), {
      target: { value: "24" },
    });

    await user.click(screen.getByRole("button", { name: "ASMR" }));
    expect(screen.getByRole("heading", { name: "我的配置" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "气泡声" }));
    fireEvent.change(screen.getByLabelText("气泡声音量"), {
      target: { value: "35" },
    });

    await user.click(screen.getByRole("button", { name: "其他声音" }));
    expect(screen.getByRole("heading", { name: "我的配置" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /雨声\s*17/u }));
    await user.click(
      screen.getByRole("button", { name: "小雨，雨声，XMSLEEP" }),
    );
    fireEvent.change(screen.getByLabelText("小雨，雨声，XMSLEEP音量"), {
      target: { value: "46" },
    });

    await user.click(screen.getByRole("button", { name: "白噪音" }));
    expect(screen.getByRole("heading", { name: "我的配置" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存当前配置" }));

    expect(await screen.findByText("已保存为自定义配置")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用配置我的配置 1" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "应用配置我的配置 1" }));

    await waitFor(() => {
      expect(stopAll).toHaveBeenCalledTimes(1);
      expect(play.mock.calls.slice(-3).map(([sound, volume]) => [
        sound.id,
        volume,
      ])).toEqual([
        ["campfire", 0.24],
        ["asmr_bubbles", 0.35],
        ["xmsleep_light_rain", 0.46],
      ]);
    });
  });

  it("uses the unified button to play and stop the default preset", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "播放预设" }));
    await user.click(await screen.findByRole("button", { name: "停止播放" }));

    expect(play).toHaveBeenCalledTimes(3);
    expect(stopAll).toHaveBeenCalledTimes(1);
  });

  it("applies grouped presets through the player port", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "应用预设图书馆专注" }));

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(3);
    expect(play.mock.calls.map(([sound]) => sound.id)).toEqual([
      "library",
      "keyboard",
      "clock",
    ]);
  });

  it("keeps a white-noise sound volume when starting an ASMR sound", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    fireEvent.change(screen.getByLabelText("大雨音量"), {
      target: { value: "73" },
    });
    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "ASMR" }));
    await user.click(screen.getByRole("button", { name: "轻柔掏耳" }));
    await user.click(screen.getByRole("button", { name: "白噪音" }));

    expect(play.mock.calls.map(([sound, volume]) => [sound.id, volume])).toEqual([
      ["heavy_rain", 0.73],
      ["asmr_ear_cleaning_soft", 0.5],
    ]);
    expect(screen.getByLabelText("大雨音量")).toHaveValue("73");
  });

  it("switches to the ASMR console and shows real ASMR sounds", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "ASMR" }));

    expect(
      screen.getByRole("heading", { name: "ASMR 控制台" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ASMR 预设" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用预设近耳清理" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "轻柔掏耳" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "气泡声" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "车顶雨点" }),
    ).toBeInTheDocument();
  });

  it("uses the unified button to play the default ASMR preset in ASMR mode", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "ASMR" }));
    await user.click(screen.getByRole("button", { name: "播放 ASMR" }));
    await user.click(await screen.findByRole("button", { name: "停止播放" }));

    expect(play.mock.calls.map(([sound]) => sound.id)).toEqual([
      "asmr_ear_cleaning_soft",
      "asmr_ear_cleaning_deep",
      "asmr_paper_rub",
    ]);
    expect(stopAll).toHaveBeenCalledTimes(2);
  });

  it("switches to other sounds and filters imported sounds by category", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "其他声音" }));

    expect(
      screen.getByRole("region", { name: "其他声音" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "声音分类" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "河流，自然，XMSLEEP" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "海浪，自然，XMSLEEP" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "救护车警笛，城市，XMSLEEP" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "键盘，物品，XMSLEEP" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "掏耳朵1，物品，XMSLEEP" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "咖啡厅，场所，XMSLEEP" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /城市\s*7/u }));

    expect(
      screen.getByRole("button", { name: "救护车警笛，城市，XMSLEEP" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "河流，自然，XMSLEEP" }),
    ).not.toBeInTheDocument();
  });

  it("uses the unified button to play the current other-sounds category", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "其他声音" }));
    await user.click(screen.getByRole("button", { name: /雨声\s*17/u }));
    await user.click(screen.getByRole("button", { name: "播放分类" }));
    await user.click(await screen.findByRole("button", { name: "停止播放" }));

    expect(play.mock.calls.map(([sound]) => sound.id)).toEqual([
      "xmsleep_light_rain",
      "xmsleep_rain_on_tent",
      "xmsleep_rain_on_leaves",
    ]);
    expect(stopAll).toHaveBeenCalledTimes(2);
  });

  it("switches to the audiobook view and speaks text through the TTS port", async () => {
    const user = userEvent.setup();
    const { engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));

    expect(screen.getByRole("heading", { name: "听书" })).toBeInTheDocument();
    expect(await screen.findByText("系统女声 · zh-CN")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("书稿文本"));
    await user.type(screen.getByLabelText("书稿文本"), "第一段。\n\n第二段。");
    await user.click(screen.getByRole("button", { name: "播放" }));

    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "第一段。",
        voiceId: "voice:default",
      }),
    );
  });

  it("imports an EPUB book as pre-segmented audiobook content", async () => {
    const user = userEvent.setup();
    const { engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.upload(
      screen.getByLabelText("导入听书书稿"),
      await createMinimalEpubFile(),
    );

    expect(await screen.findByText("已导入 测试 EPUB · 5 段")).toBeInTheDocument();
    expect(screen.queryByLabelText("书稿文本")).not.toBeInTheDocument();
    expect(screen.getByText("EPUB · 2 章 · 5 个朗读片段")).toBeInTheDocument();
    expect(screen.getByText("正在播放章节")).toBeInTheDocument();
    expect(screen.getByText("3 段 · 第 1 / 2 章")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "02第一段。" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /第一章\s+第一段。/u }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "选择章节，当前 第一章" }),
    );
    expect(screen.getByRole("listbox", { name: "章节列表" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /第一章.*3 段/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /第二章.*2 段/u }),
    ).toBeInTheDocument();
    expect(screen.queryByText("第三段。第四段。")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一章" }));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "第二章",
          voiceId: "voice:default",
        }),
      );
    });
    expect(
      screen.getByRole("button", { name: "选择章节，当前 第二章" }),
    ).toBeInTheDocument();
    expect(screen.getByText("第三段。第四段。")).toBeInTheDocument();
    expect(screen.queryByText("第一段。")).not.toBeInTheDocument();
  });

  it("imports an EPUB book dropped onto the audiobook import panel", async () => {
    const user = userEvent.setup();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
        ttsEngine={createTtsEngineTestDouble().engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));
    fireEvent.drop(screen.getByRole("region", { name: "导入书稿" }), {
      dataTransfer: {
        files: [await createMinimalEpubFile()],
      },
    });

    expect(await screen.findByText("已导入 测试 EPUB · 5 段")).toBeInTheDocument();
    expect(screen.queryByLabelText("书稿文本")).not.toBeInTheDocument();
    expect(screen.getByText("EPUB · 2 章 · 5 个朗读片段")).toBeInTheDocument();
  });

  it("imports multiple audiobook files into the bookshelf", async () => {
    const user = userEvent.setup();
    render(
      <AppWorkspace
        fileSystem={createMemoryFileSystem()}
        player={createPlayerPortTestDouble().player}
        ttsEngine={createTtsEngineTestDouble().engine}
      />,
    );
    const plainTextBook = new File(["第一本第一段。"], "第一本.txt", {
      type: "text/plain",
    });

    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.upload(screen.getByLabelText("导入听书书稿"), [
      plainTextBook,
      await createMinimalEpubFile(),
    ]);

    expect(
      await screen.findByText("已导入 2 本，当前打开 测试 EPUB"),
    ).toBeInTheDocument();
    expect(screen.getByText("第一本")).toBeInTheDocument();
    expect(screen.getByText("测试 EPUB")).toBeInTheDocument();
    expect(screen.getByText("2 本")).toBeInTheDocument();
  });

  it("loads a Bilibili link in the direct audio player", async () => {
    mockHtmlMediaPlayback();
    const { bilibiliDirectAudioLoader, user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    expect(screen.getByRole("heading", { name: "听视频" })).toBeInTheDocument();
    expect(screen.getByLabelText("视频或直播链接")).toHaveAttribute(
      "type",
      "text",
    );

    await user.type(
      screen.getByLabelText("视频或直播链接"),
      "https://www.bilibili.com/video/BV1xx411c7mD/",
    );
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(screen.getByText("已载入 BV BV1xx411c7mD")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "视频测试标题" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("视频测试标题 封面")).toHaveAttribute(
      "src",
      "https://i0.hdslb.com/video-cover.jpg",
    );
    expect(screen.getByAltText("视频测试标题 封面")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
    expect(bilibiliDirectAudioLoader).toHaveBeenCalledWith({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
    expect(screen.getByLabelText("直连音频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.audioUrl,
    );
    expect(screen.getByText("02:00")).toBeInTheDocument();
    expect(screen.getByLabelText("视频章节")).toHaveValue("0");
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();
  });

  it("shows a direct-mode unsupported message for Bilibili live rooms", async () => {
    const { bilibiliDirectAudioLoader, user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(
      screen.getByLabelText("视频或直播链接"),
      "https://live.bilibili.com/23058",
    );
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(
      screen.getAllByText("当前直连模式暂不支持直播间").length,
    ).toBeGreaterThan(0);
    expect(bilibiliDirectAudioLoader).not.toHaveBeenCalled();
    expect(screen.queryByTitle(/B 站直播播放器/u)).not.toBeInTheDocument();
  });

  it("controls regular Bilibili video playback through the direct audio element", async () => {
    const media = mockHtmlMediaPlayback();
    const { user } = renderVideoWorkspace();

    const audio = await loadDirectAudioVideo(user);
    expect(audio).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.audioUrl,
    );
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "暂停" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("收听音量")).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "暂停" }));

    expect(media.pause).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "播放" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "播放" }));

    expect(media.play).toHaveBeenCalledTimes(2);
  });

  it("controls Bilibili direct audio volume", async () => {
    mockHtmlMediaPlayback();
    const { user } = renderVideoWorkspace();

    const audio = await loadDirectAudioVideo(user);
    fireEvent.change(screen.getByLabelText("收听音量"), {
      target: { value: "35" },
    });

    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(audio).toHaveProperty("volume", 0.35);
  });

  it("keeps the direct video panel hidden by default and toggles it", async () => {
    mockHtmlMediaPlayback();
    const { user } = renderVideoWorkspace();

    await loadDirectAudioVideo(user);

    expect(screen.getByRole("heading", { name: "视频画面" })).toBeInTheDocument();
    expect(await screen.findByText("BV1xx411c7mD")).toBeInTheDocument();
    expect(screen.getByText("170001")).toBeInTheDocument();
    expect(screen.getByText("110002")).toBeInTheDocument();
    expect(screen.getAllByText("audio/mp4").length).toBeGreaterThan(0);
    expect(screen.getByText("128 kbps")).toBeInTheDocument();
    expect(screen.getByText("800 kbps")).toBeInTheDocument();
    expect(screen.getByText("1280 x 720")).toBeInTheDocument();
    expect(screen.getByText("视频画面已隐藏")).toBeInTheDocument();
    expect(screen.queryByLabelText("直连视频播放器")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开视频" }));

    expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.videoUrl,
    );

    await user.click(screen.getByRole("button", { name: "隐藏视频" }));

    expect(screen.getByText("视频画面已隐藏")).toBeInTheDocument();
    expect(screen.queryByLabelText("直连视频播放器")).not.toBeInTheDocument();
  });

  it("pastes a Bilibili link from the clipboard", async () => {
    const user = userEvent.setup();
    const readText = vi.fn().mockResolvedValue("BV1xx411c7mD");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.click(screen.getByRole("button", { name: "粘贴" }));

    expect(readText).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("视频或直播链接")).toHaveValue("BV1xx411c7mD");
  });
});
