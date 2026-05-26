---
name: archimate-api
description: 'Interroger et explorer le modèle ArchiMate via le serveur MCP local ou l''API REST (archimate natif / OEFF). Use when: listing elements, filtering by type, finding relationships, browsing views, rendering diagrams, querying ArchiMate model, architecture components, ApplicationComponent, BusinessActor, Flow relations, diagrams.'
argument-hint: 'question ou filtre sur le modèle (ex: liste des ApplicationComponent, relations de id-app-001, affiche la vue X)'
---

# ArchiMate API Skill

Deux interfaces disponibles pour interroger et modifier le modèle ArchiMate (`.archimate` natif Archi Tool, aligné ArchiMate 3.1 XSD) :

1. **Serveur MCP** (recommandé) — `http://localhost:8000/mcp` — accès direct depuis les workflows IA
2. **API REST** — `http://localhost:8000` — accès programmatique via HTTP

## Prérequis

Le serveur doit être démarré avant toute requête :

```bash
npm start
```

Vérifier qu'il répond : `curl http://127.0.0.1:8000/`

## Option 1 — Serveur MCP (outils disponibles)

### Lecture

| Outil MCP | Description |
|-----------|-------------|
| `get_model_info` | Métadonnées du modèle (identifier, name, version, compteurs) |
| `list_element_types` | Types d'éléments présents dans le modèle |
| `list_elements` | Éléments avec filtres optionnels (`element_type`, `name`) |
| `get_element` | Détail d'un élément par `element_id` |
| `list_relationship_types` | Types de relations présents dans le modèle |
| `list_relationships` | Relations avec filtres (`rel_type`, `source_id_filter`, `target_id`) |
| `get_relationship` | Détail d'une relation par `relationship_id` |
| `list_views` | Vues avec `node_count`, `connection_count`, `viewpoint` |
| `get_view` | Détail d'une vue : nœuds (position, style) et connexions |

### Écriture (modifications en mémoire)

| Outil MCP | Description |
|-----------|-------------|
| `create_element` | Crée un élément ArchiMate (`name`, `type` requis) |
| `update_element` | Modifie un élément (patch partiel par `element_id`) |
| `delete_element` | Supprime un élément et ses relations |
| `create_relationship` | Crée une relation (`type`, `source`, `target` requis) |
| `update_relationship` | Modifie une relation (patch partiel par `relationship_id`) |
| `delete_relationship` | Supprime une relation |
| `create_view` | Crée une nouvelle vue/diagramme (`name` requis) |
| `create_node` | Ajoute un nœud visuel à une vue |
| `save_model` | Écrit le modèle en mémoire sur disque |

### Rendu

| Outil MCP | Description |
|-----------|-------------|
| `render_view` | Génère une image SVG ou PNG d'une vue (`format`: `"svg"` par défaut, `"png"` nécessite `npm install sharp`) |

## Option 2 — API REST (endpoints disponibles)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Infos générales du modèle |
| POST | `/save` | Sauvegarde le modèle sur disque |
| GET | `/elements/types` | Types ArchiMate distincts présents |
| GET | `/elements` | Liste les éléments (filtres: `type`, `name`) |
| GET | `/elements/{id}` | Détail d'un élément |
| POST | `/elements` | Crée un élément |
| PUT | `/elements/{id}` | Modifie un élément |
| DELETE | `/elements/{id}` | Supprime un élément |
| GET | `/relationships/types` | Types de relations distincts |
| GET | `/relationships` | Liste les relations (filtres: `type`, `source_id`, `target_id`) |
| GET | `/relationships/{id}` | Détail d'une relation |
| POST | `/relationships` | Crée une relation |
| PUT | `/relationships/{id}` | Modifie une relation |
| DELETE | `/relationships/{id}` | Supprime une relation |
| GET | `/views` | Liste les vues du modèle |
| GET | `/views/{id}` | Détail d'une vue avec nœuds et connexions |
| POST | `/views` | Crée une vue |
| POST | `/views/{id}/nodes` | Ajoute un nœud à une vue |
| GET | `/views/{id}/image` | Image SVG ou PNG de la vue (`?format=svg` par défaut, `?format=png` nécessite `sharp`) |

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

1. **Vérifier que le serveur tourne** — appeler `GET /` ou `get_model_info`
2. **Identifier ce que l'utilisateur cherche** :
   - Un type d'élément → `list_element_types` puis `list_elements(element_type=...)`
   - Un élément par nom → `list_elements(name=...)`
   - Les dépendances d'un composant → `list_relationships(source_id_filter=...)` ou `target_id=...`
   - Explorer une vue → `list_views` puis `get_view(view_id=...)`
   - Visualiser une vue → `render_view(view_id=...)`
3. **Présenter les résultats** de manière structurée (tableau ou liste)
4. **Proposer des requêtes complémentaires** si pertinent

## Exemples : question → outil MCP / requête REST

| Question | MCP | REST |
|----------|-----|------|
| "Liste les composants applicatifs" | `list_elements(element_type="ApplicationComponent")` | `GET /elements?type=ApplicationComponent` |
| "Qui appelle cet élément ?" | `list_relationships(target_id="<identifier>")` | `GET /relationships?target_id=<identifier>` |
| "Relations sortantes de X" | `list_relationships(source_id_filter="<identifier>")` | `GET /relationships?source_id=<identifier>` |
| "Détail d'un élément" | `get_element(element_id="<identifier>")` | `GET /elements/<identifier>` |
| "Quelles vues existent ?" | `list_views()` | `GET /views` |
| "Infos générales du modèle" | `get_model_info()` | `GET /` |
| "Affiche le diagramme de la vue X" | `render_view(view_id="<identifier>")` | `GET /views/<identifier>/image` |
| "Exporte la vue X en PNG" | `render_view(view_id="<identifier>", format="png")` | `GET /views/<identifier>/image?format=png` |
| "Crée un composant applicatif" | `create_element(name="Mon App", type="ApplicationComponent")` | `POST /elements` |
| "Sauvegarde les modifications" | `save_model()` | `POST /save` |
