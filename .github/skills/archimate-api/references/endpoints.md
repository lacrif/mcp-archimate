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
        "fill_color": { "r": 255, "g": 255, "b": 255, "a": null },
        "line_color": { "r": 0, "g": 0, "b": 0, "a": null },
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

---

## Codes d'erreur

| Code | Cas |
|------|-----|
| 200 | Succès |
| 404 | Identifiant inconnu |
| 422 | Type ArchiMate invalide (`type` filter) |
