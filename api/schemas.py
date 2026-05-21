"""Pydantic schemas used by REST and MCP responses.

This module contains output models shared by FastAPI endpoints and MCP tools.
"""

from typing import Optional
from pydantic import BaseModel


class ModelInfo(BaseModel):
    """Global metadata about the loaded ArchiMate model.

    Attributes:
        uuid: Model UUID.
        name: Model name.
        element_count: Total number of elements.
        relationship_count: Total number of relationships.
        view_count: Total number of views.
    """

    uuid: str
    name: str
    element_count: int
    relationship_count: int
    view_count: int


class ElementOut(BaseModel):
    """Element payload returned by list/detail operations.

    Attributes:
        uuid: Element UUID.
        name: Element name.
        type: ArchiMate element type.
        desc: Optional textual description.
        props: Custom element properties.
    """

    uuid: str
    name: str
    type: str
    desc: Optional[str] = None
    props: dict = {}


class RelationshipOut(BaseModel):
    """Relationship payload returned by list/detail operations.

    Attributes:
        uuid: Relationship UUID.
        type: ArchiMate relationship type.
        source_id: Source element UUID.
        source_name: Optional source element name.
        target_id: Target element UUID.
        target_name: Optional target element name.
        name: Optional relationship name.
        desc: Optional relationship description.
    """

    uuid: str
    type: str
    source_id: str
    source_name: Optional[str] = None
    target_id: str
    target_name: Optional[str] = None
    name: Optional[str] = None
    desc: Optional[str] = None


class NodeOut(BaseModel):
    """Node payload used in detailed view responses.

    Attributes:
        uuid: Node UUID.
        name: Optional node name.
        element_id: Optional referenced element UUID.
        x: Optional horizontal coordinate.
        y: Optional vertical coordinate.
        w: Optional node width.
        h: Optional node height.
    """

    uuid: str
    name: Optional[str] = None
    element_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None


class ViewOut(BaseModel):
    """Summary view payload.

    Attributes:
        uuid: View UUID.
        name: View name.
        desc: Optional view description.
        node_count: Number of nodes in the view.
    """

    uuid: str
    name: str
    desc: Optional[str] = None
    node_count: int


class ViewDetailOut(ViewOut):
    """Detailed view payload including nodes.

    Attributes:
        nodes: Nodes contained in the view.
    """

    nodes: list[NodeOut] = []
