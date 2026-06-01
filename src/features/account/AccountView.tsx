import { useId, useState, type FormEvent } from "react";
import {
  AuthApiError,
  loginWithPassword,
  registerWithPassword,
  type PasswordLogin,
  type PasswordLoginResult,
  type PasswordRegister,
} from "./authApi";
import "./AccountView.css";

interface AccountViewProps {
  login?: PasswordLogin;
  register?: PasswordRegister;
}

type LoginStatus = "idle" | "submitting" | "authenticated";
type AuthMode = "login" | "register";

const PASSWORD_MIN_LENGTH = 6;

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  return "登录失败，请稍后重试";
}

function getDisplayName(loginResult: PasswordLoginResult): string {
  return loginResult.user.displayName ?? loginResult.user.email;
}

export function AccountView({
  login = loginWithPassword,
  register = registerWithPassword,
}: AccountViewProps) {
  const emailInputId = useId();
  const passwordInputId = useId();
  const displayNameInputId = useId();
  const titleId = useId();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");
  const [loginResult, setLoginResult] = useState<PasswordLoginResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = loginStatus === "submitting";
  const isRegisterMode = authMode === "register";
  const submitLabel = isRegisterMode ? "注册并登录" : "登录";

  function handleModeChange(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setErrorMessage(null);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("请输入邮箱");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage("密码至少 6 位");
      return;
    }

    setErrorMessage(null);
    setLoginStatus("submitting");

    try {
      const nextLoginResult = isRegisterMode
        ? await register({
            displayName: displayName.trim() || undefined,
            email: trimmedEmail,
            password,
          })
        : await login({
            email: trimmedEmail,
            password,
          });
      setLoginResult(nextLoginResult);
      setPassword("");
      setLoginStatus("authenticated");
    } catch (error) {
      setLoginResult(null);
      setLoginStatus("idle");
      setErrorMessage(getLoginErrorMessage(error));
    }
  }

  function handleSwitchAccount() {
    setLoginResult(null);
    setLoginStatus("idle");
    setErrorMessage(null);
  }

  return (
    <div className="account-view">
      {errorMessage ? (
        <p className="error-message account-error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="account-layout">
        <section
          aria-labelledby={titleId}
          className="account-login-panel glass-panel"
        >
          <div className="account-heading">
            <p className="app-kicker">我的</p>
            <h1 className="account-title" id={titleId}>
              {isRegisterMode ? "注册" : "登录"}
            </h1>
          </div>

          {loginResult ? (
            <div className="account-signed-in" role="status">
              <div>
                <span className="account-state-pill">已登录</span>
                <h2>{getDisplayName(loginResult)}</h2>
                <p>{loginResult.user.email}</p>
              </div>
              <button
                className="secondary-control-button account-secondary-action"
                type="button"
                onClick={handleSwitchAccount}
              >
                切换账号
              </button>
            </div>
          ) : (
            <form
              className="account-login-form"
              onSubmit={(event) => {
                void handleLoginSubmit(event);
              }}
            >
              <div className="account-mode-switch" aria-label="账号操作">
                <button
                  aria-label="切换到登录"
                  aria-pressed={!isRegisterMode}
                  className={
                    isRegisterMode
                      ? "account-mode-button"
                      : "account-mode-button account-mode-button-active"
                  }
                  disabled={isSubmitting}
                  type="button"
                  onClick={() => {
                    handleModeChange("login");
                  }}
                >
                  登录
                </button>
                <button
                  aria-label="切换到注册"
                  aria-pressed={isRegisterMode}
                  className={
                    isRegisterMode
                      ? "account-mode-button account-mode-button-active"
                      : "account-mode-button"
                  }
                  disabled={isSubmitting}
                  type="button"
                  onClick={() => {
                    handleModeChange("register");
                  }}
                >
                  注册
                </button>
              </div>

              <label className="field-label" htmlFor={emailInputId}>
                邮箱
              </label>
              <input
                autoComplete="email"
                className="account-input"
                disabled={isSubmitting}
                id={emailInputId}
                inputMode="email"
                placeholder="user@example.com"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                }}
              />

              {isRegisterMode ? (
                <>
                  <label className="field-label" htmlFor={displayNameInputId}>
                    昵称
                  </label>
                  <input
                    autoComplete="name"
                    className="account-input"
                    disabled={isSubmitting}
                    id={displayNameInputId}
                    maxLength={64}
                    type="text"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.currentTarget.value);
                    }}
                  />
                </>
              ) : null}

              <label className="field-label" htmlFor={passwordInputId}>
                密码
              </label>
              <input
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                className="account-input"
                disabled={isSubmitting}
                id={passwordInputId}
                minLength={PASSWORD_MIN_LENGTH}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                }}
              />

              <button
                className="custom-audio-button account-login-button"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? `${submitLabel}中` : submitLabel}
              </button>
            </form>
          )}
        </section>

        <section className="account-status-panel glass-panel" aria-label="账号状态">
          <span
            className={
              loginResult
                ? "account-state-pill account-state-pill-active"
                : "account-state-pill"
            }
          >
            {loginResult ? "已登录" : "未登录"}
          </span>
          <h2>{loginResult ? getDisplayName(loginResult) : "访客"}</h2>
          <p>{loginResult?.user.email ?? "登录后显示账号信息"}</p>
        </section>
      </div>
    </div>
  );
}
