import { useCallback, useEffect, useState } from "react";
import { errorMessage, projectsApi } from "../../api";
import { useRealtime } from "../../hooks/useRealtime";
import type { ProjectFileChanges, ProjectInput, ProjectRecord } from "./types";

export interface ProjectSaveResult {
  project: ProjectRecord;
  failedFiles: string[];
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setProjects(await projectsApi.list());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useRealtime((message) => {
    if (message.event === "project_ar.changed") void reload();
  });

  const applyFiles = useCallback(async (id: number, changes: ProjectFileChanges, existing: ProjectRecord["files"]): Promise<string[]> => {
    const failed: string[] = [];
    for (const fileId of changes.removeIds) {
      try {
        await projectsApi.deleteFile(id, fileId);
      } catch (e) {
        failed.push(`${existing.find((file) => file.id === fileId)?.name ?? `document ${fileId}`} (${errorMessage(e)})`);
      }
    }
    for (const file of changes.add) {
      try {
        await projectsApi.uploadFile(id, file);
      } catch (e) {
        failed.push(`${file.name} (${errorMessage(e)})`);
      }
    }
    return failed;
  }, []);

  const create = useCallback(
    async (data: ProjectInput, changes: ProjectFileChanges): Promise<ProjectSaveResult> => {
      const project = await projectsApi.create(data);
      const failedFiles = await applyFiles(project.id, changes, []);
      await reload();
      return { project, failedFiles };
    },
    [applyFiles, reload],
  );

  const update = useCallback(
    async (current: ProjectRecord, data: ProjectInput, changes: ProjectFileChanges): Promise<ProjectSaveResult> => {
      const project = await projectsApi.update(current.id, data);
      const failedFiles = await applyFiles(current.id, changes, current.files);
      await reload();
      return { project, failedFiles };
    },
    [applyFiles, reload],
  );

  const remove = useCallback(
    async (id: number) => {
      await projectsApi.remove(id);
      await reload();
    },
    [reload],
  );

  return { projects, loaded, error, reload, create, update, remove };
}
