import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../../store/AppData";
import { DebtorView } from "../../types";
import { fmtDA, fmtDate, todayISO } from "../../shared/lib/format";
import { generateMiseEnDemeureNum } from "../../shared/lib/generators";

interface Props {
  client: DebtorView;
  onClose: () => void;
}

export default function MiseEnDemeureModal({ client, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const { recordMED, getJuridique } = useAppData();
  const num = useMemo(() => generateMiseEnDemeureNum(), []);
  const [recorded, setRecorded] = useState(false);
  const already = getJuridique(client.kind, client.id).mises.length;

  // A printed mise en demeure counts as sent: it is written to the customer's
  // état juridique so next month's extraction skips this customer.
  const record = () => {
    recordMED(client.kind, client.id, num, "Courrier");
    setRecorded(true);
  };
  const today = todayISO();
  const deadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    return d.toISOString();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface rounded-t-lg flex-shrink-0 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted">{num}</span>
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-danger/20 text-danger">
              MISE EN DEMEURE
            </span>
          </div>
          <div className="flex gap-2 items-center">
            {recorded ? (
              <span className="text-xs text-green-700">✓ Enregistrée dans l'état juridique</span>
            ) : (
              <button
                onClick={record}
                className="px-3 py-1.5 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
              >
                Enregistrer sans imprimer
              </button>
            )}
            <button
              onClick={() => {
                if (!recorded) record();
                window.print();
              }}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:opacity-80 transition-opacity"
            >
              Imprimer et enregistrer
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-surface2 border border-border text-muted rounded hover:text-[#1C2235] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>

        {already > 0 && !recorded && (
          <div className="no-print px-4 py-2 text-xs bg-amber-50 text-amber-800 border-b border-amber-200">
            Ce client a déjà reçu {already} mise(s) en demeure. Vérifiez qu'un nouvel envoi est nécessaire.
          </div>
        )}

        {/* Scrollable document */}
        <div className="overflow-auto flex-1 bg-surface2">
          <div className="print-area bg-white text-black p-10 m-4 rounded shadow-sm border border-gray-100 text-sm leading-relaxed">
            {/* Header */}
            <div className="text-center mb-6 pb-5 border-b-2 border-black">
              <p className="text-[9px] uppercase tracking-widest text-gray-500">
                République Algérienne Démocratique et Populaire
              </p>
              <p className="text-[9px] text-gray-500">Ministère de la Poste et des Télécommunications</p>
              <div className="text-3xl font-extrabold mt-2 tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                ALGÉRIE TÉLÉCOM
              </div>
              <div className="text-sm font-medium text-gray-700 mt-0.5">
                Direction Régionale de {client.wilaya || "—"}
              </div>
            </div>

            {/* Recipient + reference */}
            <div className="flex justify-between text-xs mb-6">
              <div>
                <div className="font-semibold text-sm">
                  {client.nom} {client.prenom}
                </div>
                {client.entreprise && (
                  <div className="text-gray-700">
                    À l'attention de {client.entreprise.representant || "la direction"}
                    {client.entreprise.fonctionRepresentant ? `, ${client.entreprise.fonctionRepresentant}` : ""}
                    {client.entreprise.nif ? ` — NIF ${client.entreprise.nif}` : ""}
                  </div>
                )}
                <div className="text-gray-700">{client.adresse}</div>
                <div className="text-gray-700">
                  {client.commune} — {client.wilaya}
                </div>
              </div>
              <div className="text-right">
                <div>
                  N° <span className="font-mono font-bold">{num}</span>
                </div>
                <div>Le {fmtDate(today)}</div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <div
                className="inline-block px-8 py-2.5 border-2 border-black font-bold text-lg uppercase tracking-widest bg-red-50"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Mise en Demeure de Payer
              </div>
            </div>

            <p className="mb-3 font-semibold">
              Objet : Mise en demeure de payer — {client.idLabel} {client.id}
            </p>

            <p className="mb-3">
              {client.entreprise
                ? `Madame, Monsieur le représentant de la société ${client.nom},`
                : `Madame, Monsieur ${client.nom} ${client.prenom},`}
            </p>

            <p className="mb-3">
              Malgré nos rappels précédents, nous constatons qu'à ce jour, la somme de{" "}
              <span className="font-bold font-mono">{fmtDA(client.solde)}</span> demeure impayée au titre
              de votre {client.kind === "avant" ? "abonnement" : client.entreprise ? "compte professionnel" : "compte"} n° <span className="font-mono">{client.id}</span>{" "}
              ({client.typeService || "service Algérie Télécom"}).
            </p>

            <p className="mb-3">
              Par la présente, nous vous mettons en demeure de régulariser cette situation dans un délai de
              huit (8) jours à compter de la date de réception du présent courrier, soit au plus tard le{" "}
              <span className="font-bold">{fmtDate(deadline)}</span>.
            </p>

            <p className="mb-3">
              À défaut de règlement intégral dans ce délai, nous nous verrons contraints d'engager toute
              procédure utile au recouvrement de cette créance, pouvant inclure la suspension du service et/ou
              une action contentieuse, sans préjudice des frais et intérêts qui pourraient en résulter.
            </p>

            <p className="mb-8">
              Nous restons néanmoins à votre disposition pour convenir, si nécessaire, d'un échéancier de
              paiement adapté à votre situation.
            </p>

            <p className="mb-10">Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>

            <div className="grid grid-cols-2 gap-8 text-[9px] uppercase text-gray-500 tracking-wider">
              <div>
                <div className="border-t border-gray-400 pt-1 mt-10">Cachet &amp; Signature</div>
              </div>
              <div className="text-right">
                <div className="border-t border-gray-400 pt-1 mt-10">Direction Régionale</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
