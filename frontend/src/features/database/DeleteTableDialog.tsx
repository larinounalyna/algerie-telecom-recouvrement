import { useState } from "react";
import { ConfirmDialog } from "../../shared/ui";
import { DELETE_TABLES, describeDeleted, errorMessage } from "../../services";
import type { DeleteTableId } from "../../services";

export interface DeleteTableOption {
  id: DeleteTableId;
  /** Rows currently loaded in the screen (shown to the user), when known. */
  count?: number | null;
}

interface Props {
  options: readonly DeleteTableOption[];
  initial?: DeleteTableId;
  /** Called after a successful delete (reload the screen). */
  onChanged?: () => void | Promise<void>;
  /** Called once with the final message. */
  onDone: (msg: { ok: boolean; text: string }) => void;
  onClose: () => void;
}

const fr = (n: number) => n.toLocaleString("fr-FR");

/**
 * Pop-up "Vider une table": pick the table, read what else disappears with it, type the delete
 * password (same one as for deleting a versement) and tick the box. The pop-up stays open on any
 * failure (wrong password, locked out, server error) so the user can retry.
 */
export default function DeleteTableDialog({ options, initial, onChanged, onDone, onClose }: Props) {
  const [id, setId] = useState<DeleteTableId>(initial && options.some((o) => o.id === initial) ? initial : options[0].id);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = DELETE_TABLES[id];
  const count = options.find((o) => o.id === id)?.count;

  const confirm = async () => {
    if (busy || !password || !ack) return;
    setBusy(true);
    setError(null);
    try {
      const r = await spec.run(password);
      onDone({ ok: true, text: `Table ${spec.table} vidée : ${fr(r.deleted)} ligne(s) supprimée(s)${Object.keys(r.details).length > 1 ? ` (${describeDeleted(r)})` : ""}.` });
      await onChanged?.();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title="Vider une table ?"
      confirmLabel="Oui, tout supprimer"
      tone="danger"
      busy={busy}
      confirmDisabled={!password || !ack}
      autoFocusConfirm={false}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      {options.length > 1 && (
        <fieldset className="space-y-1.5" disabled={busy}>
          <legend className="text-xs font-medium text-gray-700 mb-1">Table à vider</legend>
          {options.map((o) => {
            const t = DELETE_TABLES[o.id];
            const on = o.id === id;
            return (
              <label
                key={o.id}
                className={`flex items-center justify-between gap-3 cursor-pointer rounded-lg border-2 px-3 py-1.5 transition-colors ${on ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <input
                  type="radio"
                  name="delete-table"
                  className="sr-only"
                  checked={on}
                  onChange={() => {
                    setId(o.id);
                    setError(null);
                  }}
                />
                <span>
                  <span className="block text-[#1C2235]">{t.title}</span>
                  <span className="block font-mono text-[11px] text-gray-500">{t.table}</span>
                </span>
                {typeof o.count === "number" && <span className="text-xs text-gray-500 whitespace-nowrap">{fr(o.count)} ligne(s)</span>}
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[13px] text-[#1C2235]">
        <span className="font-mono">{spec.table}</span> — {spec.title}
        {typeof count === "number" && (
          <>
            {" "}
            · <b>{fr(count)}</b> ligne(s) actuellement
          </>
        )}
      </div>
      <p>
        <b className="text-red-700">TOUTES</b> les lignes de cette table vont être supprimées. Cette action est <b>irréversible</b>.
      </p>
      {spec.cascade && <p className="text-red-700">{spec.cascade}</p>}

      <label className="block pt-1">
        <span className="block text-xs font-medium text-gray-700 mb-1">Mot de passe de suppression</span>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            autoFocus
            autoComplete="off"
            value={password}
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && void confirm()}
            aria-invalid={error ? true : undefined}
            className={`w-full rounded-lg border-2 pl-3 pr-11 py-2 text-sm text-gray-900 focus:outline-none ${error ? "border-red-400 bg-red-50" : "border-gray-300 focus:border-red-400"}`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            disabled={busy}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            {show ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </label>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={ack} disabled={busy} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600" />
        <span>Je comprends que ces données seront définitivement perdues.</span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
