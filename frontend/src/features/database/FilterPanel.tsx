import { ReactNode, useMemo } from "react";
import { AccentTheme, DbKind } from "../../types";
import { DbRow, FilterState, countActive, distinct, emptyFilters } from "../../shared/lib/dbRows";
import { STADES } from "../../shared/lib/juridique";

interface Props {
  kind: DbKind;
  rows: DbRow[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  accent: AccentTheme;
  /** Filters that are fixed by the context (e.g. monthly extraction) and must not be shown. */
  hide?: (keyof FilterState)[];
  /** Filters that don't count as "active" because they're the tab's defaults. */
  baseline?: Partial<FilterState>;
}

const inputBase =
  "w-full bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-[#1C2235] focus:outline-none transition-colors placeholder:text-gray-400";

function Group({ title, accent, children }: { title: string; accent: AccentTheme; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
        <span className="text-sm text-[#1C2235]">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block text-[11px] text-gray-500">
      <span className="block mb-0.5">{text}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, text }: { checked: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#1C2235] cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-current" />
      {text}
    </label>
  );
}

export default function FilterPanel({ kind, rows, value: f, onChange, accent, hide = [], baseline = {} }: Props) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => onChange({ ...f, [k]: v });
  const show = (k: keyof FilterState) => !hide.includes(k);
  const sel = `${inputBase} ${accent.focusBorder}`;

  const real = kind !== "entreprise"; // avant_gaia / apres_gaia: filters use the real columns
  const actels = useMemo(() => distinct(rows, (r) => r.actel), [rows]);
  const typesCompte = useMemo(() => distinct(rows, (r) => r.typeCompte), [rows]);
  const codetats = useMemo(() => distinct(rows, (r) => r.codetat), [rows]);
  const motifs = useMemo(() => distinct(rows, (r) => r.motifRes), [rows]);
  const bimestres = useMemo(() => distinct(rows, (r) => r.bimestre), [rows]);
  const wilayas = useMemo(() => distinct(rows, (r) => r.wilaya), [rows]);
  const communes = useMemo(
    () => distinct(f.wilaya ? rows.filter((r) => r.wilaya === f.wilaya) : rows, (r) => r.commune),
    [rows, f.wilaya],
  );
  const services = useMemo(() => distinct(rows, (r) => r.typeService), [rows]);
  const statuts = useMemo(() => distinct(rows, (r) => r.statut), [rows]);
  const formes = useMemo(() => distinct(rows, (r) => r.formeJuridique), [rows]);
  const secteurs = useMemo(() => distinct(rows, (r) => r.secteur), [rows]);

  const reset = () => onChange({ ...emptyFilters, ...baseline });
  const active = countActive(f, [...hide, ...(Object.keys(baseline) as (keyof FilterState)[])]) +
    (Object.keys(baseline) as (keyof FilterState)[]).filter((k) => f[k] !== baseline[k]).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#1C2235]">
          Filtres{" "}
          {active > 0 && <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] ${accent.badge}`}>{active} actif(s)</span>}
        </span>
        <button
          onClick={reset}
          disabled={active === 0}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            active === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Réinitialiser
        </button>
      </div>

      {show("search") && (
        <Label text="Recherche libre">
          <input
            type="search"
            className={sel}
            placeholder={real ? "N°, intitulé, adresse…" : "N°, nom, adresse, téléphone…"}
            value={f.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </Label>
      )}

      {!real && (
        <Group title="Localisation" accent={accent}>
        <Label text="Wilaya">
          <select
            className={sel}
            value={f.wilaya}
            onChange={(e) => onChange({ ...f, wilaya: e.target.value, commune: "" })}
          >
            <option value="">Toutes les wilayas</option>
            {wilayas.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Commune">
          <select className={sel} value={f.commune} onChange={(e) => set("commune", e.target.value)}>
            <option value="">Toutes les communes</option>
            {communes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Label>
      </Group>
      )}

      {real && (
        <Group title="Table" accent={accent}>
          {kind === "apres" && (
            <Label text="Commune">
              <select className={sel} value={f.commune} onChange={(e) => set("commune", e.target.value)}>
                <option value="">Toutes les communes</option>
                {communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Label>
          )}
          <Label text="actel">
            <select className={sel} value={f.actel} onChange={(e) => set("actel", e.target.value)}>
              <option value="">Tous</option>
              {actels.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Label>
          <Label text="type_de_compte">
            <select className={sel} value={f.typeCompte} onChange={(e) => set("typeCompte", e.target.value)}>
              <option value="">Tous</option>
              {typesCompte.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Label>
          {kind === "avant" ? (
            <Label text="Bimestre (n_bimestre/annee_bimestre)">
              <select className={sel} value={f.bimestre} onChange={(e) => set("bimestre", e.target.value)}>
                <option value="">Tous</option>
                {bimestres.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Label>
          ) : (
            <>
              <Label text="codetat">
                <select className={sel} value={f.codetat} onChange={(e) => set("codetat", e.target.value)}>
                  <option value="">Tous</option>
                  {codetats.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </Label>
              <Label text="motif res">
                <select className={sel} value={f.motifRes} onChange={(e) => set("motifRes", e.target.value)}>
                  <option value="">Tous</option>
                  {motifs.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </Label>
            </>
          )}
        </Group>
      )}

      {kind === "entreprise" && (
        <Group title="Entreprise" accent={accent}>
          <Label text="Forme juridique">
            <select className={sel} value={f.formeJuridique} onChange={(e) => set("formeJuridique", e.target.value)}>
              <option value="">Toutes</option>
              {formes.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Secteur d'activité">
            <select className={sel} value={f.secteur} onChange={(e) => set("secteur", e.target.value)}>
              <option value="">Tous</option>
              {secteurs.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Label>
        </Group>
      )}

      {!real && (
      <Group title="Contrat" accent={accent}>
        <Label text="Type de service">
          <select className={sel} value={f.typeService} onChange={(e) => set("typeService", e.target.value)}>
            <option value="">Tous les services</option>
            {services.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Statut du compte">
          <select className={sel} value={f.statut} onChange={(e) => set("statut", e.target.value)}>
            <option value="">Tous les statuts</option>
            {statuts.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Label text="Créé à partir du">
            <input type="date" className={`${sel} font-mono`} value={f.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
          </Label>
          <Label text="Jusqu'au">
            <input type="date" className={`${sel} font-mono`} value={f.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
          </Label>
        </div>
      </Group>
      )}

      {real && (
        <Group title="Période" accent={accent}>
          <div className="grid grid-cols-2 gap-2">
            <Label text={kind === "avant" ? "Créé à partir du" : "Vigueur abt. à partir du"}>
              <input type="date" className={`${sel} font-mono`} value={f.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
            </Label>
            <Label text="Jusqu'au">
              <input type="date" className={`${sel} font-mono`} value={f.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
            </Label>
          </div>
        </Group>
      )}

      <Group title="Situation financière" accent={accent}>
        {show("soldeMode") && (
          <Label text="Solde">
            <select className={sel} value={f.soldeMode} onChange={(e) => set("soldeMode", e.target.value as FilterState["soldeMode"])}>
              <option value="tous">Tous</option>
              <option value="du">Doit de l'argent</option>
              <option value="solde">Soldé</option>
            </select>
          </Label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Label text="Solde dû min. (DA)">
            <input type="number" min={0} className={`${sel} font-mono`} value={f.soldeMin} onChange={(e) => set("soldeMin", e.target.value)} />
          </Label>
          <Label text="Solde dû max. (DA)">
            <input type="number" min={0} className={`${sel} font-mono`} value={f.soldeMax} onChange={(e) => set("soldeMax", e.target.value)} />
          </Label>
        </div>
        <Label text="Sans versement depuis (jours)">
          <input
            type="number"
            min={0}
            className={`${sel} font-mono`}
            placeholder="ex. 90"
            value={f.sansVersementJours}
            onChange={(e) => set("sansVersementJours", e.target.value)}
          />
        </Label>
      </Group>

      {(show("med") || show("stade")) && (
        <Group title="Situation juridique" accent={accent}>
          {show("med") && (
            <Label text="Mise en demeure">
              <select className={sel} value={f.med} onChange={(e) => set("med", e.target.value as FilterState["med"])}>
                <option value="tous">Tous</option>
                <option value="jamais">Jamais mis en demeure</option>
                <option value="deja">Déjà mis en demeure</option>
              </select>
            </Label>
          )}
          {show("stade") && (
            <Label text="État juridique">
              <select className={sel} value={f.stade} onChange={(e) => set("stade", e.target.value as FilterState["stade"])}>
                <option value="">Tous les états</option>
                {STADES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Label>
          )}
        </Group>
      )}

      <Group title="Données à renseigner" accent={accent}>
        <Check checked={f.requireAdresse} onChange={(v) => set("requireAdresse", v)} text="Adresse renseignée" />
        {kind !== "avant" && (
          <Check checked={f.requireTelephone} onChange={(v) => set("requireTelephone", v)} text={kind === "apres" ? "N° d'appel renseigné" : "Téléphone renseigné"} />
        )}
        {kind === "entreprise" && <Check checked={f.requireNif} onChange={(v) => set("requireNif", v)} text="NIF renseigné" />}
      </Group>
    </div>
  );
}
