/**
 * Data source registry.
 * Loads config.json at startup, parses each source file, and exposes a Map
 * keyed by source id so routes and MCP tools can look up sources by name.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parseArchiMateXML } from "./model.js";
import { parseArchiFormat } from "./archi-parser.js";
import type { ArchiModel } from "./model.js";

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export interface SourceConfig {
  id: string;
  name: string;
  path: string;
  format: "oef" | "archi";
}

export interface AppConfig {
  sources: SourceConfig[];
}

// ---------------------------------------------------------------------------
// Runtime DataSource (one per configured source)
// ---------------------------------------------------------------------------

export interface DataSource {
  readonly id: string;
  readonly name: string;
  readonly model: ArchiModel;
  /** Sorted unique element types present in the model. */
  readonly elementTypes: string[];
  /** Sorted unique relationship types present in the model. */
  readonly relationshipTypes: string[];
}

// ---------------------------------------------------------------------------
// Startup loading
// ---------------------------------------------------------------------------

function loadModel(cfg: SourceConfig): ArchiModel {
  const content = readFileSync(join(process.cwd(), cfg.path), "utf-8");
  return cfg.format === "archi" ? parseArchiFormat(content) : parseArchiMateXML(content);
}

function loadConfig(): AppConfig {
  const raw = readFileSync(join(process.cwd(), "config.json"), "utf-8");
  return JSON.parse(raw) as AppConfig;
}

function buildRegistry(config: AppConfig): Map<string, DataSource> {
  const map = new Map<string, DataSource>();
  for (const src of config.sources) {
    const model = loadModel(src);
    map.set(src.id, {
      id: src.id,
      name: src.name,
      model,
      elementTypes: [...new Set(model.elements.map((e) => e.type).filter(Boolean))].sort(),
      relationshipTypes: [...new Set(model.relationships.map((r) => r.type).filter(Boolean))].sort(),
    });
  }
  return map;
}

const _config = loadConfig();

export const registry: Map<string, DataSource> = buildRegistry(_config);

/** Id of the first configured source, used as MCP default. */
export const defaultSourceId: string = _config.sources[0]?.id ?? "";
