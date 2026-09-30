import type { PaymentTranche } from "../../types";

interface Props {
  tranche: PaymentTranche;
  /** Tailwind classes of the "validated" pill (accent colour of the database). */
  validClass: string;
  /** false for databases whose versement table has no status column → the cell stays blank. */
  tracked?: boolean;
  className?: string;
}

/** Statut pill of one versement: En attente / Validé / Refusé (or nothing when the table has no status). */
export default function TrancheStatusBadge({ tranche: t, validClass, tracked = true, className = "text-[10px]" }: Props) {
  if (!tracked) return null;
  const refused = t.statut === "refuse";
  const cls = refused ? "bg-red-100 text-red-700" : t.valide ? validClass : "bg-gray-100 text-gray-500";
  return <span className={`px-2 py-0.5 rounded-full font-medium ${className} ${cls}`}>{refused ? "Refusé" : t.valide ? "Validé" : "En attente"}</span>;
}
