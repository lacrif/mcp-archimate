/**
 * Parser for the Archi tool native format (.archimate).
 * Root element: <archimate:model> with elements in folder trees,
 * relationships in <folder type="relations">, views in <folder type="diagrams">.
 */

import { XMLParser } from "fast-xml-parser";
import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "./schemas.js";
import type { ArchiColor, ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView, ArchiModel } from "./model.js";

type XmlNode = Record<string, unknown>;

function ensureArray<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function stripPrefix(xsiType: string): string {
  return xsiType.startsWith("archimate:") ? xsiType.slice(10) : xsiType;
}

function hexToArchiColor(hex: string | undefined): ArchiColor | null {
  if (!hex) return null;
  const s = hex.replace(/^#/, "");
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function classifyType(xsiType: string): "element" | "relationship" | "view" | "skip" {
  const type = stripPrefix(xsiType);
  if (ELEMENT_TYPES.has(type)) return "element";
  if (type === "Junction") return "element"; // Archi stores And/OrJunction as Junction + type="or" attr
  if (type === "ArchimateDiagramModel") return "view";
  if (type.endsWith("Relationship") && RELATIONSHIP_TYPES.has(type.slice(0, -12))) return "relationship";
  return "skip";
}

function parseArchiProps(elem: XmlNode): Record<string, string> {
  const result: Record<string, string> = {};
  for (const prop of ensureArray<XmlNode>(elem["property"])) {
    const key = prop["@_key"] != null ? String(prop["@_key"]) : null;
    if (key) result[key] = prop["@_value"] != null ? String(prop["@_value"]) : "";
  }
  return result;
}

function collectFromFolders(
  folders: XmlNode[],
  elements: XmlNode[],
  relationships: XmlNode[],
  diagrams: XmlNode[]
): void {
  for (const folder of folders) {
    for (const elem of ensureArray<XmlNode>(folder["element"])) {
      const xsiType = elem["@_xsi:type"] ? String(elem["@_xsi:type"]) : "";
      switch (classifyType(xsiType)) {
        case "element": elements.push(elem); break;
        case "relationship": relationships.push(elem); break;
        case "view": diagrams.push(elem); break;
      }
    }
    collectFromFolders(ensureArray<XmlNode>(folder["folder"]), elements, relationships, diagrams);
  }
}

function parseArchiNode(childRaw: XmlNode, elementMap: Map<string, ArchiElement>): ArchiNode {
  const elementRef = childRaw["@_archimateElement"] ? String(childRaw["@_archimateElement"]) : null;
  const ref = elementRef ? (elementMap.get(elementRef) ?? elementRef) : null;
  const bounds = childRaw["bounds"] as XmlNode | undefined;

  const children = ensureArray<XmlNode>(childRaw["child"])
    .filter((c) => stripPrefix(String(c["@_xsi:type"] ?? "")) === "DiagramObject")
    .map((c) => parseArchiNode(c, elementMap));

  return {
    uuid: String(childRaw["@_id"]),
    name: childRaw["@_name"] ? String(childRaw["@_name"]) : null,
    ref,
    x: bounds?.["@_x"] != null ? Number(bounds["@_x"]) : null,
    y: bounds?.["@_y"] != null ? Number(bounds["@_y"]) : null,
    w: bounds?.["@_width"] != null ? Number(bounds["@_width"]) : null,
    h: bounds?.["@_height"] != null ? Number(bounds["@_height"]) : null,
    fill_color: hexToArchiColor(childRaw["@_fillColor"] ? String(childRaw["@_fillColor"]) : undefined),
    line_color: hexToArchiColor(childRaw["@_lineColor"] ? String(childRaw["@_lineColor"]) : undefined),
    font_name: null,
    font_size: null,
    font_color: hexToArchiColor(childRaw["@_fontColor"] ? String(childRaw["@_fontColor"]) : undefined),
    line_width: null,
    nodes: children,
  };
}

function collectConnections(childRaw: XmlNode, into: ArchiConnection[]): void {
  for (const conn of ensureArray<XmlNode>(childRaw["sourceConnection"])) {
    into.push({
      uuid: String(conn["@_id"]),
      name: conn["@_name"] ? String(conn["@_name"]) : null,
      ref: conn["@_archimateRelationship"] ? String(conn["@_archimateRelationship"]) : null,
      source: conn["@_source"] ? String(conn["@_source"]) : null,
      target: conn["@_target"] ? String(conn["@_target"]) : null,
      line_color: null,
      font_name: null,
      font_size: null,
      font_color: hexToArchiColor(conn["@_fontColor"] ? String(conn["@_fontColor"]) : undefined),
      line_width: null,
    });
  }
  for (const sub of ensureArray<XmlNode>(childRaw["child"])) {
    collectConnections(sub, into);
  }
}

export function parseArchiFormat(xmlContent: string): ArchiModel {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    textNodeName: "#text",
    isArray: (name) =>
      ["element", "folder", "child", "sourceConnection", "property", "feature"].includes(name),
  });

  const parsed = parser.parse(xmlContent);
  const modelRaw = parsed["archimate:model"] as XmlNode;

  const elementRaws: XmlNode[] = [];
  const relationshipRaws: XmlNode[] = [];
  const diagramRaws: XmlNode[] = [];

  collectFromFolders(
    ensureArray<XmlNode>(modelRaw["folder"]),
    elementRaws,
    relationshipRaws,
    diagramRaws
  );

  const elementArray: ArchiElement[] = elementRaws.map((elem) => {
    const rawType = stripPrefix(String(elem["@_xsi:type"] ?? ""));
    // Archi stores And/OrJunction as "Junction" with an optional type="or" attribute
    const type =
      rawType === "Junction"
        ? elem["@_type"] === "or"
          ? "OrJunction"
          : "AndJunction"
        : rawType;
    return {
      uuid: String(elem["@_id"]),
      name: elem["@_name"] ? String(elem["@_name"]) : "",
      type,
      desc: elem["documentation"] ? String(elem["documentation"]) : null,
      props: parseArchiProps(elem),
    };
  });

  const elementMap = new Map<string, ArchiElement>(elementArray.map((e) => [e.uuid, e]));

  const relationshipArray: ArchiRelationship[] = relationshipRaws.map((rel) => {
    const rawType = stripPrefix(String(rel["@_xsi:type"] ?? ""));
    const type = rawType.endsWith("Relationship") ? rawType.slice(0, -12) : rawType;
    const srcId = rel["@_source"] ? String(rel["@_source"]) : "";
    const tgtId = rel["@_target"] ? String(rel["@_target"]) : "";
    return {
      uuid: String(rel["@_id"]),
      name: rel["@_name"] ? String(rel["@_name"]) : null,
      type,
      source: elementMap.get(srcId) ?? srcId,
      target: elementMap.get(tgtId) ?? tgtId,
      desc: null,
      props: parseArchiProps(rel),
      access_type: rel["@_accessType"] ? String(rel["@_accessType"]) : null,
      is_directed: rel["@_directed"] != null ? Boolean(rel["@_directed"]) : null,
      influence_strength: rel["@_strength"] ? String(rel["@_strength"]) : null,
    };
  });

  const viewArray: ArchiView[] = diagramRaws.map((diag) => {
    const allChildren = ensureArray<XmlNode>(diag["child"]);
    const nodes = allChildren
      .filter((c) => stripPrefix(String(c["@_xsi:type"] ?? "")) === "DiagramObject")
      .map((c) => parseArchiNode(c, elementMap));
    const conns: ArchiConnection[] = [];
    for (const child of allChildren) collectConnections(child, conns);

    return {
      uuid: String(diag["@_id"]),
      name: diag["@_name"] ? String(diag["@_name"]) : "",
      desc: diag["documentation"] ? String(diag["documentation"]) : null,
      primary_viewpoint: diag["@_viewpoint"] ? String(diag["@_viewpoint"]) : null,
      nodes,
      conns,
    };
  });

  return {
    uuid: modelRaw["@_id"] ? String(modelRaw["@_id"]) : "",
    name: modelRaw["@_name"] ? String(modelRaw["@_name"]) : "",
    desc: null,
    version: modelRaw["@_version"] ? String(modelRaw["@_version"]) : null,
    elements: elementArray,
    relationships: relationshipArray,
    views: viewArray,
    _rawArchi: modelRaw,
  };
}
