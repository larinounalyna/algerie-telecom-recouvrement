import { ReactNode } from "react";

/**
 * Colour variants for SelectionCard. Add a new key here (and to
 * `variantClasses` below) instead of hand-rolling another
 * background / border / hover class string at the call site.
 */
export type SelectionCardVariant = "red" | "emerald" | "amber" | "blue";

interface VariantClasses {
  card: string;
  badge: string;
  title: string;
  subtitle: string;
}

const variantClasses: Record<SelectionCardVariant, VariantClasses> = {
  red: {
    card: "bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-500",
    badge: "bg-red-600 group-hover:bg-red-700",
    title: "text-red-800",
    subtitle: "text-red-600",
  },
  emerald: {
    card: "bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500",
    badge: "bg-emerald-600 group-hover:bg-emerald-700",
    title: "text-emerald-800",
    subtitle: "text-emerald-600",
  },
  amber: {
    card: "bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-500",
    badge: "bg-amber-500 group-hover:bg-amber-600",
    title: "text-amber-800",
    subtitle: "text-amber-600",
  },
  blue: {
    card: "bg-blue-50 border-blue-300 hover:bg-blue-100 hover:border-blue-500",
    badge: "bg-blue-600 group-hover:bg-blue-700",
    title: "text-blue-800",
    subtitle: "text-blue-600",
  },
};

interface SelectionCardProps {
  variant: SelectionCardVariant;
  /** Short text/initials shown inside the round badge, e.g. "HG", "EN". */
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
      className={`group flex flex-col items-center gap-4 py-10 px-8 rounded-2xl border-2 hover:shadow-lg transition-all cursor-pointer ${c.card}`}
    >
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-colors shadow-md ${c.badge}`}
      >
        {badgeLabel}
      </div>
      <div className="text-center">
        <div className={`text-xl ${c.title}`}>{title}</div>
        <div className={`text-sm ${c.subtitle}`}>{subtitle}</div>
      </div>
    </button>
  );
}
