import { ReactNode } from "react";

/** Colour variants for SelectionCard: each keeps a distinct identity on an otherwise neutral card. */
export type SelectionCardVariant = "red" | "emerald" | "amber" | "blue";

const variantClasses: Record<SelectionCardVariant, { bar: string; badge: string; title: string }> = {
  red: { bar: "bg-brand", badge: "bg-brand", title: "group-hover:text-brand" },
  emerald: { bar: "bg-leaf", badge: "bg-leaf", title: "group-hover:text-leaf-dark" },
  amber: { bar: "bg-amber-500", badge: "bg-amber-500", title: "group-hover:text-amber-700" },
  blue: { bar: "bg-blue-600", badge: "bg-blue-600", title: "group-hover:text-blue-700" },
};

interface SelectionCardProps {
  variant: SelectionCardVariant;
  badgeLabel: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

/** Big clickable tile used on the Home and Client-type selection screens. */
export default function SelectionCard({ variant, badgeLabel, title, subtitle, onClick }: SelectionCardProps) {
  const c = variantClasses[variant];
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden flex items-center gap-5 py-7 px-7 text-left rounded-xl bg-white border border-border shadow-sm hover:shadow-md hover:border-border2 transition-shadow cursor-pointer"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${c.bar}`} />
      <div className={`w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-lg font-semibold ${c.badge}`}>
        {badgeLabel}
      </div>
      <div>
        <div className={`text-lg font-semibold text-[#1b2338] transition-colors ${c.title}`}>{title}</div>
        <div className="text-sm text-muted mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}
