export function parseStartCommand(text: string): string | null {
  const match = /^\/start (\S+)$/.exec(text.trim());
  return match ? match[1] : null;
}
