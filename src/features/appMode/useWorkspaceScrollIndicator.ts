import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface ScrollIndicatorState {
  isVisible: boolean;
  thumbHeight: number;
  thumbOffset: number;
}

const hiddenScrollIndicator: ScrollIndicatorState = {
  isVisible: false,
  thumbHeight: 0,
  thumbOffset: 0,
};

function getScrollIndicatorState(shell: HTMLElement): ScrollIndicatorState {
  const scrollableHeight = shell.scrollHeight - shell.clientHeight;
  if (scrollableHeight <= 0) {
    return hiddenScrollIndicator;
  }

  const trackHeight = Math.max(shell.clientHeight - 16, 1);
  const thumbHeight = Math.max(
    48,
    Math.round((shell.clientHeight / shell.scrollHeight) * trackHeight),
  );
  const maxThumbOffset = Math.max(trackHeight - thumbHeight, 0);
  const thumbOffset = Math.round(
    (shell.scrollTop / scrollableHeight) * maxThumbOffset,
  );

  return {
    isVisible: true,
    thumbHeight,
    thumbOffset,
  };
}

function resetWorkspaceScroll(shell: HTMLElement | null): void {
  if (shell) {
    shell.scrollTop = 0;
  }

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  if (window.scrollY > 0) {
    window.scrollTo?.({ left: 0, top: 0, behavior: "auto" });
  }
}

export function useWorkspaceScrollIndicator() {
  const shellRef = useRef<HTMLElement>(null);
  const scrollHideTimerRef = useRef<number | null>(null);
  const [scrollIndicator, setScrollIndicator] = useState<ScrollIndicatorState>(
    hiddenScrollIndicator,
  );

  const clearScrollHideTimer = useCallback(() => {
    if (scrollHideTimerRef.current !== null) {
      window.clearTimeout(scrollHideTimerRef.current);
      scrollHideTimerRef.current = null;
    }
  }, []);

  const resetScrollPosition = useCallback(() => {
    resetWorkspaceScroll(shellRef.current);
    clearScrollHideTimer();
    setScrollIndicator(hiddenScrollIndicator);

    const scheduleScrollReset =
      window.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    scheduleScrollReset(() => {
      resetWorkspaceScroll(shellRef.current);
    });
  }, [clearScrollHideTimer]);

  const handleShellScroll = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    setScrollIndicator(getScrollIndicatorState(shell));
    clearScrollHideTimer();

    scrollHideTimerRef.current = window.setTimeout(() => {
      setScrollIndicator((current) => ({
        ...current,
        isVisible: false,
      }));
      scrollHideTimerRef.current = null;
    }, 900);
  }, [clearScrollHideTimer]);

  useEffect(
    () => () => {
      clearScrollHideTimer();
    },
    [clearScrollHideTimer],
  );

  const scrollIndicatorStyle = {
    "--scroll-thumb-height": `${scrollIndicator.thumbHeight}px`,
    "--scroll-thumb-offset": `${scrollIndicator.thumbOffset}px`,
  } as CSSProperties;

  return {
    handleShellScroll,
    resetScrollPosition,
    scrollIndicator,
    scrollIndicatorStyle,
    shellRef,
  };
}

