# Claude Instructions

## After every code change

1. **Run the tests**: `npm test` — all tests must pass before considering the change done.
2. **Check coverage**: `npm test -- --coverage` — line/branch/function coverage must stay at or above **80%**. If a change drops coverage below 80%, add tests before finishing.
3. **Update the documentation**: keep `README.md` in sync with any API, MCP tool, or behaviour change.

## Project conventions

- **In-memory mutations**: write operations (create / update / delete) modify the loaded model in memory. Use `POST /save` to write changes back to disk.
- **Partial updates**: `update*` functions use `!== undefined` checks — only fields explicitly provided in the request body are modified.
- **Cascade on delete**: deleting an element also removes every relationship that references it (source or target).
- **Type validation**: element and relationship types must belong to the ArchiMate 3.1 sets defined in `src/schemas.ts`. Invalid types return HTTP 422 / throw in MCP tools.

## Key files

| File | Role |
|------|------|
| `src/schemas.ts` | TypeScript interfaces: output types + `*CreateIn` / `*UpdateIn` input types |
| `src/model.ts` | ArchiMate model type interfaces (`ArchiElement`, `ArchiRelationship`, `ArchiModel`, …) |
| `src/archi-parser.ts` | Native Archi Tool format parser — stores `_rawArchi` in model for lossless round-trip |
| `src/serializer.ts` | Archi native XML serializer: `serializeToArchi` (round-trip via `_rawArchi`), `saveModelToFile` |
| `src/registry.ts` | Single Archi model source loader — exports `dataSource` and `recomputeDataSourceTypes` |
| `src/app.ts` | Express flat routes (REST, no source_id prefix) + 18 MCP tools (read, write, persistence) |
| `src/openapi.ts` | OpenAPI 3.0 spec (served at `/openapi.json` and `/docs`) |
| `tests/api.test.ts` | Unit tests (helpers, CRUD, serializers) + integration tests (full HTTP cycles) |

## Adding a new endpoint or MCP tool

1. Add or update TypeScript interfaces in `src/schemas.ts` if new input/output shapes are needed.
2. Implement the business logic as an exported function in `src/app.ts` (shared by REST and MCP).
3. Wire the REST route directly on `app` in `src/app.ts` (flat paths, no source_id).
4. Register the MCP tool with `mcpServer.registerTool` in `src/app.ts`.
5. Add the endpoint to `src/openapi.ts` (path + request/response schemas).
6. Add unit tests (using `makeElement` / `makeRelationship` / `makeDataSource` factories) and integration tests (full HTTP cycle) in `tests/api.test.ts`.
7. Run `npm test` and update `README.md`.
