/**
 * OpenAPI 3.0 specification for the mcp-archimate REST API.
 * Served as JSON at GET /openapi.json and as Swagger UI at GET /docs.
 */

import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "./schemas.js";

const elementTypesEnum = [...ELEMENT_TYPES].sort();
const relationshipTypesEnum = [...RELATIONSHIP_TYPES].sort();

// ---------------------------------------------------------------------------
// Reusable schema objects
// ---------------------------------------------------------------------------

const RGBColor = {
  type: "object",
  properties: {
    r: { type: "integer", minimum: 0, maximum: 255 },
    g: { type: "integer", minimum: 0, maximum: 255 },
    b: { type: "integer", minimum: 0, maximum: 255 },
  },
  required: ["r", "g", "b"],
};

const Font = {
  type: "object",
  properties: {
    name:  { type: "string", nullable: true },
    size:  { type: "number", nullable: true },
    style: { type: "string", nullable: true },
    color: { $ref: "#/components/schemas/RGBColor", nullable: true },
  },
};

const Style = {
  type: "object",
  properties: {
    fill_color:  { $ref: "#/components/schemas/RGBColor", nullable: true },
    line_color:  { $ref: "#/components/schemas/RGBColor", nullable: true },
    font:        { $ref: "#/components/schemas/Font",     nullable: true },
    line_width:  { type: "number", nullable: true },
  },
};

const Property = {
  type: "object",
  required: ["property_definition_ref", "value"],
  properties: {
    property_definition_ref: { type: "string" },
    value:                   { type: "string" },
  },
};

const SourceInfo = {
  type: "object",
  required: ["id", "name"],
  properties: {
    id:   { type: "string", example: "open-exchange" },
    name: { type: "string", example: "Open Exchange Demo" },
  },
};

const ModelInfo = {
  type: "object",
  required: ["identifier", "name", "element_count", "relationship_count", "view_count"],
  properties: {
    identifier:         { type: "string" },
    name:               { type: "string" },
    documentation:      { type: "string", nullable: true },
    version:            { type: "string", nullable: true },
    element_count:      { type: "integer" },
    relationship_count: { type: "integer" },
    view_count:         { type: "integer" },
  },
};

const Element = {
  type: "object",
  required: ["identifier", "name", "type", "properties"],
  properties: {
    identifier:    { type: "string" },
    name:          { type: "string" },
    type:          { type: "string", enum: elementTypesEnum },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
  },
};

const Relationship = {
  type: "object",
  required: ["identifier", "type", "source", "target", "properties"],
  properties: {
    identifier:    { type: "string" },
    name:          { type: "string", nullable: true },
    type:          { type: "string", enum: relationshipTypesEnum },
    source:        { type: "string", description: "Identifiant de l'element source" },
    source_name:   { type: "string", nullable: true },
    target:        { type: "string", description: "Identifiant de l'element cible" },
    target_name:   { type: "string", nullable: true },
    documentation: { type: "string", nullable: true },
    properties:    { type: "array", items: { $ref: "#/components/schemas/Property" } },
    access_type:   { type: "string", enum: ["Access", "Read", "Write", "ReadWrite"], nullable: true,
                     description: "Uniquement pour le type Access" },
    is_directed:   { type: "boolean", nullable: true,
                     description: "Uniquement pour le type Association" },
    modifier:      { type: "string", nullable: true,
                     description: "Force d'influence, uniquement pour le type Influence" },
  },
};

const Node: Record<string, unknown> = {
  type: "object",
  required: ["identifier", "children"],
  properties: {
    identifier:  { type: "string" },
    name:        { type: "string", nullable: true },
    element_ref: { type: "string", nullable: true },
    x:           { type: "integer", nullable: true },
    y:           { type: "integer", nullable: true },
    w:           { type: "integer", nullable: true },
    h:           { type: "integer", nullable: true },
    style:       { $ref: "#/components/schemas/Style", nullable: true },
    children:    { type: "array", items: { $ref: "#/components/schemas/Node" } },
  },
};

const Connection = {
  type: "object",
  required: ["identifier"],
  properties: {
    identifier:       { type: "string" },
    name:             { type: "string", nullable: true },
    relationship_ref: { type: "string", nullable: true },
    source:           { type: "string", nullable: true },
    target:           { type: "string", nullable: true },
    style:            { $ref: "#/components/schemas/Style", nullable: true },
  },
};

const View = {
  type: "object",
  required: ["identifier", "name", "node_count", "connection_count"],
  properties: {
    identifier:       { type: "string" },
    name:             { type: "string" },
    documentation:    { type: "string", nullable: true },
    viewpoint:        { type: "string", nullable: true },
    node_count:       { type: "integer" },
    connection_count: { type: "integer" },
  },
};

const ViewDetail = {
  allOf: [
    { $ref: "#/components/schemas/View" },
    {
      type: "object",
      required: ["nodes", "connections"],
      properties: {
        nodes:       { type: "array", items: { $ref: "#/components/schemas/Node" } },
        connections: { type: "array", items: { $ref: "#/components/schemas/Connection" } },
      },
    },
  ],
};

const ErrorDetail = {
  type: "object",
  required: ["detail"],
  properties: {
    detail: { type: "string" },
  },
};

// ---------------------------------------------------------------------------
// Reusable parameters
// ---------------------------------------------------------------------------

const sourceIdParam = {
  name: "source_id",
  in: "path",
  required: true,
  schema: { type: "string", example: "open-exchange" },
  description: "Identifiant de la source de donnees declare dans config.json",
};

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "mcp-archimate",
    version: "2.0.0",
    description:
      "API REST pour interroger des modeles ArchiMate 3.1 (Open Exchange XML et format Archi Tool natif). " +
      "Plusieurs sources de donnees peuvent etre configurees simultanement via `config.json`. " +
      "Toutes les routes de donnees sont prefixees par l'identifiant de la source (`/{source_id}/`).",
    contact: { name: "GitHub", url: "https://github.com/lacrif/mcp-archimate" },
  },
  servers: [{ url: "http://localhost:8000", description: "Serveur local" }],

  tags: [
    { name: "Sources",       description: "Gestion des sources de donnees" },
    { name: "Elements",      description: "Elements ArchiMate" },
    { name: "Relationships", description: "Relations ArchiMate" },
    { name: "Views",         description: "Vues et diagrammes" },
    { name: "MCP",           description: "Transport MCP (streamable-http)" },
  ],

  paths: {
    "/sources": {
      get: {
        tags: ["Sources"],
        summary: "Lister les sources configurees",
        operationId: "listSources",
        responses: {
          "200": {
            description: "Liste des sources de donnees",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/SourceInfo" } },
              },
            },
          },
        },
      },
    },

    "/{source_id}/": {
      get: {
        tags: ["Sources"],
        summary: "Metadonnees d'un modele",
        operationId: "getModelInfo",
        parameters: [sourceIdParam],
        responses: {
          "200": {
            description: "Informations globales du modele",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ModelInfo" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/{source_id}/elements/types": {
      get: {
        tags: ["Elements"],
        summary: "Types d'elements presents dans la source",
        operationId: "listElementTypes",
        parameters: [sourceIdParam],
        responses: {
          "200": {
            description: "Liste triee des types d'elements ArchiMate 3.1 presents",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["ApplicationComponent", "BusinessActor"] },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/{source_id}/elements": {
      get: {
        tags: ["Elements"],
        summary: "Lister les elements",
        operationId: "listElements",
        parameters: [
          sourceIdParam,
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: elementTypesEnum },
            description: "Filtrer par type ArchiMate 3.1",
          },
          {
            name: "name",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par nom (insensible a la casse, sous-chaine)",
          },
        ],
        responses: {
          "200": {
            description: "Liste des elements",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Element" } },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/{source_id}/elements/{identifier}": {
      get: {
        tags: ["Elements"],
        summary: "Detail d'un element",
        operationId: "getElementById",
        parameters: [
          sourceIdParam,
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de l'element (champ identifier)",
          },
        ],
        responses: {
          "200": {
            description: "Element ArchiMate",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Element" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/{source_id}/relationships/types": {
      get: {
        tags: ["Relationships"],
        summary: "Types de relations presents dans la source",
        operationId: "listRelationshipTypes",
        parameters: [sourceIdParam],
        responses: {
          "200": {
            description: "Liste triee des types de relations ArchiMate 3.1 presents",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" }, example: ["Association", "Flow"] },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/{source_id}/relationships": {
      get: {
        tags: ["Relationships"],
        summary: "Lister les relations",
        operationId: "listRelationships",
        parameters: [
          sourceIdParam,
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: relationshipTypesEnum },
            description: "Filtrer par type de relation",
          },
          {
            name: "source_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par identifiant de l'element source",
          },
          {
            name: "target_id",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrer par identifiant de l'element cible",
          },
        ],
        responses: {
          "200": {
            description: "Liste des relations",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Relationship" } },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "422": { $ref: "#/components/responses/UnprocessableType" },
        },
      },
    },

    "/{source_id}/relationships/{identifier}": {
      get: {
        tags: ["Relationships"],
        summary: "Detail d'une relation",
        operationId: "getRelationshipById",
        parameters: [
          sourceIdParam,
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la relation",
          },
        ],
        responses: {
          "200": {
            description: "Relation ArchiMate",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Relationship" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/{source_id}/views": {
      get: {
        tags: ["Views"],
        summary: "Lister les vues",
        operationId: "listViews",
        parameters: [sourceIdParam],
        responses: {
          "200": {
            description: "Liste des vues avec compteurs",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/View" } },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/{source_id}/views/{identifier}": {
      get: {
        tags: ["Views"],
        summary: "Detail d'une vue",
        operationId: "getViewById",
        parameters: [
          sourceIdParam,
          {
            name: "identifier",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identifiant de la vue",
          },
        ],
        responses: {
          "200": {
            description: "Vue avec noeuds et connexions",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ViewDetail" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/mcp/": {
      post: {
        tags: ["MCP"],
        summary: "Requete MCP (JSON-RPC)",
        operationId: "mcpPost",
        description:
          "Point d'entree JSON-RPC 2.0 du transport streamable-http MCP. " +
          "La premiere requete doit etre une `initialize`. " +
          "Les requetes suivantes doivent inclure l'en-tete `mcp-session-id` retourne par `initialize`.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Reponse JSON-RPC (text/event-stream ou application/json)" },
          "400": { description: "Session invalide ou requete non-initialize sans session" },
        },
      },
      get: {
        tags: ["MCP"],
        summary: "Flux SSE MCP",
        operationId: "mcpGet",
        parameters: [
          { name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Flux d'evenements SSE" },
          "405": { description: "Session non trouvee" },
        },
      },
      delete: {
        tags: ["MCP"],
        summary: "Fermer une session MCP",
        operationId: "mcpDelete",
        parameters: [
          { name: "mcp-session-id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Session fermee" },
          "404": { description: "Session non trouvee" },
        },
      },
    },
  },

  components: {
    schemas: {
      RGBColor,
      Font,
      Style,
      Property,
      SourceInfo,
      ModelInfo,
      Element,
      Relationship,
      Node,
      Connection,
      View,
      ViewDetail,
      ErrorDetail,
    },
    responses: {
      NotFound: {
        description: "Ressource introuvable",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
      UnprocessableType: {
        description: "Type ArchiMate invalide",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorDetail" } } },
      },
    },
  },
};
