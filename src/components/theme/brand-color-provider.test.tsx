import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandColorProvider, useBrandColor } from "./brand-color-provider";

function Probe() {
  const { brandColor, setBrandColor } = useBrandColor();
  return (
    <button onClick={() => setBrandColor("#00FF00")}>{brandColor}</button>
  );
}

describe("BrandColorProvider", () => {
  it("sets the --brand-color CSS variable from initialColor on mount", () => {
    render(
      <BrandColorProvider initialColor="#FF6F61">
        <Probe />
      </BrandColorProvider>
    );
    expect(document.documentElement.style.getPropertyValue("--brand-color")).toBe("#FF6F61");
  });

  it("updates the CSS variable and context value when setBrandColor is called", () => {
    render(
      <BrandColorProvider initialColor="#FF6F61">
        <Probe />
      </BrandColorProvider>
    );
    act(() => screen.getByRole("button").click());
    expect(document.documentElement.style.getPropertyValue("--brand-color")).toBe("#00FF00");
    expect(screen.getByRole("button")).toHaveTextContent("#00FF00");
  });
});
