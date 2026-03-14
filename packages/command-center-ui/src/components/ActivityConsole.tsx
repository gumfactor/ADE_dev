interface ActivityEntry {
  id: string;
  level: "info" | "success" | "error";
  message: string;
  timestamp: string;
}

interface ActivityConsoleProps {
  activities: ActivityEntry[];
}

const LEVEL_COLOR: Record<ActivityEntry["level"], string> = {
  info: "#96c2ff",
  success: "#8ef0b7",
  error: "#ff9f9f"
};

export function ActivityConsole({ activities }: ActivityConsoleProps): JSX.Element {
  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(8, 16, 30, 0.72)",
        padding: 10,
        minHeight: 200,
        overflow: "auto"
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Activity Console</h3>
      {activities.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>No activity yet</p>
      ) : (
        activities.map((entry) => (
          <p key={entry.id} style={{ margin: "0 0 6px", fontSize: 12, color: LEVEL_COLOR[entry.level] }}>
            [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.message}
          </p>
        ))
      )}
    </section>
  );
}
