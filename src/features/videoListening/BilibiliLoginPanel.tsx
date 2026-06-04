import type { BilibiliAuthClient } from "./bilibiliAuth";
import { useBilibiliAuth } from "./useBilibiliAuth";

interface BilibiliLoginPanelProps {
  authClient?: BilibiliAuthClient;
}

function createQrImageUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export function BilibiliLoginPanel({ authClient }: BilibiliLoginPanelProps) {
  const {
    account,
    createLoginQr,
    errorMessage,
    isLoadingStatus,
    isLoggedIn,
    isLoggingOut,
    isRequestingQr,
    loginState,
    logout,
    qr,
    statusMessage,
  } = useBilibiliAuth(authClient);
  const isBusy = isLoadingStatus || isLoggingOut || isRequestingQr;

  return (
    <section className="bilibili-login-panel" aria-label="B 站登录">
      <div className="bilibili-login-main">
        <span className="bilibili-login-avatar" aria-hidden="true">
          {account?.avatarUrl ? (
            <img alt="" referrerPolicy="no-referrer" src={account.avatarUrl} />
          ) : (
            "B"
          )}
        </span>
        <div className="bilibili-login-copy">
          <strong>{account?.name ?? "B 站账号"}</strong>
          <span>
            {account ? `mid ${account.mid}` : statusMessage}
          </span>
        </div>
      </div>

      <div className="bilibili-login-actions">
        {isLoggedIn ? (
          <button
            className="secondary-control-button bilibili-login-button"
            type="button"
            disabled={isBusy}
            onClick={() => {
              void logout();
            }}
          >
            {isLoggingOut ? "退出中" : "退出登录"}
          </button>
        ) : (
          <button
            className="custom-audio-button bilibili-login-button"
            type="button"
            disabled={isBusy}
            onClick={() => {
              void createLoginQr();
            }}
          >
            {isRequestingQr ? "获取中" : qr ? "刷新二维码" : "扫码登录"}
          </button>
        )}
      </div>

      {qr && !isLoggedIn ? (
        <div className="bilibili-login-qr" role="group" aria-label="B 站登录二维码">
          <img
            alt="B 站登录二维码"
            referrerPolicy="no-referrer"
            src={createQrImageUrl(qr.qrSvg)}
          />
          <p>{statusMessage}</p>
        </div>
      ) : null}

      {!qr && isLoggedIn ? (
        <p className="bilibili-login-status" role="status">
          {statusMessage}
        </p>
      ) : null}

      {loginState === "expired" ? (
        <p className="bilibili-login-status" role="status">
          二维码已过期
        </p>
      ) : null}

      {errorMessage ? (
        <p className="error-message bilibili-login-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
