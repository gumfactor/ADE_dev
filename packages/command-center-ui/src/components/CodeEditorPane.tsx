interface CodeEditorPaneProps {
  selectedPath?: string;
  content: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function CodeEditorPane({ selectedPath, content, loading, saving, dirty, onChange, onSave }: CodeEditorPaneProps): JSX.Element {
  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(7, 12, 24, 0.72)",
        padding: 10,
        minHeight: 380,
        display: "grid",
        gap: 8,
        gridTemplateRows: "auto 1fr"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{selectedPath ?? "No file selected"}</h3>
        <button
          type="button"
          onClick={onSave}
          disabled={!selectedPath || saving || loading || !dirty}
          style={{
            border: "1px solid rgba(86, 201, 154, 0.7)",
            borderRadius: 8,
            background: "rgba(24, 80, 62, 0.6)",
            color: "#dbfff1",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 12,
            opacity: !selectedPath || saving || loading || !dirty ? 0.55 : 1
          }}
        >
          {saving ? "Saving..." : dirty ? "Save" : "Saved"}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        style={{
          width: "100%",
          minHeight: 320,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(1, 6, 14, 0.85)",
          color: "#e7f0ff",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          padding: 10,
          resize: "vertical"
        }}
      />
    </section>
  );
}
