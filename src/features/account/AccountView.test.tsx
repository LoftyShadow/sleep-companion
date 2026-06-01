import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountView } from "./AccountView";
import {
  AuthApiError,
  type PasswordLogin,
  type PasswordLoginResult,
} from "./authApi";

const LOGIN_RESULT: PasswordLoginResult = {
  accessToken: "access-token",
  accessTokenExpiresInSeconds: 900,
  refreshToken: "refresh-token",
  user: {
    displayName: "梦伴用户",
    email: "user@example.com",
    id: "739182738912312320",
  },
};

describe("AccountView", () => {
  it("submits trimmed credentials and renders the authenticated account", async () => {
    const user = userEvent.setup();
    const login: PasswordLogin = vi.fn(() => Promise.resolve(LOGIN_RESULT));
    render(<AccountView login={login} />);

    await user.type(screen.getByLabelText("邮箱"), " user@example.com ");
    await user.type(screen.getByLabelText("密码"), "secret123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
    });
    expect(await screen.findAllByText("已登录")).toHaveLength(2);
    expect(screen.getAllByText("梦伴用户")).toHaveLength(2);
    expect(screen.getAllByText("user@example.com")).toHaveLength(2);
  });

  it("validates the required email and minimum password length", async () => {
    const user = userEvent.setup();
    const login: PasswordLogin = vi.fn(() => Promise.resolve(LOGIN_RESULT));
    render(<AccountView login={login} />);

    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请输入邮箱");

    await user.type(screen.getByLabelText("邮箱"), "user@example.com");
    await user.type(screen.getByLabelText("密码"), "12345");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByRole("alert")).toHaveTextContent("密码至少 6 位");
    expect(login).not.toHaveBeenCalled();
  });

  it("renders the backend login error", async () => {
    const user = userEvent.setup();
    const login: PasswordLogin = vi.fn(() =>
      Promise.reject(
        new AuthApiError({
          code: "auth.invalid_credentials",
          message: "邮箱或密码错误",
          requestId: "req_invalid",
          status: 401,
        }),
      ),
    );
    render(<AccountView login={login} />);

    await user.type(screen.getByLabelText("邮箱"), "user@example.com");
    await user.type(screen.getByLabelText("密码"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "邮箱或密码错误",
    );
    expect(screen.getByRole("button", { name: "登录" })).toBeEnabled();
  });

  it("returns to the login form when switching accounts", async () => {
    const user = userEvent.setup();
    const login: PasswordLogin = vi.fn(() => Promise.resolve(LOGIN_RESULT));
    render(<AccountView login={login} />);

    await user.type(screen.getByLabelText("邮箱"), "user@example.com");
    await user.type(screen.getByLabelText("密码"), "secret123");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await user.click(await screen.findByRole("button", { name: "切换账号" }));

    expect(screen.getByLabelText("邮箱")).toHaveValue("user@example.com");
    expect(screen.getByLabelText("密码")).toHaveValue("");
  });
});
