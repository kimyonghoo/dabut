import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ConnectionManager } from "./connection-manager";
import { acceptConnectionInvitation } from "@/lib/actions/connections";

vi.mock("@/lib/actions/connections", () => ({
  searchProfileByEmail: vi.fn(),
  sendConnectionInvitation: vi.fn(),
  acceptConnectionInvitation: vi.fn(),
}));

const messages = {
  connections: {
    searchLabel: "Find by email",
    searchPlaceholder: "email@example.com",
    searchButton: "Search",
    invite: "Invite",
    pendingReceived: "Received",
    pendingSent: "Sent",
    accept: "Accept",
    connectedWith: "Connected",
  },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ConnectionManager", () => {
  it("surfaces the error when accepting a no-longer-pending invitation", async () => {
    vi.mocked(acceptConnectionInvitation).mockResolvedValue({
      error: "invitation not found or not pending",
    });
    const user = userEvent.setup();

    renderWithIntl(
      <ConnectionManager
        receivedInvitations={[{ id: "inv-1", inviterEmail: "a@example.com" }]}
        connections={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invitation not found or not pending");
  });
});
