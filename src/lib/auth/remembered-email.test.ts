import { describe, expect, it, vi } from "vitest";
import { REMEMBERED_EMAIL_KEY, clearRememberedEmail, getRememberedEmail, setRememberedEmail } from "./remembered-email";

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

describe("remembered email", () => {
  it("returns null when nothing has been saved", () => {
    const storage = fakeStorage();
    expect(getRememberedEmail(storage)).toBeNull();
  });

  it("saves and reads back the email under the namespaced key", () => {
    const storage = fakeStorage();
    setRememberedEmail("person@example.com", storage);
    expect(storage.store.get(REMEMBERED_EMAIL_KEY)).toBe("person@example.com");
    expect(getRememberedEmail(storage)).toBe("person@example.com");
  });

  it("clears a previously saved email", () => {
    const storage = fakeStorage({ [REMEMBERED_EMAIL_KEY]: "person@example.com" });
    clearRememberedEmail(storage);
    expect(getRememberedEmail(storage)).toBeNull();
  });

  it("never touches any key other than the namespaced one", () => {
    const storage = fakeStorage({ other: "untouched" });
    setRememberedEmail("person@example.com", storage);
    clearRememberedEmail(storage);
    expect(storage.store.get("other")).toBe("untouched");
  });

  it("swallows storage errors instead of throwing", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("disabled");
      }),
      setItem: vi.fn(() => {
        throw new Error("disabled");
      }),
      removeItem: vi.fn(() => {
        throw new Error("disabled");
      }),
    };
    expect(getRememberedEmail(storage)).toBeNull();
    expect(() => setRememberedEmail("x@example.com", storage)).not.toThrow();
    expect(() => clearRememberedEmail(storage)).not.toThrow();
  });
});
