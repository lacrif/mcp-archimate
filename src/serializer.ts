/**
 * Serializer for ArchiModel → Archi native XML (.archimate format).
 * Inverse of archi-parser.ts.
 */

import { writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { XMLBuilder } from "fast-xml-parser";
import type {
  ArchiModel,
  ArchiElement,
  ArchiRelationship,
  ArchiView,
  ArchiColor,
  ArchiConnection,
  ArchiNode,
} from "./model.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hexColor(c: ArchiColor | null | undefined): string | null {
  if (!c) return null;
  return "#" + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("");
}



// ---------------------------------------------------------------------------
// Archi native (.archimate) serializer
// ---------------------------------------------------------------------------

const ARCHI_LAYER: Record<string, string> = {
  Resource: "strategy", Capability: "strategy", CourseOfAction: "strategy", ValueStream: "strategy",
  BusinessActor: "business", BusinessRole: "business", BusinessCollaboration: "business",
  BusinessInterface: "business", BusinessProcess: "business", BusinessFunction: "business",
  BusinessInteraction: "business", BusinessEvent: "business", BusinessService: "business",
  BusinessObject: "business", Contract: "business", Representation: "business", Product: "business",
  ApplicationComponent: "application", ApplicationCollaboration: "application",
  ApplicationInterface: "application", ApplicationFunction: "application",
  ApplicationInteraction: "application", ApplicationProcess: "application",
  ApplicationEvent: "application", ApplicationService: "application", DataObject: "application",
  Node: "technology", Device: "technology", SystemSoftware: "technology",
  TechnologyCollaboration: "technology", TechnologyInterface: "technology", Path: "technology",
  CommunicationNetwork: "technology", TechnologyFunction: "technology",
  TechnologyProcess: "technology", TechnologyInteraction: "technology",
  TechnologyEvent: "technology", TechnologyService: "technology", Artifact: "technology",
  Equipment: "technology", Facility: "technology", DistributionNetwork: "technology", Material: "technology",
  Stakeholder: "motivation", Driver: "motivation", Assessment: "motivation", Goal: "motivation",
  Outcome: "motivation", Principle: "motivation", Requirement: "motivation",
  Constraint: "motivation", Meaning: "motivation", Value: "motivation",
  WorkPackage: "implementation_migration", Deliverable: "implementation_migration",
  ImplementationEvent: "implementation_migration", Plateau: "implementation_migration", Gap: "implementation_migration",
  Grouping: "other", Location: "other", AndJunction: "other", OrJunction: "other",
};

const ARCHI_LAYER_ORDER = [
  "strategy", "business", "application", "technology",
  "motivation", "implementation_migration", "other",
];

const ARCHI_LAYER_NAMES: Record<string, string> = {
  strategy: "Strategy",
  business: "Business",
  application: "Application",
  technology: "Technology & Physical",
  motivation: "Motivation",
  implementation_migration: "Implementation & Migration",
  other: "Other",
};

const ARCHI_REL_TYPE: Record<string, string> = {
  Association: "archimate:AssociationRelationship",
  Composition: "archimate:CompositionRelationship",
  Aggregation: "archimate:AggregationRelationship",
  Assignment: "archimate:AssignmentRelationship",
  Realization: "archimate:RealizationRelationship",
  Serving: "archimate:ServingRelationship",
  Access: "archimate:AccessRelationship",
  Influence: "archimate:InfluenceRelationship",
  Triggering: "archimate:TriggeringRelationship",
  Flow: "archimate:FlowRelationship",
  Specialization: "archimate:SpecializationRelationship",
};

// ---------------------------------------------------------------------------
// Archi round-trip helpers (preserve folder hierarchy from original file)
// ---------------------------------------------------------------------------

type XmlNode = Record<string, unknown>;

function ensureArr<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function elemToRawArchiNode(e: ArchiElement): XmlNode {
  // Archi native format uses "Junction" + type="or" for OrJunction, "Junction" alone for AndJunction
  const xsiType =
    e.type === "AndJunction" || e.type === "OrJunction"
      ? "archimate:Junction"
      : `archimate:${e.type}`;
  const node: XmlNode = {
    "@_xsi:type": xsiType,
    "@_name": e.name,
    "@_id": e.uuid,
  };
  if (e.type === "OrJunction") node["@_type"] = "or";
  if (e.desc) node["documentation"] = e.desc;
  if (Object.keys(e.props).length > 0) {
    node["property"] = Object.entries(e.props).map(([k, v]) => ({ "@_key": k, "@_value": v }));
  }
  return node;
}

function relToRawArchiNode(r: ArchiRelationship): XmlNode {
  const srcId = typeof r.source === "string" ? r.source : r.source.uuid;
  const tgtId = typeof r.target === "string" ? r.target : r.target.uuid;
  const xsiType = ARCHI_REL_TYPE[r.type] ?? `archimate:${r.type}Relationship`;
  const node: XmlNode = { "@_xsi:type": xsiType, "@_id": r.uuid, "@_source": srcId, "@_target": tgtId };
  if (r.name) node["@_name"] = r.name;
  if (r.access_type) node["@_accessType"] = r.access_type;
  if (r.is_directed != null) node["@_directed"] = r.is_directed;
  if (r.influence_strength) node["@_strength"] = r.influence_strength;
  if (Object.keys(r.props).length > 0) {
    node["property"] = Object.entries(r.props).map(([k, v]) => ({ "@_key": k, "@_value": v }));
  }
  return node;
}

function diagramChildToRaw(n: ArchiNode, connsBySource: Map<string, ArchiConnection[]>): XmlNode {
  const ref = n.ref;
  const elemRef = ref == null ? null : typeof ref === "string" ? ref : ref.uuid;
  const raw: XmlNode = { "@_xsi:type": "archimate:DiagramObject", "@_id": n.uuid };
  if (n.name) raw["@_name"] = n.name;
  if (elemRef) raw["@_archimateElement"] = elemRef;
  const fc = hexColor(n.fill_color);
  if (fc) raw["@_fillColor"] = fc;
  const lc = hexColor(n.line_color);
  if (lc) raw["@_lineColor"] = lc;
  if (n.x != null || n.y != null || n.w != null || n.h != null) {
    const bounds: XmlNode = {};
    if (n.x != null) bounds["@_x"] = n.x;
    if (n.y != null) bounds["@_y"] = n.y;
    if (n.w != null) bounds["@_width"] = n.w;
    if (n.h != null) bounds["@_height"] = n.h;
    raw["bounds"] = bounds;
  }
  const children = n.nodes.map((child) => diagramChildToRaw(child, connsBySource));
  if (children.length > 0) raw["child"] = children;
  const conns = connsBySource.get(n.uuid) ?? [];
  if (conns.length > 0) {
    raw["sourceConnection"] = conns.map((c) => {
      const cr: XmlNode = { "@_xsi:type": "archimate:Connection", "@_id": c.uuid };
      if (c.source) cr["@_source"] = c.source;
      if (c.target) cr["@_target"] = c.target;
      if (c.ref) cr["@_archimateRelationship"] = c.ref;
      if (c.name) cr["@_name"] = c.name;
      return cr;
    });
  }
  return raw;
}

function viewToRawArchiNode(v: ArchiView): XmlNode {
  const connsBySource = new Map<string, ArchiConnection[]>();
  for (const c of v.conns) {
    if (c.source) {
      const list = connsBySource.get(c.source) ?? [];
      list.push(c);
      connsBySource.set(c.source, list);
    }
  }
  const raw: XmlNode = {
    "@_xsi:type": "archimate:ArchimateDiagramModel",
    "@_name": v.name,
    "@_id": v.uuid,
  };
  if (v.primary_viewpoint) raw["@_viewpoint"] = v.primary_viewpoint;
  if (v.desc) raw["documentation"] = v.desc;
  const children = v.nodes.map((n) => diagramChildToRaw(n, connsBySource));
  if (children.length > 0) raw["child"] = children;
  return raw;
}

function collectRawViewIds(folder: XmlNode, ids: Set<string>): void {
  for (const elem of ensureArr<XmlNode>(folder["element"])) {
    const id = elem["@_id"] ? String(elem["@_id"]) : null;
    if (id) ids.add(id);
  }
  for (const sub of ensureArr<XmlNode>(folder["folder"])) {
    collectRawViewIds(sub, ids);
  }
}

function updateFoldersInPlace(
  folders: XmlNode[],
  currentElems: Map<string, ArchiElement>,
  currentRels: Map<string, ArchiRelationship>,
  currentViews: ArchiView[],
  seenElemIds: Set<string>,
  seenRelIds: Set<string>
): void {
  for (const folder of folders) {
    const folderType = folder["@_type"] ? String(folder["@_type"]) : null;

    if (folderType === "diagrams") {
      // Collect view IDs from entire diagrams subtree (may include nested sub-folders)
      const rawViewIds = new Set<string>();
      collectRawViewIds(folder, rawViewIds);
      const newViews = currentViews.filter((v) => !rawViewIds.has(v.uuid));
      if (newViews.length > 0) {
        const existing = ensureArr<XmlNode>(folder["element"]);
        folder["element"] = [...existing, ...newViews.map(viewToRawArchiNode)];
      }
      continue;
    }

    if (folderType === "relations") {
      const rawRels = ensureArr<XmlNode>(folder["element"]);
      const updatedRels: XmlNode[] = [];
      for (const rawRel of rawRels) {
        const id = rawRel["@_id"] ? String(rawRel["@_id"]) : null;
        if (!id) continue;
        seenRelIds.add(id);
        const rel = currentRels.get(id);
        if (rel) updatedRels.push(relToRawArchiNode(rel));
      }
      // Append new relationships not in original tree
      for (const [id, rel] of currentRels) {
        if (!seenRelIds.has(id)) {
          updatedRels.push(relToRawArchiNode(rel));
          seenRelIds.add(id);
        }
      }
      folder["element"] = updatedRels.length > 0 ? updatedRels : [];
    } else {
      // Element folder — update elements, recurse into sub-folders
      const rawElems = ensureArr<XmlNode>(folder["element"]);
      const updatedElems: XmlNode[] = [];
      for (const rawElem of rawElems) {
        const id = rawElem["@_id"] ? String(rawElem["@_id"]) : null;
        if (!id) continue;
        seenElemIds.add(id);
        const elem = currentElems.get(id);
        if (elem) updatedElems.push(elemToRawArchiNode(elem));
      }
      folder["element"] = updatedElems.length > 0 ? updatedElems : [];
      updateFoldersInPlace(
        ensureArr<XmlNode>(folder["folder"]),
        currentElems, currentRels, currentViews, seenElemIds, seenRelIds
      );
    }
  }
}

function insertNewElements(folders: XmlNode[], newElems: ArchiElement[]): void {
  const byLayer = new Map<string, ArchiElement[]>();
  for (const e of newElems) {
    const layer = ARCHI_LAYER[e.type] ?? "other";
    const list = byLayer.get(layer) ?? [];
    list.push(e);
    byLayer.set(layer, list);
  }
  for (const folder of folders) {
    const folderType = folder["@_type"] ? String(folder["@_type"]) : null;
    if (!folderType || folderType === "relations" || folderType === "diagrams") continue;
    const elemsForLayer = byLayer.get(folderType);
    if (elemsForLayer && elemsForLayer.length > 0) {
      const existing = ensureArr<XmlNode>(folder["element"]);
      folder["element"] = [...existing, ...elemsForLayer.map(elemToRawArchiNode)];
      byLayer.delete(folderType);
    }
  }
  for (const [layer, elems] of byLayer) {
    folders.push({
      "@_name": ARCHI_LAYER_NAMES[layer] ?? layer,
      "@_id": randomUUID(),
      "@_type": layer,
      element: elems.map(elemToRawArchiNode),
    });
  }
}

function serializeToArchiFromRaw(model: ArchiModel, rawModelNode: XmlNode): string {
  const modelNode = JSON.parse(JSON.stringify(rawModelNode)) as XmlNode;

  const currentElems = new Map(model.elements.map((e) => [e.uuid, e]));
  const currentRels = new Map(model.relationships.map((r) => [r.uuid, r]));
  const seenElemIds = new Set<string>();
  const seenRelIds = new Set<string>();

  const folders = ensureArr<XmlNode>(modelNode["folder"]);
  updateFoldersInPlace(folders, currentElems, currentRels, model.views, seenElemIds, seenRelIds);

  const newElems = model.elements.filter((e) => !seenElemIds.has(e.uuid));
  if (newElems.length > 0) insertNewElements(folders, newElems);

  const hasRelFolder = folders.some((f) => String(f["@_type"] ?? "") === "relations");
  if (!hasRelFolder) {
    const newRels = model.relationships.filter((r) => !seenRelIds.has(r.uuid));
    if (newRels.length > 0) {
      folders.push({
        "@_name": "Relations",
        "@_id": randomUUID(),
        "@_type": "relations",
        element: newRels.map(relToRawArchiNode),
      });
    }
  }

  modelNode["folder"] = folders;

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
  });

  const bodyXml = builder.build({ "archimate:model": modelNode }) as string;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${bodyXml}`;
}

function archiNodeXml(
  n: ArchiNode,
  connsBySource: Map<string, ArchiConnection[]>,
  indent: string
): string {
  const ref = n.ref;
  const elemRef = ref == null ? null : typeof ref === "string" ? ref : ref.uuid;
  const attrs: string[] = [`xsi:type="archimate:DiagramObject"`, `id="${esc(n.uuid)}"`];
  if (n.name) attrs.push(`name="${esc(n.name)}"`);
  if (elemRef) attrs.push(`archimateElement="${esc(elemRef)}"`);
  const fc = hexColor(n.fill_color);
  if (fc) attrs.push(`fillColor="${fc}"`);
  const lc = hexColor(n.line_color);
  if (lc) attrs.push(`lineColor="${lc}"`);
  const foc = hexColor(n.font_color);
  if (foc) attrs.push(`fontColor="${foc}"`);

  const inner: string[] = [];
  if (n.x != null && n.y != null) {
    const ba: string[] = [`x="${n.x}"`, `y="${n.y}"`];
    if (n.w != null) ba.push(`width="${n.w}"`);
    if (n.h != null) ba.push(`height="${n.h}"`);
    inner.push(`${indent}  <bounds ${ba.join(" ")}/>`);
  }
  for (const child of n.nodes) inner.push(archiNodeXml(child, connsBySource, indent + "  "));
  for (const c of connsBySource.get(n.uuid) ?? []) {
    const ca: string[] = [`xsi:type="archimate:Connection"`, `id="${esc(c.uuid)}"`];
    if (c.source) ca.push(`source="${esc(c.source)}"`);
    if (c.target) ca.push(`target="${esc(c.target)}"`);
    if (c.ref) ca.push(`archimateRelationship="${esc(c.ref)}"`);
    if (c.name) ca.push(`name="${esc(c.name)}"`);
    inner.push(`${indent}  <sourceConnection ${ca.join(" ")}/>`);
  }

  if (inner.length === 0) return `${indent}<child ${attrs.join(" ")}/>`;
  return `${indent}<child ${attrs.join(" ")}>\n${inner.join("\n")}\n${indent}</child>`;
}

export function serializeToArchi(model: ArchiModel): string {
  if (model._rawArchi) {
    return serializeToArchiFromRaw(model, model._rawArchi as XmlNode);
  }

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  const ma: string[] = [
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `xmlns:archimate="http://www.archimatetool.com/archimate"`,
    `name="${esc(model.name)}"`,
    `id="${esc(model.uuid)}"`,
  ];
  if (model.version) ma.push(`version="${esc(model.version)}"`);
  lines.push(`<archimate:model ${ma.join(" ")}>`);

  // Group elements by ArchiMate layer
  const byLayer = new Map<string, ArchiElement[]>();
  for (const e of model.elements) {
    const layer = ARCHI_LAYER[e.type] ?? "other";
    const list = byLayer.get(layer) ?? [];
    list.push(e);
    byLayer.set(layer, list);
  }

  for (const layer of ARCHI_LAYER_ORDER) {
    const elems = byLayer.get(layer);
    if (!elems || elems.length === 0) continue;
    lines.push(`  <folder name="${ARCHI_LAYER_NAMES[layer] ?? layer}" id="${randomUUID()}" type="${layer}">`);
    for (const e of elems) {
      const flatXsiType =
        e.type === "AndJunction" || e.type === "OrJunction"
          ? "archimate:Junction"
          : `archimate:${e.type}`;
      const ea: string[] = [
        `xsi:type="${esc(flatXsiType)}"`,
        `name="${esc(e.name)}"`,
        `id="${esc(e.uuid)}"`,
      ];
      if (e.type === "OrJunction") ea.push(`type="or"`);
      const eInner: string[] = [];
      if (e.desc) eInner.push(`      <documentation>${esc(e.desc)}</documentation>`);
      for (const [k, v] of Object.entries(e.props)) {
        eInner.push(`      <property key="${esc(k)}" value="${esc(v)}"/>`);
      }
      if (eInner.length === 0) {
        lines.push(`    <element ${ea.join(" ")}/>`);
      } else {
        lines.push(`    <element ${ea.join(" ")}>`);
        lines.push(...eInner);
        lines.push("    </element>");
      }
    }
    lines.push("  </folder>");
  }

  if (model.relationships.length > 0) {
    lines.push(`  <folder name="Relations" id="${randomUUID()}" type="relations">`);
    for (const r of model.relationships) {
      const src = r.source;
      const tgt = r.target;
      const srcId = typeof src === "string" ? src : src.uuid;
      const tgtId = typeof tgt === "string" ? tgt : tgt.uuid;
      const xsiType = ARCHI_REL_TYPE[r.type] ?? `archimate:${r.type}Relationship`;
      const ra: string[] = [
        `xsi:type="${xsiType}"`,
        `id="${esc(r.uuid)}"`,
        `source="${esc(srcId)}"`,
        `target="${esc(tgtId)}"`,
      ];
      if (r.name) ra.push(`name="${esc(r.name)}"`);
      if (r.access_type) ra.push(`accessType="${esc(r.access_type)}"`);
      if (r.is_directed != null) ra.push(`directed="${r.is_directed}"`);
      if (r.influence_strength) ra.push(`strength="${esc(r.influence_strength)}"`);
      const rInner: string[] = [];
      for (const [k, v] of Object.entries(r.props)) {
        rInner.push(`      <property key="${esc(k)}" value="${esc(v)}"/>`);
      }
      if (rInner.length === 0) {
        lines.push(`    <element ${ra.join(" ")}/>`);
      } else {
        lines.push(`    <element ${ra.join(" ")}>`);
        lines.push(...rInner);
        lines.push("    </element>");
      }
    }
    lines.push("  </folder>");
  }

  if (model.views.length > 0) {
    lines.push(`  <folder name="Diagrams" id="${randomUUID()}" type="diagrams">`);
    for (const v of model.views) {
      const va: string[] = [
        `xsi:type="archimate:ArchimateDiagramModel"`,
        `name="${esc(v.name)}"`,
        `id="${esc(v.uuid)}"`,
      ];
      if (v.primary_viewpoint) va.push(`viewpoint="${esc(v.primary_viewpoint)}"`);
      // Map connections to their source node for embedded serialization
      const connsBySource = new Map<string, ArchiConnection[]>();
      for (const c of v.conns) {
        if (c.source) {
          const list = connsBySource.get(c.source) ?? [];
          list.push(c);
          connsBySource.set(c.source, list);
        }
      }
      const vInner: string[] = [];
      if (v.desc) vInner.push(`      <documentation>${esc(v.desc)}</documentation>`);
      for (const n of v.nodes) vInner.push(archiNodeXml(n, connsBySource, "      "));
      if (vInner.length === 0) {
        lines.push(`    <element ${va.join(" ")}/>`);
      } else {
        lines.push(`    <element ${va.join(" ")}>`);
        lines.push(...vInner);
        lines.push("    </element>");
      }
    }
    lines.push("  </folder>");
  }

  lines.push("</archimate:model>");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

export function saveModelToFile(model: ArchiModel, filePath: string): void {
  writeFileSync(filePath, serializeToArchi(model), "utf-8");
}
