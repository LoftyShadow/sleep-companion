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
} from "../../test/audioTestDoubles";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type { BilibiliAuthClient } from "../videoListening/bilibiliAuth";
import type { BilibiliDirectAudioLoader } from "../videoListening/bilibiliDirectAudio";
import { AppWorkspace } from "./AppWorkspace";

const TEST_AUDIOBOOK_TEXT = "用户自己的第一段。\n\n用户自己的第二段。";
const FIRST_TEST_AUDIOBOOK_SEGMENT = "用户自己的第一段。";
const TEST_BILIBILI_DIRECT_AUDIO_SOURCE = {
  aid: "170001",
  audioUrl: "/api/bilibili/audio-proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s",
  backupUrls: [],
  bandwidth: 128000,
  bvid: "BV1xx411c7mD",
  cid: "110002",
  codecs: "mp4a.40.2",
  coverUrl: "https://i0.hdslb.com/video.jpg",
  mimeType: "audio/mp4",
  title: "视频测试标题",
};

function createLoggedOutBilibiliAuthClient(): BilibiliAuthClient {
  return {
    createLoginQr: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({
      account: undefined,
      isLoggedIn: false,
    }),
    logout: vi.fn(),
    pollLoginQr: vi.fn(),
  };
}

function createBilibiliDirectAudioLoaderTestDouble(): BilibiliDirectAudioLoader {
  return vi.fn().mockResolvedValue(TEST_BILIBILI_DIRECT_AUDIO_SOURCE);
}

function mockHtmlMediaPlayback() {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(function mockPlay(this: HTMLMediaElement) {
      this.dispatchEvent(new Event("play"));

      return Promise.resolve();
    });
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(function mockPause(this: HTMLMediaElement) {
      this.dispatchEvent(new Event("pause"));
    });
  const load = vi
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});

  return { load, pause, play };
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
    expect(await screen.findByText("系统女声 · zh-CN")).toBeInTheDocument();

    await user.type(screen.getByLabelText("书稿文本"), TEST_AUDIOBOOK_TEXT);
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
    await user.type(screen.getByLabelText("书稿文本"), TEST_AUDIOBOOK_TEXT);
    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
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
    expect(await screen.findByText("视频测试标题")).toBeInTheDocument();
    expect(screen.getByLabelText("直连音频播放器")).toHaveAttribute(
      "src",
      TEST_BILIBILI_DIRECT_AUDIO_SOURCE.audioUrl,
    );
    expect(screen.queryByTitle(/B 站视频播放器/u)).not.toBeInTheDocument();
    expect(media.play).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));

    const videoModuleButton = await screen.findByRole("button", {
      name: "暂停听视频模块",
    });
    expect(videoModuleButton).toBeEnabled();
    expect(videoModuleButton).toHaveTextContent("暂停");
    expect(screen.getAllByText("播放中").length).toBeGreaterThan(0);
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

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.type(screen.getByLabelText("书稿文本"), TEST_AUDIOBOOK_TEXT);
    await user.click(screen.getByRole("button", { name: "播放" }));
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

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.type(screen.getByLabelText("书稿文本"), TEST_AUDIOBOOK_TEXT);
    await user.click(screen.getByRole("button", { name: "播放" }));
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
