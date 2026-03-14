interface FileNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: FileNode[];
}

interface WorkspaceExplorerProps {
  tree: FileNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}

function renderNode(node: FileNode, selectedPath: string | undefined, onSelect: (path: string) => void, depth: number): JSX.Element {
  const isSelected = node.path === selectedPath;
  return (
    <div key={node.path} style={{ marginLeft: depth * 12 }}>
      <button
        type="button"
        onClick={() => {
          if (node.kind === "file") {
            onSelect(node.path);
          }
        }}
        style={{
          width: "100%",
          textAlign: "left",
          border: "none",
          background: isSelected ? "rgba(84, 150, 255, 0.35)" : "transparent",
          color: node.kind === "directory" ? "#b8cff8" : "#f1f6ff",
          borderRadius: 6,
          padding: "4px 6px",
          cursor: node.kind === "file" ? "pointer" : "default",
          fontSize: 12
        }}
      >
        {node.kind === "directory" ? "[dir]" : "[file]"} {node.name}
      </button>
      {node.children?.map((child) => renderNode(child, selectedPath, onSelect, depth + 1))}
    </div>
  );
}

export function WorkspaceExplorer({ tree, selectedPath, onSelect }: WorkspaceExplorerProps): JSX.Element {
  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(8, 22, 34, 0.65)",
        padding: 10,
        overflow: "auto",
        minHeight: 380
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Workspace</h3>
      {tree.length === 0 ? <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>No files</p> : tree.map((node) => renderNode(node, selectedPath, onSelect, 0))}
    </section>
  );
}
