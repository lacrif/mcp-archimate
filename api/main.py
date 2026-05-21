"""REST and MCP services to explore an ArchiMate model.

This module loads the Open Exchange XML model once at startup and exposes:
- REST endpoints through FastAPI.
- MCP tools through FastMCP (streamable HTTP transport).
"""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastmcp import FastMCP
from pyArchimate import Model, Readers

from api.schemas import (
    ElementOut,
    ModelInfo,
    NodeOut,
    RelationshipOut,
    ViewDetailOut,
    ViewOut,
)

# ---------------------------------------------------------------------------
# Load model once at startup
# ---------------------------------------------------------------------------

_XML_PATH = Path(__file__).parent.parent / "data" / "open-exchange.xml"

_model = Model()
# Le modèle est chargé une seule fois pour éviter de relire le XML à chaque requête.
_model.read(str(_XML_PATH), reader=Readers.archimate)

# Serveur MCP dédié, monté ensuite dans l'application FastAPI principale.
mcp = FastMCP(
    name="ArchiMate MCP",
    instructions="Service MCP en lecture seule pour explorer le modele ArchiMate.",
)

mcp_app = mcp.http_app(path="/", transport="streamable-http")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ArchiMate OEFF API",
    description="API read-only pour explorer le modèle ArchiMate `open-exchange.xml`.",
    version="1.0.0",
    # Le lifespan MCP initialise correctement le gestionnaire de session streamable-http.
    lifespan=mcp_app.lifespan,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _element_out(e) -> ElementOut:
    """Convert a pyArchimate element into the API schema.

    Args:
        e: pyArchimate element instance.

    Returns:
        ElementOut: Normalized API payload for an element.
    """
    return ElementOut(
        uuid=e.uuid,
        name=e.name or "",
        type=e.type or "",
        desc=e.desc or None,
        props=dict(e.props) if e.props else {},
    )


def _rel_out(r) -> RelationshipOut:
    """Convert a pyArchimate relationship into the API schema.

    Args:
        r: pyArchimate relationship instance.

    Returns:
        RelationshipOut: Normalized API payload for a relationship.
    """
    src = r.source
    tgt = r.target
    return RelationshipOut(
        uuid=r.uuid,
        type=r.type or "",
        source_id=src.uuid if hasattr(src, "uuid") else str(src),
        source_name=src.name if hasattr(src, "name") else None,
        target_id=tgt.uuid if hasattr(tgt, "uuid") else str(tgt),
        target_name=tgt.name if hasattr(tgt, "name") else None,
        name=r.name or None,
        desc=r.desc or None,
    )


def _node_out(n) -> NodeOut:
    """Convert a pyArchimate view node into the API schema.

    Args:
        n: pyArchimate node instance.

    Returns:
        NodeOut: Normalized API payload for a node.
    """
    element_id = n.ref if isinstance(n.ref, str) else None
    return NodeOut(
        uuid=n.uuid,
        name=n.name or None,
        element_id=element_id,
        x=n.x,
        y=n.y,
        w=n.w,
        h=n.h,
    )


def _view_out(v, detail: bool = False):
    """Convert a pyArchimate view into summary or detailed schema.

    Args:
        v: pyArchimate view instance.
        detail: Whether to include nodes in the output.

    Returns:
        ViewOut | ViewDetailOut: Summary or detailed representation.
    """
    base = dict(
        uuid=v.uuid,
        name=v.name or "",
        desc=v.desc or None,
        node_count=len(v.nodes),
    )
    if detail:
        return ViewDetailOut(**base, nodes=[_node_out(n) for n in v.nodes])
    return ViewOut(**base)


def _get_model_info() -> ModelInfo:
    """Build global metadata for the loaded model.

    Returns:
        ModelInfo: Global counters and identity for the model.
    """
    return ModelInfo(
        uuid=_model.uuid or "",
        name=_model.name or "",
        element_count=len(_model.elements),
        relationship_count=len(_model.relationships),
        view_count=len(_model.views),
    )


def _list_element_types() -> list[str]:
    """List all distinct element types present in the model.

    Returns:
        list[str]: Sorted list of ArchiMate element types.
    """
    return sorted({e.type for e in _model.elements if e.type})


def _list_elements(element_type: Optional[str] = None, name: Optional[str] = None) -> list[ElementOut]:
    """List elements using optional filters.

    Args:
        element_type: Optional exact ArchiMate type filter.
        name: Optional case-insensitive substring on element name.

    Returns:
        list[ElementOut]: Filtered elements.
    """
    elements = _model.elements
    if element_type:
        elements = [e for e in elements if e.type == element_type]
    if name:
        name_lower = name.lower()
        elements = [e for e in elements if e.name and name_lower in e.name.lower()]
    return [_element_out(e) for e in elements]


def _get_element(element_id: str) -> ElementOut:
    """Get one element by UUID.

    Args:
        element_id: Element UUID.

    Returns:
        ElementOut: Matching element.

    Raises:
        ValueError: If the element does not exist.
    """
    matches = [e for e in _model.elements if e.uuid == element_id]
    if not matches:
        raise ValueError(f"Élément '{element_id}' introuvable.")
    return _element_out(matches[0])


def _list_relationships(
    rel_type: Optional[str] = None,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
) -> list[RelationshipOut]:
    """List relationships using optional filters.

    Args:
        rel_type: Optional exact relationship type filter.
        source_id: Optional source UUID filter.
        target_id: Optional target UUID filter.

    Returns:
        list[RelationshipOut]: Filtered relationships.
    """
    rels = _model.relationships
    if rel_type:
        rels = [r for r in rels if r.type == rel_type]
    if source_id:
        rels = [r for r in rels if (r.source.uuid if hasattr(r.source, "uuid") else r.source) == source_id]
    if target_id:
        rels = [r for r in rels if (r.target.uuid if hasattr(r.target, "uuid") else r.target) == target_id]
    return [_rel_out(r) for r in rels]


def _list_relationship_types() -> list[str]:
    """List all distinct relationship types present in the model.

    Returns:
        list[str]: Sorted list of relationship types.
    """
    return sorted({r.type for r in _model.relationships if r.type})


def _get_relationship(relationship_id: str) -> RelationshipOut:
    """Get one relationship by UUID.

    Args:
        relationship_id: Relationship UUID.

    Returns:
        RelationshipOut: Matching relationship.

    Raises:
        ValueError: If the relationship does not exist.
    """
    matches = [r for r in _model.relationships if r.uuid == relationship_id]
    if not matches:
        raise ValueError(f"Relation '{relationship_id}' introuvable.")
    return _rel_out(matches[0])


def _list_views() -> list[ViewOut]:
    """List all views in summary mode.

    Returns:
        list[ViewOut]: All model views with summary fields.
    """
    return [_view_out(v) for v in _model.views]


def _get_view(view_id: str) -> ViewDetailOut:
    """Get one detailed view by UUID.

    Args:
        view_id: View UUID.

    Returns:
        ViewDetailOut: Matching view including nodes.

    Raises:
        ValueError: If the view does not exist.
    """
    matches = [v for v in _model.views if v.uuid == view_id]
    if not matches:
        raise ValueError(f"Vue '{view_id}' introuvable.")
    return _view_out(matches[0], detail=True)


# ---------------------------------------------------------------------------
# Routes – Model
# ---------------------------------------------------------------------------


@app.get("/", response_model=ModelInfo, summary="Informations générales sur le modèle")
def get_model_info():
    """Return global model information.

    Returns:
        ModelInfo: Global model metadata.
    """
    return _get_model_info()


# ---------------------------------------------------------------------------
# Routes – Elements
# ---------------------------------------------------------------------------


@app.get("/elements/types", response_model=list[str], summary="Liste des types d'éléments")
def list_element_types():
    """Return sorted available element types.

    Returns:
        list[str]: Distinct element types.
    """
    return _list_element_types()


@app.get("/elements", response_model=list[ElementOut], summary="Liste des éléments")
def list_elements(
    type: Optional[str] = Query(None, description="Filtrer par type ArchiMate (ex: ApplicationComponent)"),
    name: Optional[str] = Query(None, description="Filtrer par nom (insensible à la casse, sous-chaîne)"),
):
    """Return elements optionally filtered by type and name.

    Args:
        type: Optional exact ArchiMate type filter.
        name: Optional case-insensitive substring on element name.

    Returns:
        list[ElementOut]: Filtered elements.
    """
    return _list_elements(element_type=type, name=name)


@app.get("/elements/{element_id}", response_model=ElementOut, summary="Détail d'un élément")
def get_element(element_id: str):
    """Return one element by UUID.

    Args:
        element_id: Element UUID.

    Returns:
        ElementOut: Matching element.

    Raises:
        HTTPException: If the element does not exist.
    """
    try:
        return _get_element(element_id)
    except ValueError as exc:
        # On convertit l'erreur métier en statut HTTP standard pour l'API REST.
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Routes – Relationships
# ---------------------------------------------------------------------------


@app.get("/relationships", response_model=list[RelationshipOut], summary="Liste des relations")
def list_relationships(
    type: Optional[str] = Query(None, description="Filtrer par type de relation (ex: Flow)"),
    source_id: Optional[str] = Query(None, description="Filtrer par identifiant source"),
    target_id: Optional[str] = Query(None, description="Filtrer par identifiant cible"),
):
    """Return relationships optionally filtered by type/source/target.

    Args:
        type: Optional exact relationship type filter.
        source_id: Optional source UUID filter.
        target_id: Optional target UUID filter.

    Returns:
        list[RelationshipOut]: Filtered relationships.
    """
    return _list_relationships(rel_type=type, source_id=source_id, target_id=target_id)


@app.get("/relationships/types", response_model=list[str], summary="Liste des types de relations")
def list_relationship_types():
    """Return sorted available relationship types.

    Returns:
        list[str]: Distinct relationship types.
    """
    return _list_relationship_types()


@app.get("/relationships/{relationship_id}", response_model=RelationshipOut, summary="Détail d'une relation")
def get_relationship(relationship_id: str):
    """Return one relationship by UUID.

    Args:
        relationship_id: Relationship UUID.

    Returns:
        RelationshipOut: Matching relationship.

    Raises:
        HTTPException: If the relationship does not exist.
    """
    try:
        return _get_relationship(relationship_id)
    except ValueError as exc:
        # On convertit l'erreur métier en statut HTTP standard pour l'API REST.
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Routes – Views
# ---------------------------------------------------------------------------


@app.get("/views", response_model=list[ViewOut], summary="Liste des vues")
def list_views():
    """Return all views in summary mode.

    Returns:
        list[ViewOut]: All views.
    """
    return _list_views()


@app.get("/views/{view_id}", response_model=ViewDetailOut, summary="Détail d'une vue avec ses nœuds")
def get_view(view_id: str):
    """Return one detailed view by UUID.

    Args:
        view_id: View UUID.

    Returns:
        ViewDetailOut: Matching view with nodes.

    Raises:
        HTTPException: If the view does not exist.
    """
    try:
        return _get_view(view_id)
    except ValueError as exc:
        # On convertit l'erreur métier en statut HTTP standard pour l'API REST.
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@mcp.tool(description="Informations generales sur le modele")
def get_model_info_tool() -> dict:
    """MCP tool that returns global model information.

    Returns:
        dict: JSON-serializable payload with model metadata.
    """
    # Les outils MCP sérialisent explicitement les modèles Pydantic en dictionnaires JSON.
    return _get_model_info().model_dump()


@mcp.tool(description="Liste des types d'elements")
def list_element_types_tool() -> list[str]:
    """MCP tool that returns sorted available element types.

    Returns:
        list[str]: Distinct element types.
    """
    return _list_element_types()


@mcp.tool(description="Liste des elements avec filtres optionnels")
def list_elements_tool(element_type: Optional[str] = None, name: Optional[str] = None) -> list[dict]:
    """MCP tool that lists elements with optional filters.

    Args:
        element_type: Optional exact ArchiMate type filter.
        name: Optional case-insensitive substring on element name.

    Returns:
        list[dict]: JSON-serializable element payloads.
    """
    return [e.model_dump() for e in _list_elements(element_type=element_type, name=name)]


@mcp.tool(description="Detail d'un element")
def get_element_tool(element_id: str) -> dict:
    """MCP tool that returns one element by UUID.

    Args:
        element_id: Element UUID.

    Returns:
        dict: JSON-serializable element payload.

    Raises:
        ValueError: If the element does not exist.
    """
    return _get_element(element_id).model_dump()


@mcp.tool(description="Liste des types de relations")
def list_relationship_types_tool() -> list[str]:
    """MCP tool that returns sorted available relationship types.

    Returns:
        list[str]: Distinct relationship types.
    """
    return _list_relationship_types()


@mcp.tool(description="Liste des relations avec filtres optionnels")
def list_relationships_tool(
    rel_type: Optional[str] = None,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
) -> list[dict]:
    """MCP tool that lists relationships with optional filters.

    Args:
        rel_type: Optional exact relationship type filter.
        source_id: Optional source UUID filter.
        target_id: Optional target UUID filter.

    Returns:
        list[dict]: JSON-serializable relationship payloads.
    """
    return [
        r.model_dump()
        for r in _list_relationships(rel_type=rel_type, source_id=source_id, target_id=target_id)
    ]


@mcp.tool(description="Detail d'une relation")
def get_relationship_tool(relationship_id: str) -> dict:
    """MCP tool that returns one relationship by UUID.

    Args:
        relationship_id: Relationship UUID.

    Returns:
        dict: JSON-serializable relationship payload.

    Raises:
        ValueError: If the relationship does not exist.
    """
    return _get_relationship(relationship_id).model_dump()


@mcp.tool(description="Liste des vues")
def list_views_tool() -> list[dict]:
    """MCP tool that lists views in summary mode.

    Returns:
        list[dict]: JSON-serializable summary view payloads.
    """
    return [v.model_dump() for v in _list_views()]


@mcp.tool(description="Detail d'une vue")
def get_view_tool(view_id: str) -> dict:
    """MCP tool that returns one detailed view by UUID.

    Args:
        view_id: View UUID.

    Returns:
        dict: JSON-serializable detailed view payload.

    Raises:
        ValueError: If the view does not exist.
    """
    return _get_view(view_id).model_dump()


app.mount("/mcp", mcp_app)
