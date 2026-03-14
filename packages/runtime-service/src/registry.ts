export type ToolTrustLevel = "trusted" | "restricted" | "untrusted";

export interface ToolRegistryEntry {
  id: string;
  name: string;
  version: string;
  trustLevel: ToolTrustLevel;
  enabled: boolean;
  scopes: Array<"single_file" | "workspace" | "repo" | "system">;
}

export interface McpRegistryEntry {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  endpoint: string;
}

export class RuntimeRegistryStore {
  private readonly tools = new Map<string, ToolRegistryEntry>();
  private readonly mcps = new Map<string, McpRegistryEntry>();

  constructor() {
    this.seedDefaults();
  }

  listTools(): ToolRegistryEntry[] {
    return [...this.tools.values()];
  }

  listMcps(): McpRegistryEntry[] {
    return [...this.mcps.values()];
  }

  getTool(toolId: string): ToolRegistryEntry | undefined {
    return this.tools.get(toolId);
  }

  assertToolAllowed(toolId: string, scope: "single_file" | "workspace" | "repo" | "system"): {
    ok: boolean;
    error?: string;
  } {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { ok: false, error: `tool not found in registry: ${toolId}` };
    }
    if (!tool.enabled) {
      return { ok: false, error: `tool is disabled by policy: ${toolId}` };
    }
    if (!tool.scopes.includes(scope)) {
      return { ok: false, error: `tool scope ${scope} is not allowed for ${toolId}` };
    }
    return { ok: true };
  }

  setToolEnabled(toolId: string, enabled: boolean): ToolRegistryEntry {
    const existing = this.tools.get(toolId);
    if (!existing) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    const updated = { ...existing, enabled };
    this.tools.set(toolId, updated);
    return updated;
  }

  private seedDefaults(): void {
    const seededTools: ToolRegistryEntry[] = [
      {
        id: "planner.generate_plan",
        name: "Planner Generate Plan",
        version: "0.1.0",
        trustLevel: "trusted",
        enabled: true,
        scopes: ["workspace", "repo"]
      },
      {
        id: "filesystem.write",
        name: "Filesystem Write",
        version: "0.1.0",
        trustLevel: "restricted",
        enabled: true,
        scopes: ["single_file", "workspace", "repo"]
      },
      {
        id: "terminal.run_tests",
        name: "Terminal Run Tests",
        version: "0.1.0",
        trustLevel: "trusted",
        enabled: true,
        scopes: ["workspace", "repo"]
      },
      {
        id: "deploy.prepare",
        name: "Deploy Prepare",
        version: "0.1.0",
        trustLevel: "restricted",
        enabled: true,
        scopes: ["repo", "system"]
      }
    ];

    const seededMcps: McpRegistryEntry[] = [
      {
        id: "mcp.internal.tools",
        name: "Internal Tools MCP",
        version: "0.1.0",
        enabled: true,
        endpoint: "mcp://internal/tools"
      },
      {
        id: "mcp.security.audit",
        name: "Security Audit MCP",
        version: "0.1.0",
        enabled: true,
        endpoint: "mcp://security/audit"
      }
    ];

    for (const tool of seededTools) {
      this.tools.set(tool.id, tool);
    }
    for (const mcp of seededMcps) {
      this.mcps.set(mcp.id, mcp);
    }
  }
}
