import AtLogo from "./AtLogo";

export const DOT_FR = "Direction Opérationnelle des Télécommunications d'Alger Est";
export const DOT_AR = "المديرية العملياتية للاتصالات الجزائر شرق";

interface Props {
  /** Adds the logo plate on a dark background. */
  tone?: "light" | "dark";
  compact?: boolean;
}

/** Logo + institution name in French and Arabic, used on the selection screens and headers. */
export default function BrandHeader({ tone = "light", compact = false }: Props) {
  const dark = tone === "dark";
  return (
    <div className="flex items-center gap-4">
      <div className={dark ? "bg-white rounded-md px-3 py-1.5 shadow-sm flex-shrink-0" : "flex-shrink-0"}>
        <AtLogo height={compact ? 40 : 46} />
      </div>
      <div className={`leading-tight ${dark ? "text-white" : "text-brand"}`}>
        <div className={`font-semibold ${compact ? "text-[13px]" : "text-sm"}`}>{DOT_FR}</div>
        <div className={`font-arabic ${compact ? "text-[13px]" : "text-sm"} ${dark ? "text-white/80" : "text-muted"}`} dir="rtl">
          {DOT_AR}
        </div>
      </div>
    </div>
  );
}
