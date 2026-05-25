/**
 * ArchiMate Open Exchange Format (OEF) XML parser.
 * Replaces the pyArchimate library from the Python version.
 * Parses archimate3_Model.xsd / archimate3_View.xsd / archimate3_Diagram.xsd.
 */

import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Internal model types
// ---------------------------------------------------------------------------

export interface ArchiColor {
  r: number;
  g: number;
  b: number;
  a?: number | null;
}

export interface ArchiFont {
  name?: string | null;
  size?: number | null;
  style?: string | null;
  color?: ArchiColor | null;
}

export interface ArchiElement {
  uuid: string;
  name: string;
  type: string;
  desc: string | null;
  props: Record<string, string>;
}

export interface ArchiRelationship {
  uuid: string;
  name: string | null;
  type: string;
  source: ArchiElement | string;
  target: ArchiElement | string;
  desc: string | null;
  props: Record<string, string>;
  access_type: string | null;
  is_directed: boolean | null;
  influence_strength: string | null;
}

export interface ArchiNode {
  uuid: string;
  name: string | null;
  ref: ArchiElement | string | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  fill_color: ArchiColor | null;
  line_color: ArchiColor | null;
  font_name: string | null;
  font_size: number | null;
  font_color: ArchiColor | null;
  line_width: number | null;
  nodes: ArchiNode[];
}

export interface ArchiConnection {
  uuid: string;
  name: string | null;
  ref: string | null;
  source: string | null;
  target: string | null;
  line_color: ArchiColor | null;
  font_name: string | null;
  font_size: number | null;
  font_color: ArchiColor | null;
  line_width: number | null;
}

export interface ArchiView {
  uuid: string;
  name: string;
  desc: string | null;
  primary_viewpoint: string | null;
  nodes: ArchiNode[];
  conns: ArchiConnection[];
}

export interface ArchiModel {
  uuid: string;
  name: string;
  desc: string | null;
  version: string | null;
  elements: ArchiElement[];
  relationships: ArchiRelationship[];
  views: ArchiView[];
}

// ---------------------------------------------------------------------------
// XML parsing helpers
// ---------------------------------------------------------------------------

type XmlNode = Record<string, unknown>;

/** Extract text content from a parsed XML node that may have xml:lang attribute. */
function getText(node: unknown): string | null {
  if (node === undefined || node === null) return null;
  if (typeof node === "string") return node.length > 0 ? node : null;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (typeof node === "object") {
    const obj = node as XmlNode;
    if ("#text" in obj) {
      const text = obj["#text"];
      return text !== undefined && text !== null && text !== "" ? String(text) : null;
    }
  }
  return null;
}

function parseColor(colorNode: unknown): ArchiColor | null {
  if (!colorNode || typeof colorNode !== "object") return null;
  const c = colorNode as XmlNode;
  if (c["@_r"] === undefined || c["@_g"] === undefined || c["@_b"] === undefined) return null;
  const result: ArchiColor = {
    r: Number(c["@_r"]),
    g: Number(c["@_g"]),
    b: Number(c["@_b"]),
  };
  if (c["@_a"] !== undefined) result.a = Number(c["@_a"]);
  return result;
}

function parseFont(fontNode: unknown): ArchiFont | null {
  if (!fontNode || typeof fontNode !== "object") return null;
  const f = fontNode as XmlNode;
  const name = f["@_name"] ? String(f["@_name"]) : null;
  const size = f["@_size"] !== undefined ? Number(f["@_size"]) : null;
  const style = f["@_style"] ? String(f["@_style"]) : null;
  const color = parseColor(f["color"]);
  if (name || size !== null || style || color) {
    return { name, size, style, color };
  }
  return null;
}

interface ParsedStyle {
  fillColor: ArchiColor | null;
  lineColor: ArchiColor | null;
  font: ArchiFont | null;
  lineWidth: number | null;
}

function parseStyle(styleNode: unknown): ParsedStyle {
  if (!styleNode || typeof styleNode !== "object") {
    return { fillColor: null, lineColor: null, font: null, lineWidth: null };
  }
  const s = styleNode as XmlNode;
  return {
    fillColor: parseColor(s["fillColor"]),
    lineColor: parseColor(s["lineColor"]),
    font: parseFont(s["font"]),
    lineWidth: s["@_lineWidth"] !== undefined ? Number(s["@_lineWidth"]) : null,
  };
}

function parseProperties(propsNode: unknown): Record<string, string> {
  if (!propsNode || typeof propsNode !== "object") return {};
  const p = propsNode as XmlNode;
  const propArray = Array.isArray(p["property"])
    ? p["property"]
    : p["property"]
    ? [p["property"]]
    : [];
  const result: Record<string, string> = {};
  for (const prop of propArray) {
    if (!prop || typeof prop !== "object") continue;
    const propObj = prop as XmlNode;
    const ref = propObj["@_propertyDefinitionRef"];
    if (!ref) continue;
    result[String(ref)] = getText(propObj["value"]) ?? "";
  }
  return result;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseNode(nodeRaw: unknown, elementMap: Map<string, ArchiElement>): ArchiNode {
  const n = nodeRaw as XmlNode;
  const elementRef = n["@_elementRef"] ? String(n["@_elementRef"]) : null;
  const ref: ArchiElement | string | null = elementRef
    ? (elementMap.get(elementRef) ?? elementRef)
    : null;
  const style = parseStyle(n["style"]);

  return {
    uuid: String(n["@_identifier"]),
    name: getText(n["name"]),
    ref,
    x: n["@_x"] !== undefined ? Number(n["@_x"]) : null,
    y: n["@_y"] !== undefined ? Number(n["@_y"]) : null,
    w: n["@_w"] !== undefined ? Number(n["@_w"]) : null,
    h: n["@_h"] !== undefined ? Number(n["@_h"]) : null,
    fill_color: style.fillColor,
    line_color: style.lineColor,
    font_name: style.font?.name ?? null,
    font_size: style.font?.size ?? null,
    font_color: style.font?.color ?? null,
    line_width: style.lineWidth,
    nodes: ensureArray(n["node"]).map((cn) => parseNode(cn, elementMap)),
  };
}

function parseConnection(connRaw: unknown): ArchiConnection {
  const c = connRaw as XmlNode;
  const style = parseStyle(c["style"]);
  return {
    uuid: String(c["@_identifier"]),
    name: getText(c["name"]),
    ref: c["@_relationshipRef"] ? String(c["@_relationshipRef"]) : null,
    source: c["@_source"] ? String(c["@_source"]) : null,
    target: c["@_target"] ? String(c["@_target"]) : null,
    line_color: style.lineColor,
    font_name: style.font?.name ?? null,
    font_size: style.font?.size ?? null,
    font_color: style.font?.color ?? null,
    line_width: style.lineWidth,
  };
}

// ---------------------------------------------------------------------------
// Main XML parsing function
// ---------------------------------------------------------------------------

export function parseArchiMateXML(xmlContent: string): ArchiModel {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    textNodeName: "#text",
    isArray: (name: string) =>
      ["element", "relationship", "view", "node", "connection", "property"].includes(name),
  });

  const parsed = parser.parse(xmlContent);
  const modelRaw = parsed["model"] as XmlNode;

  // Parse elements
  const elementsRaw = modelRaw["elements"] as XmlNode | undefined;
  const elementArray: ArchiElement[] = ensureArray(elementsRaw?.["element"]).map((e) => {
    const elem = e as XmlNode;
    return {
      uuid: String(elem["@_identifier"]),
      name: getText(elem["name"]) ?? "",
      type: elem["@_xsi:type"] ? String(elem["@_xsi:type"]) : "",
      desc: getText(elem["documentation"]),
      props: parseProperties(elem["properties"]),
    };
  });

  const elementMap = new Map<string, ArchiElement>(elementArray.map((e) => [e.uuid, e]));

  // Parse relationships
  const relationshipsRaw = modelRaw["relationships"] as XmlNode | undefined;
  const relationshipArray: ArchiRelationship[] = ensureArray(
    relationshipsRaw?.["relationship"]
  ).map((r) => {
    const rel = r as XmlNode;
    const srcId = rel["@_source"] ? String(rel["@_source"]) : "";
    const tgtId = rel["@_target"] ? String(rel["@_target"]) : "";
    const relType = rel["@_xsi:type"] ? String(rel["@_xsi:type"]) : "";

    return {
      uuid: String(rel["@_identifier"]),
      name: getText(rel["name"]),
      type: relType,
      source: elementMap.get(srcId) ?? srcId,
      target: elementMap.get(tgtId) ?? tgtId,
      desc: getText(rel["documentation"]),
      props: parseProperties(rel["properties"]),
      access_type: rel["@_accessType"] ? String(rel["@_accessType"]) : null,
      is_directed: rel["@_isDirected"] !== undefined ? Boolean(rel["@_isDirected"]) : null,
      influence_strength: rel["@_modifier"] !== undefined ? String(rel["@_modifier"]) : null,
    };
  });

  // Parse views
  const viewsRaw = modelRaw["views"] as XmlNode | undefined;
  const diagramsRaw = viewsRaw?.["diagrams"] as XmlNode | undefined;
  const viewArray: ArchiView[] = ensureArray(diagramsRaw?.["view"]).map((v) => {
    const view = v as XmlNode;
    return {
      uuid: String(view["@_identifier"]),
      name: getText(view["name"]) ?? "",
      desc: getText(view["documentation"]),
      primary_viewpoint: view["@_viewpoint"] ? String(view["@_viewpoint"]) : null,
      nodes: ensureArray(view["node"]).map((n) => parseNode(n, elementMap)),
      conns: ensureArray(view["connection"]).map((c) => parseConnection(c)),
    };
  });

  return {
    uuid: modelRaw["@_identifier"] ? String(modelRaw["@_identifier"]) : "",
    name: getText(modelRaw["name"]) ?? "",
    desc: getText(modelRaw["documentation"]),
    version: modelRaw["@_version"] ? String(modelRaw["@_version"]) : null,
    elements: elementArray,
    relationships: relationshipArray,
    views: viewArray,
  };
}

