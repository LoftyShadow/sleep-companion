import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockHtmlMediaPlayback } from "../../test/audioTestDoubles";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type {
  BilibiliDirectAudioLoader,
  BilibiliDirectAudioSource,
} from "./bilibiliDirectAudio";
import { useVideoListeningController } from "./useVideoListeningController";

const TEST_DIRECT_AUDIO_SOURCE: BilibiliDirectAudioSource = {
  aid: "170001",
  audioUrl: "/api/bilibili/media-proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s",
  backupUrls: [],
  bandwidth: 128000,
  bvid: "BV1xx411c7mD",
  chapters: [],
  cid: "110002",
  codecs: "mp4a.40.2",
  coverUrl: "https://i0.hdslb.com/video.jpg",
  durationSeconds: 120,
  mimeType: "audio/mp4",
  title: "视频测试标题",
  videoBackupUrls: [],
  videoTracks: [],
};

interface ControllerHookProps {
  globalStopRequestId: number;
  playbackControlRequestId: number;
}

function renderControllerHook(
  props: ControllerHookProps = {
    globalStopRequestId: 0,
    playbackControlRequestId: 0,
  },
) {
  const directAudioLoader: BilibiliDirectAudioLoader = vi
    .fn()
    .mockResolvedValue(TEST_DIRECT_AUDIO_SOURCE);
  const fileSystem = createMemoryFileSystem();
  const renderedHook = renderHook(
    (hookProps: ControllerHookProps) =>
      useVideoListeningController({
        directAudioLoader,
        fileSystem,
        globalStopRequestId: hookProps.globalStopRequestId,
        playbackControlRequestId: hookProps.playbackControlRequestId,
      }),
    { initialProps: props },
  );
  const audio = document.createElement("audio");

  renderedHook.result.current.audioRef.current = audio;

  return {
    ...renderedHook,
    audio,
    directAudioLoader,
  };
}

async function loadDirectAudio(
  result: ReturnType<typeof renderControllerHook>["result"],
) {
  act(() => {
    result.current.setVideoInput("BV1xx411c7mD");
  });

  await act(async () => {
    await result.current.handleLoadVideo();
  });
}

describe("useVideoListeningController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("consumes each global stop request only once", async () => {
    const media = mockHtmlMediaPlayback();
    const { rerender, result } = renderControllerHook();

    await loadDirectAudio(result);

    expect(result.current.audioSource?.bvid).toBe("BV1xx411c7mD");
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(media.pause).not.toHaveBeenCalled();

    rerender({
      globalStopRequestId: 1,
      playbackControlRequestId: 0,
    });

    await waitFor(() => {
      expect(result.current.audioSource).toBeNull();
    });
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(result.current.videoMetadata).toBeNull();
    expect(result.current.currentFavoriteVideo).toBeNull();

    rerender({
      globalStopRequestId: 1,
      playbackControlRequestId: 0,
    });

    expect(media.pause).toHaveBeenCalledTimes(1);
  });

  it("consumes each playback control request only once", async () => {
    const media = mockHtmlMediaPlayback();
    const { rerender, result } = renderControllerHook();

    await loadDirectAudio(result);

    expect(media.play).toHaveBeenCalledTimes(1);
    expect(media.pause).not.toHaveBeenCalled();

    rerender({
      globalStopRequestId: 0,
      playbackControlRequestId: 0,
    });

    expect(media.play).toHaveBeenCalledTimes(1);
    expect(media.pause).not.toHaveBeenCalled();

    rerender({
      globalStopRequestId: 0,
      playbackControlRequestId: 1,
    });

    await waitFor(() => {
      expect(result.current.isDirectAudioPlaying).toBe(false);
    });
    expect(media.pause).toHaveBeenCalledTimes(1);

    rerender({
      globalStopRequestId: 0,
      playbackControlRequestId: 1,
    });

    expect(media.pause).toHaveBeenCalledTimes(1);

    rerender({
      globalStopRequestId: 0,
      playbackControlRequestId: 2,
    });

    await waitFor(() => {
      expect(result.current.isDirectAudioPlaying).toBe(true);
    });
    expect(media.play).toHaveBeenCalledTimes(2);

    rerender({
      globalStopRequestId: 0,
      playbackControlRequestId: 2,
    });

    expect(media.play).toHaveBeenCalledTimes(2);
  });
});
