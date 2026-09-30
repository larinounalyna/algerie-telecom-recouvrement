import PageHero from "../../shared/ui/PageHero";
import SelectionCard from "../../shared/ui/SelectionCard";

export type Segment = "particuliers" | "entreprises";

interface Props {
  onSelect: (s: Segment) => void;
}

/** First screen: which kind of customers are we working on? */
export default function HomePage({ onSelect }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 bg-bg overflow-auto">
      <PageHero title="Gestion des Factures" subtitle="Choisissez le type de clients" />

      <div className="w-full max-w-3xl grid grid-cols-2 gap-6">
        <SelectionCard
          variant="red"
          badgeLabel="CP"
          title="Clients particuliers"
          subtitle="Hors Gaïa et Après Gaïa"
          onClick={() => onSelect("particuliers")}
        />
        <SelectionCard
          variant="emerald"
          badgeLabel="AR"
          title="Corporate AR"
          subtitle="Créances des entreprises"
          onClick={() => onSelect("entreprises")}
        />
      </div>
    </div>
  );
}
