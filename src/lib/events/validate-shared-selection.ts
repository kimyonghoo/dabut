export function validateSharedSelection(
  isShared: boolean,
  connectionId: string | null
): { error: string } | null {
  if (isShared && !connectionId) {
    return { error: "Select a connection to share with" };
  }
  return null;
}
