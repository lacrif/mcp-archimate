# mcp-archimate

[![Docker Pulls](https://img.shields.io/docker/pulls/lacrif/mcp-archimate?logo=docker&link=https%3A%2F%2Fhub.docker.com%2Fr%2Frs%2Flacrif%2Fmcp-archimate)](https://hub.docker.com/r/lacrif/mcp-archimate)
[![Unit Tests](https://github.com/lacrif/mcp-archimate/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/unit-tests.yml)
[![Docker Build & Push](https://github.com/lacrif/mcp-archimate/actions/workflows/docker-build-push.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/docker-build-push.yml)

Ce depot expose une **API REST** et un **serveur MCP (Model Context Protocol)** pour interroger un modele ArchiMate stocke dans un fichier XML standardise.

## Objectif du depot

Ce projet fournit des services pour interroger et exploiter un modele ArchiMate expose via :

1. **Une API REST** (FastAPI) pour acceder programmatiquement aux elements, relations et vues du modele
2. **Un serveur MCP** (Model Context Protocol) pour integrer le modele dans des workflows d'IA

Le fichier source du modele (`data/open-exchange.xml`) contient une architecture d'entreprise documentee et structuree selon la norme ArchiMate.

## Modele ArchiMate

Le fichier `data/open-exchange.xml` est un export standardise au format Open Exchange XML d'un modele ArchiMate. Il est genere avec Archi Tool et contient une documentation complete d'une architecture d'entreprise.

Le modele peut etre consulte et modifie localement avec Archi Tool (non decrit ici), puis exporte en XML standardise pour etre utilise par cette API.

## Rappel sur la norme ArchiMate

ArchiMate est une norme de modelisation d'architecture d'entreprise maintenue par The Open Group. Elle fournit un langage commun pour decrire une architecture sous plusieurs points de vue coherents.

## Architecture ArchiMate - Reference

Le modele est organise selon les couches ArchiMate :

- **Strategy** : capacites, ressources, cours d'action, objectifs
- **Business** : acteurs, roles, processus, fonctions, services metier
- **Application** : composants applicatifs, interfaces, services applicatifs, flux
- **Technology** : noeuds, systemes, services techniques, reseaux, infrastructure
- **Physical** : equipements et materiels
- **Motivation** : objectifs, principes, contraintes, exigences
- **Implementation and Migration** : livrables, plateaux, gaps, work packages

Les elements sont lies par des relations standardisees (`Serving`, `Access`, `Composition`, `Aggregation`, `Realization`, `Assignment`, `Flow`, `Association`, etc.).

## Structure du projet

```
.
├── archisurance.archimate          # Source du modele (Archi Tool)
├── data/
│   └── open-exchange.xml           # Export standardise du modele
├── api/
│   ├── main.py                     # Application FastAPI et serveur MCP
│   ├── schemas.py                  # Schemas Pydantic
│   └── __init__.py
├── tests/
│   ├── test_api.py                 # Tests unitaires
│   └── __init__.py
├── requirements.txt                # Dependencies Python
├── Dockerfile                      # Image Docker
└── README.md                       # Ce fichier
```

## L'API REST (FastAPI)

L'API sera accessible sur `http://localhost:8000` et la documentation interactive swagger sur `http://localhost:8000/docs`.

### Endpoints principaux

| Methode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/` | Informations generales sur le modele |
| GET | `/elements` | Liste des elements (filtre par `type`, `name`) |
| GET | `/elements/types` | Liste des types d'elements |
| GET | `/elements/{id}` | Detail d'un element |
| GET | `/relationships` | Liste des relations (filtre par `type`, `source_id`, `target_id`) |
| GET | `/relationships/types` | Liste des types de relations |
| GET | `/views` | Liste des vues |
| GET | `/views/{id}` | Detail d'une vue avec ses noeuds |

## Deploiement

### Execution locale

```bash
# Installer les dependencies
pip install -r requirements.txt

# Lancer l'API FastAPI
uvicorn api.main:app --reload
```

### Execution via Docker (image Docker Hub)

Image publiee: [lacrif/mcp-archimate:latest](https://hub.docker.com/r/lacrif/mcp-archimate)

```bash
# Recuperer l'image Docker Hub
docker pull lacrif/mcp-archimate:latest

# Lancer le conteneur
docker run -p 8000:8000 lacrif/mcp-archimate:latest
```

### Execution via Docker build local

```bash
# Construire l'image localement
docker build -t mcp-archimate:local .

# Lancer le conteneur a partir de l'image locale
docker run -p 8000:8000 mcp-archimate:local
```

### Utiliser votre propre open-exchange.xml avec Docker

Vous pouvez remplacer le fichier de modele fourni par votre propre export ArchiMate en montant un volume dans le conteneur.

```bash
# Exemple: monter un fichier local dans le conteneur
docker run -p 8000:8000 \
    -v /chemin/vers/mon-open-exchange.xml:/app/data/open-exchange.xml:ro \
    lacrif/mcp-archimate:latest
```

Le fichier local est monte en lecture seule (`:ro`) et remplace `data/open-exchange.xml` utilise par l'application.

### Option avec Docker Compose

Vous pouvez aussi utiliser Docker Compose pour declarer le volume de facon persistante:

```yaml
services:
    mcp-archimate:
        image: lacrif/mcp-archimate:latest
        ports:
            - "8000:8000"
        volumes:
            - ./data/open-exchange.xml:/app/data/open-exchange.xml:ro
```

Puis lancer:

```bash
docker compose up
```

## Skills archimate-api

Le repository inclut un skill Copilot dedie a l'exploration du modele ArchiMate via l'API locale:

- Emplacement: `.github/skills/archimate-api/SKILL.md`
- Reference des routes: `.github/skills/archimate-api/references/endpoints.md`

Ce skill est utile pour:

- lister les elements du modele
- filtrer par type (`ApplicationComponent`, `BusinessActor`, etc.)
- retrouver les relations (ex: `Flow`, relations entrantes/sortantes)
- parcourir les vues et leurs details

## Service MCP (FastMCP)

Le projet expose aussi un service MCP en lecture seule, monte dans la meme application FastAPI.

### Endpoint MCP

- base URL : `http://localhost:8000/mcp`
- transport : `streamable-http`

### Outils MCP exposes

- `get_model_info_tool`
- `list_element_types_tool`
- `list_elements_tool`
- `get_element_tool`
- `list_relationship_types_tool`
- `list_relationships_tool`
- `get_relationship_tool`
- `list_views_tool`
- `get_view_tool`

Ces outils reprennent les memes capacites de consultation que les endpoints REST (`/`, `/elements`, `/relationships`, `/views`) avec une interface MCP.

### Configuration MCP

Le fichier `.vscode/mcp.json` fournit une configuration réutilisable pour les clients MCP. Il décrit l'endpoint, le transport, la version du protocole et les outils exposés.

```json
{
    "servers": {
        "mcp-archimate": {
            "url": "http://localhost:8000/mcp",
            "type": "http"
        }
    },
    "inputs": []
}
```

## Tests unitaires

Les tests unitaires sont situes dans le repertoire `tests/` et utilisent le framework pytest.

### Executer les tests en local

```bash
pip install -r requirements.txt
pytest
```

Pour executer avec un niveau de verbosité augmente :

```bash
pytest -v
```

Pour executer les tests avec un rapport de couverture de code :

```bash
pytest --cov=api tests/
```

Pour executer un test specifique :

```bash
pytest tests/test_api.py::test_function_name
```

## Reference rapide

- **Format de donnees** : ArchiMate (Open Exchange XML)
- **API** : FastAPI (REST)
- **Serveur MCP** : FastMCP (Protocol Model Context)
- **Framework** : Python 3.x
- **Port par defaut** : 8000
- **Documentation API** : http://localhost:8000/docs
- **Endpoint MCP** : http://localhost:8000/mcp (streamable-http)
