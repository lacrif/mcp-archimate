---
name: archimate-api
description: 'Interroger et explorer le modèle ArchiMate via l''API REST (archimate natif / OEFF). Use when: listing elements, filtering by type, finding relationships, browsing views, rendering diagrams, querying ArchiMate model, architecture components, ApplicationComponent, BusinessActor, Flow relations, diagrams.'
argument-hint: 'question ou filtre sur le modèle (ex: liste des ApplicationComponent, relations de id-app-001, affiche la vue X)'
---

# ArchiMate API Skill

API REST pour interroger et modifier le modèle ArchiMate (`.archimate` natif Archi Tool, aligné ArchiMate 3.1 XSD).

Base URL : `http://127.0.0.1:8000`

## Prérequis

Le serveur doit être démarré avant toute requête :

```bash
npm start
```

Vérifier qu'il répond : `curl http://127.0.0.1:8000/`

Swagger UI disponible sur `http://127.0.0.1:8000/docs`

## Endpoints disponibles

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Infos générales du modèle |
| POST | `/save` | Sauvegarde le modèle sur disque |
| GET | `/openapi.json` | Spécification OpenAPI 3.0 |
| GET | `/docs` | Swagger UI interactif |
| GET | `/elements/types` | Types ArchiMate distincts présents |
| GET | `/elements` | Liste les éléments (filtres: `type`, `name`) |
| GET | `/elements/{id}` | Détail d'un élément |
| POST | `/elements` | Crée un élément (`name`, `type` requis) |
| PUT | `/elements/{id}` | Modifie un élément (patch partiel) |
| DELETE | `/elements/{id}` | Supprime un élément (cascade relations) → 204 |
| GET | `/relationships/types` | Types de relations distincts |
| GET | `/relationships` | Liste les relations (filtres: `type`, `source_id`, `target_id`) |
| GET | `/relationships/{id}` | Détail d'une relation |
| POST | `/relationships` | Crée une relation (`type`, `source`, `target` requis) |
| PUT | `/relationships/{id}` | Modifie une relation (patch partiel, source/target inclus) |
| DELETE | `/relationships/{id}` | Supprime une relation → 204 |
| GET | `/views` | Liste les vues du modèle |
| GET | `/views/{id}` | Détail d'une vue avec nœuds et connexions |
| POST | `/views` | Crée une vue (`name` requis) |
| POST | `/views/{id}/nodes` | Ajoute un nœud à une vue (`element_id` requis) |
| GET | `/views/{id}/image` | Image SVG ou PNG de la vue (`?format=svg` par défaut, `?format=png` nécessite `sharp`) |

## Champs de réponse (alignés XSD ArchiMate 3.1)

| Objet | Champs clés |
|-------|-------------|
| Élément | `identifier`, `name`, `type`, `documentation`, `properties` |
| Relation | `identifier`, `type`, `source`, `target`, `source_name`, `target_name`, `name`, `documentation`, `properties`, `access_type`, `is_directed`, `modifier` |
| Vue | `identifier`, `name`, `viewpoint`, `documentation`, `node_count`, `connection_count` |
| Nœud | `identifier`, `element_ref`, `name`, `x`, `y`, `w`, `h`, `style`, `children` |
| Connexion | `identifier`, `relationship_ref`, `source`, `target`, `name`, `style` |
| Style | `fill_color`, `line_color`, `font` (`name`, `size`, `color`), `line_width` |

Champs spécifiques selon le type de relation :
- `access_type` : `Access` | `Read` | `Write` | `ReadWrite` (relation `Access` uniquement)
- `is_directed` : booléen (relation `Association` uniquement)
- `modifier` : force d'influence en sortie (relation `Influence` uniquement) — paramètre en entrée : `influence_strength`

## Types ArchiMate 3.1 valides

**Types d'éléments (62) :**

| Couche | Types |
|--------|-------|
| Business | `BusinessActor`, `BusinessRole`, `BusinessCollaboration`, `BusinessInterface`, `BusinessProcess`, `BusinessFunction`, `BusinessInteraction`, `BusinessEvent`, `BusinessService`, `BusinessObject`, `Contract`, `Representation`, `Product` |
| Application | `ApplicationComponent`, `ApplicationCollaboration`, `ApplicationInterface`, `ApplicationFunction`, `ApplicationInteraction`, `ApplicationProcess`, `ApplicationEvent`, `ApplicationService`, `DataObject` |
| Technology | `Node`, `Device`, `SystemSoftware`, `TechnologyCollaboration`, `TechnologyInterface`, `Path`, `CommunicationNetwork`, `TechnologyFunction`, `TechnologyProcess`, `TechnologyInteraction`, `TechnologyEvent`, `TechnologyService`, `Artifact` |
| Physical | `Equipment`, `Facility`, `DistributionNetwork`, `Material` |
| Motivation | `Stakeholder`, `Driver`, `Assessment`, `Goal`, `Outcome`, `Principle`, `Requirement`, `Constraint`, `Meaning`, `Value` |
| Strategy | `Resource`, `Capability`, `CourseOfAction`, `ValueStream` |
| Implémentation | `WorkPackage`, `Deliverable`, `ImplementationEvent`, `Plateau`, `Gap` |
| Composites | `Grouping`, `Location`, `AndJunction`, `OrJunction` |

**Types de relations (11) :** `Access`, `Aggregation`, `Assignment`, `Association`, `Composition`, `Flow`, `Influence`, `Realization`, `Serving`, `Specialization`, `Triggering`

Un type invalide retourne HTTP 422 avec la liste des valeurs acceptées.

## Procédure recommandée

1. **Vérifier que le serveur tourne** — `GET /`
2. **Identifier ce que l'utilisateur cherche** :
   - Un type d'élément → `GET /elements/types` puis `GET /elements?type=...`
   - Un élément par nom → `GET /elements?name=...`
   - Les dépendances d'un composant → `GET /relationships?source_id=...` ou `?target_id=...`
   - Explorer une vue → `GET /views` puis `GET /views/{id}`
   - Visualiser une vue → `GET /views/{id}/image`
3. **Présenter les résultats** de manière structurée (tableau ou liste)
4. **Proposer des requêtes complémentaires** si pertinent

## Exemples : question → requête REST

| Question | Requête REST |
|----------|-------------|
| "Liste les composants applicatifs" | `GET /elements?type=ApplicationComponent` |
| "Qui appelle cet élément ?" | `GET /relationships?target_id=<identifier>` |
| "Relations sortantes de X" | `GET /relationships?source_id=<identifier>` |
| "Détail d'un élément" | `GET /elements/<identifier>` |
| "Quelles vues existent ?" | `GET /views` |
| "Infos générales du modèle" | `GET /` |
| "Affiche le diagramme de la vue X" | `GET /views/<identifier>/image` |
| "Exporte la vue X en PNG" | `GET /views/<identifier>/image?format=png` |
| "Crée un composant applicatif" | `POST /elements` |
| "Sauvegarde les modifications" | `POST /save` |
