import { useState } from "react";
import PageHeaderBar from "../../shared/ui/PageHeaderBar";
import CorporateArForm from "./CorporateArForm";
import CorporateArDatabase from "./CorporateArDatabase";
import { useCorporateClients } from "./useCorporateClients";

interface Props {
  onBack: () => void;
}

/** Corporate AR: same shell as SystemPage (header bar + single-screen form, or the full-window database). */
export default function CorporateArPage({ onBack }: Props) {
  const store = useCorporateClients();
  const [db, setDb] = useState<{ oldOnly: boolean } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  // The database takes the whole window (no header of this page).
  if (db)
    return (
      <CorporateArDatabase
        store={store}
        startWithOldOnly={db.oldOnly}
        onClose={() => setDb(null)}
        onOpen={(code) => {
          setFocus(code);
          setDb(null);
        }}
      />
    );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeaderBar title="CORPORATE AR" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-hidden bg-bg">
        <CorporateArForm
          store={store}
          initialCode={focus}
          onOpenDB={(oldOnly = false) => {
            setFocus(null);
            setDb({ oldOnly });
          }}
        />
      </div>
    </div>
  );
}
