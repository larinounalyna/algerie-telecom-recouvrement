import { useState } from "react";
import { AccentTheme, ApresGaiaMedRow, DebtorView, EtatJuridiqueMed } from "../../types";
import { ApresGaiaMedController } from "../../hooks/useApresGaiaMed";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";
import { fmtDate } from "../../shared/lib/format";
import { ETATS_JURIDIQUES_MED, etatJuridiqueMedInfo } from "../../shared/lib/juridique";
import MedDocumentModal from "./MedDocumentModal";
import { MedDocType } from "./medDocuments";

interface Props {
  client: DebtorView;
  accent: AccentTheme;
  controller: ApresGaiaMedController;
}

function EtatPill({ done, doneLabel, notDoneLabel }: { done: boolean; doneLabel: string; notDoneLabel: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {done ? doneLabel : notDoneLabel}
    </span>
  );
}

/**
 * « Cas particulier » + commentaire libre de la phase d'engagement (situation
 * sociale/médicale, échéancier hors barème…). Indépendant de Engagé / Non engagé :
 * on peut le noter dans les deux cas. Un seul enregistrement crée ou modifie.
 */
function CasParticulierEditor({ med, busy, accent, onSave, onClear }: {
  med: ApresGaiaMedRow;
  busy: boolean;
  accent: AccentTheme;
  onSave: ApresGaiaMedController["setCasParticulier"];
  onClear: ApresGaiaMedController["clearCasParticulier"];
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const startEdit = () => {
    setLabel(med.cas_particulier ?? "");
    setCommentaire(med.cas_particulier_commentaire ?? "");
    setEditing(true);
  };

  const save = async () => {
    const err = await onSave({ label, commentaire });
    if (!err) setEditing(false);
  };

  const clear = async () => {
    const err = await onClear();
    if (!err) {
      setConfirmClear(false);
      setEditing(false);
    }
  };

  const fieldCls = `w-full bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-[#1C2235] focus:outline-none transition-colors ${accent.focusBorder}`;

  return (
    <div className="px-4 py-3 bg-gray-50/60">
      <div className="text-sm text-[#1C2235]">
        Cas particulier &amp; commentaire <span className="text-xs text-gray-400">(engagement)</span>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <label className="block text-[11px] text-gray-500">
            Cas particulier
            <input
              className={`${fieldCls} mt-0.5`}
              maxLength={100}
              placeholder="ex. Situation médicale, échéancier hors barème…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block text-[11px] text-gray-500">
            Commentaire
            <textarea
              rows={3}
              className={`${fieldCls} mt-0.5 resize-none`}
              placeholder="Précisions, accord donné, pièces justificatives…"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy || !label.trim()}
              className={`px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-50 ${accent.bg} ${accent.hover}`}
            >
              Enregistrer
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs border-2 border-gray-300 text-gray-700 hover:bg-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : med.cas_particulier ? (
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{med.cas_particulier}</span>
              {med.cas_particulier_date && <span className="text-xs font-mono text-gray-500">{fmtDate(med.cas_particulier_date)}</span>}
            </div>
            {med.cas_particulier_commentaire && (
              <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap break-words">{med.cas_particulier_commentaire}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={startEdit}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs border-2 border-gray-300 text-gray-700 hover:bg-white transition-colors"
            >
              Modifier
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs border-2 border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-gray-400 italic">Aucun cas particulier enregistré.</span>
          <button
            onClick={startEdit}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs border-2 border-gray-300 text-gray-700 hover:bg-white transition-colors"
          >
            Ajouter un cas particulier / commentaire
          </button>
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Supprimer le cas particulier ?"
          confirmLabel="Supprimer"
          tone="danger"
          busy={busy}
          onConfirm={clear}
          onCancel={() => setConfirmClear(false)}
        >
          <p>
            Le cas particulier <b>« {med.cas_particulier} »</b> et son commentaire seront effacés. L'engagement du client n'est pas modifié.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function ApresGaiaMedPanel({ client, accent, controller }: Props) {
  const { med, busy, error, envoyerInvitation, envoyerMedLettre, engager, envoyerMedHuissier, changeEtatJuridique, setCasParticulier, clearCasParticulier } = controller;
  const [printDoc, setPrintDoc] = useState<MedDocType | null>(null);
  const [huissierNom, setHuissierNom] = useState("");
  const [huissierPrenom, setHuissierPrenom] = useState("");

  if (!med) {
    return <p className="text-sm text-gray-500">Chargement du dossier…</p>;
  }

  const info = etatJuridiqueMedInfo(med.etat_juridique);
  const invitationDone = med.invitation_paiement_etat === "ENVOYEE";
  const medLettreDone = med.med_lettre_etat === "ENVOYEE";
  const engagementDone = med.engagement_etat === "ENGAGE";
  const huissierDone = med.med_huissier_etat === "ENVOYEE";

  const inputCls =
    "bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1 text-xs text-[#1C2235] focus:outline-none transition-colors";

  return (
    <div className="space-y-5">
      {/* État juridique actuel */}
      <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase text-gray-400">État juridique actuel</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${info.badge}`}>{med.etat_juridique}</span>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Étapes MED complétées</div>
            <div className="text-lg font-mono text-[#1C2235]">
              {[invitationDone, medLettreDone, engagementDone, huissierDone].filter(Boolean).length} / 4
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[11px] uppercase text-gray-400 mb-1.5">Changer l'état juridique</div>
          <div className="flex flex-wrap gap-1.5">
            {ETATS_JURIDIQUES_MED.map((s) => (
              <button
                key={s.value}
                onClick={() => s.value !== med.etat_juridique && changeEtatJuridique(s.value as EtatJuridiqueMed)}
                disabled={busy}
                aria-pressed={s.value === med.etat_juridique}
                className={`px-2.5 py-1 rounded-lg text-xs border-2 transition-colors disabled:opacity-60 ${
                  s.value === med.etat_juridique
                    ? `${accent.bg} text-white border-transparent`
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {s.court}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {/* Étapes MED */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
          <span className="text-sm text-[#1C2235]">Mises en demeure &amp; invitation de paiement</span>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {/* Invitation de paiement */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div>
              <div className="text-sm text-[#1C2235]">Invitation de paiement</div>
              <div className="mt-1 flex items-center gap-2">
                <EtatPill done={invitationDone} doneLabel="Envoyée" notDoneLabel="Non envoyée" />
                {med.invitation_paiement_date && <span className="text-xs font-mono text-gray-500">{fmtDate(med.invitation_paiement_date)}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!invitationDone && (
                <button
                  onClick={() => envoyerInvitation()}
                  disabled={busy}
                  className={`px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-60 ${accent.bg} ${accent.hover}`}
                >
                  Envoyer
                </button>
              )}
              <button
                onClick={() => setPrintDoc("invitation")}
                className="px-3 py-1.5 rounded-lg text-xs border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Imprimer
              </button>
            </div>
          </div>

          {/* MED par lettre */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div>
              <div className="text-sm text-[#1C2235]">Mise en demeure par lettre</div>
              <div className="mt-1 flex items-center gap-2">
                <EtatPill done={medLettreDone} doneLabel="Envoyée" notDoneLabel="Non envoyée" />
                {med.med_lettre_date && <span className="text-xs font-mono text-gray-500">{fmtDate(med.med_lettre_date)}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!medLettreDone && (
                <button
                  onClick={() => envoyerMedLettre()}
                  disabled={busy}
                  className={`px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-60 ${accent.bg} ${accent.hover}`}
                >
                  Envoyer
                </button>
              )}
              <button
                onClick={() => setPrintDoc("med_lettre")}
                className="px-3 py-1.5 rounded-lg text-xs border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Imprimer
              </button>
            </div>
          </div>

          {/* Engagement du client */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div>
              <div className="text-sm text-[#1C2235]">Engagement du client</div>
              <div className="mt-1 flex items-center gap-2">
                <EtatPill done={engagementDone} doneLabel="Engagé" notDoneLabel="Non engagé" />
                {med.engagement_date && <span className="text-xs font-mono text-gray-500">{fmtDate(med.engagement_date)}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!engagementDone && (
                <button
                  onClick={() => engager()}
                  disabled={busy}
                  className={`px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-60 ${accent.bg} ${accent.hover}`}
                >
                  Engagement
                </button>
              )}
              <button
                onClick={() => setPrintDoc("engagement")}
                className="px-3 py-1.5 rounded-lg text-xs border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Imprimer
              </button>
            </div>
          </div>

          {/* Cas particulier & commentaire — fait partie de la phase d'engagement */}
          <CasParticulierEditor med={med} busy={busy} accent={accent} onSave={setCasParticulier} onClear={clearCasParticulier} />

          {/* MED par huissier */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
            <div className="min-w-[10rem]">
              <div className="text-sm text-[#1C2235]">Mise en demeure par huissier</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <EtatPill done={huissierDone} doneLabel="Envoyée" notDoneLabel="Non envoyée" />
                {med.med_huissier_date && <span className="text-xs font-mono text-gray-500">{fmtDate(med.med_huissier_date)}</span>}
                {(med.med_huissier_nom || med.med_huissier_prenom) && (
                  <span className="text-xs text-gray-500">
                    {[med.med_huissier_prenom, med.med_huissier_nom].filter(Boolean).join(" ")}
                  </span>
                )}
              </div>
            </div>
            {!huissierDone ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input className={inputCls} placeholder="Prénom huissier" value={huissierPrenom} onChange={(e) => setHuissierPrenom(e.target.value)} />
                <input className={inputCls} placeholder="Nom huissier" value={huissierNom} onChange={(e) => setHuissierNom(e.target.value)} />
                <button
                  onClick={() => envoyerMedHuissier(huissierNom, huissierPrenom)}
                  disabled={busy}
                  className={`px-3 py-1.5 rounded-lg text-xs text-white transition-colors disabled:opacity-60 ${accent.bg} ${accent.hover}`}
                >
                  Envoyer
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Notifiée par huissier — document externe (non généré ici)</span>
            )}
          </div>
        </div>
      </div>

      {printDoc && (
        <MedDocumentModal
          client={client}
          med={med}
          type={printDoc}
          accent={accent}
          busy={busy}
          alreadySentDate={
            printDoc === "invitation" ? med.invitation_paiement_date : printDoc === "med_lettre" ? med.med_lettre_date : med.engagement_date
          }
          onEnvoyer={() =>
            printDoc === "invitation" ? envoyerInvitation() : printDoc === "med_lettre" ? envoyerMedLettre() : engager()
          }
          onClose={() => setPrintDoc(null)}
        />
      )}
    </div>
  );
}
