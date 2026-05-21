---
name: archimate-api
description: 'Interroger et explorer le modèle ArchiMate Orange via l''API locale FastAPI (open-exchange.xml / OEFF). Use when: listing elements, filtering by type, finding relationships, browsing views, querying ArchiMate model, architecture components, ApplicationComponent, BusinessActor, Flow relations, diagrams.'
argument-hint: 'question ou filtre sur le modèle (ex: liste des ApplicationComponent, relations de id-app-001)'
---

# ArchiMate API Skill

API read-only FastAPI qui expose le modèle ArchiMate `data/open-exchange.xml` (format OEFF).

## Prérequis

Le serveur doit être démarré avant toute requête :

```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Vérifier qu'il répond : `curl http://127.0.0.1:8000/`

Si le serveur n'est pas lancé, démarrer avec la commande ci-dessus (répertoire racine du projet).

## Endpoints disponibles

Voir la référence complète : [endpoints.md](./references/endpoints.md)

| Route | Description |
|-------|-------------|
| `GET /` | Infos générales du modèle (nom, compteurs) |
| `GET /elements` | Liste tous les éléments (filtres: `type`, `name`) |
| `GET /elements/types` | Types ArchiMate distincts présents dans le modèle |
| `GET /elements/{id}` | Détail d'un élément par identifiant |
| `GET /relationships` | Liste les relations (filtres: `type`, `source_id`, `target_id`) |
| `GET /relationships/types` | Types de relations distincts |
| `GET /relationships/{id}` | Détail d'une relation |
| `GET /views` | Liste les vues du modèle |
| `GET /views/{id}` | Détail d'une vue avec nœuds (position x/y/w/h) |

Swagger UI disponible sur `http://127.0.0.1:8000/docs`

## Procédure

1. **Vérifier que le serveur tourne** — appeler `GET /` et vérifier la réponse JSON
2. **Identifier ce que l'utilisateur cherche** :
   - Un type d'élément → `GET /elements/types` puis `GET /elements?type=<type>`
   - Un élément par nom → `GET /elements?name=<sous-chaîne>`
   - Les dépendances d'un composant → `GET /relationships?source_id=<id>` ou `target_id=<id>`
   - Explorer une vue → `GET /views` puis `GET /views/<id>`
3. **Présenter les résultats** de manière structurée (tableau ou liste)
4. **Proposer des requêtes complémentaires** si pertinent (ex: détail d'un élément trouvé)

## Exemples de questions utilisateur → requêtes API

| Question | Requête |
|----------|---------|
| "Liste les composants applicatifs" | `GET /elements?type=ApplicationComponent` |
| "Qui appelle APP_SERVICE_ALPHA ?" | `GET /relationships?target_id=id-app-001` |
| "Quelles sont les relations sortantes de APP_SERVICE_ALPHA ?" | `GET /relationships?source_id=id-app-001` |
| "Détail de l'élément APP_SERVICE_BETA" | `GET /elements?name=APP_SERVICE_BETA` puis `GET /elements/id-app-002` |
| "Quelles vues existent ?" | `GET /views` |
| "Quels types d'éléments sont dans le modèle ?" | `GET /elements/types` |
| "Infos générales sur le modèle" | `GET /` |
