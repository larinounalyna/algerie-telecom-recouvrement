import type { View } from "../../app/navigation";
import PageHero from "../../shared/ui/PageHero";
import SelectionCard from "../../shared/ui/SelectionCard";
import BackLink from "../../shared/ui/BackLink";

interface Props {
  onSelect: (v: View) => void;
  onBack: () => void;
}

/** Particuliers: choose the legacy (Hors Gaïa) or the current (Après Gaïa) system. */
export default function ClientTypeSelectPage({ onSelect, onBack }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-auto bg-bg">
      <div className="h-1.5 flex-shrink-0 bg-gradient-to-r from-brand via-brand to-leaf" />
      <div className="px-6 pt-5">
        <BackLink onClick={onBack} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-10">
        <PageHero title="Clients particuliers" subtitle="Choisissez le système de facturation" />

        <div className="w-full max-w-3xl grid grid-cols-2 gap-5">
          <SelectionCard variant="amber" badgeLabel="HG" title="Hors Gaïa" subtitle="Abonnés de l'ancien système" onClick={() => onSelect("hors-gaia")} />
          <SelectionCard variant="blue" badgeLabel="AG" title="Après Gaïa" subtitle="Comptes résiliés Après Gaïa" onClick={() => onSelect("apres-gaia")} />
        </div>
      </div>
    </div>
  );
}
