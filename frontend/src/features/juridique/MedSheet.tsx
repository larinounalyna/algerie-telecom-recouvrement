import { ApresGaiaMedRow, DebtorView } from "../../types";
import { fmtDate, todayISO } from "../../shared/lib/format";
import { DocSheet, BilingualLetterhead, SpaFooter, SpaLetterhead, Row, blank } from "../../shared/ui/documents/DocParts";
import { DocLang, MedDocType } from "./medDocuments";

const money = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\u202f/g, " ");

interface Props {
  type: MedDocType;
  lang: DocLang;
  client: DebtorView;
  med: ApresGaiaMedRow;
}

const refOf = (med: ApresGaiaMedRow) => `AT / DOT Alger - Est / DFC / S - R / N° ${String(med.id ?? 0).padStart(3, "0")} / ${new Date().getFullYear()}`;

/* ------------------------------------------------------------------ */
/* Invitation de paiement + Mise en demeure par lettre                 */
/* Bilingual letterhead, reference block, framed "objet" box.          */
/* ------------------------------------------------------------------ */
function LetterSheet({ type, lang, client, med }: Props) {
  const fr = lang === "fr";
  const nom = [client.nom, client.prenom].filter(Boolean).join(" ");
  const invitation = type === "invitation";

  const objet = invitation ? (fr ? "Objet : Invitation." : "الموضوع : دعوة") : fr ? "Objet : Convocation." : "إشعار بالدفع قبل المتابعة القضائية";
  const paragraphs = invitation
    ? fr
      ? [
          "Veuillez, Madame, Monsieur, vous présenter au siège de notre Direction Opérationnelle des Télécommunications d'Alger – Est, Service Recouvrement, sis à la Rue Djoudji Zitouni, Hussein Dey, pour une affaire qui concerne les factures non payées pour des lignes résiliées et des lignes actives.",
          "Merci pour votre compréhension.",
        ]
      : [
          "نعلمكم بوجوب الحضور إلى مقر مديريتنا العملياتية للاتصالات الجزائر شرق، مصلحة التحصيل، الكائن بشارع جوجي زيتوني، حسين داي، من أجل تسوية وضعية الفواتير غير المدفوعة الخاصة بالخطوط الملغاة والنشطة.",
          "شاكرين لكم حسن تفهمكم.",
        ]
    : fr
      ? [
          "Veuillez, Madame, Monsieur, vous présenter au siège de notre Direction Opérationnelle des Télécommunications d'Alger – Est, Service Recouvrement, sis à la Rue Djoudji Zitouni, Hussein Dey, pour une affaire vous concernant.",
          "En attendant votre visite, je vous prie d'agréer, Madame, Monsieur, l'assurance de notre considération distinguée.",
        ]
      : [
          "نعلمكم بوجوب الحضور في أقرب وقت إلى مصلحة التحصيل ما قبل المنازعات الكائن مقرها بـ : 02 شارع جوجي زيتوني حسين داي بجانب مكتب بريد حسين داي من أجل تسوية وضعيتكم.",
          "في حالة عدم استجابتكم نحن مضطرين لإحالة الملف إلى مصلحة الشؤون القانونية.",
          "في انتظار ذلك، تقبلوا منا سيدي فائق الاحترام والتقدير.",
        ];
  const signature = fr ? "Le Chef du Département Finance et Comptabilité" : "رئيس دائرة المالية والمحاسبة";

  return (
    <DocSheet>
      <BilingualLetterhead />

      <div className="grid grid-cols-[1.1fr_1fr] gap-6 items-start" dir="ltr">
        <div>
          <Row label="Réf" value={refOf(med)} />
          <Row label="Actel" value="" />
          <Row label="N° de Client" value={client.numClient || client.id} />
          <Row label="N° de Téléphone" value={client.telephone} />
          <Row label="Montant" value={`${money(client.solde)} DA`} />
          <Row label="Date de Résiliation" value="" />
        </div>
        <div className="text-[12.5px] leading-[1.9] text-right">
          <p><span className="font-semibold">Nom et Prénom :</span> <b>{nom}</b></p>
          <p><span className="font-semibold">Adresse :</span> <b>{client.adresse}{client.adresse ? ", " : ""}Alger</b></p>
        </div>
      </div>

      {!fr && (
        <p className="text-center font-bold mt-3" dir="ltr">
          Jour de Réception : Lundi - Mercredi
        </p>
      )}

      <div className="h-3 bg-[#e3e5ea] border border-[#9aa0ac] mt-3 mb-5" />

      <div className="doc-fold flex-1 max-h-[420px]" dir={fr ? "ltr" : "rtl"}>
        <p className={`text-[14px] mb-5 ${fr ? "" : "text-center font-bold text-[16px]"}`}>{objet}</p>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 text-justify" style={{ textIndent: fr ? "3.2em" : undefined }}>
            {p}
          </p>
        ))}
        <p className={`mt-8 font-semibold ${fr ? "text-right" : "text-left"}`}>{signature}</p>
      </div>
    </DocSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Engagement — form, identity pre-filled, échéancier filled by hand.  */
/* ------------------------------------------------------------------ */
function EngagementSheet({ lang, client, med }: Props) {
  const fr = lang === "fr";
  const nom = [client.nom, client.prenom].filter(Boolean).join(" ");
  const numClient = client.numClient || client.id;
  const today = fmtDate(todayISO());
  const T = fr
    ? {
        titulaire: "Titulaire de la Ligne Téléphonique",
        lieu: "Hussein Dey, le",
        numClient: "N° Client :",
        appel: "N° d'Appel :",
        monsieur: "Monsieur :",
        adresse: "Adresse :",
        montant: "Montant des Dus :",
        rnp: "Date RNP :",
        titre: "Engagement",
        soussigne: "Je Soussigné Monsieur :",
        demeurant: "Demeurant au :",
        cni: "Portant Carte d'identité Nationale",
        numero: "Numéro :",
        delivre: "Délivré le",
        apc: "Par APC",
        p1: "Reconnais le Montant des Dus des Factures Téléphoniques Sous le N° Client :",
        p1b: "et qui s'élève à",
        p2a: "Monsieur",
        p2b: "s'engage sur son honneur à payer et honorer ce Montant en respectant l'échéancier établi par le Service Recouvrement comme suit :",
        v1: "1er Versement",
        payele: "DA payé le",
        mois: "Chaque mois",
        apartir: "DA à partir du",
        contraire: "Dans le cas contraire l'Entreprise d'Algérie Télécom se verra contrainte de poursuivre son client devant les juridictions compétentes.",
        sigL: ["Algérie - Télécom", "le Représentant"],
        sigR: ["Lu et Approuvé", "l'Intéressé"],
        cas: "Cas particulier",
      }
    : {
        titulaire: "صاحب الخط الهاتفي",
        lieu: "حسين داي، في",
        numClient: "رقم الزبون :",
        appel: "رقم الاتصال :",
        monsieur: "السيد(ة) :",
        adresse: "العنوان :",
        montant: "مبلغ المستحقات :",
        rnp: "تاريخ RNP :",
        titre: "التزام",
        soussigne: "أنا الموقع أدناه السيد(ة) :",
        demeurant: "الساكن(ة) بـ :",
        cni: "حامل بطاقة التعريف الوطنية",
        numero: "رقم :",
        delivre: "الصادرة بتاريخ",
        apc: "عن بلدية",
        p1: "أقر بمبلغ مستحقات الفواتير الهاتفية تحت رقم الزبون :",
        p1b: "والذي يبلغ",
        p2a: "السيد(ة)",
        p2b: "يلتزم على شرفه بدفع وتسديد هذا المبلغ وفق الجدول الذي تضعه مصلحة التحصيل كما يلي :",
        v1: "الدفعة الأولى",
        payele: "دج بتاريخ",
        mois: "كل شهر",
        apartir: "دج ابتداءً من",
        contraire: "في الحالة المعاكسة، تضطر مؤسسة اتصالات الجزائر إلى متابعة زبونها أمام الجهات القضائية المختصة.",
        sigL: ["اتصالات الجزائر", "الممثل"],
        sigR: ["قُرئ ووُفق عليه", "المعني"],
        cas: "حالة خاصة",
      };
  const bullet = (c: string) => <span className="inline-block w-5">{c}</span>;

  return (
    <DocSheet dir={fr ? "ltr" : "rtl"}>
      <SpaLetterhead />

      <div className="mt-6 italic space-y-1.5 text-[15px]">
        <p className="flex justify-between">
          <span>{bullet("➢")}<b>{T.titulaire}</b></span>
          <span>{T.lieu} {today}</span>
        </p>
        <p className="flex gap-16">
          <span>{bullet("➢")}<b>{T.numClient}</b> {numClient}</span>
          <span><b>{T.appel}</b> {client.telephone}</span>
        </p>
        <p>{bullet("➢")}<b>{T.monsieur}</b> {nom}</p>
        <p>{bullet("➢")}<b>{T.adresse}</b> {client.adresse}</p>
        <p>{bullet("➢")}<b>{T.montant}</b> {money(client.solde)} DA</p>
        <p>{bullet("➢")}<b>{T.rnp}</b> {blank}</p>
      </div>

      <h2 className="doc-title-engagement">{T.titre}</h2>

      <div className="italic space-y-1.5 text-[15px]">
        <p>{bullet("❖")}<b>{T.soussigne}</b> {blank}{blank}</p>
        <p>{bullet("❖")}<b>{T.demeurant}</b> {client.adresse || blank}</p>
        <p className="flex gap-10">
          <span>{bullet("❖")}<b>{T.cni}</b></span>
          <span><b>{T.numero}</b> {blank}</span>
        </p>
        <p className="flex gap-10">
          <span>{bullet("❖")}<b>{T.delivre}</b> {blank}</span>
          <span><b>{T.apc}</b> {blank}</span>
        </p>
      </div>

      <div className="italic text-[15px] mt-5 space-y-3 text-justify">
        <p style={{ textIndent: "3em" }}>
          <b>{T.p1}</b> {numClient} &nbsp;<b>{T.p1b}</b> {money(client.solde)} DA.
        </p>
        <p style={{ textIndent: "3em" }}>
          <b>{T.p2a}</b> {blank} <b>{T.p2b}</b>
        </p>
        {med.cas_particulier && (
          <p className="not-italic text-[13.5px] border-l-2 border-black pl-3">
            <b>{T.cas} :</b> {med.cas_particulier}
            {med.cas_particulier_commentaire ? ` — ${med.cas_particulier_commentaire}` : ""}
          </p>
        )}
        <p className="ml-10">{bullet("➢")}<b>{T.v1}</b> {blank} <b>{T.payele}</b> {blank}</p>
        <p className="ml-10">{bullet("➢")}<b>{T.mois}</b> {blank} <b>{T.apartir}</b> {blank}</p>
        <p style={{ textIndent: "3em" }}>
          <b>{T.contraire}</b>
        </p>
      </div>

      <div className="flex justify-between mt-8 italic font-semibold text-[15px] px-2">
        <div className="text-center">{T.sigL.map((l) => <p key={l}>{l}</p>)}</div>
        <div className="text-center">{T.sigR.map((l) => <p key={l}>{l}</p>)}</div>
      </div>

      <SpaFooter />
    </DocSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Attestation de Mise à Jour                                          */
/* ------------------------------------------------------------------ */
function AttestationSheet({ lang, client, med }: Props) {
  const fr = lang === "fr";
  const nom = [client.nom, client.prenom].filter(Boolean).join(" ");
  const numClient = client.numClient || client.id;
  const today = fmtDate(todayISO());
  const tel = client.telephone || "………………";

  return (
    <DocSheet dir={fr ? "ltr" : "rtl"}>
      <SpaLetterhead />

      <p className="mt-8 text-[14.5px]" dir="ltr">
        <b>Réf : {refOf(med)}</b>
      </p>
      <p className={`mt-10 italic text-[14.5px] ${fr ? "text-right" : "text-left"}`}>
        <b>{fr ? `Hussein Dey, le ${today}` : `حسين داي، في ${today}`}</b>
      </p>

      <h2 className="text-center font-bold text-[17px] doc-underline mt-8 mb-8">{fr ? "Attestation de Mise à Jour" : "شهادة تحيين الوضعية"}</h2>

      <div className="space-y-7 text-justify text-[15px]" style={{ textIndent: fr ? "3.2em" : "2.5em" }}>
        {fr ? (
          <>
            <p>
              Suite à la Résiliation de la Ligne Téléphonique Sous le N° d'Appel : <b>{tel}</b> et Sous le N° de Client : <b>{numClient}</b> sis à <b>{client.adresse || "………………"}</b>, appartenant à <b>Mr {nom}</b> et ce, depuis le <b>{blank}</b>.
            </p>
            <p>
              Ce dernier a régularisé sa situation envers Algérie – Télécom en payant la Totalité de ces dus dont le Montant est de <b>{money(client.montantTotal)} DA</b>.
            </p>
            <p>Cette attestation est délivrée et valoir à qui de droit.</p>
          </>
        ) : (
          <>
            <p>
              على إثر إلغاء الخط الهاتفي تحت رقم الاتصال : <b>{tel}</b> ورقم الزبون : <b>{numClient}</b> الكائن بـ <b>{client.adresse || "………………"}</b>، والمملوك للسيد <b>{nom}</b> وذلك منذ <b>{blank}</b>.
            </p>
            <p>
              قام المعني بتسوية وضعيته اتجاه اتصالات الجزائر بدفع كامل مستحقاته والتي بلغ مبلغها <b>{money(client.montantTotal)} دج</b>.
            </p>
            <p>سُلمت هذه الشهادة للمعني بالأمر لتُستعمل في حدود ما يخوّله القانون.</p>
          </>
        )}
      </div>

      <SpaFooter />
    </DocSheet>
  );
}

export default function MedSheet(props: Props) {
  if (props.type === "engagement") return <EngagementSheet {...props} />;
  if (props.type === "attestation") return <AttestationSheet {...props} />;
  return <LetterSheet {...props} />;
}
