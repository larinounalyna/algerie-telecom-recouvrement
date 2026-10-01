import { TVA_RATE, splitTTC } from "../../shared/lib/tva";
import type { FactureData } from "../../types";
import { DocSheet } from "../../shared/ui/documents/DocParts";
import AtLogo from "../../shared/ui/AtLogo";
import { fmtDate } from "../../shared/lib/format";

const num = (n: number | undefined) =>
  n === undefined || n === null ? "" : new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\u202f/g, " ");

const ordinal = (n: number) => (n === 1 ? "1er" : `${n}ème`);

/** One label (FR, left) · value (centre) · label (AR, right) line of the facture. */
function Line({ fr, ar, value }: { fr: string; ar: string; value?: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.25fr_1fr] items-baseline text-[14px] leading-[1.75]" dir="ltr">
      <span>{fr} :</span>
      <span className="text-center font-bold text-[13.5px]">{value}</span>
      <span className="doc-ar text-right text-[14px]">{ar} :</span>
    </div>
  );
}

function Masthead() {
  const rows: [string, string, boolean][] = [
    ["ALGERIE TELECOM", "اتصالات الجزائر", true],
    ["DIRECTION TERRITORIALE", "المديرية الإقليمية", false],
    ["ALGER", "", true],
  ];
  return (
    <div dir="ltr">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        <div className="text-[13px] leading-[1.6]">
          {rows.map(([fr, , b], i) => (
            <p key={i} className={b ? "font-bold" : ""}>{fr}</p>
          ))}
        </div>
        <AtLogo height={56} />
        <div className="doc-ar text-right text-[13.5px] leading-[1.7]">
          <p className="font-bold">اتصالات الجزائر</p>
          <p>المديرية الإقليمية</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mt-3 text-[13px] leading-[1.6]">
        <div>
          <p>UNITE OPERATIONNELLE DES</p>
          <p>TELECOMMUNICATIONS DE LA</p>
          <p>WILAYA D'ALGER</p>
          <p className="font-bold">UOT EST</p>
        </div>
        <div className="doc-ar text-right text-[13.5px] leading-[1.9]">
          <p>الوحدة العملية للاتصالات ولاية الجزائر</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mt-3 text-[13px] leading-[1.6]">
        <div>
          <p>BUREAU DU RECOUVREMENT ET DU</p>
          <p>CONTENTIEUX</p>
          <p className="mt-2">Tél : 021 77 38 34</p>
        </div>
        <div className="doc-ar text-right text-[13.5px] leading-[1.9]">
          <p>مكتب التحصيل و المنازعات</p>
          <p className="mt-2">الهاتف : 021 77 38 34</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Facture « Contentieux — Versement partiel » — same layout as the paper original:
 * bilingual masthead, FR/AR labelled lines, then the detachable « talon de paiement ».
 */
export default function FactureSheet({ data }: { data: FactureData }) {
  const isReceipt = !!data.isReceipt;
  const ttc = data.montantTTC ?? data.montantDu;
  const tva =
    data.tvaAmount !== undefined
      ? data.tvaAmount
      : data.tvaRate !== undefined && data.montantTTC !== undefined
        ? splitTTC(data.montantTTC, data.tvaRate).tva
        : undefined;
  const ht = data.montantHT !== undefined ? data.montantHT : tva !== undefined ? Math.round((ttc - tva) * 100) / 100 : undefined;
  const rate =
    data.tvaRate !== undefined ? data.tvaRate : ht && tva !== undefined ? Math.round((tva / ht) * 100) : TVA_RATE;

  const partial = data.billType === "partielle";
  const vp = partial ? `${ordinal(data.rang ?? 1)} VP` : "Règlement global";
  const subtitleFr = partial ? "Versement partiel" : "Règlement global";
  const client = [data.nom, data.prenom].filter(Boolean).join(" ");
  const numClient = data.numClient || data.numIdentifiant;
  const numAbonnement = data.telephone || data.numIdentifiant;
  const localite = [data.commune, data.wilaya].filter(Boolean).join(" — ");

  const figures = (
    <>
      <Line fr="Montant HT" ar="المجموع (خ ر)" value={num(ht)} />
      <Line fr={`TVA ${rate}%`} ar={`رسم القيمة المضافة ${rate}%`} value={num(tva)} />
      <Line fr="Total TTC" ar="المبلغ الإجمالي للدفع" value={num(ttc)} />
    </>
  );

  return (
    <DocSheet>
      <Masthead />

      <p className="text-[13px] mt-4">{vp}</p>

      <div className="text-center mt-1 mb-3 relative">
        <div className="flex items-baseline justify-center gap-10 italic text-[26px] leading-tight">
          <span className="doc-underline">FACTURE</span>
          <span className="doc-ar not-italic text-[22px] doc-underline">فاتورة</span>
        </div>
        <div className="flex items-baseline justify-center gap-8 italic text-[19px]">
          <span>Contentieux</span>
          <span className="doc-ar not-italic text-[17px]">المنازعات</span>
        </div>
        <div className="italic text-[17px] tracking-[0.22em] mt-1">{subtitleFr}</div>
        {isReceipt && (
          <div
            className="absolute right-0 top-2 border-[3px] border-[#233e83] text-[#233e83] px-3 py-0.5 text-[13px] font-bold tracking-widest"
            style={{ transform: "rotate(-5deg)" }}
          >
            ✓ VERSEMENT VALIDÉ
          </div>
        )}
      </div>

      <div className="mt-2">
        <Line fr="Mme-Melle-Mr" ar="الأنسة - السيد (ة)" value={client} />
        <Line fr="Adresse" ar="العنوان" value={data.adresse} />
        <Line fr="Localité" ar="المنطقة" value={localite} />
      </div>
      <div className="mt-4">
        <Line fr="Numéro du Client" ar="رقم الزبون" value={numClient} />
        <Line fr="Numéro d'Abonnement" ar="رقم الاشتراك" value={numAbonnement} />
        <Line fr="Date de Résiliation" ar="تاريخ الإلغاء" value={data.dateResiliation} />
      </div>
      <div className="mt-4">{figures}</div>

      {partial && (
        <div className="mt-3 ml-[20%] mr-[20%] border border-black px-4 py-1.5 text-[13.5px]" dir="ltr">
          <div className="flex justify-between"><span>Montant du versement ({fmtDate(data.datePaiement)})</span><b>{num(data.montantVerse)}</b></div>
          <div className="flex justify-between"><span>Reste à payer</span><b>{num(data.reste)}</b></div>
        </div>
      )}

      <p className="text-[12.5px] mt-5 leading-snug" dir="ltr">
        Pour Tous renseignements complémentaires, veuillez contacter le Bureau du Recouvrement et du Contentieux.
      </p>
      <p className="doc-ar text-right text-[13px]">لمزيد من المعلومات، الرجاء الاتصال بمكتب التحصيل و المنازعات.</p>
      <hr className="doc-rule" />

      {/* Talon de paiement */}
      <div className="flex items-baseline justify-center gap-8 italic text-[18px]" dir="ltr">
        <span>Contentieux</span>
        <span className="doc-ar not-italic text-[16px]">المنازعات</span>
      </div>
      <div className="text-center text-[13px] mt-1" dir="ltr">Mme-Melle-Mr <span className="doc-ar mx-2">الأنسة - السيد (ة)</span></div>
      <div className="flex justify-between items-baseline mt-2 text-[13px]" dir="ltr">
        <span>{vp}</span>
        <b className="text-[15px]">{client}</b>
        <span />
      </div>
      <div className="grid grid-cols-2 gap-8 mt-3 mb-3" dir="ltr">
        <span className="text-[13.5px] tracking-wide">TALON DE PAIEMENT</span>
        <span className="doc-ar text-right text-[15px]">قسيمة الدفع</span>
      </div>
      <Line fr="Numéro Client" ar="رقم الزبون" value={numClient} />
      <Line fr="Numéro d'Abonnement" ar="رقم الاشتراك" value={numAbonnement} />
      <Line fr="Date de Résiliation" ar="تاريخ الإلغاء" value={data.dateResiliation} />
      <div className="mt-3">{figures}</div>
    </DocSheet>
  );
}
