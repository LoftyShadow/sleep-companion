import { useCallback, useEffect, useRef, useState } from "react";
import {
  bilibiliAuthClient,
  type BilibiliAuthAccount,
  type BilibiliAuthClient,
  type BilibiliLoginPollState,
  type BilibiliLoginQr,
} from "./bilibiliAuth";

const LOGIN_POLL_INTERVAL_MS = 2_000;

export interface UseBilibiliAuthState {
  account: BilibiliAuthAccount | null;
  errorMessage: string | null;
  isLoadingStatus: boolean;
  isLoggedIn: boolean;
  isLoggingOut: boolean;
  isRequestingQr: boolean;
  loginState: BilibiliLoginPollState | "idle";
  qr: BilibiliLoginQr | null;
  statusMessage: string;
  createLoginQr: () => Promise<void>;
  logout: () => Promise<void>;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallbackMessage;
}

function statusMessageForPollState(
  state: BilibiliLoginPollState,
  message?: string,
): string {
  switch (state) {
    case "error":
      return message ?? "B 站登录失败";
    case "expired":
      return "二维码已过期";
    case "pending":
      return "等待扫码确认";
    case "scanned":
      return "已扫码，请在 B 站客户端确认";
    case "success":
      return "B 站已登录";
  }
}

export function useBilibiliAuth(
  authClient: BilibiliAuthClient = bilibiliAuthClient,
): UseBilibiliAuthState {
  const [account, setAccount] = useState<BilibiliAuthAccount | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRequestingQr, setIsRequestingQr] = useState(false);
  const [loginState, setLoginState] =
    useState<UseBilibiliAuthState["loginState"]>("idle");
  const [qr, setQr] = useState<BilibiliLoginQr | null>(null);
  const [statusMessage, setStatusMessage] = useState("正在读取 B 站登录状态");
  const pollTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      setIsLoadingStatus(true);
      try {
        const status = await authClient.getStatus();
        if (!isMounted) {
          return;
        }

        setAccount(status.account ?? null);
        setStatusMessage(status.isLoggedIn ? "B 站已登录" : "未登录 B 站");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error, "读取 B 站登录状态失败"));
        setStatusMessage("B 站登录状态不可用");
      } finally {
        if (isMounted) {
          setIsLoadingStatus(false);
        }
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
      clearPollTimer();
      requestIdRef.current += 1;
    };
  }, [authClient, clearPollTimer]);

  const pollLoginQr = useCallback(
    (qrcodeKey: string, requestId: number) => {
      clearPollTimer();
      pollTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const result = await authClient.pollLoginQr(qrcodeKey);
            if (requestIdRef.current !== requestId) {
              return;
            }

            setLoginState(result.state);
            setStatusMessage(
              statusMessageForPollState(result.state, result.message),
            );
            setErrorMessage(result.state === "error" ? result.message ?? "B 站登录失败" : null);

            if (result.state === "success") {
              setAccount(result.account ?? null);
              setQr(null);
              clearPollTimer();
              return;
            }

            if (result.state === "expired" || result.state === "error") {
              clearPollTimer();
              return;
            }

            pollLoginQr(qrcodeKey, requestId);
          } catch (error) {
            if (requestIdRef.current !== requestId) {
              return;
            }

            setLoginState("error");
            setErrorMessage(getErrorMessage(error, "轮询 B 站登录状态失败"));
            setStatusMessage("B 站登录失败");
            clearPollTimer();
          }
        })();
      }, LOGIN_POLL_INTERVAL_MS);
    },
    [authClient, clearPollTimer],
  );

  const createLoginQr = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    clearPollTimer();
    setIsRequestingQr(true);
    setErrorMessage(null);
    setStatusMessage("正在获取 B 站登录二维码");

    try {
      const nextQr = await authClient.createLoginQr();
      if (requestIdRef.current !== requestId) {
        return;
      }

      setQr(nextQr);
      setLoginState("pending");
      setStatusMessage("等待扫码确认");
      pollLoginQr(nextQr.qrcodeKey, requestId);
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setLoginState("error");
      setErrorMessage(getErrorMessage(error, "获取 B 站登录二维码失败"));
      setStatusMessage("B 站登录失败");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsRequestingQr(false);
      }
    }
  }, [authClient, clearPollTimer, pollLoginQr]);

  const logout = useCallback(async () => {
    requestIdRef.current += 1;
    clearPollTimer();
    setIsLoggingOut(true);
    setErrorMessage(null);
    setStatusMessage("正在退出 B 站登录");

    try {
      await authClient.logout();
      setAccount(null);
      setLoginState("idle");
      setQr(null);
      setStatusMessage("未登录 B 站");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "退出 B 站登录失败"));
      setStatusMessage("退出 B 站登录失败");
    } finally {
      setIsLoggingOut(false);
    }
  }, [authClient, clearPollTimer]);

  return {
    account,
    createLoginQr,
    errorMessage,
    isLoadingStatus,
    isLoggedIn: Boolean(account),
    isLoggingOut,
    isRequestingQr,
    loginState,
    logout,
    qr,
    statusMessage,
  };
}
