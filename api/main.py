"""REST and MCP services to explore an ArchiMate model.

Loads the Open Exchange XML model once at startup and exposes:
- REST endpoints through FastAPI.
- MCP tools through FastMCP (streamable HTTP transport).

Field names follow archimate3_Model.xsd / archimate3_Diagram.xsd / archimate3_View.xsd v3.1.
"""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastmcp import FastMCP
from pyArchimate import Model, Readers

from api.schemas import (
    ACCESS_TYPES,
    ELEMENT_TYPES,
    RELATIONSHIP_TYPES,
    ConnectionOut,
    ElementOut,
    FontOut,
    ModelInfo,
    NodeOut,
    PropertyOut,
    RGBColorOut,
    RelationshipOut,
    StyleOut,
    ViewDetailOut,
    ViewOut,
)

# ---------------------------------------------------------------------------
# Load model once at startup
# ---------------------------------------------------------------------------

_XML_PATH = Path(__file__).parent.parent / "data" / "open-exchange.xml"

_model = Model()
_model.read(str(_XML_PATH), reader=Readers.archimate)

mcp = FastMCP(
    name="ArchiMate MCP",
    instructions=(
        "Service MCP en lecture seule pour explorer un modèle ArchiMate 3.1. "
        "Les identifiants utilisés correspondent au champ 'identifier' du format "
        "Open Exchange (archimate3_Model.xsd)."
    ),
)

mcp_app = mcp.http_app(path="/", transport="streamable-http")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ArchiMate OEFF API",
    description=(
        "API read-only pour explorer un modèle ArchiMate 3.1 au format Open Exchange. "
        "Schémas alignés sur archimate3_Model.xsd, archimate3_View.xsd et "
        "archimate3_Diagram.xsd (v3.1)."
    ),
    version="2.0.0",
    lifespan=mcp_app.lifespan,
)

# ---------------------------------------------------------------------------
# Style helpers
# ---------------------------------------------------------------------------


def _hex_to_rgb(hex_str: Optional[str]) -> Optional[RGBColorOut]:
    """Convert a CSS hex color string (#RRGGBB) to RGBColorOut."""
    if not hex_str:
        return None
    s = hex_str.lstrip("#")
    if len(s) != 6:
        return None
    try:
        return RGBColorOut(r=int(s[0:2], 16), g=int(s[2:4], 16), b=int(s[4:6], 16))
    except ValueError:
        return None


def _font_out(obj) -> Optional[FontOut]:
    name = getattr(obj, "font_name", None)
    size = getattr(obj, "font_size", None)
    color = _hex_to_rgb(getattr(obj, "font_color", None))
    if name or size or color:
        return FontOut(name=name, size=size, color=color)
    return None


def _node_style_out(n) -> Optional[StyleOut]:
    fill = _hex_to_rgb(getattr(n, "fill_color", None))
    line = _hex_to_rgb(getattr(n, "line_color", None))
    font = _font_out(n)
    lw = getattr(n, "line_width", None)
    if fill or line or font or lw:
        return StyleOut(fill_color=fill, line_color=line, font=font, line_width=lw)
    return None


def _conn_style_out(c) -> Optional[StyleOut]:
    line = _hex_to_rgb(getattr(c, "line_color", None))
    font = _font_out(c)
    lw = getattr(c, "line_width", None)
    if line or font or lw:
        return StyleOut(line_color=line, font=font, line_width=lw)
    return None


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------


def _props_out(obj) -> list[PropertyOut]:
    raw = getattr(obj, "props", None)
    if not raw:
        return []
    return [PropertyOut(property_definition_ref=str(k), value=str(v)) for k, v in dict(raw).items()]


def _element_out(e) -> ElementOut:
    return ElementOut(
        identifier=e.uuid,
        name=e.name or "",
        type=e.type or "",
        documentation=e.desc or None,
        properties=_props_out(e),
    )


def _rel_out(r) -> RelationshipOut:
    src = r.source
    tgt = r.target
    rel_type = r.type or ""

    access_type = r.access_type if rel_type == "Access" else None
    is_directed = r.is_directed if rel_type == "Association" else None
    # XSD calls this "modifier"; pyArchimate exposes it as "influence_strength"
    modifier = getattr(r, "influence_strength", None) if rel_type == "Influence" else None

    return RelationshipOut(
        identifier=r.uuid,
        name=r.name or None,
        type=rel_type,
        source=src.uuid if hasattr(src, "uuid") else str(src),
        source_name=src.name if hasattr(src, "name") else None,
        target=tgt.uuid if hasattr(tgt, "uuid") else str(tgt),
        target_name=tgt.name if hasattr(tgt, "name") else None,
        documentation=r.desc or None,
        properties=_props_out(r),
        access_type=access_type if access_type else None,
        is_directed=is_directed,
        modifier=str(modifier) if modifier is not None else None,
    )


def _node_out(n) -> NodeOut:
    ref = n.ref
    element_ref = ref if isinstance(ref, str) else (ref.uuid if hasattr(ref, "uuid") else None)

    children = [_node_out(child) for child in (getattr(n, "nodes", None) or [])]

    return NodeOut(
        identifier=n.uuid,
        name=n.name or None,
        element_ref=element_ref,
        x=int(n.x) if n.x is not None else None,
        y=int(n.y) if n.y is not None else None,
        w=int(n.w) if n.w is not None else None,
        h=int(n.h) if n.h is not None else None,
        style=_node_style_out(n),
        children=children,
    )


def _connection_out(c) -> ConnectionOut:
    ref = getattr(c, "ref", None)
    relationship_ref = ref if isinstance(ref, str) else (ref.uuid if hasattr(ref, "uuid") else None)

    src = getattr(c, "source", None)
    tgt = getattr(c, "target", None)

    return ConnectionOut(
        identifier=c.uuid,
        name=getattr(c, "name", None) or None,
        relationship_ref=relationship_ref,
        source=src.uuid if hasattr(src, "uuid") else (str(src) if src else None),
        target=tgt.uuid if hasattr(tgt, "uuid") else (str(tgt) if tgt else None),
        style=_conn_style_out(c),
    )


def _view_out(v, detail: bool = False):
    raw_conns = getattr(v, "conns", None) or []
    base = dict(
        identifier=v.uuid,
        name=v.name or "",
        documentation=v.desc or None,
        viewpoint=getattr(v, "primary_viewpoint", None) or None,
        node_count=len(v.nodes),
        connection_count=len(raw_conns),
    )
    if detail:
        return ViewDetailOut(
            **base,
            nodes=[_node_out(n) for n in v.nodes],
            connections=[_connection_out(c) for c in raw_conns],
        )
    return ViewOut(**base)


# ---------------------------------------------------------------------------
# Business logic (shared by REST + MCP)
# ---------------------------------------------------------------------------


def _get_model_info() -> ModelInfo:
    return ModelInfo(
        identifier=_model.uuid or "",
        name=_model.name or "",
        documentation=getattr(_model, "desc", None) or None,
        version=getattr(_model, "version", None) or None,
        element_count=len(_model.elements),
        relationship_count=len(_model.relationships),
        view_count=len(_model.views),
    )


def _list_element_types() -> list[str]:
    return sorted({e.type for e in _model.elements if e.type})


def _list_elements(
    element_type: Optional[str] = None,
    name: Optional[str] = None,
) -> list[ElementOut]:
    elements = _model.elements
    if element_type:
        elements = [e for e in elements if e.type == element_type]
    if name:
        nl = name.lower()
        elements = [e for e in elements if e.name and nl in e.name.lower()]
    return [_element_out(e) for e in elements]


def _get_element(element_id: str) -> ElementOut:
    matches = [e for e in _model.elements if e.uuid == element_id]
    if not matches:
        raise ValueError(f"Élément '{element_id}' introuvable.")
    return _element_out(matches[0])


def _list_relationship_types() -> list[str]:
    return sorted({r.type for r in _model.relationships if r.type})


def _list_relationships(
    rel_type: Optional[str] = None,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
) -> list[RelationshipOut]:
    rels = _model.relationships
    if rel_type:
        rels = [r for r in rels if r.type == rel_type]
    if source_id:
        rels = [r for r in rels if (r.source.uuid if hasattr(r.source, "uuid") else r.source) == source_id]
    if target_id:
        rels = [r for r in rels if (r.target.uuid if hasattr(r.target, "uuid") else r.target) == target_id]
    return [_rel_out(r) for r in rels]


def _get_relationship(relationship_id: str) -> RelationshipOut:
    matches = [r for r in _model.relationships if r.uuid == relationship_id]
    if not matches:
        raise ValueError(f"Relation '{relationship_id}' introuvable.")
    return _rel_out(matches[0])


def _list_views() -> list[ViewOut]:
    return [_view_out(v) for v in _model.views]


def _get_view(view_id: str) -> ViewDetailOut:
    matches = [v for v in _model.views if v.uuid == view_id]
    if not matches:
        raise ValueError(f"Vue '{view_id}' introuvable.")
    return _view_out(matches[0], detail=True)


# ---------------------------------------------------------------------------
# Input validation helpers
# ---------------------------------------------------------------------------


def _validate_element_type(element_type: Optional[str]) -> None:
    if element_type and element_type not in ELEMENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Type d'élément ArchiMate invalide: '{element_type}'. "
                f"Types valides: {sorted(ELEMENT_TYPES)}"
            ),
        )


def _validate_relationship_type(rel_type: Optional[str]) -> None:
    if rel_type and rel_type not in RELATIONSHIP_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Type de relation ArchiMate invalide: '{rel_type}'. "
                f"Types valides: {sorted(RELATIONSHIP_TYPES)}"
            ),
        )


# ---------------------------------------------------------------------------
# Routes – Model
# ---------------------------------------------------------------------------


@app.get("/", response_model=ModelInfo, summary="Informations générales sur le modèle")
def get_model_info():
    return _get_model_info()


# ---------------------------------------------------------------------------
# Routes – Elements
# ---------------------------------------------------------------------------


@app.get("/elements/types", response_model=list[str], summary="Liste des types d'éléments présents dans le modèle")
def list_element_types():
    return _list_element_types()


@app.get("/elements", response_model=list[ElementOut], summary="Liste des éléments")
def list_elements(
    type: Optional[str] = Query(
        None,
        description=f"Filtrer par type ArchiMate 3.1 (ex: ApplicationComponent). Valides: {sorted(ELEMENT_TYPES)}",
    ),
    name: Optional[str] = Query(None, description="Filtrer par nom (insensible à la casse, sous-chaîne)"),
):
    _validate_element_type(type)
    return _list_elements(element_type=type, name=name)


@app.get("/elements/{element_id}", response_model=ElementOut, summary="Détail d'un élément")
def get_element(element_id: str):
    try:
        return _get_element(element_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Routes – Relationships
# ---------------------------------------------------------------------------


@app.get("/relationships/types", response_model=list[str], summary="Liste des types de relations présents dans le modèle")
def list_relationship_types():
    return _list_relationship_types()


@app.get("/relationships", response_model=list[RelationshipOut], summary="Liste des relations")
def list_relationships(
    type: Optional[str] = Query(
        None,
        description=f"Filtrer par type de relation ArchiMate 3.1 (ex: Flow). Valides: {sorted(RELATIONSHIP_TYPES)}",
    ),
    source_id: Optional[str] = Query(None, description="Filtrer par identifiant source"),
    target_id: Optional[str] = Query(None, description="Filtrer par identifiant cible"),
):
    _validate_relationship_type(type)
    return _list_relationships(rel_type=type, source_id=source_id, target_id=target_id)


@app.get("/relationships/{relationship_id}", response_model=RelationshipOut, summary="Détail d'une relation")
def get_relationship(relationship_id: str):
    try:
        return _get_relationship(relationship_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Routes – Views
# ---------------------------------------------------------------------------


@app.get("/views", response_model=list[ViewOut], summary="Liste des vues")
def list_views():
    return _list_views()


@app.get("/views/{view_id}", response_model=ViewDetailOut, summary="Détail d'une vue avec nœuds et connexions")
def get_view(view_id: str):
    try:
        return _get_view(view_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------

_ELEMENT_TYPES_STR = ", ".join(sorted(ELEMENT_TYPES))
_RELATIONSHIP_TYPES_STR = ", ".join(sorted(RELATIONSHIP_TYPES))


@mcp.tool(description="Retourne les métadonnées globales du modèle ArchiMate chargé (identifiant, nom, version, compteurs).")
def get_model_info_tool() -> dict:
    return _get_model_info().model_dump()


@mcp.tool(description="Retourne la liste triée des types d'éléments ArchiMate 3.1 présents dans le modèle.")
def list_element_types_tool() -> list[str]:
    return _list_element_types()


@mcp.tool(
    description=(
        f"Liste les éléments du modèle avec filtres optionnels. "
        f"element_type doit être un type ArchiMate 3.1 valide parmi: {_ELEMENT_TYPES_STR}."
    )
)
def list_elements_tool(element_type: Optional[str] = None, name: Optional[str] = None) -> list[dict]:
    if element_type and element_type not in ELEMENT_TYPES:
        raise ValueError(
            f"Type d'élément invalide: '{element_type}'. "
            f"Types valides ArchiMate 3.1: {sorted(ELEMENT_TYPES)}"
        )
    return [e.model_dump() for e in _list_elements(element_type=element_type, name=name)]


@mcp.tool(description="Retourne le détail d'un élément ArchiMate par son identifiant (champ 'identifier').")
def get_element_tool(element_id: str) -> dict:
    return _get_element(element_id).model_dump()


@mcp.tool(description="Retourne la liste triée des types de relations ArchiMate 3.1 présents dans le modèle.")
def list_relationship_types_tool() -> list[str]:
    return _list_relationship_types()


@mcp.tool(
    description=(
        f"Liste les relations du modèle avec filtres optionnels. "
        f"rel_type doit être parmi: {_RELATIONSHIP_TYPES_STR}. "
        f"Pour Access: le champ access_type précise Read/Write/ReadWrite. "
        f"Pour Association: is_directed indique si la relation est orientée. "
        f"Pour Influence: modifier indique la force d'influence."
    )
)
def list_relationships_tool(
    rel_type: Optional[str] = None,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
) -> list[dict]:
    if rel_type and rel_type not in RELATIONSHIP_TYPES:
        raise ValueError(
            f"Type de relation invalide: '{rel_type}'. "
            f"Types valides ArchiMate 3.1: {sorted(RELATIONSHIP_TYPES)}"
        )
    return [r.model_dump() for r in _list_relationships(rel_type=rel_type, source_id=source_id, target_id=target_id)]


@mcp.tool(description="Retourne le détail d'une relation ArchiMate par son identifiant.")
def get_relationship_tool(relationship_id: str) -> dict:
    return _get_relationship(relationship_id).model_dump()


@mcp.tool(description="Liste toutes les vues du modèle avec leur nombre de nœuds et de connexions.")
def list_views_tool() -> list[dict]:
    return [v.model_dump() for v in _list_views()]


@mcp.tool(
    description=(
        "Retourne le détail d'une vue ArchiMate par son identifiant: nœuds (position, taille, style), "
        "connexions (relation référencée, source, cible, style) et viewpoint."
    )
)
def get_view_tool(view_id: str) -> dict:
    return _get_view(view_id).model_dump()


app.mount("/mcp", mcp_app)
