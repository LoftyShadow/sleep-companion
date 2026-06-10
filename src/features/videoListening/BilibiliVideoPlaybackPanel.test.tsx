import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BilibiliVideoPlaybackPanel } from "./BilibiliVideoPlaybackPanel";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";

const TEST_DIRECT_AUDIO_SOURCE: BilibiliDirectAudioSource = {
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

const BACKUP_VIDEO_AUDIO_SOURCE: BilibiliDirectAudioSource = {
  ...TEST_DIRECT_AUDIO_SOURCE,
  videoBackupUrls: ["/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fbackup.m4s"],
  videoTracks: [
    {
      ...TEST_DIRECT_AUDIO_SOURCE.videoTracks[0],
      backupUrls: ["/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fbackup.m4s"],
      url: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fprimary.m4s",
    },
  ],
  videoUrl: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fprimary.m4s",
};

function renderVideoPlaybackPanel(
  audioSource: BilibiliDirectAudioSource = TEST_DIRECT_AUDIO_SOURCE,
  options: {
    currentTimeSeconds?: number;
    durationSeconds?: number;
  } = {},
) {
  const audio = document.createElement("audio");
  const onSeek = vi.fn();

  render(
    <BilibiliVideoPlaybackPanel
      audioRef={{ current: audio }}
      audioSource={audioSource}
      currentTimeSeconds={options.currentTimeSeconds ?? 0}
      durationSeconds={
        options.durationSeconds ?? audioSource.durationSeconds ?? 0
      }
      isAudioPlaying
      isLoading={false}
      onSeek={onSeek}
    />,
  );

  return { onSeek };
}

describe("BilibiliVideoPlaybackPanel", () => {
  async function renderExpandedBackupVideoPanel() {
    const user = userEvent.setup();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    renderVideoPlaybackPanel(BACKUP_VIDEO_AUDIO_SOURCE);

    await user.click(screen.getByRole("button", { name: "展开视频" }));
  }

  it("does not report interrupted video play attempts as unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
      function mockPlay(this: HTMLMediaElement) {
        if (this.tagName.toLowerCase() === "video") {
          return Promise.reject(
            new DOMException("播放请求被新的加载中断", "AbortError"),
          );
        }

        return Promise.resolve();
      },
    );
    renderVideoPlaybackPanel();

    await user.click(screen.getByRole("button", { name: "展开视频" }));

    await waitFor(() => {
      expect(
        screen.getByLabelText("直连视频播放器"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("视频画面暂不可用")).not.toBeInTheDocument();
  });

  it("switches to a backup video source when the current source errors", async () => {
    await renderExpandedBackupVideoPanel();

    expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
      "src",
      "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fprimary.m4s",
    );

    fireEvent.error(screen.getByLabelText("直连视频播放器"));

    await waitFor(() => {
      expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
        "src",
        "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fbackup.m4s",
      );
    });
    expect(screen.queryByText("视频画面暂不可用")).not.toBeInTheDocument();
  });

  it("collapses the video frame when every video source errors", async () => {
    await renderExpandedBackupVideoPanel();

    fireEvent.error(screen.getByLabelText("直连视频播放器"));

    await waitFor(() => {
      expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
        "src",
        "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fbackup.m4s",
      );
    });

    fireEvent.error(screen.getByLabelText("直连视频播放器"));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("直连视频播放器"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("已切回音频播放")).toBeInTheDocument();
    expect(
      screen.getByText("视频画面暂不可用，音频播放不受影响"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重试视频" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("tries the next quality and then collapses when video never renders a frame", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    try {
      renderVideoPlaybackPanel({
        ...TEST_DIRECT_AUDIO_SOURCE,
        videoTracks: [
          TEST_DIRECT_AUDIO_SOURCE.videoTracks[0],
          {
            backupUrls: [],
            bandwidth: 420000,
            codecs: "avc1.64001F",
            height: 480,
            id: "track-2",
            label: "480p · AVC · 420 kbps",
            mimeType: "video/mp4",
            url: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2F480p.m4s",
            width: 854,
          },
        ],
      });

      fireEvent.click(screen.getByRole("button", { name: "展开视频" }));

      expect(screen.getByLabelText("视频画质")).toHaveValue("track-1");
      expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
        "src",
        TEST_DIRECT_AUDIO_SOURCE.videoUrl,
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByLabelText("视频画质")).toHaveValue("track-2");
      expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
        "src",
        "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2F480p.m4s",
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(
        screen.queryByLabelText("直连视频播放器"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("已切回音频播放")).toBeInTheDocument();
      expect(
        screen.getByText("视频画面暂不可用，音频播放不受影响"),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the video frame expanded after rendered video data arrives", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    try {
      renderVideoPlaybackPanel();

      fireEvent.click(screen.getByRole("button", { name: "展开视频" }));
      const video = screen.getByLabelText("直连视频播放器");

      Object.defineProperty(video, "videoWidth", {
        configurable: true,
        value: 1280,
      });
      Object.defineProperty(video, "videoHeight", {
        configurable: true,
        value: 720,
      });
      Object.defineProperty(video, "readyState", {
        configurable: true,
        value: HTMLMediaElement.HAVE_CURRENT_DATA,
      });
      fireEvent.loadedData(video);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByLabelText("直连视频播放器")).toBeInTheDocument();
      expect(screen.getByText("画面显示中")).toBeInTheDocument();
      expect(
        screen.queryByText("视频画面暂不可用，音频播放不受影响"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("switches the direct video source when selecting another quality", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    renderVideoPlaybackPanel({
      ...TEST_DIRECT_AUDIO_SOURCE,
      videoTracks: [
        TEST_DIRECT_AUDIO_SOURCE.videoTracks[0],
        {
          backupUrls: [],
          bandwidth: 1800000,
          codecs: "avc1.640033",
          height: 2160,
          id: "track-2",
          label: "2160p · AVC · 1800 kbps",
          mimeType: "video/mp4",
          url: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2F4k.m4s",
          width: 3840,
        },
      ],
    });

    expect(screen.getByLabelText("视频画质")).toHaveValue("track-1");

    await user.click(screen.getByRole("button", { name: "展开视频" }));

    expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
      "src",
      TEST_DIRECT_AUDIO_SOURCE.videoUrl,
    );

    await user.selectOptions(screen.getByLabelText("视频画质"), "track-2");

    expect(screen.getByLabelText("视频画质")).toHaveValue("track-2");
    expect(screen.getByLabelText("直连视频播放器")).toHaveAttribute(
      "src",
      "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2F4k.m4s",
    );
    expect(screen.getByText("3840 x 2160")).toBeInTheDocument();
    expect(screen.getByText("1800 kbps")).toBeInTheDocument();
  });

  it("requests fullscreen for the expanded video frame", async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(HTMLDivElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    renderVideoPlaybackPanel();

    expect(screen.getByRole("button", { name: "全屏" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "展开视频" }));
    await user.click(await screen.findByRole("button", { name: "全屏" }));

    expect(requestFullscreen).toHaveBeenCalled();
  });

  it("seeks the direct audio source when dragging progress", () => {
    const { onSeek } = renderVideoPlaybackPanel(
      TEST_DIRECT_AUDIO_SOURCE,
      {
        currentTimeSeconds: 30,
        durationSeconds: 120,
      },
    );

    expect(screen.getByText("00:30")).toBeInTheDocument();
    expect(screen.getByText("02:00")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "播放进度" }), {
      target: { value: "45" },
    });

    expect(onSeek).toHaveBeenCalledWith(45);
  });

  it("seeks to chapter start time when selecting a chapter", async () => {
    const user = userEvent.setup();
    const { onSeek } = renderVideoPlaybackPanel(
      TEST_DIRECT_AUDIO_SOURCE,
      {
        currentTimeSeconds: 0,
        durationSeconds: 120,
      },
    );

    expect(screen.getByLabelText("视频章节")).toHaveValue("0");

    await user.selectOptions(screen.getByLabelText("视频章节"), "1");

    expect(onSeek).toHaveBeenCalledWith(60);
  });
});
