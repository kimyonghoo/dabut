"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteAccount } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/client";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { buttonClass } from "@/components/ui/button";
import { errorClass, inputClass } from "@/components/ui/field";
import { Spinner } from "@/components/ui/submit-button";

export function DeleteAccount() {
  const t = useTranslations("account");
  const router = useProgressRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const confirmWord = t("confirmWord");
  const matches = confirmation.trim() === confirmWord;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  function handleDelete() {
    if (!matches) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(confirmation).catch(() => ({ ok: false as const, error: "failed" }));
      if (!result.ok) {
        setError(result.error === "confirmationMismatch" ? t("mismatch") : t("failed"));
        return;
      }
      // The server already removed the user; clear the local session too.
      await createClient().auth.signOut().catch(() => undefined);
      router.replace({ pathname: "/login", query: { toast: "accountDeleted" } });
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("danger", "w-full")}>
        <Trash2 aria-hidden className="size-4" strokeWidth={2} /> {t("deleteButton")}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(92vw,24rem)] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-expense/10 text-expense">
              <AlertTriangle aria-hidden className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold text-ink">
                {t("dialogTitle")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t("dialogBody")}</p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-muted">
            {t("typeToConfirm", { word: confirmWord })}
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={confirmWord}
              className={inputClass}
              disabled={pending}
            />
          </label>

          {error && (
            <p role="alert" className={errorClass}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={close} disabled={pending} className={buttonClass("secondary", "flex-1")}>
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!matches || pending}
              className={`${buttonClass("primary", "flex-1")} !bg-expense hover:!bg-expense/90`}
            >
              {pending ? <Spinner /> : <Trash2 aria-hidden className="size-4" strokeWidth={2} />}
              {t("confirmButton")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
