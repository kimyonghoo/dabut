import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ConnectionManager } from "./connection-manager";
import {
  acceptConnectionInvitation,
  declineConnectionInvitation,
  cancelConnectionInvitation,
} from "@/lib/actions/connections";

vi.mock("@/lib/actions/connections", () => ({
  searchProfileByEmail: vi.fn(),
  sendConnectionInvitation: vi.fn(),
  acceptConnectionInvitation: vi.fn(),
  declineConnectionInvitation: vi.fn(),
  cancelConnectionInvitation: vi.fn(),
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
    decline: "Decline",
    cancelInvite: "Cancel invite",
    connectedWith: "Connected",
    duplicateInvite: "You already sent an invite to this person",
    pendingFromTarget: "They already invited you",
    alreadyConnected: "You're already connected",
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
        sentInvitations={[]}
        connections={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invitation not found or not pending");
  });

  it("removes a received invitation from the list after declining it", async () => {
    vi.mocked(declineConnectionInvitation).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithIntl(
      <ConnectionManager
        receivedInvitations={[{ id: "inv-1", inviterEmail: "a@example.com" }]}
        sentInvitations={[]}
        connections={[]}
      />
    );

    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(declineConnectionInvitation).toHaveBeenCalledWith("inv-1");
    await waitFor(() => expect(screen.queryByText("a@example.com")).not.toBeInTheDocument());
  });

  it("removes a sent invitation from the list after cancelling it", async () => {
    vi.mocked(cancelConnectionInvitation).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithIntl(
      <ConnectionManager
        receivedInvitations={[]}
        sentInvitations={[{ id: "inv-2", inviteeEmail: "b@example.com" }]}
        connections={[]}
      />
    );

    expect(screen.getByText("b@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel invite" }));

    expect(cancelConnectionInvitation).toHaveBeenCalledWith("inv-2");
    await waitFor(() => expect(screen.queryByText("b@example.com")).not.toBeInTheDocument());
  });

  it("shows the translated message when declining fails with a localized error code", async () => {
    vi.mocked(declineConnectionInvitation).mockResolvedValue({ error: "alreadyConnected" });
    const user = userEvent.setup();

    renderWithIntl(
      <ConnectionManager
        receivedInvitations={[{ id: "inv-1", inviterEmail: "a@example.com" }]}
        sentInvitations={[]}
        connections={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You're already connected");
    // The invitation stays listed since the decline did not actually succeed.
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
  });
});
