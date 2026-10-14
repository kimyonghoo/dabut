import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("toggles the html class between light and dark on click", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={{ theme: { light: "Light", dark: "Dark" } }}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ThemeToggle />
        </ThemeProvider>
      </NextIntlClientProvider>
    );

    expect(document.documentElement).toHaveClass("light");
    await user.click(screen.getByRole("button"));
    expect(document.documentElement).toHaveClass("dark");
  });
});
