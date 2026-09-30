import { useClientAccount } from "../../hooks";
import { DbKind } from "../../types";
import { labelFor, prefixFor, themeFor } from "../../shared/theme/theme";
import ClientDetailModal from "./ClientDetailModal";

interface Props {
  kind: DbKind;
  id: string;
  onClose: () => void;
  initialTab?: "finance" | "juridique";
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 max-w-md text-center space-y-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/**
 * Opens the client detail window for any of the three databases. The data
 * comes from the API (Avant / Après Gaïa) or the local store (Entreprises),
 * through useClientAccount — this component only deals with presentation.
 */
export default function ClientDetailHost({ kind, id, onClose, initialTab }: Props) {
  const { client, loading, error, recordPayment, validate, refuse, remove } = useClientAccount(kind, id);

  if (loading) {
    return (
      <Overlay onClose={onClose}>
        <p className="text-sm text-gray-600">Chargement de la fiche client…</p>
      </Overlay>
    );
  }

  if (!client) {
    return (
      <Overlay onClose={onClose}>
        <p className="text-sm text-red-700">{error ?? `Aucune fiche trouvée pour ${id}.`}</p>
        <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm border border-gray-300 hover:bg-gray-50">
          Fermer
        </button>
      </Overlay>
    );
  }

  return (
    <ClientDetailModal
      client={client}
      accent={themeFor(kind)}
      dbLabel={labelFor(kind)}
      numPrefix={prefixFor(kind)}
      initialTab={initialTab}
      onRecordPayment={recordPayment}
      onValidateTranche={validate}
      onRefuseTranche={refuse}
      onDeleteTranche={remove}
      onClose={onClose}
    />
  );
}
