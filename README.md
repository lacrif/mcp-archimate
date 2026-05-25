# mcp-archimate

[![Docker Pulls](https://img.shields.io/docker/pulls/lacrif/mcp-archimate?link=https%3A%2F%2Fhub.docker.com%2Fr%2Flacrif%2Fmcp-archimate)](https://hub.docker.com/r/lacrif/mcp-archimate)
[![Unit Tests](https://github.com/lacrif/mcp-archimate/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/unit-tests.yml)
[![Docker Build & Push](https://github.com/lacrif/mcp-archimate/actions/workflows/docker-build-push.yml/badge.svg)](https://github.com/lacrif/mcp-archimate/actions/workflows/docker-build-push.yml)

Ce depot expose une **API REST** et un **serveur MCP (Model Context Protocol)** pour interroger des modeles ArchiMate stockes dans des fichiers XML ou natifs Archi Tool.

L'API supporte **plusieurs sources de donnees simultanees**, chacune declaree dans `config.json`. Toutes les routes de donnees sont prefixees par l'identifiant de la source (`/:source_id/`).

Les schemas de donnees sont alignes sur les XSD officiels ArchiMate 3.1 Open Exchange Format :
`archimate3_Model.xsd`, `archimate3_View.xsd`, `archimate3_Diagram.xsd`.

## Objectif du depot

Ce projet fournit des services pour interroger et exploiter des modeles ArchiMate exposes via :

1. **Une API REST** (Express / Node.js) pour acceder programmatiquement aux elements, relations et vues de chaque modele
2. **Un serveur MCP** (Model Context Protocol) pour integrer les modeles dans des workflows d'IA

## Sources de donnees supportees

| Format | Extension | Description |
| ------ | --------- | ----------- |
| Open Exchange Format (OEF) | `.xml` | Export standardise ArchiMate 3.1, conforme aux XSD officiels |
| Archi Tool natif | `.archimate` | Format natif de l'outil Archi (Archi Tool) |

## Configuration (`config.json`)

Le fichier `config.json` a la racine du projet declare les sources de donnees a charger au demarrage :

```json
{
  "sources": [
    {
      "id": "open-exchange",
      "name": "Open Exchange Demo",
      "path": "data/open-exchange.xml",
      "format": "oef"
    },
    {
      "id": "archisurance",
      "name": "ArchiSurance",
      "path": "data/archisurance.archimate",
      "format": "archi"
    }
  ]
}
```

| Champ | Description |
| ----- | ----------- |
| `id` | Identifiant unique de la source — utilise comme prefixe de route (`/:source_id/`) |
| `name` | Nom lisible de la source |
| `path` | Chemin vers le fichier, relatif a la racine du projet |
| `format` | `"oef"` (Open Exchange XML) ou `"archi"` (format natif Archi Tool) |

Toutes les sources sont chargees en memoire au demarrage. L'ajout d'une nouvelle source ne necessite que de modifier `config.json` et de redemarrer le serveur.

## Structure du projet

```text
.
├── config.json                     # Declaration des sources de donnees
├── data/
│   ├── open-exchange.xml           # Modele ArchiMate au format Open Exchange
│   └── archisurance.archimate      # Modele ArchiMate au format Archi Tool natif
├── src/
│   ├── schemas.ts                  # Interfaces TypeScript et constantes ArchiMate 3.1
│   ├── model.ts                    # Parseur Open Exchange XML (fast-xml-parser)
│   ├── archi-parser.ts             # Parseur format natif Archi Tool (.archimate)
│   ├── registry.ts                 # Registre des sources (chargement via config.json)
│   ├── app.ts                      # Application Express, routes REST et serveur MCP
│   └── main.ts                     # Point d'entree du serveur HTTP
├── tests/
│   └── api.test.ts                 # Tests unitaires et d'integration (128 tests)
├── dist/                           # Code JavaScript compile (genere par tsc)
├── package.json                    # Dependencies Node.js
├── tsconfig.json                   # Configuration TypeScript
├── Dockerfile                      # Image Docker (Node.js 22)
├── docker-compose.yml              # Compose avec volumes et watch
└── README.md                       # Ce fichier
```

## Rappel sur la norme ArchiMate

ArchiMate est une norme de modelisation d'architecture d'entreprise maintenue par The Open Group. Elle fournit un langage commun pour decrire une architecture sous plusieurs points de vue coherents.

Le modele est organise selon les couches ArchiMate :

- **Strategy** : capacites, ressources, cours d'action, objectifs
- **Business** : acteurs, roles, processus, fonctions, services metier
- **Application** : composants applicatifs, interfaces, services applicatifs, flux
- **Technology** : noeuds, systemes, services techniques, reseaux, infrastructure
- **Physical** : equipements et materiels
- **Motivation** : objectifs, principes, contraintes, exigences
- **Implementation and Migration** : livrables, plateaux, gaps, work packages

Les elements sont lies par des relations standardisees (`Serving`, `Access`, `Composition`, `Aggregation`, `Realization`, `Assignment`, `Flow`, `Influence`, `Association`, etc.).

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

Les couleurs sont exposees au format RGB decompose (r, g, b : 0-255) conforme au XSD.

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

## L'API REST

L'API est accessible sur `http://localhost:8000`.

### Documentation interactive (Swagger UI)

| Chemin | Description |
| ------ | ----------- |
| [`/docs`](http://localhost:8000/docs) | Swagger UI — exploration interactive de toutes les routes |
| [`/openapi.json`](http://localhost:8000/openapi.json) | Spec OpenAPI 3.0 au format JSON |

La spec est generee dynamiquement depuis le code : les enums de types ArchiMate 3.1 sont toujours synchronises avec les constantes de `src/schemas.ts`.

### Endpoint global

| Methode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/sources` | Liste de toutes les sources de donnees configurees |

### Endpoints par source (`/:source_id/`)

Remplacer `:source_id` par l'identifiant de la source declare dans `config.json` (ex: `open-exchange`, `archisurance`).

| Methode | Chemin | Description |
| ------- | ------ | ----------- |
| GET | `/:source_id/` | Metadonnees du modele (identifier, name, version, compteurs) |
| GET | `/:source_id/elements/types` | Types d'elements presents dans le modele |
| GET | `/:source_id/elements` | Elements (filtres : `type`, `name`) |
| GET | `/:source_id/elements/{identifier}` | Detail d'un element |
| GET | `/:source_id/relationships/types` | Types de relations presents dans le modele |
| GET | `/:source_id/relationships` | Relations (filtres : `type`, `source_id`, `target_id`) |
| GET | `/:source_id/relationships/{identifier}` | Detail d'une relation |
| GET | `/:source_id/views` | Vues (node_count, connection_count, viewpoint) |
| GET | `/:source_id/views/{identifier}` | Detail d'une vue avec noeuds, connexions et styles |

**Validation des filtres** : passer un `type` invalide (non conforme ArchiMate 3.1) retourne HTTP 422 avec la liste des types valides. Un `source_id` inconnu retourne HTTP 404.

### Exemples d'appels

```bash
# Lister les sources configurees
curl http://localhost:8000/sources

# Metadonnees de la source open-exchange
curl http://localhost:8000/open-exchange/

# Elements ApplicationComponent de la source archisurance
curl "http://localhost:8000/archisurance/elements?type=ApplicationComponent"

# Detail d'une vue dans open-exchange
curl http://localhost:8000/open-exchange/views/id-de-la-vue
```

## Deploiement

### Execution locale

```bash
# Installer les dependencies
npm install

# Lancer le serveur en mode developpement (avec rechargement automatique)
npm run dev

# Lancer le serveur en mode production
npm start
```

### Execution via Docker (image Docker Hub)

Image publiee: [lacrif/mcp-archimate:latest](https://hub.docker.com/r/lacrif/mcp-archimate)

```bash
# Lancer avec les donnees et la configuration embarquees dans l'image
docker run -p 8000:8000 lacrif/mcp-archimate:latest

# Monter sa propre configuration et ses propres donnees
docker run -p 8000:8000 \
    -v /chemin/vers/config.json:/app/config.json:ro \
    -v /chemin/vers/data:/app/data:ro \
    lacrif/mcp-archimate:latest
```

### Execution via Docker build local

```bash
# Construire l'image localement
docker build -t mcp-archimate:local .

# Lancer avec les volumes locaux (config + data)
docker run -p 8000:8000 \
    -v ./config.json:/app/config.json:ro \
    -v ./data:/app/data:ro \
    mcp-archimate:local
```

### Docker Compose (volumes + watch)

Le fichier `docker-compose.yml` monte automatiquement `config.json` et le repertoire `data/` comme volumes, et active le **rechargement automatique** via `docker compose watch`.

```bash
# Build et demarrer le service avec les volumes montes
docker compose up --build

# Mode watch : rebuild ou sync automatique a chaque modification
docker compose watch
```

Comportement du watch :

| Chemin surveille | Action | Detail |
| ---------------- | ------ | ------- |
| `src/` | `rebuild` | Recompile TypeScript et relance le conteneur |
| `package.json`, `package-lock.json` | `rebuild` | Reinstalle les dependances |
| `tsconfig.json` | `rebuild` | Recompile avec la nouvelle config |
| `config.json` | `sync+restart` | Copie et redémarre le conteneur |
| `data/` | `sync` | Copie les fichiers directement sans rebuild |

### Utiliser ses propres modeles

Pour brancher l'API sur vos propres fichiers ArchiMate :

1. Placer vos fichiers dans `data/` (`.xml` OEF ou `.archimate` Archi Tool)
2. Modifier `config.json` pour declarer vos sources
3. Redemarrer le serveur (ou laisser `docker compose watch` le faire)

```json
{
  "sources": [
    {
      "id": "mon-modele",
      "name": "Mon Architecture d'Entreprise",
      "path": "data/mon-modele.xml",
      "format": "oef"
    }
  ]
}
```

## Service MCP

Le projet expose un service MCP en lecture seule, monte dans la meme application Express.

### Endpoint MCP

- base URL : `http://localhost:8000/mcp`
- transport : `streamable-http`

### Outils MCP exposes

Chaque outil accepte un parametre optionnel `source_id` (defaut : premiere source configuree).

| Outil | Description |
| ----- | ----------- |
| `get_model_info_tool` | Metadonnees globales du modele |
| `list_element_types_tool` | Types d'elements presents dans le modele |
| `list_elements_tool` | Elements avec filtres optionnels (`element_type`, `name`) |
| `get_element_tool` | Detail d'un element par `identifier` |
| `list_relationship_types_tool` | Types de relations presents dans le modele |
| `list_relationships_tool` | Relations avec filtres (`rel_type`, `source_id_filter`, `target_id`) |
| `get_relationship_tool` | Detail d'une relation par `identifier` |
| `list_views_tool` | Vues avec `node_count`, `connection_count`, `viewpoint` |
| `get_view_tool` | Detail d'une vue avec noeuds, connexions et styles |

Les descriptions des outils MCP incluent les types valides ArchiMate 3.1 pour guider les LLM.

## Configuration MCP par client

Le serveur MCP utilise le transport **streamable-http** sur `http://localhost:8000/mcp`.
Le serveur doit etre demarre avant toute connexion MCP.

### Claude Code (CLI)

Le fichier `.mcp.json` a la racine du projet est **automatiquement detecte** par Claude Code :

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

Editer le fichier de configuration Claude Desktop :

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

Redemarrer Claude Desktop apres modification.

### VS Code / GitHub Copilot

Le fichier `.vscode/mcp.json` est **deja inclus** dans le projet :

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

Les outils MCP apparaissent ensuite dans le panneau **Copilot Chat** (icone outil).

### OpenAI Codex CLI

Dans le fichier de configuration Codex (`~/.codex/config.toml`) :

```toml
[mcp_servers.mcp-archimate]
type = "http"
url = "http://localhost:8000/mcp"
```

## Tests

Les tests sont situes dans `tests/api.test.ts` (128 tests) et couvrent :

- **Tests unitaires** : helpers de conversion (`elementOut`, `relOut`, `nodeOut`, `connectionOut`, `viewOut`), conversion de couleurs (`hexToRgb`), constantes XSD (`ELEMENT_TYPES`, `RELATIONSHIP_TYPES`, `ACCESS_TYPES`, `VIEWPOINTS`)
- **Tests d'integration** : tous les endpoints REST avec le modele reel (`/sources`, `/:source_id/`, elements, relations, vues), validation des types ArchiMate, service MCP (initialize + tools/list)

### Executer les tests en local

```bash
# Installer les dependencies
npm install

# Lancer les tests
npm test
```

## Reference rapide

- **Format de donnees** : ArchiMate 3.1 Open Exchange XML et format natif Archi Tool
- **API** : Express (REST) — version 2.0.0
- **Serveur MCP** : @modelcontextprotocol/sdk (streamable-http)
- **Runtime** : Node.js 22 / TypeScript
- **Port par defaut** : 8000
- **Endpoint MCP** : [http://localhost:8000/mcp](http://localhost:8000/mcp) (streamable-http)
