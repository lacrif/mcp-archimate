/**
 * Tests for the ArchiMate API (src/app.ts).
 *
 * Structure:
 * - Unit tests: internal helpers tested with plain objects (no real model).
 * - Integration tests: supertest against the Express app with the real model.
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

import {
  app,
  hexToRgb,
  elementOut,
  relOut,
  nodeOut,
  connectionOut,
  viewOut,
} from "../src/app.js";
import { registry } from "../src/registry.js";
import type { DataSource } from "../src/registry.js";
import {
  ACCESS_TYPES,
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  VIEWPOINTS,
  type ElementOut,
  type RelationshipOut,
  type ViewOut,
  type ViewDetailOut,
} from "../src/schemas.js";
import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView } from "../src/model.js";

const SOURCE_ID = "open-exchange";
const UNKNOWN_ID = "id-does-not-exist";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<ArchiElement> = {}): ArchiElement {
  return {
    uuid: "elem-001",
    name: "My Component",
    type: "ApplicationComponent",
    desc: null,
    props: {},
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<ArchiRelationship> = {}): ArchiRelationship {
  const src = makeElement({ uuid: "src-001", name: "Source" });
  const tgt = makeElement({ uuid: "tgt-001", name: "Target" });
  return {
    uuid: "rel-001",
    name: null,
    type: "Association",
    source: src,
    target: tgt,
    desc: null,
    props: {},
    access_type: null,
    is_directed: null,
    influence_strength: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<ArchiNode> = {}): ArchiNode {
  return {
    uuid: "node-001",
    name: null,
    ref: null,
    x: 10,
    y: 20,
    w: 120,
    h: 55,
    fill_color: { r: 255, g: 255, b: 255, a: 100 },
    line_color: { r: 0, g: 0, b: 0, a: 100 },
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    nodes: [],
    ...overrides,
  };
}

function makeConnection(overrides: Partial<ArchiConnection> = {}): ArchiConnection {
  return {
    uuid: "conn-001",
    name: null,
    ref: "rel-001",
    source: "node-src",
    target: "node-tgt",
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    ...overrides,
  };
}

function makeView(overrides: Partial<ArchiView> = {}): ArchiView {
  return {
    uuid: "view-001",
    name: "My View",
    desc: null,
    primary_viewpoint: null,
    nodes: [],
    conns: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures (loaded once)
// ---------------------------------------------------------------------------

let ds: DataSource;
let elementsData: ElementOut[];
let knownElement: ElementOut;
let knownElementType: string;
let knownElementNameFragment: string;
let relationshipsData: RelationshipOut[];
let knownRelationship: RelationshipOut;
let knownRelationshipType: string;
let knownView: ViewOut;

beforeAll(async () => {
  ds = registry.get(SOURCE_ID)!;

  const elemRes = await request(app).get(`/${SOURCE_ID}/elements`);
  elementsData = elemRes.body as ElementOut[];
  knownElement = elementsData.find((e) => e.identifier && e.type) ?? elementsData[0]!;
  knownElementType = knownElement.type;
  const name = knownElement.name ?? "";
  knownElementNameFragment = (name.length >= 3 ? name.slice(0, 3) : name).toLowerCase();

  const relRes = await request(app).get(`/${SOURCE_ID}/relationships`);
  relationshipsData = relRes.body as RelationshipOut[];
  knownRelationship = relationshipsData.find((r) => r.identifier && r.type) ?? relationshipsData[0]!;
  knownRelationshipType = knownRelationship.type;

  const viewRes = await request(app).get(`/${SOURCE_ID}/views`);
  const views = viewRes.body as ViewOut[];
  knownView = views.find((v) => v.identifier) ?? views[0]!;
});

// ===========================================================================
// Unit tests – schema constants
// ===========================================================================

describe("Schema constants", () => {
  it("ELEMENT_TYPES has 62 types", () => {
    expect(ELEMENT_TYPES.size).toBe(62);
  });

  it("ELEMENT_TYPES contains Business Layer types", () => {
    const expected = [
      "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
      "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
      "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Application Layer types", () => {
    const expected = [
      "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
      "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
      "ApplicationEvent", "ApplicationService", "DataObject",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Technology Layer types", () => {
    const expected = [
      "Node", "Device", "SystemSoftware", "TechnologyCollaboration",
      "TechnologyInterface", "Path", "CommunicationNetwork", "TechnologyFunction",
      "TechnologyProcess", "TechnologyInteraction", "TechnologyEvent",
      "TechnologyService", "Artifact",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Motivation types", () => {
    const expected = [
      "Stakeholder", "Driver", "Assessment", "Goal", "Outcome",
      "Principle", "Requirement", "Constraint", "Meaning", "Value",
    ];
    for (const t of expected) expect(ELEMENT_TYPES.has(t)).toBe(true);
  });

  it("ELEMENT_TYPES contains Strategy types", () => {
    for (const t of ["Resource", "Capability", "CourseOfAction", "ValueStream"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("ELEMENT_TYPES contains Implementation & Migration types", () => {
    for (const t of ["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("ELEMENT_TYPES contains Composites & Junctions", () => {
    for (const t of ["Grouping", "Location", "AndJunction", "OrJunction"]) {
      expect(ELEMENT_TYPES.has(t)).toBe(true);
    }
  });

  it("RELATIONSHIP_TYPES has all 11 types", () => {
    const expected = new Set([
      "Composition", "Aggregation", "Assignment", "Realization", "Serving",
      "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
    ]);
    expect(RELATIONSHIP_TYPES).toEqual(expected);
  });

  it("ACCESS_TYPES are correct", () => {
    expect(ACCESS_TYPES).toEqual(new Set(["Access", "Read", "Write", "ReadWrite"]));
  });

  it("VIEWPOINTS has at least 20 entries", () => {
    expect(VIEWPOINTS.size).toBeGreaterThanOrEqual(20);
  });

  it("VIEWPOINTS contains standard viewpoints", () => {
    expect(VIEWPOINTS.has("Layered")).toBe(true);
    expect(VIEWPOINTS.has("Motivation")).toBe(true);
    expect(VIEWPOINTS.has("Strategy")).toBe(true);
  });
});

// ===========================================================================
// Unit tests – hexToRgb helper
// ===========================================================================

describe("hexToRgb", () => {
  it("converts white #FFFFFF", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts black #000000", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts grey #5C5C5C", () => {
    const c = hexToRgb("#5C5C5C");
    expect(c?.r).toBe(92);
    expect(c?.g).toBe(92);
    expect(c?.b).toBe(92);
  });

  it("converts without hash prefix", () => {
    expect(hexToRgb("FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for null input", () => {
    expect(hexToRgb(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(hexToRgb("")).toBeNull();
  });

  it("returns null for invalid length #FFF", () => {
    expect(hexToRgb("#FFF")).toBeNull();
  });

  it("returns null for invalid hex #ZZZZZZ", () => {
    expect(hexToRgb("#ZZZZZZ")).toBeNull();
  });
});

// ===========================================================================
// Unit tests – elementOut helper
// ===========================================================================

describe("elementOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(elementOut(makeElement()).identifier).toBe("elem-001");
  });

  it("maps name and type", () => {
    const result = elementOut(makeElement());
    expect(result.name).toBe("My Component");
    expect(result.type).toBe("ApplicationComponent");
  });

  it("maps desc to documentation", () => {
    expect(elementOut(makeElement({ desc: "Some doc" })).documentation).toBe("Some doc");
  });

  it("documentation is null when desc is null", () => {
    expect(elementOut(makeElement({ desc: null })).documentation).toBeNull();
  });

  it("converts props dict to PropertyOut array", () => {
    const result = elementOut(makeElement({ props: { "Capability Level": "0", Status: "active" } }));
    expect(result.properties).toHaveLength(2);
    const refs = new Set(result.properties.map((p) => p.property_definition_ref));
    expect(refs.has("Capability Level")).toBe(true);
    expect(refs.has("Status")).toBe(true);
  });

  it("property value is a string", () => {
    const result = elementOut(makeElement({ props: { key: "val" } }));
    expect(result.properties[0]!.value).toBe("val");
  });

  it("empty props gives empty array", () => {
    expect(elementOut(makeElement({ props: {} })).properties).toEqual([]);
  });
});

// ===========================================================================
// Unit tests – relOut helper
// ===========================================================================

describe("relOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(relOut(makeRelationship()).identifier).toBe("rel-001");
  });

  it("resolves source and target UUIDs", () => {
    const result = relOut(makeRelationship());
    expect(result.source).toBe("src-001");
    expect(result.target).toBe("tgt-001");
  });

  it("includes source_name and target_name", () => {
    const result = relOut(makeRelationship());
    expect(result.source_name).toBe("Source");
    expect(result.target_name).toBe("Target");
  });

  it("maps desc to documentation", () => {
    expect(relOut(makeRelationship({ desc: "Relation doc" })).documentation).toBe("Relation doc");
  });

  it("sets access_type for Access relationship", () => {
    const result = relOut(makeRelationship({ type: "Access", access_type: "Write" }));
    expect(result.access_type).toBe("Write");
  });

  it("access_type is null for non-Access relationship", () => {
    const result = relOut(makeRelationship({ type: "Flow", access_type: "Write" }));
    expect(result.access_type).toBeNull();
  });

  it("sets is_directed for Association", () => {
    const result = relOut(makeRelationship({ type: "Association", is_directed: true }));
    expect(result.is_directed).toBe(true);
  });

  it("is_directed is null for non-Association", () => {
    const result = relOut(makeRelationship({ type: "Serving", is_directed: true }));
    expect(result.is_directed).toBeNull();
  });

  it("sets modifier for Influence", () => {
    const result = relOut(makeRelationship({ type: "Influence", influence_strength: "+" }));
    expect(result.modifier).toBe("+");
  });

  it("modifier is null for non-Influence", () => {
    const result = relOut(makeRelationship({ type: "Flow", influence_strength: "+" }));
    expect(result.modifier).toBeNull();
  });
});

// ===========================================================================
// Unit tests – nodeOut helper
// ===========================================================================

describe("nodeOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(nodeOut(makeNode()).identifier).toBe("node-001");
  });

  it("maps coordinates as integers", () => {
    const result = nodeOut(makeNode({ x: 10, y: 20, w: 120, h: 55 }));
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.w).toBe(120);
    expect(result.h).toBe(55);
  });

  it("element_ref from string ref", () => {
    expect(nodeOut(makeNode({ ref: "elem-abc" })).element_ref).toBe("elem-abc");
  });

  it("element_ref from element object ref", () => {
    const refObj = makeElement({ uuid: "elem-xyz" });
    expect(nodeOut(makeNode({ ref: refObj })).element_ref).toBe("elem-xyz");
  });

  it("element_ref is null when ref is null", () => {
    expect(nodeOut(makeNode({ ref: null })).element_ref).toBeNull();
  });

  it("style has fill and line colors", () => {
    const result = nodeOut(makeNode({
      fill_color: { r: 255, g: 0, b: 0 },
      line_color: { r: 0, g: 0, b: 255 },
    }));
    expect(result.style?.fill_color).toEqual({ r: 255, g: 0, b: 0 });
    expect(result.style?.line_color).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("children are populated", () => {
    const child = makeNode({ uuid: "child-001" });
    const parent = makeNode({ uuid: "parent-001", nodes: [child] });
    const result = nodeOut(parent);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.identifier).toBe("child-001");
  });
});

// ===========================================================================
// Unit tests – connectionOut helper
// ===========================================================================

describe("connectionOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(connectionOut(makeConnection()).identifier).toBe("conn-001");
  });

  it("maps relationship_ref", () => {
    expect(connectionOut(makeConnection({ ref: "rel-abc" })).relationship_ref).toBe("rel-abc");
  });

  it("maps source and target", () => {
    const result = connectionOut(makeConnection({ source: "n1", target: "n2" }));
    expect(result.source).toBe("n1");
    expect(result.target).toBe("n2");
  });

  it("style has line_color", () => {
    const result = connectionOut(makeConnection({ line_color: { r: 92, g: 92, b: 92 } }));
    expect(result.style?.line_color).toEqual({ r: 92, g: 92, b: 92 });
  });

  it("style is null when no styling", () => {
    expect(connectionOut(makeConnection({ line_color: null, line_width: null })).style).toBeNull();
  });
});

// ===========================================================================
// Unit tests – viewOut helper
// ===========================================================================

describe("viewOut helper", () => {
  it("maps uuid to identifier", () => {
    expect(viewOut(makeView()).identifier).toBe("view-001");
  });

  it("maps name", () => {
    expect(viewOut(makeView()).name).toBe("My View");
  });

  it("maps desc to documentation", () => {
    expect(viewOut(makeView({ desc: "View doc" })).documentation).toBe("View doc");
  });

  it("maps primary_viewpoint to viewpoint", () => {
    expect(viewOut(makeView({ primary_viewpoint: "Layered" })).viewpoint).toBe("Layered");
  });

  it("node_count is correct", () => {
    const nodes = [makeNode(), makeNode({ uuid: "node-002" }), makeNode({ uuid: "node-003" })];
    expect(viewOut(makeView({ nodes })).node_count).toBe(3);
  });

  it("connection_count is correct", () => {
    const conns = [makeConnection(), makeConnection({ uuid: "conn-002" }), makeConnection({ uuid: "conn-003" }), makeConnection({ uuid: "conn-004" }), makeConnection({ uuid: "conn-005" })];
    expect(viewOut(makeView({ conns })).connection_count).toBe(5);
  });

  it("summary returns ViewOut shape (no nodes/connections array)", () => {
    const result = viewOut(makeView());
    expect("nodes" in result).toBe(false);
    expect("connections" in result).toBe(false);
  });

  it("detail mode returns ViewDetailOut with nodes and connections", () => {
    const result = viewOut(makeView(), true) as ViewDetailOut;
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.connections)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /sources
// ===========================================================================

describe("GET /sources", () => {
  it("returns 200", async () => {
    expect((await request(app).get("/sources")).status).toBe(200);
  });

  it("returns an array of sources", async () => {
    const data = (await request(app).get("/sources")).body;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("each source has id and name", async () => {
    const data = (await request(app).get("/sources")).body as { id: string; name: string }[];
    for (const src of data) {
      expect(typeof src.id).toBe("string");
      expect(typeof src.name).toBe("string");
    }
  });

  it("contains the open-exchange source", async () => {
    const data = (await request(app).get("/sources")).body as { id: string }[];
    expect(data.some((s) => s.id === SOURCE_ID)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/
// ===========================================================================

describe(`GET /${SOURCE_ID}/`, () => {
  it("returns 200", async () => {
    const res = await request(app).get(`/${SOURCE_ID}/`);
    expect(res.status).toBe(200);
  });

  it("response has required fields", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/`)).body;
    expect(data).toHaveProperty("identifier");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("element_count");
    expect(data).toHaveProperty("relationship_count");
    expect(data).toHaveProperty("view_count");
  });

  it("model name is non-empty string", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/`)).body;
    expect(typeof data.name).toBe("string");
    expect(data.name.trim()).not.toBe("");
  });

  it("counts are positive", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/`)).body;
    expect(data.element_count).toBeGreaterThan(0);
    expect(data.relationship_count).toBeGreaterThan(0);
    expect(data.view_count).toBeGreaterThan(0);
  });

  it("identifier is non-empty", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/`)).body;
    expect(data.identifier.trim()).not.toBe("");
  });

  it("unknown source_id returns 404", async () => {
    expect((await request(app).get("/unknown-source/")).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/elements/types
// ===========================================================================

describe(`GET /${SOURCE_ID}/elements/types`, () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/elements/types`)).status).toBe(200);
  });

  it("returns array of strings", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/types`)).body as string[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((t) => typeof t === "string")).toBe(true);
  });

  it("is sorted", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/types`)).body as string[];
    expect(data).toEqual([...data].sort());
  });

  it("has no duplicates", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/types`)).body as string[];
    expect(data.length).toBe(new Set(data).size);
  });

  it("contains known element type", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/types`)).body as string[];
    expect(data.includes(knownElementType)).toBe(true);
  });

  it("all types are valid ArchiMate 3.1", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/types`)).body as string[];
    for (const t of data) {
      expect(ELEMENT_TYPES.has(t), `Type '${t}' not in ArchiMate 3.1 spec`).toBe(true);
    }
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/elements
// ===========================================================================

describe(`GET /${SOURCE_ID}/elements`, () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/elements`)).status).toBe(200);
  });

  it("returns all elements", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements`)).body as ElementOut[];
    expect(data.length).toBe(ds.model.elements.length);
  });

  it("element has required shape", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements`)).body as ElementOut[];
    const e = data[0]!;
    expect(e).toHaveProperty("identifier");
    expect(e).toHaveProperty("name");
    expect(e).toHaveProperty("type");
    expect(e).toHaveProperty("documentation");
    expect(e).toHaveProperty("properties");
  });

  it("properties is an array", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements`)).body as ElementOut[];
    expect(data.every((e) => Array.isArray(e.properties))).toBe(true);
  });

  it("property has correct shape", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements`)).body as ElementOut[];
    const withProps = data.find((e) => e.properties.length > 0);
    if (withProps) {
      const p = withProps.properties[0]!;
      expect(p).toHaveProperty("property_definition_ref");
      expect(p).toHaveProperty("value");
    }
  });

  it("filter by type works", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements?type=${knownElementType}`)).body as ElementOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => e.type === knownElementType)).toBe(true);
  });

  it("filter by type + name returns empty when no match", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements?type=Capability&name=xyznotfound123`)).body;
    expect(data).toEqual([]);
  });

  it("invalid type returns 422", async () => {
    const res = await request(app).get(`/${SOURCE_ID}/elements?type=NonExistentType`);
    expect(res.status).toBe(422);
  });

  it("filter by name is case-insensitive", async () => {
    if (!knownElementNameFragment) return;
    const data = (await request(app).get(`/${SOURCE_ID}/elements?name=${knownElementNameFragment}`)).body as ElementOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => (e.name ?? "").toLowerCase().includes(knownElementNameFragment))).toBe(true);
  });

  it("name filter with no match returns empty array", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements?name=xyznotfound123`)).body;
    expect(data).toEqual([]);
  });

  it("combined filter by type and name", async () => {
    if (!knownElementNameFragment) return;
    const data = (await request(app).get(`/${SOURCE_ID}/elements?type=${knownElementType}&name=${knownElementNameFragment}`)).body as ElementOut[];
    expect(data.every((e) => e.type === knownElementType)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/elements/:id
// ===========================================================================

describe(`GET /${SOURCE_ID}/elements/:id`, () => {
  it("known id returns 200", async () => {
    const res = await request(app).get(`/${SOURCE_ID}/elements/${knownElement.identifier}`);
    expect(res.status).toBe(200);
  });

  it("known id returns correct data", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/${knownElement.identifier}`)).body;
    expect(data.identifier).toBe(knownElement.identifier);
    expect(data.name).toBe(knownElement.name);
    expect(data.type).toBe(knownElement.type);
  });

  it("unknown id returns 404", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/elements/${UNKNOWN_ID}`)).status).toBe(404);
  });

  it("404 message contains the id", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/${UNKNOWN_ID}`)).body;
    expect(data.detail).toContain(UNKNOWN_ID);
  });

  it("properties is an array", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/elements/${knownElement.identifier}`)).body;
    expect(Array.isArray(data.properties)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/relationships/types
// ===========================================================================

describe(`GET /${SOURCE_ID}/relationships/types`, () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/relationships/types`)).status).toBe(200);
  });

  it("is sorted", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships/types`)).body as string[];
    expect(data).toEqual([...data].sort());
  });

  it("contains known relationship type", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships/types`)).body as string[];
    expect(data.includes(knownRelationshipType)).toBe(true);
  });

  it("all types are valid ArchiMate 3.1", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships/types`)).body as string[];
    for (const t of data) {
      expect(RELATIONSHIP_TYPES.has(t), `Type '${t}' not in ArchiMate 3.1 spec`).toBe(true);
    }
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/relationships
// ===========================================================================

describe(`GET /${SOURCE_ID}/relationships`, () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/relationships`)).status).toBe(200);
  });

  it("returns all relationships", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships`)).body as RelationshipOut[];
    expect(data.length).toBe(ds.model.relationships.length);
  });

  it("relationship has required shape", async () => {
    const r = ((await request(app).get(`/${SOURCE_ID}/relationships`)).body as RelationshipOut[])[0]!;
    expect(r).toHaveProperty("identifier");
    expect(r).toHaveProperty("type");
    expect(r).toHaveProperty("source");
    expect(r).toHaveProperty("target");
    expect(r).toHaveProperty("documentation");
    expect(r).toHaveProperty("properties");
  });

  it("filter by type works", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?type=${knownRelationshipType}`)).body as RelationshipOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.type === knownRelationshipType)).toBe(true);
  });

  it("invalid type returns 422", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/relationships?type=NotARelType`)).status).toBe(422);
  });

  it("filter by source_id works", async () => {
    const source = knownRelationship.source;
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?source_id=${source}`)).body as RelationshipOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.source === source)).toBe(true);
  });

  it("filter by target_id works", async () => {
    const target = knownRelationship.target;
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?target_id=${target}`)).body as RelationshipOut[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.target === target)).toBe(true);
  });

  it("filter with no match returns empty array", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?source_id=${UNKNOWN_ID}`)).body;
    expect(data).toEqual([]);
  });

  it("source_name and target_name are present", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships`)).body as RelationshipOut[];
    expect(data.every((r) => "source_name" in r && "target_name" in r)).toBe(true);
  });

  it("Access relationships have access_type in ACCESS_TYPES or null", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?type=Access`)).body as RelationshipOut[];
    for (const r of data) {
      if (r.access_type !== null && r.access_type !== undefined) {
        expect(ACCESS_TYPES.has(r.access_type)).toBe(true);
      }
    }
  });

  it("Association relationships have is_directed field", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?type=Association`)).body as RelationshipOut[];
    for (const r of data) {
      expect("is_directed" in r).toBe(true);
    }
  });

  it("Influence relationships have modifier field", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships?type=Influence`)).body as RelationshipOut[];
    for (const r of data) {
      expect("modifier" in r).toBe(true);
    }
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/relationships/:id
// ===========================================================================

describe(`GET /${SOURCE_ID}/relationships/:id`, () => {
  it("known id returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/relationships/${knownRelationship.identifier}`)).status).toBe(200);
  });

  it("known id returns correct data", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/relationships/${knownRelationship.identifier}`)).body;
    expect(data.identifier).toBe(knownRelationship.identifier);
    expect(data.type).toBe(knownRelationship.type);
  });

  it("unknown id returns 404", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/relationships/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/views
// ===========================================================================

describe(`GET /${SOURCE_ID}/views`, () => {
  it("returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/views`)).status).toBe(200);
  });

  it("returns all views", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views`)).body as ViewOut[];
    expect(data.length).toBe(ds.model.views.length);
  });

  it("view has required shape", async () => {
    const v = ((await request(app).get(`/${SOURCE_ID}/views`)).body as ViewOut[])[0]!;
    expect(v).toHaveProperty("identifier");
    expect(v).toHaveProperty("name");
    expect(v).toHaveProperty("node_count");
    expect(v).toHaveProperty("connection_count");
    expect(v).toHaveProperty("viewpoint");
    expect(v).toHaveProperty("documentation");
  });

  it("node_count is an integer", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views`)).body as ViewOut[];
    expect(data.every((v) => Number.isInteger(v.node_count))).toBe(true);
  });

  it("connection_count is an integer", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views`)).body as ViewOut[];
    expect(data.every((v) => Number.isInteger(v.connection_count))).toBe(true);
  });

  it("contains known view", async () => {
    const ids = ((await request(app).get(`/${SOURCE_ID}/views`)).body as ViewOut[]).map((v) => v.identifier);
    expect(ids.includes(knownView.identifier)).toBe(true);
  });
});

// ===========================================================================
// Integration tests – GET /:source_id/views/:id
// ===========================================================================

describe(`GET /${SOURCE_ID}/views/:id`, () => {
  it("known id returns 200", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).status).toBe(200);
  });

  it("known id returns correct data", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body;
    expect(data.identifier).toBe(knownView.identifier);
    expect(data.name).toBe(knownView.name);
  });

  it("nodes are present and count matches", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(data.nodes.length).toBe(data.node_count);
  });

  it("connections are present and count matches", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    expect(Array.isArray(data.connections)).toBe(true);
    expect(data.connections.length).toBe(data.connection_count);
  });

  it("node has correct shape (if view has nodes)", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    if (!data.nodes.length) return;
    const n = data.nodes[0]!;
    expect(n).toHaveProperty("identifier");
    expect(n).toHaveProperty("element_ref");
    expect(n).toHaveProperty("x");
    expect(n).toHaveProperty("y");
    expect(n).toHaveProperty("w");
    expect(n).toHaveProperty("h");
    expect(n).toHaveProperty("style");
    expect(n).toHaveProperty("children");
  });

  it("node coordinates are integers", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    for (const n of data.nodes) {
      if (n.x !== null && n.x !== undefined) expect(Number.isInteger(n.x)).toBe(true);
      if (n.w !== null && n.w !== undefined) expect(Number.isInteger(n.w)).toBe(true);
    }
  });

  it("node style RGB colors are in 0-255 range", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    for (const n of data.nodes) {
      const fc = n.style?.fill_color;
      if (fc) {
        expect(fc.r).toBeGreaterThanOrEqual(0);
        expect(fc.r).toBeLessThanOrEqual(255);
        expect(fc.g).toBeGreaterThanOrEqual(0);
        expect(fc.g).toBeLessThanOrEqual(255);
        expect(fc.b).toBeGreaterThanOrEqual(0);
        expect(fc.b).toBeLessThanOrEqual(255);
      }
    }
  });

  it("connection has correct shape (if view has connections)", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    if (!data.connections.length) return;
    const c = data.connections[0]!;
    expect(c).toHaveProperty("identifier");
    expect(c).toHaveProperty("relationship_ref");
    expect(c).toHaveProperty("source");
    expect(c).toHaveProperty("target");
  });

  it("connection source references a node in the view", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    if (!data.connections.length) return;
    const nodeIds = new Set(data.nodes.map((n) => n.identifier));
    for (const c of data.connections) {
      if (c.source) expect(nodeIds.has(c.source)).toBe(true);
    }
  });

  it("connection relationship_ref references a known relationship", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    const relIds = new Set(
      ((await request(app).get(`/${SOURCE_ID}/relationships`)).body as RelationshipOut[]).map((r) => r.identifier)
    );
    for (const c of data.connections) {
      if (c.relationship_ref) expect(relIds.has(c.relationship_ref)).toBe(true);
    }
  });

  it("node element_ref references a known element", async () => {
    const data = (await request(app).get(`/${SOURCE_ID}/views/${knownView.identifier}`)).body as ViewDetailOut;
    const elemIds = new Set(
      ((await request(app).get(`/${SOURCE_ID}/elements`)).body as ElementOut[]).map((e) => e.identifier)
    );
    const refs = data.nodes.filter((n) => n.element_ref).map((n) => n.element_ref!);
    if (refs.length > 0) {
      expect(refs.some((ref) => elemIds.has(ref))).toBe(true);
    }
  });

  it("unknown id returns 404", async () => {
    expect((await request(app).get(`/${SOURCE_ID}/views/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

// ===========================================================================
// Integration tests – MCP service
// ===========================================================================

describe("MCP service", () => {
  it("POST /mcp/ without session returns 400 for non-initialize request", async () => {
    const res = await request(app)
      .post("/mcp/")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: "1", method: "tools/list", params: {} });
    expect(res.status).toBe(400);
  });

  it("initialize and list tools via JSON-RPC", async () => {
    const headers = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    };

    const initRes = await request(app)
      .post("/mcp/")
      .set(headers)
      .send({
        jsonrpc: "2.0",
        id: "init-1",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0" },
        },
      });

    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers["mcp-session-id"] as string;
    expect(sessionId).toBeTruthy();

    const initLine = initRes.text.split("\n").find((l) => l.startsWith("data: "));
    expect(initLine).toBeTruthy();
    const initPayload = JSON.parse(initLine!.replace("data: ", ""));
    expect(initPayload.jsonrpc).toBe("2.0");
    expect(initPayload).toHaveProperty("result");

    const toolsRes = await request(app)
      .post("/mcp/")
      .set({ ...headers, "mcp-session-id": sessionId })
      .send({ jsonrpc: "2.0", id: "tools-1", method: "tools/list", params: {} });

    expect(toolsRes.status).toBe(200);
    const toolsLine = toolsRes.text.split("\n").find((l) => l.startsWith("data: "));
    const toolsPayload = JSON.parse(toolsLine!.replace("data: ", ""));
    const registeredTools = new Set((toolsPayload.result.tools as { name: string }[]).map((t) => t.name));

    const expectedTools = new Set([
      "get_model_info",
      "list_element_types",
      "list_elements",
      "get_element",
      "list_relationship_types",
      "list_relationships",
      "get_relationship",
      "list_views",
      "get_view",
    ]);

    for (const tool of expectedTools) {
      expect(registeredTools.has(tool), `Tool '${tool}' not registered`).toBe(true);
    }
  });
});
