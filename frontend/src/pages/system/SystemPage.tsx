import { useState } from "react";
import AvantGaiaForm from "../../features/avant-gaia/AvantGaiaForm";
import ApresGaiaForm from "../../features/apres-gaia/ApresGaiaForm";
import EntrepriseForm from "../../features/entreprises/EntrepriseForm";
import DatabasePage from "../../features/database/DatabasePage";
import ClientDetailHost from "../../features/client-detail/ClientDetailHost";
import { useAppData } from "../../store/AppData";
import { DbKind } from "../../types";
import { labelFor } from "../../shared/theme/theme";
import PageHeaderBar from "../../shared/ui/PageHeaderBar";

interface Props {
  system: DbKind;
  onBack: () => void;
  onSwitchSystem?: (system: "avant" | "apres") => void;
}

export default function SystemPage({ system, onBack, onSwitchSystem }: Props) {
  const { entreprises, applyPayment, validateTranche } = useAppData();
  const [showDB, setShowDB] = useState(false);
  const [detail, setDetail] = useState<{ id: string; tab: "finance" | "juridique" } | null>(null);

  // The database takes the whole window (no header of this page, no pop-up).
  if (showDB) return <DatabasePage kind={system} onClose={() => setShowDB(false)} />;

  const commonProps = {
    onOpenDB: () => setShowDB(true),
    onViewHistory: (id: string) => setDetail({ id, tab: "finance" }),
    onViewJuridique: (id: string) => setDetail({ id, tab: "juridique" }),
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <PageHeaderBar title={labelFor(system).toUpperCase()} onBack={onBack} />

      {/* Form — non-scrollable single screen */}
      <div className="flex-1 min-h-0 overflow-hidden bg-bg">
        {system === "avant" ? (
          <AvantGaiaForm {...commonProps} onGoToApresGaia={onSwitchSystem ? () => onSwitchSystem("apres") : undefined} />
        ) : system === "apres" ? (
          <ApresGaiaForm {...commonProps} onGoToHorsGaia={onSwitchSystem ? () => onSwitchSystem("avant") : undefined} />
        ) : (
          <EntrepriseForm
            data={entreprises}
            {...commonProps}
            onRecordPayment={applyPayment}
            onValidateTranche={validateTranche}
          />
        )}
      </div>

      {detail && <ClientDetailHost kind={system} id={detail.id} initialTab={detail.tab} onClose={() => setDetail(null)} />}
    </div>
  );
}
