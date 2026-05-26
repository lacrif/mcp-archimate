# mcp-archimate

[![Publish](https://github.com/lacrif/mcp-archimate/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/npm-publish.yml)

A **REST API** and **MCP (Model Context Protocol) server** for querying and modifying ArchiMate models stored in native Archi Tool files.

## Purpose

This project provides services for querying and modifying ArchiMate models via:

1. **A REST API** (Express / Node.js) for programmatic access and modification of elements, relationships, and views
2. **An MCP server** (Model Context Protocol) for integrating models into AI workflows (read and write)

## Configuration (`config.json`)

To point the API at your own ArchiMate files:

1. Place your files in `data/` (`.archimate` Archi Tool)
2. Edit `config.json` to declare your sources
3. Restart the server

```json
{
  "path": "data/archisurance.archimate",
  "name": "ArchiSurance"
}
```

## REST API

The API is available at `http://localhost:8000`.

### Interactive documentation (Swagger UI)

| Path | Description |
| ---- | ----------- |
| [`/docs`](http://localhost:8000/docs) | Swagger UI — interactive exploration of all routes |
| [`/openapi.json`](http://localhost:8000/openapi.json) | OpenAPI 3.0 spec as JSON |

The spec is generated dynamically from code: ArchiMate 3.1 type enums are always in sync with the constants in `src/schemas.ts`.

## MCP server

The project exposes an MCP server (read and write), mounted inside the same Express application.

### MCP Endpoint

- Base URL: `http://localhost:8000/mcp`
- Transport: `streamable-http`

### MCP Tools

#### Read

| Tool | Description |
| ---- | ----------- |
| `get_model_info` | Global model metadata |
| `list_element_types` | Element types present in the model |
| `list_elements` | Elements with optional filters (`element_type`, `name`) |
| `get_element` | Element detail by `element_id` |
| `list_relationship_types` | Relationship types present in the model |
| `list_relationships` | Relationships with filters (`rel_type`, `source_id_filter`, `target_id`) |
| `get_relationship` | Relationship detail by `relationship_id` |
| `list_views` | Views with `node_count`, `connection_count`, `viewpoint` |
| `get_view` | View detail with nodes, connections, and styles |

#### Write (in-memory changes)

| Tool | Required parameters | Description |
| ---- | ------------------- | ----------- |
| `create_element` | `name`, `type` | Create an ArchiMate element |
| `update_element` | `element_id` | Update an element (partial patch) |
| `delete_element` | `element_id` | Delete an element and its relationships |
| `create_relationship` | `type`, `source`, `target` | Create a relationship between two elements |
| `update_relationship` | `relationship_id` | Update a relationship (partial patch) |
| `delete_relationship` | `relationship_id` | Delete a relationship |

#### Rendering

| Tool | Required parameters | Description |
| ---- | ------------------- | ----------- |
| `render_view` | `view_id` | Generate an SVG or PNG image of a view (`format`: `"svg"` (default) or `"png"`). PNG requires the optional `sharp` package (`npm install sharp`). The MCP response uses the `image` content type so AI clients can display it inline. |

#### File persistence

| Tool | Required parameters | Description |
| ---- | ------------------- | ----------- |
| `save_model` | — | Write the in-memory model back to its source file on disk |
| `create_source` | `id`, `name`, `path`, `format` | Create a new blank model file and register it as a source |
| `delete_source` | `source_id` | Remove a source from the registry (set `delete_file: true` to also delete the file) |

Tool descriptions include the valid ArchiMate 3.1 types to guide LLMs.

## MCP client configuration

The MCP server uses the **streamable-http** transport at `http://localhost:8000/mcp`.
The server must be running before any MCP client connects.

### Claude Code (CLI)

The `.mcp.json` file at the project root is **automatically detected** by Claude Code:

```json
{
    "mcpServers": {
        "mcp-archimate": {
            "type": "http",
            "url": "http://localhost:8000/mcp"
        }
    }
}
```

Or via the CLI:

```bash
claude mcp add mcp-archimate http://localhost:8000/mcp --transport http
```

### Claude Desktop

Edit the Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
    "mcpServers": {
        "mcp-archimate": {
            "type": "http",
            "url": "http://localhost:8000/mcp"
        }
    }
}
```

Restart Claude Desktop after editing.

### VS Code / GitHub Copilot

The `.vscode/mcp.json` file is **already included** in the project:

```json
{
    "servers": {
        "mcp-archimate": {
            "url": "http://localhost:8000/mcp",
            "type": "http"
        }
    },
    "inputs": []
}
```

Enable MCP support in VS Code:

```json
// .vscode/settings.json
{
    "github.copilot.chat.mcp.enabled": true
}
```

The MCP tools then appear in the **Copilot Chat** panel (tool icon).

### OpenAI Codex CLI

In the Codex configuration file (`~/.codex/config.toml`):

```toml
[mcp_servers.mcp-archimate]
type = "http"
url = "http://localhost:8000/mcp"
```

## Deployment

```bash
# Install dependencies
npm install

# Start in development mode (with hot reload)
npm run dev

# Start in production mode
npm start
```

## Tests

Tests are located in `tests/api.test.ts` (181 tests) and cover:

- **Unit tests**: conversion helpers, colour conversion, XSD constants, CRUD functions (`createElement`, `updateElement`, `deleteElement`, `createRelationship`, `updateRelationship`, `deleteRelationship`), serializers (`serializeToOEF`, `serializeToArchi` with round-trip tests), `saveModel`, `listSources`
- **Integration tests**: all REST endpoints (`/sources`, CRUD cycles for elements and relationships, `POST /sources`, `DELETE /sources/:id`, `POST /:source_id/save`), MCP service (initialize + tools/list with all 18 tools)

### Running tests locally

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests coverage
npm test -- --coverage
```

## Quick reference

- **Data format**: ArchiMate 3.1 Open Exchange XML and native Archi Tool format
- **API**: Express (REST)
- **MCP server**: @modelcontextprotocol/sdk (streamable-http)
- **Runtime**: Node.js 24 / TypeScript
