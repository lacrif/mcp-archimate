# Référence des Endpoints — ArchiMate API

Base URL : `http://127.0.0.1:8000`

---

## GET /

Informations générales sur le modèle chargé.

**Réponse**
```json
{
  "uuid": "id-model-001",
  "name": "MODELE_EXEMPLE",
  "element_count": 46,
  "relationship_count": 18,
  "view_count": 2
}
```

---

## GET /elements/types

Liste triée des types ArchiMate distincts présents dans le modèle.

**Réponse** : `["ApplicationComponent", "BusinessActor", "BusinessProcess", "BusinessService", "CommunicationNetwork", "Goal", "Node", "TechnologyService"]`

---

## GET /elements

Liste tous les éléments avec filtres optionnels.

**Query params**
| Param | Description | Exemple |
|-------|-------------|---------|
| `type` | Type ArchiMate exact | `?type=ApplicationComponent` |
| `name` | Sous-chaîne insensible à la casse | `?name=APP` |

**Réponse** (liste de `ElementOut`)
```json
[
  {
    "uuid": "id-app-001",
    "name": "APP_SERVICE_ALPHA",
    "type": "ApplicationComponent",
    "desc": "Service applicatif de référence...",
    "props": { "categorie": "A1" }
  }
]
```

---

## GET /elements/{element_id}

Détail d'un élément par son identifiant exact.

**404** si l'identifiant est inconnu.

---

## GET /relationships/types

Liste triée des types de relations distincts.

**Réponse** : `["Flow"]`

---

## GET /relationships

Liste toutes les relations avec filtres optionnels.

**Query params**
| Param | Description |
|-------|-------------|
| `type` | Type de relation exact (ex: `Flow`) |
| `source_id` | UUID de l'élément source |
| `target_id` | UUID de l'élément cible |

**Réponse** (liste de `RelationshipOut`)
```json
[
  {
    "uuid": "id-rel-001",
    "type": "Flow",
    "source_id": "id-app-010",
    "source_name": "APP_SOURCE_GENERIC",
    "target_id": "id-app-001",
    "target_name": "APP_SERVICE_ALPHA",
    "name": null,
    "desc": null
  }
]
```

---

## GET /relationships/{relationship_id}

Détail d'une relation par son identifiant exact.

---

## GET /views

Liste toutes les vues du modèle.

**Réponse**
```json
[
  {
    "uuid": "id-view-001",
    "name": "Application_Reference",
    "desc": "Vue de synthèse...",
    "node_count": 18
  }
]
```

---

## GET /views/{view_id}

Détail d'une vue avec la liste de ses nœuds (éléments positionnés).

**Réponse** (inclut `nodes`)
```json
{
  "uuid": "id-view-001",
  "name": "Application_Reference",
  "node_count": 18,
  "nodes": [
    {
      "uuid": "id-node-001",
      "name": null,
      "element_id": "id-app-011",
      "x": 60, "y": 33, "w": 120, "h": 55
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
| 422 | Paramètre invalide |
