import { useCallback, useEffect, useMemo, useState } from "react";

interface FileNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: FileNode[];
}

interface ActivityEntry {
  id: string;
  level: "info" | "success" | "error";
  message: string;
  timestamp: string;
}

export interface WorkspaceEditorState {
  tree: FileNode[];
  selectedPath?: string;
  content: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  activities: ActivityEntry[];
  selectFile: (path: string) => Promise<void>;
  updateContent: (nextContent: string) => void;
  saveFile: () => Promise<void>;
  refreshTree: () => Promise<void>;
}

const API_BASE = typeof window === "undefined" ? "http://127.0.0.1:8787" : "";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

function flattenFiles(nodes: FileNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      out.push(node.path);
    }
    if (node.children) {
      out.push(...flattenFiles(node.children));
    }
  }
  return out;
}

export function useWorkspaceEditor(): WorkspaceEditorState {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  const pushActivity = useCallback((level: ActivityEntry["level"], message: string) => {
    setActivities((previous) => [
      {
        id: crypto.randomUUID(),
        level,
        message,
        timestamp: new Date().toISOString()
      },
      ...previous
    ].slice(0, 40));
  }, []);

  const refreshTree = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/api/files/tree?path="));
      if (!response.ok) {
        throw new Error("failed to fetch workspace tree");
      }
      const payload = (await response.json()) as { tree: FileNode[] };
      setTree(payload.tree);
      pushActivity("info", "Workspace tree refreshed");

      if (!selectedPath) {
        const firstFile = flattenFiles(payload.tree)[0];
        if (firstFile) {
          setSelectedPath(firstFile);
        }
      }
    } catch (error) {
      pushActivity("error", `Tree refresh failed: ${(error as Error).message}`);
    }
  }, [pushActivity, selectedPath]);

  const selectFile = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/files/read?path=${encodeURIComponent(path)}`));
        if (!response.ok) {
          throw new Error("failed to read file");
        }
        const payload = (await response.json()) as { path: string; content: string };
        setSelectedPath(payload.path);
        setContent(payload.content);
        setLoadedContent(payload.content);
        pushActivity("info", `Opened ${payload.path}`);
      } catch (error) {
        pushActivity("error", `Open failed: ${(error as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [pushActivity]
  );

  const updateContent = useCallback((nextContent: string) => {
    setContent(nextContent);
  }, []);

  const saveFile = useCallback(async () => {
    if (!selectedPath) {
      pushActivity("error", "No file selected");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(apiUrl("/api/files/write"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: selectedPath, content })
      });
      if (!response.ok) {
        throw new Error("failed to save file");
      }
      setLoadedContent(content);
      pushActivity("success", `Saved ${selectedPath}`);
      await refreshTree();
    } catch (error) {
      pushActivity("error", `Save failed: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [selectedPath, content, pushActivity, refreshTree]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    if (selectedPath) {
      void selectFile(selectedPath);
    }
  }, [selectedPath, selectFile]);

  const dirty = useMemo(() => content !== loadedContent, [content, loadedContent]);

  return {
    tree,
    selectedPath,
    content,
    loading,
    saving,
    dirty,
    activities,
    selectFile,
    updateContent,
    saveFile,
    refreshTree
  };
}
