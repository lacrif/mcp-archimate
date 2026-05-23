---
description: "Global instructions for GitHub Copilot to ensure consistent code generation across the project."
applyTo: "**/*"
---

# Copilot Instructions

## Comment Style

All produced code must contain comments written in **Google Style**:

- **Python**: use Google Style docstrings (`Args:`, `Returns:`, `Raises:`, `Example:`).
- **Functions and classes**: always document with a Google Style docstring.
- **Inline comments**: clear and concise, explaining the *why* rather than the *what*.

### Python Example (Google Style)

```python
def fetch_data(url: str, timeout: int = 30) -> dict:
    """Fetches JSON data from the given URL.

    Args:
        url: The URL to fetch data from.
        timeout: Request timeout in seconds. Defaults to 30.

    Returns:
        A dictionary containing the parsed JSON response.

    Raises:
        ValueError: If the URL is empty.
        requests.HTTPError: If the HTTP request fails.
    """
```

## ArchiMate Model — MCP Server

This project exposes a **read-only MCP server** at `http://localhost:8000/mcp` (streamable-http transport).
The MCP server is the preferred way to query the ArchiMate model from AI workflows.

### Available MCP Tools

| Tool | Description |
| ---- | ----------- |
| `get_model_info_tool` | Global metadata (identifier, name, version, counts) |
| `list_element_types_tool` | Distinct element types present in the model |
| `list_elements_tool` | Elements with optional filters (`element_type`, `name`) |
| `get_element_tool` | Element detail by `element_id` |
| `list_relationship_types_tool` | Distinct relationship types in the model |
| `list_relationships_tool` | Relationships with filters (`rel_type`, `source_id`, `target_id`) |
| `get_relationship_tool` | Relationship detail by `relationship_id` |
| `list_views_tool` | Views with `node_count`, `connection_count`, `viewpoint` |
| `get_view_tool` | View detail with nodes (position, style) and connections |

### Response Field Names (XSD-aligned)

All fields follow **archimate3_Model.xsd / archimate3_View.xsd / archimate3_Diagram.xsd v3.1**:

- Elements: `identifier`, `name`, `type`, `documentation`, `properties`
- Relationships: `identifier`, `type`, `source`, `target`, `source_name`, `target_name`, `access_type`, `is_directed`, `modifier`
- Views: `identifier`, `name`, `viewpoint`, `node_count`, `connection_count`
- Nodes: `identifier`, `element_ref`, `x`, `y`, `w`, `h`, `style`, `children`
- Connections: `identifier`, `relationship_ref`, `source`, `target`, `style`

### Valid ArchiMate 3.1 Types

**Element types (62):** `ApplicationComponent`, `ApplicationCollaboration`, `ApplicationEvent`, `ApplicationFunction`, `ApplicationInteraction`, `ApplicationInterface`, `ApplicationProcess`, `ApplicationService`, `Artifact`, `Assessment`, `AndJunction`, `BusinessActor`, `BusinessCollaboration`, `BusinessEvent`, `BusinessFunction`, `BusinessInteraction`, `BusinessInterface`, `BusinessObject`, `BusinessProcess`, `BusinessRole`, `BusinessService`, `Capability`, `CommunicationNetwork`, `Constraint`, `Contract`, `CourseOfAction`, `DataObject`, `Deliverable`, `Device`, `Driver`, `DistributionNetwork`, `Equipment`, `Facility`, `Gap`, `Goal`, `Grouping`, `ImplementationEvent`, `Location`, `Material`, `Meaning`, `Node`, `OrJunction`, `Outcome`, `Path`, `Plateau`, `Principle`, `Product`, `Representation`, `Requirement`, `Resource`, `Stakeholder`, `SystemSoftware`, `TechnologyCollaboration`, `TechnologyEvent`, `TechnologyFunction`, `TechnologyInteraction`, `TechnologyInterface`, `TechnologyProcess`, `TechnologyService`, `Value`, `ValueStream`, `WorkPackage`

**Relationship types (11):** `Access`, `Aggregation`, `Assignment`, `Association`, `Composition`, `Flow`, `Influence`, `Realization`, `Serving`, `Specialization`, `Triggering`

### Prerequisite

The server must be running before any MCP tool call:

```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000
```

### VS Code MCP Configuration

The MCP server is pre-configured in `.vscode/mcp.json`. Enable it in VS Code settings:
`"github.copilot.chat.mcp.enabled": true`
