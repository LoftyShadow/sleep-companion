import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("submits the entered name to the Tauri greet command", async () => {
    mockIPC((cmd, payload) => {
      if (cmd !== "greet") {
        throw new Error(`Unexpected Tauri command: ${cmd}`);
      }

      const { name } = payload as { name: string };
      return `Hello, ${name}! You've been greeted from Rust!`;
    });

    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByPlaceholderText("Enter a name..."), "Ada");
    await user.click(screen.getByRole("button", { name: "Greet" }));

    expect(
      await screen.findByText("Hello, Ada! You've been greeted from Rust!"),
    ).toBeInTheDocument();
  });
});
