import { useId, useState } from "react";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import { useBilibiliAuth } from "./useBilibiliAuth";

interface BilibiliLoginPanelProps {
  authClient?: BilibiliAuthClient;
}

function createQrImageUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export function BilibiliLoginPanel({ authClient }: BilibiliLoginPanelProps) {
  const cookieInputId = useId();
  const [cookieText, setCookieText] = useState("");
  const [isCookieImportOpen, setIsCookieImportOpen] = useState(false);
  const {
    account,
    createLoginQr,
    errorMessage,
    importCookies,
    isImportingCookies,
    isLoadingStatus,
    isLoggedIn,
    isLoggingOut,
    isOpeningWebLogin,
    isRequestingQr,
    isSyncingWebLogin,
    loginState,
    logout,
    openWebLogin,
    qr,
    statusMessage,
    syncWebLogin,
  } = useBilibiliAuth(authClient);
  const isBusy =
    isLoadingStatus ||
    isLoggingOut ||
    isRequestingQr ||
    isOpeningWebLogin ||
    isSyncingWebLogin ||
    isImportingCookies;
  const canImportCookie = cookieText.trim().length > 0 && !isBusy;

  function handleCookieImport() {
    const normalizedCookieText = cookieText.trim();
    if (!normalizedCookieText) {
      return;
    }

    void importCookies(normalizedCookieText).then((isSuccess) => {
      if (isSuccess) {
        setCookieText("");
        setIsCookieImportOpen(false);
      }
    });
  }

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
          <>
            <button
              className="custom-audio-button bilibili-login-button"
              type="button"
              disabled={isBusy}
              onClick={() => {
                void openWebLogin();
              }}
            >
              {isOpeningWebLogin ? "打开中" : "网页登录"}
            </button>
            <button
              className="secondary-control-button bilibili-login-button"
              type="button"
              disabled={isBusy}
              onClick={() => {
                void syncWebLogin();
              }}
            >
              {isSyncingWebLogin ? "同步中" : "同步登录"}
            </button>
          </>
        )}
      </div>

      {!isLoggedIn ? (
        <div className="bilibili-login-methods" aria-label="其他登录方式">
          <button
            className="secondary-control-button bilibili-login-method-button"
            type="button"
            disabled={isBusy}
            onClick={() => {
              void createLoginQr();
            }}
          >
            {isRequestingQr ? "获取二维码中" : qr ? "刷新二维码" : "扫码登录"}
          </button>
          <button
            className="secondary-control-button bilibili-login-method-button"
            type="button"
            disabled={isBusy}
            aria-expanded={isCookieImportOpen}
            aria-controls={cookieInputId}
            onClick={() => {
              setIsCookieImportOpen((current) => !current);
            }}
          >
            Cookie 导入
          </button>
        </div>
      ) : null}

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

      {isCookieImportOpen && !isLoggedIn ? (
        <div className="bilibili-cookie-import" role="group" aria-label="导入 B 站 Cookie">
          <label htmlFor={cookieInputId}>浏览器 Cookie</label>
          <textarea
            id={cookieInputId}
            value={cookieText}
            spellCheck={false}
            autoComplete="off"
            placeholder="粘贴 Cookie 或 Set-Cookie 文本"
            onChange={(event) => {
              setCookieText(event.target.value);
            }}
          />
          <div className="bilibili-cookie-import-footer">
            <span>仅本地验证保存，不会在界面显示完整 Cookie。</span>
            <button
              className="custom-audio-button bilibili-login-button"
              type="button"
              disabled={!canImportCookie}
              onClick={handleCookieImport}
            >
              {isImportingCookies ? "导入中" : "导入登录"}
            </button>
          </div>
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
