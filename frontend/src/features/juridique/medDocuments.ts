import { ApresGaiaMedRow, DebtorView } from "../../types";
import { fmtDA, fmtDate, todayISO } from "../../shared/lib/format";

export type MedDocType = "invitation" | "engagement" | "med_lettre" | "attestation";
export type DocLang = "fr" | "ar";

export interface MedDocField {
  label: string;
  value: string;
}

export interface MedDocument {
  lang: DocLang;
  dir: "ltr" | "rtl";
  /** Company / letterhead block, top to bottom. */
  entete: string[];
  direction: string;
  reference: MedDocField[];
  objet: string;
  titre: string;
  /** Body paragraphs, in reading order. */
  paragraphes: string[];
  /** Free-form blank lines to fill by hand (engagement échéancier, signatures…). */
  aRemplir?: string[];
  signatureGauche: string;
  signatureDroite: string;
}

const ENTETE_FR = [
  "Algérie Télécom",
  "Entreprise Publique Économique — Société par Actions au capital de 115 000 000 000 DA",
  "RC N° 02B18083",
  "Siège social : Cité Djenane El Malik, Route Nationale N°5, Les Bananiers, 16130 Hydra, Alger",
];

const ENTETE_AR = [
  "اتصالات الجزائر",
  "مؤسسة عمومية اقتصادية ذات أسهم برأسمال قدره 000 000 000 115 دج",
  "رقم السجل التجاري 18083 ب 02",
  "الكائن مقرها الاجتماعي بحي جنان الملك، الطريق الوطني رقم 05، البنيان، 16130 حيدرة الجزائر",
];

const DIRECTION_FR = "Direction Opérationnelle des Télécommunications d'Alger-Est — Service Recouvrement";
const DIRECTION_AR = "المديرية العملياتية للاتصالات الجزائر الشرق — مصلحة التحصيل";

function reference(client: DebtorView, med: ApresGaiaMedRow, lang: DocLang, dateLabel?: { label: string; value: string }): MedDocField[] {
  const fr = lang === "fr";
  const fields: MedDocField[] = [
    { label: fr ? "Réf." : "المرجع", value: `${med.id ?? "—"}` },
    { label: fr ? "N° de Compte" : "رقم الحساب", value: client.id },
    { label: fr ? "Nom et Prénom" : "الاسم واللقب", value: [client.nom, client.prenom].filter(Boolean).join(" ") || "—" },
    { label: fr ? "Adresse" : "العنوان", value: client.adresse || "—" },
    { label: fr ? "N° de Téléphone" : "رقم الهاتف", value: client.telephone || "—" },
    { label: fr ? "Montant des Dûs" : "مبلغ المستحقات", value: fmtDA(client.solde) },
  ];
  if (dateLabel) fields.push(dateLabel);
  return fields;
}

export function buildMedDocument(type: MedDocType, lang: DocLang, client: DebtorView, med: ApresGaiaMedRow): MedDocument {
  const fr = lang === "fr";
  const today = fmtDate(todayISO());
  const entete = fr ? ENTETE_FR : ENTETE_AR;
  const direction = fr ? DIRECTION_FR : DIRECTION_AR;
  const signatureGauche = fr ? "Algérie Télécom — Le Représentant" : "اتصالات الجزائر — الممثل";
  const signatureDroite = fr ? "Lu et approuvé — L'Intéressé" : "قُرئ ووُفق عليه — المعني";

  if (type === "invitation") {
    return {
      lang,
      dir: fr ? "ltr" : "rtl",
      entete,
      direction,
      reference: reference(client, med, lang, { label: fr ? "Date" : "التاريخ", value: today }),
      objet: fr ? "Objet : Invitation" : "الموضوع: دعوة",
      titre: fr ? "Invitation" : "دعوة",
      paragraphes: fr
        ? [
            "Veuillez, Madame, Monsieur, vous présenter au siège de notre Direction Opérationnelle des Télécommunications d'Alger-Est, Service Recouvrement, sis à la Rue Djoudji Zitouni, Hussein Dey, pour une affaire qui concerne les factures non payées relatives aux lignes résiliées et actives.",
            "Nous vous remercions de votre compréhension.",
          ]
        : [
            "نعلمكم بوجوب الحضور إلى مقر مديريتنا العملياتية للاتصالات الجزائر الشرق، مصلحة التحصيل، الكائن بشارع جوهر زيتوني، حسين داي، من أجل تسوية وضعية الفواتير غير المدفوعة الخاصة بالخطوط الملغاة والنشطة.",
            "شاكرين لكم حسن تفهمكم.",
          ],
      signatureGauche,
      signatureDroite,
    };
  }

  if (type === "med_lettre") {
    return {
      lang,
      dir: fr ? "ltr" : "rtl",
      entete,
      direction,
      reference: reference(client, med, lang, { label: fr ? "Date" : "التاريخ", value: today }),
      objet: fr ? "Objet : Mise en demeure avant poursuite judiciaire" : "الموضوع: إنذار قبل المتابعة القضائية",
      titre: fr ? "Mise en Demeure avant Poursuite Judiciaire" : "إنذار قبل المتابعة القضائية",
      paragraphes: fr
        ? [
            "Nous vous informons que vous devez vous présenter dans les plus brefs délais au Service Recouvrement Contentieux, sis au 02 Rue Djoudji Zitouni, Hussein Dey (Bureau de recouvrement Hussein Dey), afin de régulariser votre situation.",
            "À défaut de réponse à la présente mise en demeure, nous serons contraints de transmettre votre dossier au Service du Contentieux Juridique.",
            "Dans l'attente, veuillez agréer, Madame, Monsieur, l'expression de notre considération distinguée.",
          ]
        : [
            "نعلمكم بوجوب الحضور في أقرب وقت إلى مصلحة التحصيل ما قبل المنازعات، الكائن مقرها بـ 02 شارع جوهر زيتوني، حسين داي (مكتب التحصيل حسين داي)، من أجل تسوية وضعيتكم.",
            "في حالة عدم استجابتكم لهذا الإنذار، سنضطر إلى إحالة ملفكم إلى مصلحة الشؤون القانونية.",
            "في انتظار ذلك، تقبلوا منا فائق الاحترام والتقدير.",
          ],
      signatureGauche: fr ? "Le Chef du Service Finance et Comptabilité" : "رئيس دائرة المالية والمحاسبة",
      signatureDroite: "",
    };
  }

  // attestation de solde — délivrée quand le client n'a plus rien à payer (solde dû = 0).
  if (type === "attestation") {
    const nom = [client.nom, client.prenom].filter(Boolean).join(" ") || "—";
    return {
      lang,
      dir: fr ? "ltr" : "rtl",
      entete,
      direction,
      reference: reference(client, med, lang, { label: fr ? "Date" : "التاريخ", value: today }),
      objet: fr ? "Objet : Attestation de règlement (solde nul)" : "الموضوع: شهادة تسديد (رصيد معدوم)",
      titre: fr ? "Attestation de Règlement" : "شهادة تسديد",
      paragraphes: fr
        ? [
            `Nous soussignés, Direction Opérationnelle des Télécommunications d'Alger-Est, Service Recouvrement, attestons que le compte n° ${client.id}, au nom de ${nom}, est à jour de ses paiements à la date du ${today}.`,
            `Le montant des dûs à cette date est de ${fmtDA(client.solde)} : aucune somme n'est due au titre des factures des lignes résiliées et actives rattachées à ce compte.`,
            "La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
          ]
        : [
            `نحن الموقّعون أدناه، المديرية العملياتية للاتصالات الجزائر الشرق، مصلحة التحصيل، نشهد بأن الحساب رقم ${client.id}، باسم ${nom}، مسدَّد بالكامل إلى غاية تاريخ ${today}.`,
            `مبلغ المستحقات في هذا التاريخ هو ${fmtDA(client.solde)}: لا يوجد أي مبلغ مستحق عن فواتير الخطوط الملغاة والنشطة المرتبطة بهذا الحساب.`,
            "سُلّمت هذه الشهادة للمعني(ة) بالأمر لتُستعمل في حدود ما يخوّله القانون.",
          ],
      signatureGauche: fr ? "Le Chef du Service Recouvrement" : "رئيس مصلحة التحصيل",
      signatureDroite: "",
    };
  }

  // engagement — printed as a form: client's identity is pre-filled, the
  // échéancier (1er versement / mensualités) and signatures are filled and
  // signed by hand at the counter, exactly like the paper original.
  return {
    lang,
    dir: fr ? "ltr" : "rtl",
    entete,
    direction,
    reference: reference(client, med, lang),
    objet: fr ? "Objet : Engagement de paiement" : "الموضوع: التزام بالدفع",
    titre: fr ? "Engagement" : "التزام",
    paragraphes: fr
      ? [
          `Je soussigné(e) M./Mme _________________________________, demeurant au ${client.adresse || "_________________________________"},`,
          "titulaire de la Carte d'Identité Nationale n° ____________________, délivrée le ____________ par l'APC de ____________________,",
          `reconnais le montant des dûs des factures téléphoniques sous le n° de compte ${client.id}, qui s'élève à ${fmtDA(client.solde)}.`,
          "Je m'engage sur l'honneur à payer et honorer ce montant en respectant l'échéancier établi par le Service Recouvrement comme suit :",
        ]
      : [
          `أنا الموقّع أدناه السيد(ة) _________________________________، الساكن(ة) بـ ${client.adresse || "_________________________________"}،`,
          "حامل بطاقة التعريف الوطنية رقم ____________________، الصادرة بتاريخ ____________ عن بلدية ____________________،",
          `أقر بمبلغ مستحقات الفواتير الهاتفية تحت رقم الحساب ${client.id}، والذي يبلغ ${fmtDA(client.solde)}.`,
          "ألتزم على شرفي بدفع وتسديد هذا المبلغ وفق الجدول الذي تضعه مصلحة التحصيل كما يلي:",
        ],
    aRemplir: [
      ...(med.cas_particulier
        ? [`${fr ? "Cas particulier" : "حالة خاصة"} : ${med.cas_particulier}${med.cas_particulier_commentaire ? ` — ${med.cas_particulier_commentaire}` : ""}`]
        : []),
      ...(fr
      ? ["1er versement : ______________ DA, payé le ____________", "Chaque mois : ______________ DA, à partir du ____________"]
      : ["الدفعة الأولى: ______________ دج، بتاريخ ____________", "كل شهر: ______________ دج، ابتداءً من ____________"]),
    ],
    signatureGauche,
    signatureDroite,
  };
}
