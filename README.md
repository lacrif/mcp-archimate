# mcp-archimate

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

## Deploiement

### Execution locale

```bash
# Installer les dependencies
pip install -r requirements.txt

# Lancer l'API FastAPI
uvicorn api.main:app --reload
```

L'API sera accessible sur `http://localhost:8000` et la documentation interactive sur `http://localhost:8000/docs`.

### Execution via Docker

```bash
# Construire l'image
docker build -t mcp-archimate .

# Lancer le conteneur
docker run -p 8000:8000 mcp-archimate
```

L'API sera accessible sur `http://localhost:8000`.

### Execution des tests

```bash
# Tests locaux
pip install -r requirements.txt
pytest

# Tests via Docker
docker run mcp-archimate pytest
```

## API REST ArchiMate

Une API FastAPI est disponible pour interroger le modele de facon programmatique a partir du fichier `open-exchange.xml`.

### Lancer l'API en local

```bash
pip install -r requirements.txt
uvicorn api.main:app --reload
```

La documentation interactive est accessible sur `http://localhost:8000/docs`.

### Lancer l'API via Docker

```bash
docker build -t mcp-archimate .
docker run -p 8000:8000 mcp-archimate
```

### Endpoints principaux

| Methode | Chemin | Description |
|---------|--------|-------------|
| GET | `/` | Informations generales sur le modele |
| GET | `/elements` | Liste des elements (filtre par `type`, `name`) |
| GET | `/elements/types` | Liste des types d'elements |
| GET | `/elements/{id}` | Detail d'un element |
| GET | `/relationships` | Liste des relations (filtre par `type`, `source_id`, `target_id`) |
| GET | `/relationships/types` | Liste des types de relations |
| GET | `/views` | Liste des vues |
| GET | `/views/{id}` | Detail d'une vue avec ses noeuds |

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

### Executer les tests via Docker

```bash
docker build -t mcp-archimate .
docker run mcp-archimate pytest
```

### Ecrire de nouveaux tests

Les tests doivent etre places dans le repertoire `tests/` et commencer par le prefixe `test_`. Exemple :

```python
def test_elements_endpoint():
    """Tests the /elements endpoint."""
    # Arrange
    # Act
    # Assert
```

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

## Reference rapide

- **Format de donnees** : ArchiMate (Open Exchange XML)
- **API** : FastAPI (REST)
- **Serveur MCP** : FastMCP (Protocol Model Context)
- **Framework** : Python 3.x
- **Port par defaut** : 8000
- **Documentation API** : http://localhost:8000/docs
- **Endpoint MCP** : http://localhost:8000/mcp (streamable-http)
