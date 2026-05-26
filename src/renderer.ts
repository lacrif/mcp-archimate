/**
 * SVG (and optionally PNG) renderer for ArchiMate views.
 *
 * renderViewToSvg  – pure string generation, no runtime dependencies
 * renderViewToPng  – requires the optional "sharp" package
 */

import type { ArchiView, ArchiNode, ArchiModel } from "./model.js";

// ---------------------------------------------------------------------------
// ArchiMate layer default fill colours
// ---------------------------------------------------------------------------

const ELEMENT_FILL: Record<string, string> = {
  // Business Layer
  BusinessActor: "#FFFF99", BusinessRole: "#FFFF99", BusinessCollaboration: "#FFFF99",
  BusinessInterface: "#FFFF99", BusinessProcess: "#FFFF99", BusinessFunction: "#FFFF99",
  BusinessInteraction: "#FFFF99", BusinessEvent: "#FFFF99", BusinessService: "#FFFF99",
  BusinessObject: "#FFFF99", Contract: "#FFFF99", Representation: "#FFFF99", Product: "#FFFF99",
  // Application Layer
  ApplicationComponent: "#99CCFF", ApplicationCollaboration: "#99CCFF",
  ApplicationInterface: "#99CCFF", ApplicationFunction: "#99CCFF",
  ApplicationInteraction: "#99CCFF", ApplicationProcess: "#99CCFF",
  ApplicationEvent: "#99CCFF", ApplicationService: "#99CCFF", DataObject: "#99CCFF",
  // Technology Layer
  Node: "#C9E6B4", Device: "#C9E6B4", SystemSoftware: "#C9E6B4",
  TechnologyCollaboration: "#C9E6B4", TechnologyInterface: "#C9E6B4",
  Path: "#C9E6B4", CommunicationNetwork: "#C9E6B4", TechnologyFunction: "#C9E6B4",
  TechnologyProcess: "#C9E6B4", TechnologyInteraction: "#C9E6B4",
  TechnologyEvent: "#C9E6B4", TechnologyService: "#C9E6B4", Artifact: "#C9E6B4",
  // Physical Layer
  Equipment: "#E8D5B0", Facility: "#E8D5B0", DistributionNetwork: "#E8D5B0", Material: "#E8D5B0",
  // Motivation
  Stakeholder: "#CCCCFF", Driver: "#CCCCFF", Assessment: "#CCCCFF", Goal: "#CCCCFF",
  Outcome: "#CCCCFF", Principle: "#CCCCFF", Requirement: "#CCCCFF", Constraint: "#CCCCFF",
  Meaning: "#CCCCFF", Value: "#CCCCFF",
  // Strategy
  Resource: "#F0E68C", Capability: "#F0E68C", CourseOfAction: "#F0E68C", ValueStream: "#F0E68C",
  // Implementation & Migration
  WorkPackage: "#FFD5AA", Deliverable: "#FFD5AA", ImplementationEvent: "#FFD5AA",
  Plateau: "#FFD5AA", Gap: "#FFD5AA",
  // Composites
  Grouping: "#FFFFFF", Location: "#E8E8E8",
  AndJunction: "#000000", OrJunction: "#000000",
};

// ---------------------------------------------------------------------------
// Relationship line styles
// ---------------------------------------------------------------------------

interface RelLineStyle {
  dashArray: string | null;
  markerStart: string | null;
  markerEnd: string | null;
}

const REL_LINE: Record<string, RelLineStyle> = {
  Composition:    { dashArray: null,  markerStart: "url(#diamond-filled)", markerEnd: null },
  Aggregation:    { dashArray: null,  markerStart: "url(#diamond-open)",   markerEnd: null },
  Assignment:     { dashArray: null,  markerStart: "url(#circle-solid)",   markerEnd: "url(#arrow-open)" },
  Realization:    { dashArray: "6,3", markerStart: null,                   markerEnd: "url(#arrow-hollow)" },
  Serving:        { dashArray: null,  markerStart: null,                   markerEnd: "url(#arrow-open)" },
  Access:         { dashArray: "4,3", markerStart: null,                   markerEnd: "url(#arrow-open)" },
  Influence:      { dashArray: "6,3", markerStart: null,                   markerEnd: "url(#arrow-open)" },
  Triggering:     { dashArray: null,  markerStart: null,                   markerEnd: "url(#arrow-filled)" },
  Flow:           { dashArray: "6,3", markerStart: null,                   markerEnd: "url(#arrow-filled)" },
  Specialization: { dashArray: null,  markerStart: null,                   markerEnd: "url(#arrow-hollow)" },
  Association:    { dashArray: null,  markerStart: null,                   markerEnd: null },
};

const DEFAULT_REL_LINE: RelLineStyle = { dashArray: null, markerStart: null, markerEnd: "url(#arrow-open)" };

// ---------------------------------------------------------------------------
// Node geometry (absolute positions, child coords are relative to parent)
// ---------------------------------------------------------------------------

interface NodeGeom {
  node: ArchiNode;
  absX: number;
  absY: number;
  absW: number;
  absH: number;
  depth: number;
}

function collectNodes(
  nodes: ArchiNode[],
  offsetX: number,
  offsetY: number,
  depth: number,
  out: Map<string, NodeGeom>
): void {
  for (const n of nodes) {
    const x = offsetX + (n.x ?? 0);
    const y = offsetY + (n.y ?? 0);
    const w = n.w ?? 120;
    const h = n.h ?? 55;
    out.set(n.uuid, { node: n, absX: x, absY: y, absW: w, absH: h, depth });
    collectNodes(n.nodes, x, y, depth + 1, out);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rgbStr(c: { r: number; g: number; b: number } | null | undefined): string | null {
  if (!c) return null;
  return `rgb(${c.r},${c.g},${c.b})`;
}

function nodeType(n: ArchiNode): string {
  if (!n.ref || typeof n.ref === "string") return "Grouping";
  return n.ref.type || "Grouping";
}

function nodeName(n: ArchiNode): string {
  if (n.name) return n.name;
  if (!n.ref || typeof n.ref === "string") return "";
  return n.ref.name || "";
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (cur.length > 0 && cur.length + 1 + word.length > maxChars) {
      lines.push(cur);
      cur = word;
    } else {
      cur = cur.length > 0 ? `${cur} ${word}` : word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Point on the boundary of rect (rx,ry,rw,rh) closest to the line coming from (fx,fy)
function rectEdge(
  fx: number, fy: number,
  rx: number, ry: number, rw: number, rh: number
): { x: number; y: number } {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = cx - fx;
  const dy = cy - fy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const hw = rw / 2;
  const hh = rh / 2;
  const sx = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx - dx * s, y: cy - dy * s };
}

// Short prefix badge for ArchiMate element type (e.g. "AC" for ApplicationComponent)
function typeBadge(type: string): string {
  return type
    .replace(/^Business/, "B:")
    .replace(/^Application/, "A:")
    .replace(/^Technology/, "T:")
    .replace(/^Physical/, "Ph:")
    .replace(/^Implementation/, "I:")
    .substring(0, 14);
}

// ---------------------------------------------------------------------------
// SVG marker defs (arrows, diamonds, circle)
// orient="auto-start-reverse" makes start markers point away from the source node
// ---------------------------------------------------------------------------

const SVG_DEFS = `  <defs>
    <marker id="arrow-open" markerWidth="9" markerHeight="8" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7" fill="none" stroke="#333" stroke-width="1.2"/>
    </marker>
    <marker id="arrow-filled" markerWidth="9" markerHeight="8" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7 Z" fill="#333" stroke="none"/>
    </marker>
    <marker id="arrow-hollow" markerWidth="11" markerHeight="9" refX="10" refY="4" orient="auto">
      <path d="M0,0 L9,4 L0,8 Z" fill="white" stroke="#333" stroke-width="1.2"/>
    </marker>
    <marker id="diamond-filled" markerWidth="12" markerHeight="8" refX="0" refY="4" orient="auto-start-reverse">
      <path d="M0,4 L5,0 L10,4 L5,8 Z" fill="#333" stroke="#333" stroke-width="0.5"/>
    </marker>
    <marker id="diamond-open" markerWidth="12" markerHeight="8" refX="0" refY="4" orient="auto-start-reverse">
      <path d="M0,4 L5,0 L10,4 L5,8 Z" fill="white" stroke="#333" stroke-width="1"/>
    </marker>
    <marker id="circle-solid" markerWidth="7" markerHeight="7" refX="0" refY="3.5" orient="auto-start-reverse">
      <circle cx="3.5" cy="3.5" r="3" fill="#333" stroke="#333"/>
    </marker>
  </defs>`;

// ---------------------------------------------------------------------------
// Main export: SVG renderer
// ---------------------------------------------------------------------------

export function renderViewToSvg(view: ArchiView, model: ArchiModel): string {
  const PADDING = 24;
  const TITLE_H = 32;
  const FONT = "Arial,Helvetica,sans-serif";

  // Build relationship lookup (id → type)
  const relTypeMap = new Map<string, string>(
    model.relationships.map((r) => [r.uuid, r.type])
  );

  // Build flat node geometry map
  const geomMap = new Map<string, NodeGeom>();
  collectNodes(view.nodes, 0, 0, 0, geomMap);

  // Bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of geomMap.values()) {
    minX = Math.min(minX, g.absX);
    minY = Math.min(minY, g.absY);
    maxX = Math.max(maxX, g.absX + g.absW);
    maxY = Math.max(maxY, g.absY + g.absH);
  }
  if (geomMap.size === 0) { minX = 0; minY = 0; maxX = 400; maxY = 250; }

  const ox = PADDING - minX;  // content x offset
  const oy = PADDING - minY + TITLE_H;
  const totalW = maxX - minX + PADDING * 2;
  const totalH = maxY - minY + PADDING * 2 + TITLE_H;

  // Sort: Groupings first, then by depth (parents before children)
  const geomList = [...geomMap.values()].sort((a, b) => {
    const ag = nodeType(a.node) === "Grouping" ? 0 : 1;
    const bg = nodeType(b.node) === "Grouping" ? 0 : 1;
    if (ag !== bg) return ag - bg;
    return a.depth - b.depth;
  });

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`);
  out.push(SVG_DEFS);
  out.push(`<rect width="${totalW}" height="${totalH}" fill="white"/>`);

  // Title bar
  out.push(`<rect width="${totalW}" height="${TITLE_H}" fill="#F0F0F0" stroke="#CCCCCC" stroke-width="1"/>`);
  out.push(
    `<text x="${totalW / 2}" y="${TITLE_H / 2 + 5}" font-family="${FONT}" font-size="13" ` +
    `font-weight="bold" text-anchor="middle" fill="#222">${escXml(view.name)}</text>`
  );
  if (view.primary_viewpoint) {
    out.push(
      `<text x="${totalW - 6}" y="${TITLE_H - 5}" font-family="${FONT}" font-size="9" ` +
      `text-anchor="end" fill="#666" font-style="italic">${escXml(view.primary_viewpoint)}</text>`
    );
  }

  // Nodes
  for (const g of geomList) {
    const { node, absX, absY, absW, absH } = g;
    const x = absX + ox;
    const y = absY + oy;
    const type = nodeType(node);
    const name = nodeName(node);
    const fill = rgbStr(node.fill_color) ?? ELEMENT_FILL[type] ?? "#F5F5F5";
    const stroke = rgbStr(node.line_color) ?? "#666666";
    const lw = node.line_width ?? 1;
    const fontColor = rgbStr(node.font_color) ?? "#222222";
    const fontSize = node.font_size ?? 11;
    const fontName = node.font_name ?? FONT;

    if (type === "AndJunction" || type === "OrJunction") {
      const r = Math.min(absW, absH) / 2;
      const cx = x + absW / 2;
      const cy = y + absH / 2;
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);
      if (type === "OrJunction") {
        // inner ring to distinguish from AND
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="white" stroke="${stroke}" stroke-width="${lw}"/>`);
      }
      continue;
    }

    const isGrouping = type === "Grouping";
    const dash = isGrouping ? ' stroke-dasharray="6,4"' : "";
    out.push(
      `<rect x="${x}" y="${y}" width="${absW}" height="${absH}" rx="2" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"${dash}/>`
    );

    // Type badge (top-right, 8px)
    if (!isGrouping && type !== "Location") {
      const badge = typeBadge(type);
      out.push(
        `<text x="${x + absW - 3}" y="${y + 10}" font-family="${FONT}" font-size="8" ` +
        `text-anchor="end" fill="#555" opacity="0.9">${escXml(badge)}</text>`
      );
    }

    // Name label
    if (name) {
      if (isGrouping) {
        // Grouping name in top-left, italic
        out.push(
          `<text x="${x + 5}" y="${y + 14}" font-family="${FONT}" font-size="11" ` +
          `font-style="italic" fill="#444">${escXml(name)}</text>`
        );
      } else {
        const maxChars = Math.max(4, Math.floor(absW / (fontSize * 0.58)));
        const lines = wrapText(name, maxChars);
        const lineH = fontSize + 3;
        const textBlock = lines.length * lineH;
        const startY = y + absH / 2 - textBlock / 2 + fontSize;
        for (let i = 0; i < lines.length; i++) {
          out.push(
            `<text x="${x + absW / 2}" y="${startY + i * lineH}" ` +
            `font-family="${fontName}" font-size="${fontSize}" ` +
            `text-anchor="middle" fill="${fontColor}">${escXml(lines[i]!)}</text>`
          );
        }
      }
    }
  }

  // Connections
  for (const conn of view.conns) {
    if (!conn.source || !conn.target) continue;
    const srcG = geomMap.get(conn.source);
    const tgtG = geomMap.get(conn.target);
    if (!srcG || !tgtG) continue;

    const sx = srcG.absX + ox, sy = srcG.absY + oy;
    const tx = tgtG.absX + ox, ty = tgtG.absY + oy;
    const srcCx = sx + srcG.absW / 2, srcCy = sy + srcG.absH / 2;
    const tgtCx = tx + tgtG.absW / 2, tgtCy = ty + tgtG.absH / 2;

    const start = rectEdge(tgtCx, tgtCy, sx, sy, srcG.absW, srcG.absH);
    const end   = rectEdge(srcCx, srcCy, tx, ty, tgtG.absW, tgtG.absH);

    const relType = conn.ref ? (relTypeMap.get(conn.ref) ?? "Association") : "Association";
    const style = REL_LINE[relType] ?? DEFAULT_REL_LINE;
    const lineColor = rgbStr(conn.line_color) ?? "#444444";
    const lw = conn.line_width ?? 1;

    const dashAttr = style.dashArray ? ` stroke-dasharray="${style.dashArray}"` : "";
    const msAttr   = style.markerStart ? ` marker-start="${style.markerStart}"` : "";
    const meAttr   = style.markerEnd   ? ` marker-end="${style.markerEnd}"`     : "";

    out.push(
      `<line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" ` +
      `x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" ` +
      `stroke="${lineColor}" stroke-width="${lw}"${dashAttr}${msAttr}${meAttr}/>`
    );

    // Connection label (if any)
    if (conn.name) {
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2 - 4;
      out.push(
        `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-family="${FONT}" font-size="9" ` +
        `text-anchor="middle" fill="#555">${escXml(conn.name)}</text>`
      );
    }
  }

  out.push("</svg>");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// PNG export (requires optional "sharp" package)
// ---------------------------------------------------------------------------

export async function renderViewToPng(view: ArchiView, model: ArchiModel): Promise<Buffer> {
  let sharpFn: (input: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
  try {
    const mod = await import("sharp");
    sharpFn = mod.default as typeof sharpFn;
  } catch {
    throw new Error(
      "PNG generation requires the 'sharp' package. Install it with: npm install sharp"
    );
  }
  const svg = renderViewToSvg(view, model);
  return sharpFn(Buffer.from(svg)).png().toBuffer();
}
