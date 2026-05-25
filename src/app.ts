/**
 * REST and MCP services to explore ArchiMate models.
 *
 * All data endpoints are prefixed by /:source_id/ so that multiple models
 * can be served simultaneously. Available sources are declared in config.json.
 *
 * Routes:
 *   GET /openapi.json
 *   GET /docs
 *   GET /sources
 *   GET /:source_id/
 *   GET /:source_id/elements[/types|/:id]
 *   GET /:source_id/relationships[/types|/:id]
 *   GET /:source_id/views[/:id]
 *   POST|GET|DELETE /mcp/
 */

import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView } from "./model.js";
import { registry, defaultSourceId, DataSource } from "./registry.js";
import { openApiSpec } from "./openapi.js";
import {
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  ConnectionOut,
  ElementOut,
  FontOut,
  ModelInfo,
  NodeOut,
  PropertyOut,
  RGBColorOut,
  RelationshipOut,
  StyleOut,
  ViewDetailOut,
  ViewOut,
} from "./schemas.js";

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hexStr: string | null | undefined): RGBColorOut | null {
  if (!hexStr) return null;
  const s = hexStr.replace(/^#/, "");
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function colorOut(color: { r: number; g: number; b: number; a?: number | null } | null): RGBColorOut | null {
  if (!color) return null;
  return { r: color.r, g: color.g, b: color.b };
}

function fontOut(obj: {
  font_name?: string | null;
  font_size?: number | null;
  font_color?: { r: number; g: number; b: number; a?: number | null } | null;
}): FontOut | null {
  const name = obj.font_name ?? null;
  const size = obj.font_size ?? null;
  const color = colorOut(obj.font_color ?? null);
  if (name || size !== null || color) return { name, size, color };
  return null;
}

function nodeStyleOut(n: ArchiNode): StyleOut | null {
  const fill = colorOut(n.fill_color);
  const line = colorOut(n.line_color);
  const font = fontOut(n);
  const lw = n.line_width ?? null;
  if (fill || line || font || lw !== null) {
    return { fill_color: fill, line_color: line, font, line_width: lw };
  }
  return null;
}

function connStyleOut(c: ArchiConnection): StyleOut | null {
  const line = colorOut(c.line_color);
  const font = fontOut(c);
  const lw = c.line_width ?? null;
  if (line || font || lw !== null) return { line_color: line, font, line_width: lw };
  return null;
}

// ---------------------------------------------------------------------------
// Conversion helpers (exported for unit tests)
// ---------------------------------------------------------------------------

function propsOut(props: Record<string, string>): PropertyOut[] {
  return Object.entries(props).map(([k, v]) => ({ property_definition_ref: k, value: v }));
}

export function elementOut(e: ArchiElement): ElementOut {
  return {
    identifier: e.uuid,
    name: e.name || "",
    type: e.type || "",
    documentation: e.desc || null,
    properties: propsOut(e.props),
  };
}

export function relOut(r: ArchiRelationship): RelationshipOut {
  const src = r.source;
  const tgt = r.target;
  const relType = r.type || "";
  return {
    identifier: r.uuid,
    name: r.name || null,
    type: relType,
    source: typeof src === "string" ? src : src.uuid,
    source_name: typeof src === "string" ? null : (src.name || null),
    target: typeof tgt === "string" ? tgt : tgt.uuid,
    target_name: typeof tgt === "string" ? null : (tgt.name || null),
    documentation: r.desc || null,
    properties: propsOut(r.props),
    access_type: relType === "Access" ? (r.access_type || null) : null,
    is_directed: relType === "Association" ? r.is_directed : null,
    modifier: relType === "Influence" && r.influence_strength != null ? String(r.influence_strength) : null,
  };
}

export function nodeOut(n: ArchiNode): NodeOut {
  const ref = n.ref;
  const element_ref = ref === null ? null : typeof ref === "string" ? ref : ref.uuid;
  return {
    identifier: n.uuid,
    name: n.name || null,
    element_ref,
    x: n.x !== null ? Math.round(n.x) : null,
    y: n.y !== null ? Math.round(n.y) : null,
    w: n.w !== null ? Math.round(n.w) : null,
    h: n.h !== null ? Math.round(n.h) : null,
    style: nodeStyleOut(n),
    children: n.nodes.map(nodeOut),
  };
}

export function connectionOut(c: ArchiConnection): ConnectionOut {
  return {
    identifier: c.uuid,
    name: c.name || null,
    relationship_ref: c.ref || null,
    source: c.source || null,
    target: c.target || null,
    style: connStyleOut(c),
  };
}

export function viewOut(v: ArchiView, detail?: false): ViewOut;
export function viewOut(v: ArchiView, detail: true): ViewDetailOut;
export function viewOut(v: ArchiView, detail = false): ViewOut | ViewDetailOut {
  const base: ViewOut = {
    identifier: v.uuid,
    name: v.name || "",
    documentation: v.desc || null,
    viewpoint: v.primary_viewpoint || null,
    node_count: v.nodes.length,
    connection_count: v.conns.length,
  };
  if (detail) {
    return { ...base, nodes: v.nodes.map(nodeOut), connections: v.conns.map(connectionOut) } as ViewDetailOut;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Business logic (shared by REST + MCP)
// ---------------------------------------------------------------------------

export function getModelInfo(ds: DataSource): ModelInfo {
  const { model } = ds;
  return {
    identifier: model.uuid || "",
    name: model.name || "",
    documentation: model.desc || null,
    version: model.version || null,
    element_count: model.elements.length,
    relationship_count: model.relationships.length,
    view_count: model.views.length,
  };
}

export function listElementTypes(ds: DataSource): string[] {
  return ds.elementTypes;
}

export function listElements(ds: DataSource, element_type?: string | null, name?: string | null): ElementOut[] {
  let elements = ds.model.elements;
  if (element_type) elements = elements.filter((e) => e.type === element_type);
  if (name) {
    const nl = name.toLowerCase();
    elements = elements.filter((e) => e.name && e.name.toLowerCase().includes(nl));
  }
  return elements.map(elementOut);
}

export function getElementById(ds: DataSource, element_id: string): ElementOut {
  const match = ds.model.elements.find((e) => e.uuid === element_id);
  if (!match) throw new Error(`Élément '${element_id}' introuvable.`);
  return elementOut(match);
}

export function listRelationshipTypes(ds: DataSource): string[] {
  return ds.relationshipTypes;
}

export function listRelationships(
  ds: DataSource,
  rel_type?: string | null,
  source_id?: string | null,
  target_id?: string | null
): RelationshipOut[] {
  let rels = ds.model.relationships;
  if (rel_type) rels = rels.filter((r) => r.type === rel_type);
  if (source_id) {
    rels = rels.filter((r) => {
      const src = r.source;
      return typeof src === "string" ? src === source_id : src.uuid === source_id;
    });
  }
  if (target_id) {
    rels = rels.filter((r) => {
      const tgt = r.target;
      return typeof tgt === "string" ? tgt === target_id : tgt.uuid === target_id;
    });
  }
  return rels.map(relOut);
}

export function getRelationshipById(ds: DataSource, relationship_id: string): RelationshipOut {
  const match = ds.model.relationships.find((r) => r.uuid === relationship_id);
  if (!match) throw new Error(`Relation '${relationship_id}' introuvable.`);
  return relOut(match);
}

export function listViews(ds: DataSource): ViewOut[] {
  return ds.model.views.map((v) => viewOut(v));
}

export function getViewById(ds: DataSource, view_id: string): ViewDetailOut {
  const match = ds.model.views.find((v) => v.uuid === view_id);
  if (!match) throw new Error(`Vue '${view_id}' introuvable.`);
  return viewOut(match, true);
}

// ---------------------------------------------------------------------------
// Input validation helper
// ---------------------------------------------------------------------------

const _ELEMENT_TYPES_STR = [...ELEMENT_TYPES].sort().join(", ");
const _RELATIONSHIP_TYPES_STR = [...RELATIONSHIP_TYPES].sort().join(", ");

function validateType(
  value: string | null | undefined,
  allowed: ReadonlySet<string>,
  typesStr: string,
  label: string,
  res: Response
): boolean {
  if (value && !allowed.has(value)) {
    res.status(422).json({ detail: `Type ${label} invalide: '${value}'. Types valides: ${typesStr}` });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app = express();
app.use(express.json());

// OpenAPI spec and Swagger UI
app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>mcp-archimate — API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});

// List all configured sources
app.get("/sources", (_req: Request, res: Response) => {
  res.json([...registry.values()].map((ds) => ({ id: ds.id, name: ds.name })));
});

// ---------------------------------------------------------------------------
// Per-source router (mounted at /:source_id)
// ---------------------------------------------------------------------------

const sourceRouter = express.Router({ mergeParams: true });

function resolveSource(req: Request, res: Response, next: NextFunction): void {
  const id = req.params["source_id"] as string;
  const ds = registry.get(id);
  if (!ds) {
    res.status(404).json({ detail: `Source '${id}' introuvable.` });
    return;
  }
  res.locals["ds"] = ds;
  next();
}

sourceRouter.use(resolveSource);

// Model info
sourceRouter.get("/", (_req: Request, res: Response) => {
  res.json(getModelInfo(res.locals["ds"] as DataSource));
});

// Elements
sourceRouter.get("/elements/types", (_req: Request, res: Response) => {
  res.json(listElementTypes(res.locals["ds"] as DataSource));
});

sourceRouter.get("/elements", (req: Request, res: Response) => {
  const ds = res.locals["ds"] as DataSource;
  const type = (req.query["type"] as string) || null;
  const name = (req.query["name"] as string) || null;
  if (!validateType(type, ELEMENT_TYPES, _ELEMENT_TYPES_STR, "d'élément ArchiMate", res)) return;
  res.json(listElements(ds, type, name));
});

sourceRouter.get("/elements/:element_id", (req: Request, res: Response) => {
  try {
    res.json(getElementById(res.locals["ds"] as DataSource, req.params["element_id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// Relationships
sourceRouter.get("/relationships/types", (_req: Request, res: Response) => {
  res.json(listRelationshipTypes(res.locals["ds"] as DataSource));
});

sourceRouter.get("/relationships", (req: Request, res: Response) => {
  const ds = res.locals["ds"] as DataSource;
  const type = (req.query["type"] as string) || null;
  const source_id = (req.query["source_id"] as string) || null;
  const target_id = (req.query["target_id"] as string) || null;
  if (!validateType(type, RELATIONSHIP_TYPES, _RELATIONSHIP_TYPES_STR, "de relation ArchiMate", res)) return;
  res.json(listRelationships(ds, type, source_id, target_id));
});

sourceRouter.get("/relationships/:relationship_id", (req: Request, res: Response) => {
  try {
    res.json(getRelationshipById(res.locals["ds"] as DataSource, req.params["relationship_id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// Views
sourceRouter.get("/views", (_req: Request, res: Response) => {
  res.json(listViews(res.locals["ds"] as DataSource));
});

sourceRouter.get("/views/:view_id", (req: Request, res: Response) => {
  try {
    res.json(getViewById(res.locals["ds"] as DataSource, req.params["view_id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const mcpServer = new McpServer({ name: "ArchiMate MCP", version: "2.0.0" });

function toContent(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function resolveSourceOrThrow(source_id: string | undefined): DataSource {
  const id = source_id ?? defaultSourceId;
  const ds = registry.get(id);
  if (!ds) {
    throw new Error(`Source '${id}' introuvable. Sources: ${[...registry.keys()].join(", ")}`);
  }
  return ds;
}

const sourceIdParam = {
  source_id: z.string().optional().describe(`Identifiant de la source de données (défaut: '${defaultSourceId}')`),
};

mcpServer.tool(
  "get_model_info_tool",
  "Retourne les métadonnées globales du modèle ArchiMate chargé (identifiant, nom, version, compteurs).",
  sourceIdParam,
  async ({ source_id }) => toContent(getModelInfo(resolveSourceOrThrow(source_id)))
);

mcpServer.tool(
  "list_element_types_tool",
  "Retourne la liste triée des types d'éléments ArchiMate 3.1 présents dans le modèle.",
  sourceIdParam,
  async ({ source_id }) => toContent(listElementTypes(resolveSourceOrThrow(source_id)))
);

mcpServer.tool(
  "list_elements_tool",
  `Liste les éléments du modèle avec filtres optionnels. element_type doit être un type ArchiMate 3.1 valide parmi: ${_ELEMENT_TYPES_STR}.`,
  {
    ...sourceIdParam,
    element_type: z.string().optional().describe("Type ArchiMate 3.1 (ex: ApplicationComponent)"),
    name: z.string().optional().describe("Filtre par nom (insensible à la casse, sous-chaîne)"),
  },
  async ({ source_id, element_type, name }) => {
    const ds = resolveSourceOrThrow(source_id);
    if (element_type && !ELEMENT_TYPES.has(element_type)) {
      throw new Error(`Type d'élément invalide: '${element_type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(listElements(ds, element_type, name));
  }
);

mcpServer.tool(
  "get_element_tool",
  "Retourne le détail d'un élément ArchiMate par son identifiant (champ 'identifier').",
  { ...sourceIdParam, element_id: z.string().describe("Identifiant de l'élément") },
  async ({ source_id, element_id }) => toContent(getElementById(resolveSourceOrThrow(source_id), element_id))
);

mcpServer.tool(
  "list_relationship_types_tool",
  "Retourne la liste triée des types de relations ArchiMate 3.1 présents dans le modèle.",
  sourceIdParam,
  async ({ source_id }) => toContent(listRelationshipTypes(resolveSourceOrThrow(source_id)))
);

mcpServer.tool(
  "list_relationships_tool",
  `Liste les relations du modèle avec filtres optionnels. rel_type doit être parmi: ${_RELATIONSHIP_TYPES_STR}.`,
  {
    ...sourceIdParam,
    rel_type: z.string().optional().describe("Type de relation ArchiMate 3.1"),
    source_id_filter: z.string().optional().describe("Filtrer par identifiant source"),
    target_id: z.string().optional().describe("Filtrer par identifiant cible"),
  },
  async ({ source_id, rel_type, source_id_filter, target_id }) => {
    const ds = resolveSourceOrThrow(source_id);
    if (rel_type && !RELATIONSHIP_TYPES.has(rel_type)) {
      throw new Error(`Type de relation invalide: '${rel_type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(listRelationships(ds, rel_type, source_id_filter, target_id));
  }
);

mcpServer.tool(
  "get_relationship_tool",
  "Retourne le détail d'une relation ArchiMate par son identifiant.",
  { ...sourceIdParam, relationship_id: z.string().describe("Identifiant de la relation") },
  async ({ source_id, relationship_id }) =>
    toContent(getRelationshipById(resolveSourceOrThrow(source_id), relationship_id))
);

mcpServer.tool(
  "list_views_tool",
  "Liste toutes les vues du modèle avec leur nombre de nœuds et de connexions.",
  sourceIdParam,
  async ({ source_id }) => toContent(listViews(resolveSourceOrThrow(source_id)))
);

mcpServer.tool(
  "get_view_tool",
  "Retourne le détail d'une vue ArchiMate par son identifiant.",
  { ...sourceIdParam, view_id: z.string().describe("Identifiant de la vue") },
  async ({ source_id, view_id }) => toContent(getViewById(resolveSourceOrThrow(source_id), view_id))
);

// ---------------------------------------------------------------------------
// MCP HTTP transport (session-aware, streamable-http)
// ---------------------------------------------------------------------------

const mcpTransports: Record<string, StreamableHTTPServerTransport> = {};
const mcpSessionTimestamps: Record<string, number> = {};
const SESSION_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const id of Object.keys(mcpSessionTimestamps)) {
    if ((mcpSessionTimestamps[id] ?? 0) < cutoff) {
      delete mcpTransports[id];
      delete mcpSessionTimestamps[id];
    }
  }
}, 5 * 60 * 1000).unref();

app.post("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && mcpTransports[sessionId]) {
    mcpSessionTimestamps[sessionId] = Date.now();
    await mcpTransports[sessionId]!.handleRequest(req, res, req.body);
    return;
  }

  if (isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        mcpTransports[id] = transport;
        mcpSessionTimestamps[id] = Date.now();
      },
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: "Bad Request: missing or invalid session." });
});

app.get("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && mcpTransports[sessionId]) {
    await mcpTransports[sessionId]!.handleRequest(req, res);
    return;
  }
  res.status(405).json({ error: "Method Not Allowed" });
});

app.delete("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && mcpTransports[sessionId]) {
    await mcpTransports[sessionId]!.handleRequest(req, res);
    delete mcpTransports[sessionId];
    return;
  }
  res.status(404).json({ error: "Session not found" });
});

app.use("/:source_id", sourceRouter);
