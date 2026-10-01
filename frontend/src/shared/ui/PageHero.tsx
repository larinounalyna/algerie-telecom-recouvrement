import AtLogo from "./AtLogo";
import { DOT_AR, DOT_FR } from "./BrandHeader";

interface PageHeroProps {
  title: string;
  subtitle?: string;
}

/** Institutional masthead + page title, reused by the selection screens. */
export default function PageHero({ title, subtitle }: PageHeroProps) {
  return (
    <div className="text-center mb-10 flex flex-col items-center">
      <AtLogo height={84} />
      <p className="mt-4 text-[15px] font-semibold text-brand">{DOT_FR}</p>
      <p className="font-arabic text-base text-muted" dir="rtl">{DOT_AR}</p>
      <div className="w-16 h-[3px] rounded-full bg-leaf mt-5 mb-5" />
      <h1 className="text-3xl font-semibold text-[#1b2338] tracking-tight">{title}</h1>
      {subtitle && <p className="text-base text-muted mt-2">{subtitle}</p>}
    </div>
  );
}
