import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { CategoryPicker, type PickerCategory } from "./category-picker";

vi.mock("@/lib/actions/categories", () => ({
  createCategory: vi.fn(),
}));
import { createCategory } from "@/lib/actions/categories";

const messages = {
  ledger: {
    category: "Category",
    addCategory: "+ Add",
    addCategorySubmit: "Add",
    categoryName: "Category name",
    categoryNamePlaceholder: "Category name",
    categoryNameRequired: "Enter a category name",
    categoryIcon: "Icon",
    addCategoryTitle: "Add category",
    categoryAddFirst: "Please tap Add to save the new category first",
    cancel: "Cancel",
  },
};

function renderInForm(onCreated: (c: PickerCategory) => void = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <form>
        <CategoryPicker type="expense" categories={[]} selectedId={undefined} onSelect={() => {}} onCreated={onCreated} />
        <button type="submit">Save</button>
      </form>
    </NextIntlClientProvider>
  );
  return document.querySelector("form") as HTMLFormElement;
}

// Regression test for the bug where opening the "+ Add" category modal,
// typing a name, and submitting the outer transaction form (without
// pressing the modal's own "Add" button first) silently discarded the
// typed category and saved under whatever chip was already selected.
describe("CategoryPicker outer-form submit interception", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks the outer form submit, shows an error, and focuses the modal's Add button when a typed name was never submitted", () => {
    const form = renderInForm();

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "책" } });

    let observedDefaultPrevented: boolean | null = null;
    form.addEventListener("submit", (event) => {
      observedDefaultPrevented = event.defaultPrevented;
      event.preventDefault(); // belt-and-suspenders: never let jsdom attempt real navigation
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(observedDefaultPrevented).toBe(true);
    expect(createCategory).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please tap Add to save the new category first");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add" }));
  });

  it("does not interfere with the outer form submit when the modal is closed", () => {
    const form = renderInForm();

    let observedDefaultPrevented: boolean | null = null;
    form.addEventListener("submit", (event) => {
      observedDefaultPrevented = event.defaultPrevented;
      event.preventDefault();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(observedDefaultPrevented).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not interfere with the outer form submit when the modal is open but the name field is empty", () => {
    const form = renderInForm();
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));

    let observedDefaultPrevented: boolean | null = null;
    form.addEventListener("submit", (event) => {
      observedDefaultPrevented = event.defaultPrevented;
      event.preventDefault();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(observedDefaultPrevented).toBe(false);
  });
});
