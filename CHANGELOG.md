# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] 

---

## [0.3.1]

- Added write MCP tools: `create_element`, `update_element`, `delete_element`, `create_relationship`, `update_relationship`, `delete_relationship`, `save_model`.
- Minor OpenAPI spec update.

## [0.3.0]

- Read-only MCP tools: `get_model_info`, `list_element_types`, `list_elements`, `get_element`, `list_relationship_types`, `list_relationships`, `get_relationship`, `list_views`, `get_view`.
- Multi-source REST API with `/:source_id` prefix.
- Support for Archi native format (`.archimate`) and Open Exchange Format (OEF).
