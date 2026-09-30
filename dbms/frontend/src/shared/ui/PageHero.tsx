interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

/** Centered "Algérie Télécom / Big title / subtitle" block reused by the
 * selection screens (Home, Client-type). */
export default function PageHero({ eyebrow = "Algérie Télécom", title, subtitle }: PageHeroProps) {
  return (
    <div className="text-center mb-10">
      <p className="text-sm font-mono uppercase tracking-widest text-muted mb-3">{eyebrow}</p>
      <h1 className="text-5xl text-[#1C2235] leading-tight">{title}</h1>
      {subtitle && <p className="text-lg text-muted mt-3">{subtitle}</p>}
    </div>
  );
}
