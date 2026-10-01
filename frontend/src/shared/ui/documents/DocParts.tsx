import { ReactNode } from "react";
import AtLogo from "../AtLogo";

const NAVY = "#1b2a78";

/** A4 sheet. `dir` flips the whole page for Arabic documents. */
export function DocSheet({ children, dir = "ltr" }: { children: ReactNode; dir?: "ltr" | "rtl" }) {
  return (
    <div className="doc-sheet" dir={dir}>
      {children}
    </div>
  );
}

/** "Algérie – Télécom « S P A »" letterhead used by the engagement and the attestation. */
export function SpaLetterhead() {
  return (
    <div dir="ltr">
      <div className="relative min-h-[64px]">
        <div className="absolute left-0 top-0">
          <AtLogo height={58} />
        </div>
        <div className="text-center pt-1" style={{ color: NAVY }}>
          <p className="text-[17px] italic font-semibold">Algérie – Télécom « S P A »</p>
          <p className="text-[14px] italic font-semibold mt-2.5">
            EPE / SPA Au Capital Social de <b>115.000.000.000 DA</b> &nbsp;&nbsp; R.C &nbsp;<b>02 B 18083</b>
          </p>
        </div>
      </div>
      <hr className="doc-rule" />
      <div className="text-center mt-3 space-y-1.5 italic font-semibold text-[14.5px]">
        <p className="doc-underline">Direction Opérationnelle des Télécommunications d'Alger Est</p>
        <p className="doc-underline">Département – Finance &amp; Comptabilité</p>
        <p className="doc-underline">Service – Recouvrement</p>
      </div>
    </div>
  );
}

/** Siège social footer, pinned to the bottom of the sheet. */
export function SpaFooter() {
  return (
    <div dir="ltr" className="mt-auto pt-6" style={{ color: NAVY }}>
      <hr className="doc-rule" />
      <p className="italic font-semibold text-[13.5px] mt-2">
        Siège Social, Route Nationale N° 05 &nbsp;&nbsp;Cinq Maisons &nbsp;&nbsp;Mohammadia 16211 Alger
      </p>
      <div className="flex justify-between italic font-semibold text-[13.5px]">
        <span>Tél : 021 – 82 – 38 – 38</span>
        <span>Fax : 021 – 82 – 38 – 39</span>
      </div>
    </div>
  );
}

/** Bilingual letterhead used by the invitation and the mise en demeure (logo + Arabic company block + DOT title). */
export function BilingualLetterhead() {
  return (
    <div>
      <div className="flex items-start justify-between gap-6" dir="ltr">
        <AtLogo height={62} />
        <div className="doc-ar text-[15px] font-bold leading-[1.75] text-right flex-1" style={{ color: "#000" }}>
          <p>مؤسسة عمومية اقتصادية شركة ذات أسهم برأسمال قدره 000 000 000 115 دج</p>
          <p>رقم السجل التجاري 18083 ب 02</p>
          <p>الكائن مقرها الاجتماعي طريق الوطني رقم 05 الدبار الخمس المحمدية 16130 الجزائر</p>
        </div>
      </div>
      <hr className="doc-rule" />
      <p className="doc-ar text-center text-[19px] font-bold doc-underline mt-2 mb-4">المديرية العملياتية للاتصالات الجزائر شرق</p>
    </div>
  );
}

export function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex gap-1.5 text-[13px] leading-[1.7]" dir="ltr">
      <span className="font-semibold whitespace-nowrap">{label} :</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export const blank = <span className="doc-blank" />;
