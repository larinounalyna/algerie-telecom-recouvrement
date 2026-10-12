import { useMemo, useState } from "react";
import { errorMessage, projectsApi } from "../../api";
import type { ReactNode } from "react";
import { fmtDA, fmtDate } from "../../shared/lib/format";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";
import PageHeaderBar from "../../shared/ui/PageHeaderBar";
import ProjectFormModal from "./ProjectFormModal";
import type { ProjectFileChanges, ProjectInput, ProjectRecord } from "./types";
import { useProjects } from "./useProjects";

interface Props {
  onBack: () => void;
}

const text = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "—" : value);
const sizeLabel = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} Ko` : `${(size / (1024 * 1024)).toFixed(1)} Mo`;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 truncate text-sm text-[#1C2235]">{children}</div>
    </div>
  );
}

/** Project contract tracking, following the full-window Corporate AR database shell. */
export default function ProjectArPage({ onBack }: Props) {
  const store = useProjects();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ initial?: ProjectRecord } | null>(null);
  const [deleting, setDeleting] = useState<ProjectRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);

  const projects = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    if (!q) return store.projects;
    return store.projects.filter((project) => [
      project.projectName,
      project.contractNumber,
      `PROJ-${String(project.id).padStart(6, "0")}`,
      ...project.amendmentNumbers.map(String),
      ...project.piecesRemises,
    ].some((value) => value.toLocaleLowerCase("fr").includes(q)));
  }, [query, store.projects]);

  const save = async (data: ProjectInput, changes: ProjectFileChanges) => {
    if (!modal) return;
    const result = modal.initial
      ? await store.update(modal.initial, data, changes)
      : await store.create(data, changes);
    setActionError(null);
    setFileWarning(result.failedFiles.length ? result.failedFiles.join(" ; ") : null);
    setModal(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeaderBar title="Projets — Suivi des contrats" onBack={onBack} />
      <main className="flex-1 min-h-0 overflow-auto bg-bg px-5 py-4">
        <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">
          <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-[#1C2235]">Suivi des projets</h2>
              <p className="mt-1 text-sm text-gray-500">Contrats, avenants, pièces remises, facturation et documents joints.</p>
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2 sm:flex-nowrap">
              <label className="min-w-[220px] flex-1">
                <span className="sr-only">Rechercher un projet</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher par nom, contrat ou référence…"
                  className="w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-[#1C2235] focus:border-violet-500 focus:outline-none"
                />
              </label>
              <button
                onClick={() => { setActionError(null); setModal({}); }}
                className="whitespace-nowrap rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                + Nouveau projet
              </button>
              <button
                onClick={() => void store.reload()}
                disabled={!store.loaded}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Actualiser
              </button>
            </div>
          </section>

          {(store.error || actionError) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{actionError ?? store.error}</p>}
          {fileWarning && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Projet enregistré, mais certains documents n’ont pas pu être traités : {fileWarning}. Rouvrez « Modifier » pour réessayer.
            </p>
          )}

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-[#1C2235]">Projets enregistrés</h3>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">{projects.length} / {store.projects.length}</span>
            </div>
            {!store.loaded ? (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Chargement des projets…</div>
            ) : projects.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-medium text-gray-700">{store.projects.length ? "Aucun projet ne correspond à la recherche." : "Aucun projet enregistré."}</p>
                {!store.projects.length && <p className="text-xs text-gray-500">Créez un projet pour commencer le suivi de ses contrats et pièces.</p>}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="divide-y divide-gray-100">
                  {projects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      onEdit={() => { setActionError(null); setModal({ initial: project }); }}
                      onDelete={() => setDeleting(project)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {modal && (
        <ProjectFormModal
          initial={modal.initial}
          onCancel={() => setModal(null)}
          onSave={save}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer ce projet ?"
          confirmLabel="Supprimer"
          tone="danger"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await store.remove(deleting.id);
              setActionError(null);
              setFileWarning(null);
            } catch (error) {
              setActionError(`Suppression impossible : ${errorMessage(error)}`);
            } finally {
              setDeleting(null);
            }
          }}
        >
          <p><b>{deleting.projectName}</b> (PROJ-{String(deleting.id).padStart(6, "0")}) et ses documents joints seront supprimés définitivement.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function ProjectRow({ project, onEdit, onDelete }: { project: ProjectRecord; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="p-4 transition-colors hover:bg-violet-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-semibold text-[#1C2235]">{project.projectName}</h4>
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600">PROJ-{String(project.id).padStart(6, "0")}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Contrat : <span className="font-mono text-gray-700">{project.contractNumber}</span></p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={onEdit} className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">Modifier</button>
          <button onClick={onDelete} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Supprimer</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4 xl:grid-cols-6">
        <Detail label="Lancement">{fmtDate(project.launchDate)}</Detail>
        <Detail label="Fin du projet">{text(project.endDate) === "—" ? "—" : fmtDate(project.endDate)}</Detail>
        <Detail label="Avenants">{project.amendmentNumbers.length ? project.amendmentNumbers.join(", ") : "Aucun"}</Detail>
        <Detail label="Devis estimatif">{project.estimatedAmount === null ? "—" : fmtDA(project.estimatedAmount)}</Detail>
        <Detail label="Facture définitive">{project.finalInvoiceAmount === null ? "—" : fmtDA(project.finalInvoiceAmount)}</Detail>
        <Detail label="Paiement">{text(project.paymentDate) === "—" ? "—" : fmtDate(project.paymentDate)}</Detail>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-2 border-t border-gray-100 pt-3">
        <div className="min-w-[180px] flex-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Pièces remises</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {project.piecesRemises.length ? project.piecesRemises.map((piece, index) => <span key={`${piece}-${index}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-800">{piece}</span>) : <span className="text-xs text-gray-400">Aucune</span>}
          </div>
        </div>
        <div className="min-w-[180px] flex-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Documents joints ({project.files.length})</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {project.files.length ? project.files.map((file) => (
              <a key={file.id} href={projectsApi.fileUrl(project.id, file.id)} target="_blank" rel="noreferrer" className="max-w-full truncate text-xs text-violet-700 underline" title={`${file.name} (${sizeLabel(file.size)})`}>
                {file.type === "application/pdf" ? "📄" : "🖼️"} {file.name} <span className="text-gray-400">({sizeLabel(file.size)})</span>
              </a>
            )) : <span className="text-xs text-gray-400">Aucun document</span>}
          </div>
        </div>
      </div>
    </article>
  );
}



