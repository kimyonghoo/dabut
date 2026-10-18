// Persists the last-used login email in localStorage when the user opts in
// via the "remember email" (아이디 저장) checkbox on the login page. Only the
// email is ever stored — never the password.
export const REMEMBERED_EMAIL_KEY = "dabut.rememberedEmail";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;
type ClearableStorage = Pick<Storage, "removeItem">;

/** Reads the remembered email, if any. Returns null when absent or storage is unavailable. */
export function getRememberedEmail(storage: ReadableStorage = window.localStorage): string | null {
  try {
    return storage.getItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // storage unavailable (e.g. private browsing with storage disabled)
    return null;
  }
}

/** Saves the given email so it can pre-fill the login form next time. */
export function setRememberedEmail(email: string, storage: WritableStorage = window.localStorage): void {
  try {
    storage.setItem(REMEMBERED_EMAIL_KEY, email);
  } catch {
    // ignore
  }
}

/** Clears any previously remembered email. */
export function clearRememberedEmail(storage: ClearableStorage = window.localStorage): void {
  try {
    storage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // ignore
  }
}
