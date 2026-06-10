import { useEffect, useId, useRef, useState } from "react";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import { useBilibiliAuth } from "./useBilibiliAuth";

interface BilibiliLoginPanelProps {
  authClient?: BilibiliAuthClient;
  variant?: "panel" | "avatar";
}

function createQrImageUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export function BilibiliLoginPanel({
  authClient,
  variant = "panel",
}: BilibiliLoginPanelProps) {
  const cookieInputId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const [cookieText, setCookieText] = useState("");
  const [isCookieImportOpen, setIsCookieImportOpen] = useState(false);
  const [isLoginOptionsOpen, setIsLoginOptionsOpen] = useState(false);
  const {
    account,
    canSyncWebLogin,
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
  const isAvatarVariant = variant === "avatar";

  useEffect(() => {
    if (!isLoginOptionsOpen) {
      return undefined;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const panelElement = panelRef.current;
      if (!(event.target instanceof Node) || !panelElement) {
        return;
      }

      if (!panelElement.contains(event.target)) {
        setIsLoginOptionsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [isLoginOptionsOpen]);

  function handleCookieImport() {
    const normalizedCookieText = cookieText.trim();
    if (!normalizedCookieText) {
      return;
    }

    void importCookies(normalizedCookieText).then((isSuccess) => {
      if (isSuccess) {
        setCookieText("");
        setIsCookieImportOpen(false);
        setIsLoginOptionsOpen(false);
      }
    });
  }

  function handleLogout() {
    void logout().then(() => {
      setIsLoginOptionsOpen(false);
    });
  }

  function handleSyncWebLogin() {
    void syncWebLogin().then((isSuccess) => {
      if (isSuccess) {
        setIsLoginOptionsOpen(false);
      }
    });
  }

  const loginOptionsPanel =
    !isLoggedIn && isLoginOptionsOpen ? (
      <div className="bilibili-login-expanded" aria-label="B 站登录方式">
        {canSyncWebLogin ? (
          <div className="bilibili-login-primary-actions">
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
              onClick={handleSyncWebLogin}
            >
              {isSyncingWebLogin ? "同步中" : "同步登录"}
            </button>
          </div>
        ) : null}

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
      </div>
    ) : null;
  const accountActionsPanel =
    isLoggedIn && isLoginOptionsOpen ? (
      <div className="bilibili-account-actions" aria-label="B 站账号操作">
        <div className="bilibili-account-actions-copy">
          <strong>确认退出 B 站账号</strong>
          <span>{account?.name ?? statusMessage}</span>
        </div>
        <button
          className="bilibili-logout-button"
          type="button"
          disabled={isBusy}
          onClick={handleLogout}
        >
          {isLoggingOut ? "退出中" : "退出登录"}
        </button>
      </div>
    ) : null;
  const qrPanel =
    qr && !isLoggedIn ? (
      <div className="bilibili-login-qr" role="group" aria-label="B 站登录二维码">
        <img
          alt="B 站登录二维码"
          referrerPolicy="no-referrer"
          src={createQrImageUrl(qr.qrSvg)}
        />
        <p>{statusMessage}</p>
      </div>
    ) : null;
  const cookieImportPanel =
    isCookieImportOpen && !isLoggedIn ? (
      <div className="bilibili-cookie-import" role="group" aria-label="导入 B 站 Cookie">
        <label htmlFor={cookieInputId}>浏览器 Cookie</label>
        <textarea
          id={cookieInputId}
          name="bilibiliCookieText"
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
    ) : null;
  const expiredStatusPanel =
    loginState === "expired" ? (
      <p className="bilibili-login-status" role="status">
        二维码已过期
      </p>
    ) : null;
  const errorPanel = errorMessage ? (
    <p className="error-message bilibili-login-error" role="alert">
      {errorMessage}
    </p>
  ) : null;
  const hasAvatarPopover = Boolean(
    isAvatarVariant &&
      (accountActionsPanel ||
        loginOptionsPanel ||
        qrPanel ||
        cookieImportPanel ||
        expiredStatusPanel ||
        errorPanel),
  );
  const isCompactAvatarPopover = Boolean(
    isAvatarVariant &&
      accountActionsPanel &&
      !loginOptionsPanel &&
      !qrPanel &&
      !cookieImportPanel &&
      !expiredStatusPanel &&
      !errorPanel,
  );

  return (
    <section
      ref={panelRef}
      className={
        isAvatarVariant
          ? "bilibili-login-panel bilibili-login-panel-avatar"
          : "bilibili-login-panel"
      }
      aria-label="B 站登录"
    >
      <div className="bilibili-login-main">
        {isAvatarVariant ? (
          <button
            className="bilibili-login-avatar"
            type="button"
            aria-expanded={isLoginOptionsOpen}
            aria-label={isLoggedIn ? "B 站账号" : "登录 B 站"}
            disabled={isBusy}
            onClick={() => {
              setIsLoginOptionsOpen((current) => !current);
            }}
          >
            {account?.avatarUrl ? (
              <img alt="" referrerPolicy="no-referrer" src={account.avatarUrl} />
            ) : (
              "B"
            )}
          </button>
        ) : (
          <span className="bilibili-login-avatar" aria-hidden="true">
            {account?.avatarUrl ? (
              <img alt="" referrerPolicy="no-referrer" src={account.avatarUrl} />
            ) : (
              "B"
            )}
          </span>
        )}
        <div className="bilibili-login-copy">
          <strong>{account?.name ?? "B 站账号"}</strong>
          <span>{account ? "已登录" : statusMessage}</span>
        </div>
      </div>

      {!isAvatarVariant ? (
        <div className="bilibili-login-actions">
          {isLoggedIn ? (
            <button
              className="secondary-control-button bilibili-login-button"
              type="button"
              disabled={isBusy}
              aria-expanded={isLoginOptionsOpen}
              onClick={() => {
                setIsLoginOptionsOpen((current) => !current);
              }}
            >
              账号
            </button>
          ) : (
            <button
              className="custom-audio-button bilibili-login-button"
              type="button"
              disabled={isBusy}
              aria-expanded={isLoginOptionsOpen}
              onClick={() => {
                setIsLoginOptionsOpen((current) => !current);
              }}
            >
              登录
            </button>
          )}
        </div>
      ) : null}

      {isAvatarVariant ? (
        hasAvatarPopover ? (
          <div
            className={
              isCompactAvatarPopover
                ? "bilibili-login-popover bilibili-login-popover-compact"
                : "bilibili-login-popover"
            }
            aria-label="B 站登录操作"
          >
            {accountActionsPanel}
            {loginOptionsPanel}
            {qrPanel}
            {cookieImportPanel}
            {expiredStatusPanel}
            {errorPanel}
          </div>
        ) : null
      ) : (
        <>
          {accountActionsPanel}
          {loginOptionsPanel}
          {qrPanel}
          {cookieImportPanel}
          {expiredStatusPanel}
          {errorPanel}
        </>
      )}
    </section>
  );
}
