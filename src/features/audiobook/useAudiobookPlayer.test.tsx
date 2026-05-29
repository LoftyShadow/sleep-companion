import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  TtsEnginePort,
  TtsPlaybackHandle,
  TtsSpeakInput,
  TtsVoice,
} from "./TtsEnginePort";
import { useAudiobookPlayer } from "./useAudiobookPlayer";

function createTtsEngine(
  voices: TtsVoice[] = [
    {
      id: "voice:default",
      name: "系统女声",
      language: "zh-CN",
      isDefault: true,
      isLocal: true,
    },
  ],
  supportsPause = true,
) {
  const handleCancel = vi.fn();
  const handlePause = vi.fn();
  const handleResume = vi.fn();
  const handle: TtsPlaybackHandle = {
    cancel: handleCancel,
    pause: handlePause,
    resume: handleResume,
  };
  const cancel = vi.fn();
  const destroy = vi.fn();
  const isSupported = vi.fn(() => true);
  const listVoices = vi.fn(() => Promise.resolve(voices));
  let activeInput: TtsSpeakInput | null = null;
  const speak = vi.fn<TtsEnginePort["speak"]>((input) => {
    activeInput = input;
    return Promise.resolve(handle);
  });
  const engine: TtsEnginePort = {
    engineId: "test-system",
    label: "测试系统 TTS",
    supportsPause,
    isSupported,
    listVoices,
    speak,
    cancel,
    destroy,
  };

  return {
    activeInput: () => activeInput,
    complete() {
      activeInput?.onEnd?.();
    },
    cancel,
    engine,
    handleCancel,
    handlePause,
    handleResume,
    isSupported,
    speak,
  };
}

describe("useAudiobookPlayer", () => {
  it("loads voices and plays text segments continuously", async () => {
    const tts = createTtsEngine();
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "第一段。\n\n第二段。",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    expect(result.current.selectedVoiceId).toBeNull();
    expect(result.current.segments).toHaveLength(2);

    await act(async () => {
      await result.current.play();
    });

    expect(tts.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "zh-CN",
        text: "第一段。",
        voiceId: "voice:default",
      }),
    );
    expect(result.current.status).toBe("playing");

    act(() => {
      tts.complete();
    });

    await waitFor(() => {
      expect(tts.speak).toHaveBeenCalledTimes(2);
      expect(result.current.currentSegmentIndex).toBe(1);
    });

    act(() => {
      tts.complete();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ended");
    });
  });

  it("pauses, resumes and stops the active speech handle", async () => {
    const tts = createTtsEngine();
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "第一段。",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    await act(async () => {
      await result.current.play();
    });

    act(() => {
      result.current.pause();
    });

    expect(tts.handlePause).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("paused");

    act(() => {
      result.current.resume();
    });

    expect(tts.handleResume).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("playing");

    act(() => {
      result.current.stop();
    });

    expect(tts.handleCancel).toHaveBeenCalled();
    expect(tts.cancel).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("does not expose pause behavior for engines without pause support", async () => {
    const tts = createTtsEngine(undefined, false);
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "第一段。",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    await act(async () => {
      await result.current.play();
    });

    act(() => {
      result.current.pause();
    });

    expect(tts.handlePause).not.toHaveBeenCalled();
    expect(result.current.status).toBe("playing");
  });

  it("surfaces unsupported system TTS as an error state", async () => {
    const tts = createTtsEngine();
    tts.isSupported.mockReturnValue(false);
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "第一段。",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("当前环境不支持系统 TTS");
  });

  it("surfaces voice loading errors from native runtimes", async () => {
    const tts = createTtsEngine();
    tts.engine.listVoices = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          const rejectUnknown = reject as (reason: unknown) => void;
          rejectUnknown("command not allowed");
        }),
    );
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "第一段。",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    expect(result.current.errorMessage).toBe("command not allowed");
  });

  it("lets the system route Chinese speech when no matching voice is listed", async () => {
    const tts = createTtsEngine([
      {
        id: "voice:english",
        name: "English voice",
        language: "en-US",
        isDefault: true,
        isLocal: true,
      },
    ]);
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "雨声落在窗外。",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    expect(result.current.selectedVoiceId).toBeNull();

    await act(async () => {
      await result.current.play();
    });

    expect(tts.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "zh-CN",
        text: "雨声落在窗外。",
        voiceId: null,
      }),
    );
  });

  it("detects the speech language per segment before speaking", async () => {
    const tts = createTtsEngine([
      {
        id: "voice:zh",
        name: "中文 voice",
        language: "zh-CN",
        isDefault: true,
        isLocal: true,
      },
      {
        id: "voice:en",
        name: "English voice",
        language: "en-US",
        isDefault: false,
        isLocal: true,
      },
    ]);
    const { result } = renderHook(() =>
      useAudiobookPlayer({
        text: "雨声落在窗外。\n\nGood night.",
        engine: tts.engine,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingVoices).toBe(false);
    });

    await act(async () => {
      await result.current.play();
    });

    expect(tts.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({
        language: "zh-CN",
        text: "雨声落在窗外。",
        voiceId: "voice:zh",
      }),
    );

    act(() => {
      tts.complete();
    });

    await waitFor(() => {
      expect(tts.speak).toHaveBeenCalledTimes(2);
    });

    expect(tts.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({
        language: "en-US",
        text: "Good night.",
        voiceId: "voice:en",
      }),
    );
  });
});
