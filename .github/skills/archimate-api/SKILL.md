---
name: archimate-api
description: 'Interroger et explorer le modèle ArchiMate via le serveur MCP local ou l''API REST FastAPI (open-exchange.xml / OEFF). Use when: listing elements, filtering by type, finding relationships, browsing views, querying ArchiMate model, architecture components, ApplicationComponent, BusinessActor, Flow relations, diagrams.'
argument-hint: 'question ou filtre sur le modèle (ex: liste des ApplicationComponent, relations de id-app-001)'
---

# ArchiMate API Skill

Deux interfaces disponibles pour interroger le modèle ArchiMate `data/open-exchange.xml` (format OEFF, aligné ArchiMate 3.1 XSD) :

1. **Serveur MCP** (recommandé) — `http://localhost:8000/mcp` — accès direct depuis les workflows IA
2. **API REST** — `http://localhost:8000` — accès programmatique via HTTP

## Prérequis

Le serveur doit être démarré avant toute requête :

```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Vérifier qu'il répond : `curl http://127.0.0.1:8000/`

## Option 1 — Serveur MCP (outils disponibles)

| Outil MCP | Description |
|-----------|-------------|
| `get_model_info_tool` | Métadonnées du modèle (identifier, name, version, compteurs) |
| `list_element_types_tool` | Types d'éléments présents dans le modèle |
| `list_elements_tool` | Éléments avec filtres optionnels (`element_type`, `name`) |
| `get_element_tool` | Détail d'un élément par `element_id` |
| `list_relationship_types_tool` | Types de relations présents dans le modèle |
| `list_relationships_tool` | Relations avec filtres (`rel_type`, `source_id`, `target_id`) |
| `get_relationship_tool` | Détail d'une relation par `relationship_id` |
| `list_views_tool` | Vues avec `node_count`, `connection_count`, `viewpoint` |
| `get_view_tool` | Détail d'une vue : nœuds (position, style) et connexions |

## Option 2 — API REST (endpoints disponibles)

Voir la référence complète : [endpoints.md](./references/endpoints.md)

| Route | Description |
|-------|-------------|
| `GET /` | Infos générales du modèle (identifier, name, compteurs) |
| `GET /elements` | Liste tous les éléments (filtres: `type`, `name`) |
| `GET /elements/types` | Types ArchiMate distincts présents dans le modèle |
| `GET /elements/{id}` | Détail d'un élément par identifiant |
| `GET /relationships` | Liste les relations (filtres: `type`, `source_id`, `target_id`) |
| `GET /relationships/types` | Types de relations distincts |
| `GET /relationships/{id}` | Détail d'une relation |
| `GET /views` | Liste les vues du modèle |
| `GET /views/{id}` | Détail d'une vue avec nœuds et connexions |

Swagger UI disponible sur `http://127.0.0.1:8000/docs`

## Champs de réponse (alignés XSD ArchiMate 3.1)

| Objet | Champs clés |
|-------|-------------|
| Élément | `identifier`, `name`, `type`, `documentation`, `properties` |
| Relation | `identifier`, `type`, `source`, `target`, `source_name`, `target_name`, `access_type`, `is_directed`, `modifier` |
| Vue | `identifier`, `name`, `viewpoint`, `node_count`, `connection_count` |
| Nœud | `identifier`, `element_ref`, `x`, `y`, `w`, `h`, `style`, `children` |
| Connexion | `identifier`, `relationship_ref`, `source`, `target`, `style` |

## Types ArchiMate 3.1 valides

**Types d'éléments (62) :** `ApplicationComponent`, `ApplicationService`, `BusinessActor`, `BusinessProcess`, `BusinessRole`, `BusinessService`, `Capability`, `CommunicationNetwork`, `Constraint`, `DataObject`, `Device`, `Driver`, `Goal`, `Grouping`, `Node`, `Outcome`, `Principle`, `Requirement`, `Resource`, `Stakeholder`, `SystemSoftware`, `TechnologyService`, `WorkPackage`, *(et 39 autres — voir `GET /elements/types`)*

**Types de relations (11) :** `Access`, `Aggregation`, `Assignment`, `Association`, `Composition`, `Flow`, `Influence`, `Realization`, `Serving`, `Specialization`, `Triggering`

Un type invalide retourne HTTP 422 avec la liste des valeurs acceptées.

## Procédure recommandée

1. **Vérifier que le serveur tourne** — appeler `GET /` ou `get_model_info_tool`
2. **Identifier ce que l'utilisateur cherche** :
   - Un type d'élément → `list_element_types_tool` puis `list_elements_tool(element_type=...)`
   - Un élément par nom → `list_elements_tool(name=...)`
   - Les dépendances d'un composant → `list_relationships_tool(source_id=...)` ou `target_id=...`
   - Explorer une vue → `list_views_tool` puis `get_view_tool(view_id=...)`
3. **Présenter les résultats** de manière structurée (tableau ou liste)
4. **Proposer des requêtes complémentaires** si pertinent

## Exemples : question → outil MCP / requête REST

| Question | MCP | REST |
|----------|-----|------|
| "Liste les composants applicatifs" | `list_elements_tool(element_type="ApplicationComponent")` | `GET /elements?type=ApplicationComponent` |
| "Qui appelle cet élément ?" | `list_relationships_tool(target_id="<identifier>")` | `GET /relationships?target_id=<identifier>` |
| "Relations sortantes de X" | `list_relationships_tool(source_id="<identifier>")` | `GET /relationships?source_id=<identifier>` |
| "Détail d'un élément" | `get_element_tool(element_id="<identifier>")` | `GET /elements/<identifier>` |
| "Quelles vues existent ?" | `list_views_tool()` | `GET /views` |
| "Infos générales du modèle" | `get_model_info_tool()` | `GET /` |
