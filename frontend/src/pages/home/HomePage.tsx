import PageHero from "../../shared/ui/PageHero";
import SelectionCard from "../../shared/ui/SelectionCard";

export type Segment = "particuliers" | "entreprises" | "projets";

interface Props {
  onSelect: (s: Segment) => void;
}

/** First screen: which kind of customers are we working on? */
export default function HomePage({ onSelect }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-auto bg-bg">
      <div className="h-1.5 flex-shrink-0 bg-gradient-to-r from-brand via-brand to-leaf" />
      <div className="flex-1 flex flex-col items-center justify-center p-10">
        <PageHero title="Gestion du Recouvrement" subtitle="Service Recouvrement — choisissez le type de clients" />

        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-5">
          <SelectionCard variant="red" badgeLabel="LS" title="LSPN" subtitle="Hors Gaïa et Après Gaïa" onClick={() => onSelect("particuliers")} />
          <SelectionCard variant="emerald" badgeLabel="AR" title="Corporate AR" subtitle="Créances des entreprises" onClick={() => onSelect("entreprises")} />
          <SelectionCard variant="purple" badgeLabel="PR" title="Projets" subtitle="Suivi des contrats et avenants" onClick={() => onSelect("projets")} />
        </div>
      </div>
      <footer className="flex-shrink-0 text-center text-xs text-muted py-3 border-t border-border bg-white">
        Algérie Télécom SPA — Capital social 115 000 000 000 DA — RC 02 B 18083
      </footer>
    </div>
  );
}
