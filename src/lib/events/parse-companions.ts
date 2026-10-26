// "Companions" (누구랑) is stored as a single free-text column (events.companions),
// but the form now offers a one-tap relationship chip picker. To avoid a schema
// change we still submit a plain string: selected relationship labels joined with
// ", ", plus an optional "기타: <text>" entry for anything custom. These two pure
// functions convert between that stored string and the picker's selection state,
// and are deliberately locale-agnostic (labels are passed in) so the same logic
// works no matter which language the chips are rendered in.

export type RelationKey =
  | "spouse"
  | "child"
  | "friend"
  | "parents"
  | "siblings"
  | "colleague"
  | "family"
  | "other";

export const RELATION_KEYS: RelationKey[] = [
  "spouse",
  "child",
  "friend",
  "parents",
  "siblings",
  "colleague",
  "family",
  "other",
];

export type RelationLabels = Record<RelationKey, string>;

export type ParsedCompanions = {
  selected: RelationKey[];
  other: string;
};

/**
 * Parses a stored `companions` string back into chip selection state.
 *
 * Handles three shapes of input:
 * - New-format chip labels (e.g. "배우자, 자녀") -> matched by exact label.
 * - New-format custom entry (e.g. "기타: 민수삼촌") -> matched by the "기타: " prefix.
 * - Old-format free text typed before this feature existed -> treated as leftover
 *   text and folded into `other` so nothing is silently lost on re-save.
 */
export function parseCompanions(text: string | null | undefined, labels: RelationLabels): ParsedCompanions {
  if (!text) return { selected: [], other: "" };

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const selected: RelationKey[] = [];
  const otherParts: string[] = [];
  const otherPrefix = `${labels.other}:`;

  for (const part of parts) {
    const relationKey = RELATION_KEYS.find(
      (key) => key !== "other" && (labels[key] === part || key === part.toLowerCase())
    );
    if (relationKey) {
      if (!selected.includes(relationKey)) selected.push(relationKey);
      continue;
    }

    if (part === labels.other) {
      if (!selected.includes("other")) selected.push("other");
      continue;
    }

    if (part.startsWith(otherPrefix)) {
      const rest = part.slice(otherPrefix.length).trim();
      if (rest) otherParts.push(rest);
      continue;
    }

    // Unrecognized text: either leftover from an old free-text entry, or a
    // stray comma-separated fragment. Preserve it under "기타" so it survives.
    otherParts.push(part);
  }

  const other = otherParts.join(", ");
  if (other && !selected.includes("other")) selected.push("other");

  return { selected, other };
}

/** Inverse of {@link parseCompanions}: builds the plain string actually submitted. */
export function formatCompanions(selected: RelationKey[], other: string, labels: RelationLabels): string {
  const trimmedOther = other.trim();
  const parts = selected.filter((key) => key !== "other").map((key) => labels[key]);

  // 기타 칩을 해제하면 입력해 둔 텍스트도 함께 빠진다.
  if (selected.includes("other")) {
    parts.push(trimmedOther ? `${labels.other}: ${trimmedOther}` : labels.other);
  }

  return parts.join(", ");
}
