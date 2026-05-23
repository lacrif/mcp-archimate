# mcp-archimate

[![Docker Pulls](https://img.shields.io/docker/pulls/lacrif/mcp-archimate?link=https%3A%2F%2Fhub.docker.com%2Fr%2Flacrif%2Fmcp-archimate)](https://hub.docker.com/r/lacrif/mcp-archimate)
[![Unit Tests](https://github.com/lacrif/mcp-archimate/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/unit-tests.yml)
[![Docker Build & Push](https://github.com/lacrif/mcp-archimate/actions/workflows/docker-build-push.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/docker-build-push.yml)

Ce depot expose une **API REST** et un **serveur MCP (Model Context Protocol)** pour interroger un modele ArchiMate stocke dans un fichier XML standardise.

Les schemas de donnees sont alignes sur les XSD officiels ArchiMate 3.1 Open Exchange Format :
`archimate3_Model.xsd`, `archimate3_View.xsd`, `archimate3_Diagram.xsd`.

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

Les elements sont lies par des relations standardisees (`Serving`, `Access`, `Composition`, `Aggregation`, `Realization`, `Assignment`, `Flow`, `Influence`, `Association`, etc.).

## Structure du projet

```text
.
├── archisurance.archimate          # Source du modele (Archi Tool)
├── data/
│   └── open-exchange.xml           # Export standardise du modele
├── models/
│   ├── archimate3_Model.xsd        # XSD officiel ArchiMate 3.1 - elements et relations
│   ├── archimate3_View.xsd         # XSD officiel ArchiMate 3.1 - vues et viewpoints
│   └── archimate3_Diagram.xsd      # XSD officiel ArchiMate 3.1 - noeuds et connexions
├── api/
│   ├── main.py                     # Application FastAPI et serveur MCP
│   ├── schemas.py                  # Schemas Pydantic alignes sur les XSD
│   └── __init__.py
├── tests/
│   ├── test_api.py                 # Tests unitaires et d'integration (128 tests)
│   └── __init__.py
├── requirements.txt                # Dependencies Python
├── Dockerfile                      # Image Docker
└── README.md                       # Ce fichier
```

## Schemas de donnees (alignement XSD ArchiMate 3.1)

Tous les champs de l'API suivent les noms definis dans les XSD officiels.

### Element (`archimate3_Model.xsd` — `ElementType`)

| Champ | Type | Description |
| ----- | ---- | ----------- |
| `identifier` | string | Identifiant unique (xs:ID) |
| `name` | string | Nom de l'element |
| `type` | string | Type ArchiMate (voir liste ci-dessous) |
| `documentation` | string\|null | Description textuelle |
| `properties` | `PropertyOut[]` | Proprietes : `property_definition_ref` + `value` |

### Relation (`archimate3_Model.xsd` — `RelationshipType`)

| Champ | Type | Description |
| ----- | ---- | ----------- |
| `identifier` | string | Identifiant unique |
| `type` | string | Type de relation (voir liste ci-dessous) |
| `source` | string | IDREF vers l'element source |
| `target` | string | IDREF vers l'element cible |
| `name` | string\|null | Nom optionnel |
| `documentation` | string\|null | Description |
| `properties` | `PropertyOut[]` | Proprietes |
| `access_type` | string\|null | `Access`\|`Read`\|`Write`\|`ReadWrite` (relation `Access` uniquement) |
| `is_directed` | bool\|null | Relation dirigee (relation `Association` uniquement) |
| `modifier` | string\|null | Force d'influence (relation `Influence` uniquement) |

### Vue (`archimate3_View.xsd` — `ViewType`)

| Champ | Type | Description |
| ----- | ---- | ----------- |
| `identifier` | string | Identifiant unique |
| `name` | string | Nom de la vue |
| `documentation` | string\|null | Description |
| `viewpoint` | string\|null | Viewpoint ArchiMate (ex: `Layered`, `Motivation`) |
| `node_count` | int | Nombre de noeuds dans la vue |
| `connection_count` | int | Nombre de connexions dans la vue |
| `nodes` | `NodeOut[]` | Noeuds du diagramme (detail uniquement) |
| `connections` | `ConnectionOut[]` | Connexions du diagramme (detail uniquement) |

### Noeud de diagramme (`archimate3_Diagram.xsd` — `ViewNodeType`)

| Champ | Type | Description |
| ----- | ---- | ----------- |
| `identifier` | string | Identifiant unique du noeud |
| `element_ref` | string\|null | IDREF vers l'element ArchiMate represente |
| `x`, `y` | int\|null | Position depuis le coin superieur gauche (pixels) |
| `w`, `h` | int\|null | Largeur et hauteur (pixels) |
| `style` | `StyleOut`\|null | Style visuel (`line_color`, `fill_color`, `font`) |
| `children` | `NodeOut[]` | Noeuds enfants (containers imbriques) |

### Connexion de diagramme (`archimate3_Diagram.xsd` — `ConnectionType`)

| Champ | Type | Description |
| ----- | ---- | ----------- |
| `identifier` | string | Identifiant unique de la connexion |
| `relationship_ref` | string\|null | IDREF vers la relation ArchiMate correspondante |
| `source` | string\|null | IDREF vers le noeud source |
| `target` | string\|null | IDREF vers le noeud cible |
| `style` | `StyleOut`\|null | Style visuel de la connexion |

### Style visuel (`archimate3_Diagram.xsd` — `StyleType` / `RGBColorType`)

Les couleurs sont exposees au format RGB decompose (r, g, b : 0-255 ; a : 0-100) conforme au XSD, converties depuis les valeurs hexadecimales de l'outil Archi.

### Types d'elements valides (`archimate3_Model.xsd` — `ElementTypeEnum`)

62 types au total, repartis par couche :

| Couche | Types |
| ------ | ----- |
| Business | `BusinessActor`, `BusinessRole`, `BusinessCollaboration`, `BusinessInterface`, `BusinessProcess`, `BusinessFunction`, `BusinessInteraction`, `BusinessEvent`, `BusinessService`, `BusinessObject`, `Contract`, `Representation`, `Product` |
| Application | `ApplicationComponent`, `ApplicationCollaboration`, `ApplicationInterface`, `ApplicationFunction`, `ApplicationInteraction`, `ApplicationProcess`, `ApplicationEvent`, `ApplicationService`, `DataObject` |
| Technology | `Node`, `Device`, `SystemSoftware`, `TechnologyCollaboration`, `TechnologyInterface`, `Path`, `CommunicationNetwork`, `TechnologyFunction`, `TechnologyProcess`, `TechnologyInteraction`, `TechnologyEvent`, `TechnologyService`, `Artifact` |
| Physical | `Equipment`, `Facility`, `DistributionNetwork`, `Material` |
| Motivation | `Stakeholder`, `Driver`, `Assessment`, `Goal`, `Outcome`, `Principle`, `Requirement`, `Constraint`, `Meaning`, `Value` |
| Strategy | `Resource`, `Capability`, `CourseOfAction`, `ValueStream` |
| Impl. & Migration | `WorkPackage`, `Deliverable`, `ImplementationEvent`, `Plateau`, `Gap` |
| Composites | `Grouping`, `Location` |
| Junctions | `AndJunction`, `OrJunction` |

### Types de relations valides (`archimate3_Model.xsd` — `RelationshipTypeEnum`)

`Composition`, `Aggregation`, `Assignment`, `Realization`, `Serving`, `Access`, `Influence`, `Triggering`, `Flow`, `Specialization`, `Association`

## L'API REST (FastAPI)

L'API sera accessible sur `http://localhost:8000` et la documentation interactive swagger sur `http://localhost:8000/docs`.

### Endpoints principaux

| Methode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/` | Metadonnees du modele (identifier, name, version, compteurs) |
| GET | `/elements/types` | Liste des types d'elements presents dans le modele |
| GET | `/elements` | Liste des elements (filtres : `type`, `name`) |
| GET | `/elements/{identifier}` | Detail d'un element |
| GET | `/relationships/types` | Liste des types de relations presents dans le modele |
| GET | `/relationships` | Liste des relations (filtres : `type`, `source_id`, `target_id`) |
| GET | `/relationships/{identifier}` | Detail d'une relation |
| GET | `/views` | Liste des vues (node_count, connection_count, viewpoint) |
| GET | `/views/{identifier}` | Detail d'une vue avec noeuds, connexions et styles |

**Validation des filtres** : passer un `type` invalide (non conforme ArchiMate 3.1) retourne HTTP 422 avec la liste des types valides.

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
- parcourir les vues et leurs details (noeuds, connexions, styles)

## Configuration MCP par client

Le serveur MCP utilise le transport **streamable-http** sur `http://localhost:8000/mcp`.
Le serveur doit être démarré avant toute connexion MCP :

```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000
# ou via Docker :
docker run -p 8000:8000 lacrif/mcp-archimate:latest
```

### Claude Code (CLI)

Le fichier `.mcp.json` à la racine du projet est **automatiquement détecté** par Claude Code :

```json
{
    "mcpServers": {
        "mcp-archimate": {
            "type": "http",
            "url": "http://localhost:8000/mcp"
        }
    }
}
```

Ou via la commande CLI :

```bash
claude mcp add mcp-archimate http://localhost:8000/mcp --transport http
```

### Claude Desktop

Éditer le fichier de configuration Claude Desktop :

- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux** : `~/.config/Claude/claude_desktop_config.json`

```json
{
    "mcpServers": {
        "mcp-archimate": {
            "type": "http",
            "url": "http://localhost:8000/mcp"
        }
    }
}
```

Redémarrer Claude Desktop après modification.

### VS Code / GitHub Copilot

Le fichier `.vscode/mcp.json` est **déjà inclus** dans le projet :

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

Activer le support MCP dans VS Code :

```json
// .vscode/settings.json
{
    "github.copilot.chat.mcp.enabled": true
}
```

Les outils MCP apparaissent ensuite dans le panneau **Copilot Chat** (icône outil).
Les instructions contextuelles du modèle sont définies dans `.github/copilot-instructions.md`.

### OpenAI Codex CLI

Dans le fichier de configuration Codex (`~/.codex/config.toml`) :

```toml
[mcp_servers.mcp-archimate]
type = "http"
url = "http://localhost:8000/mcp"
```

Ou pour une configuration spécifique au projet, créer `.codex/config.toml` à la racine :

```toml
[mcp_servers.mcp-archimate]
type = "http"
url = "http://localhost:8000/mcp"
```

---

## Service MCP (FastMCP)

Le projet expose aussi un service MCP en lecture seule, monte dans la meme application FastAPI.

### Endpoint MCP

- base URL : `http://localhost:8000/mcp`
- transport : `streamable-http`

### Outils MCP exposes

| Outil | Description |
| ----- | ----------- |
| `get_model_info_tool` | Metadonnees globales du modele |
| `list_element_types_tool` | Types d'elements presents dans le modele |
| `list_elements_tool` | Elements avec filtres optionnels (`element_type`, `name`) |
| `get_element_tool` | Detail d'un element par `identifier` |
| `list_relationship_types_tool` | Types de relations presents dans le modele |
| `list_relationships_tool` | Relations avec filtres (`rel_type`, `source_id`, `target_id`) |
| `get_relationship_tool` | Detail d'une relation par `identifier` |
| `list_views_tool` | Vues avec `node_count`, `connection_count`, `viewpoint` |
| `get_view_tool` | Detail d'une vue avec noeuds, connexions et styles |

Les descriptions des outils MCP incluent les types valides ArchiMate 3.1 pour guider les LLM.

### Configuration MCP

Le fichier `.vscode/mcp.json` fournit une configuration reutilisable pour les clients MCP.

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

## Tests

Les tests sont situes dans `tests/test_api.py` (128 tests) et couvrent :

- **Tests unitaires** : helpers de conversion (`_element_out`, `_rel_out`, `_node_out`, `_connection_out`, `_view_out`), conversion de couleurs (`_hex_to_rgb`), constantes XSD (`ELEMENT_TYPES`, `RELATIONSHIP_TYPES`, `ACCESS_TYPES`, `VIEWPOINTS`)
- **Tests d'integration** : tous les endpoints REST avec le modele reel, validation des types ArchiMate, connexions et styles dans les vues, service MCP (initialize + tools/list)

### Executer les tests en local

```bash
pip install -r requirements.txt
pytest
```

Avec verbosité augmentée :

```bash
pytest -v
```

Avec rapport de couverture :

```bash
pytest --cov=api tests/
```

## Reference rapide

- **Format de donnees** : ArchiMate 3.1 Open Exchange XML (conforme XSD officiel)
- **API** : FastAPI (REST) — version 2.0.0
- **Serveur MCP** : FastMCP (Protocol Model Context)
- **Framework** : Python 3.x
- **Port par defaut** : 8000
- **Documentation API** : [http://localhost:8000/docs](http://localhost:8000/docs)
- **Endpoint MCP** : [http://localhost:8000/mcp](http://localhost:8000/mcp) (streamable-http)
