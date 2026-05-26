# Référence des Endpoints — ArchiMate API

Base URL : `http://127.0.0.1:8000`

Schémas alignés sur **archimate3_Model.xsd / archimate3_View.xsd / archimate3_Diagram.xsd v3.1**.

---

## GET /

Informations générales sur le modèle chargé.

**Réponse**
```json
{
  "identifier": "id-model-001",
  "name": "MODELE_EXEMPLE",
  "documentation": null,
  "version": null,
  "element_count": 46,
  "relationship_count": 18,
  "view_count": 2
}
```

---

## GET /openapi.json

Spécification OpenAPI 3.0 du serveur (JSON).

---

## GET /docs

Swagger UI interactif (HTML). Permet d'explorer et tester tous les endpoints depuis un navigateur.

---

## POST /save

Sauvegarde le modèle en mémoire sur le fichier `.archimate` source.

**Réponse**
```json
{ "saved": true, "path": "data/archisurance.archimate" }
```

---

## GET /elements/types

Liste triée des types ArchiMate distincts présents dans le modèle.

**Réponse** : `["ApplicationComponent", "BusinessActor", "BusinessProcess", "BusinessService", "Node", "TechnologyService"]`

---

## GET /elements

Liste tous les éléments avec filtres optionnels.

**Query params**
| Param | Description | Exemple |
|-------|-------------|---------|
| `type` | Type ArchiMate exact (valide ArchiMate 3.1) | `?type=ApplicationComponent` |
| `name` | Sous-chaîne insensible à la casse | `?name=APP` |

Passer un `type` invalide retourne **HTTP 422** avec la liste des types valides.

**Réponse** (liste de `ElementOut`)
```json
[
  {
    "identifier": "id-app-001",
    "name": "APP_SERVICE_ALPHA",
    "type": "ApplicationComponent",
    "documentation": "Service applicatif de référence.",
    "properties": [
      { "property_definition_ref": "categorie", "value": "A1" }
    ]
  }
]
```

---

## GET /elements/{element_id}

Détail d'un élément par son identifiant exact (`identifier`).

**404** si l'identifiant est inconnu.

---

## POST /elements

Crée un nouvel élément ArchiMate (en mémoire).

**Corps de la requête**
```json
{
  "name": "Mon Application",
  "type": "ApplicationComponent",
  "documentation": "Description optionnelle.",
  "properties": [
    { "property_definition_ref": "owner", "value": "Team A" }
  ]
}
```

Champs requis : `name` (string), `type` (type ArchiMate 3.1 valide).

**Réponse** : `201 Created` — `ElementOut` de l'élément créé.

---

## PUT /elements/{element_id}

Modifie un élément existant. Patch partiel — seuls les champs fournis sont mis à jour.

**Corps de la requête** (tous les champs sont optionnels)
```json
{
  "name": "Nouveau nom",
  "type": "ApplicationService",
  "documentation": "Nouvelle description.",
  "properties": [
    { "property_definition_ref": "owner", "value": "Team B" }
  ]
}
```

**404** si l'identifiant est inconnu. **422** si le type est invalide.

---

## DELETE /elements/{element_id}

Supprime un élément et toutes les relations qui le référencent (source ou cible).

**Réponse** : `204 No Content`

**404** si l'identifiant est inconnu.

---

## GET /relationships/types

Liste triée des types de relations distincts présents dans le modèle.

**Réponse** : `["Flow", "Serving"]`

---

## GET /relationships

Liste toutes les relations avec filtres optionnels.

**Query params**
| Param | Description |
|-------|-------------|
| `type` | Type de relation exact (ex: `Flow`) — **HTTP 422** si invalide |
| `source_id` | Identifiant (`identifier`) de l'élément source |
| `target_id` | Identifiant (`identifier`) de l'élément cible |

**Réponse** (liste de `RelationshipOut`)
```json
[
  {
    "identifier": "id-rel-001",
    "name": null,
    "type": "Flow",
    "source": "id-app-010",
    "source_name": "APP_SOURCE_GENERIC",
    "target": "id-app-001",
    "target_name": "APP_SERVICE_ALPHA",
    "documentation": null,
    "properties": [],
    "access_type": null,
    "is_directed": null,
    "modifier": null
  }
]
```

Champs spécifiques selon le type de relation :
- `access_type` : `Access` | `Read` | `Write` | `ReadWrite` (relation `Access` uniquement)
- `is_directed` : booléen (relation `Association` uniquement)
- `modifier` : force d'influence (relation `Influence` uniquement)

---

## GET /relationships/{relationship_id}

Détail d'une relation par son identifiant exact.

**404** si l'identifiant est inconnu.

---

## POST /relationships

Crée une nouvelle relation ArchiMate entre deux éléments (en mémoire).

**Corps de la requête**
```json
{
  "type": "Flow",
  "source": "id-app-010",
  "target": "id-app-001",
  "name": null,
  "documentation": null,
  "properties": [],
  "access_type": null,
  "is_directed": null,
  "influence_strength": null
}
```

Champs requis : `type` (type de relation valide), `source` (identifier), `target` (identifier).

Champs spécifiques :
- `access_type` : `Access` | `Read` | `Write` | `ReadWrite` — uniquement pour `type: "Access"`
- `is_directed` : booléen — uniquement pour `type: "Association"`
- `influence_strength` : string — uniquement pour `type: "Influence"` (retourné sous `modifier` dans la réponse)

**Réponse** : `201 Created` — `RelationshipOut` de la relation créée.

---

## PUT /relationships/{relationship_id}

Modifie une relation existante. Patch partiel — seuls les champs fournis sont mis à jour.

**Corps de la requête** (tous les champs sont optionnels)
```json
{
  "name": "nouveau nom",
  "type": "Serving",
  "source": "id-app-020",
  "target": "id-app-005",
  "documentation": "Nouvelle description.",
  "properties": [],
  "access_type": null,
  "is_directed": null,
  "influence_strength": null
}
```

**404** si la relation est inconnue. **422** si le type est invalide ou si source/target est introuvable.

---

## DELETE /relationships/{relationship_id}

Supprime une relation.

**Réponse** : `204 No Content`

**404** si l'identifiant est inconnu.

---

## GET /views

Liste toutes les vues du modèle.

**Réponse**
```json
[
  {
    "identifier": "id-view-001",
    "name": "Application_Reference",
    "documentation": "Vue de synthèse applicative.",
    "viewpoint": "Application Structure",
    "node_count": 18,
    "connection_count": 12
  }
]
```

---

## GET /views/{view_id}

Détail d'une vue avec la liste de ses nœuds et connexions.

**Réponse** (inclut `nodes` et `connections`)
```json
{
  "identifier": "id-view-001",
  "name": "Application_Reference",
  "documentation": null,
  "viewpoint": "Application Structure",
  "node_count": 18,
  "connection_count": 12,
  "nodes": [
    {
      "identifier": "id-node-001",
      "name": "APP_SERVICE_ALPHA",
      "element_ref": "id-app-001",
      "x": 60, "y": 33, "w": 120, "h": 55,
      "style": {
        "fill_color": { "r": 255, "g": 255, "b": 255 },
        "line_color": { "r": 0, "g": 0, "b": 0 },
        "font": null,
        "line_width": null
      },
      "children": []
    }
  ],
  "connections": [
    {
      "identifier": "id-conn-001",
      "name": null,
      "relationship_ref": "id-rel-001",
      "source": "id-node-010",
      "target": "id-node-001",
      "style": null
    }
  ]
}
```

**404** si l'identifiant est inconnu.

---

## POST /views

Crée une nouvelle vue (diagramme) dans le modèle (en mémoire).

**Corps de la requête**
```json
{
  "name": "Ma Vue Applicative",
  "viewpoint": "Application Structure",
  "documentation": null
}
```

Champ requis : `name` (string). `viewpoint` et `documentation` sont optionnels.

**Réponse** : `201 Created` — `ViewDetailOut` (avec `nodes: []` et `connections: []`).

---

## POST /views/{view_id}/nodes

Ajoute un nœud (représentation visuelle d'un élément) à une vue existante.

**Corps de la requête**
```json
{
  "element_id": "id-app-001",
  "x": 60,
  "y": 33,
  "w": 120,
  "h": 55
}
```

Champ requis : `element_id` (identifier d'un élément existant). `x`, `y`, `w`, `h` sont optionnels.

**Réponse** : `201 Created` — `NodeOut` du nœud créé.

**404** si la vue ou l'élément est introuvable.

---

## GET /views/{view_id}/image

Génère une image d'une vue.

**Query params**
| Param | Valeurs | Défaut |
|-------|---------|--------|
| `format` | `svg`, `png` | `svg` |

PNG nécessite le paquet optionnel `sharp` (`npm install sharp`).

**Réponse** : image SVG (`image/svg+xml`) ou PNG (`image/png`).

**404** si la vue est introuvable. **422** si le format est invalide.

---

## Codes d'erreur

| Code | Cas |
|------|-----|
| 200 | Succès (lecture / mise à jour) |
| 201 | Ressource créée (POST elements, relationships, views, nodes) |
| 204 | Suppression réussie (DELETE elements, relationships) |
| 404 | Identifiant inconnu |
| 422 | Type ArchiMate invalide, champ requis manquant, ou référence introuvable |
| 500 | Erreur serveur (ex: rendu PNG sans `sharp`) |
