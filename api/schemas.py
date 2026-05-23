"""Pydantic schemas and ArchiMate 3.1 type constants aligned with the Open Exchange Format XSD.

Sources: archimate3_Model.xsd, archimate3_View.xsd, archimate3_Diagram.xsd (v3.1).
"""

from typing import Optional
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# ArchiMate 3.1 type constants (archimate3_Model.xsd)
# ---------------------------------------------------------------------------

ELEMENT_TYPES: frozenset[str] = frozenset({
    # Business Layer
    "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
    "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
    "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
    # Application Layer
    "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
    "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
    "ApplicationEvent", "ApplicationService", "DataObject",
    # Technology Layer
    "Node", "Device", "SystemSoftware", "TechnologyCollaboration", "TechnologyInterface",
    "Path", "CommunicationNetwork", "TechnologyFunction", "TechnologyProcess",
    "TechnologyInteraction", "TechnologyEvent", "TechnologyService", "Artifact",
    # Physical Layer
    "Equipment", "Facility", "DistributionNetwork", "Material",
    # Motivation
    "Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle",
    "Requirement", "Constraint", "Meaning", "Value",
    # Strategy
    "Resource", "Capability", "CourseOfAction", "ValueStream",
    # Implementation & Migration
    "WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap",
    # Composites & Junctions
    "Grouping", "Location", "AndJunction", "OrJunction",
})

RELATIONSHIP_TYPES: frozenset[str] = frozenset({
    "Composition", "Aggregation", "Assignment", "Realization", "Serving",
    "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
})

# Access relationship accessType attribute values (archimate3_Model.xsd AccessTypeEnum)
ACCESS_TYPES: frozenset[str] = frozenset({"Access", "Read", "Write", "ReadWrite"})

# Viewpoint names (archimate3_View.xsd ViewpointsEnum)
VIEWPOINTS: frozenset[str] = frozenset({
    "Organization", "Application Platform", "Application Structure",
    "Information Structure", "Technology", "Layered", "Physical",
    "Product", "Application Usage", "Technology Usage",
    "Business Process Cooperation", "Application Cooperation",
    "Service Realization", "Implementation and Deployment",
    "Goal Realization", "Goal Contribution", "Principles",
    "Requirements Realization", "Motivation", "Strategy",
    "Capability Map", "Outcome Realization", "Resource Map", "Value Stream",
    "Project", "Migration", "Implementation and Migration", "Stakeholder",
})

# ---------------------------------------------------------------------------
# Style sub-types (archimate3_Diagram.xsd)
# ---------------------------------------------------------------------------


class RGBColorOut(BaseModel):
    """RGB color (0–255 per channel) with optional alpha (0=transparent, 100=opaque)."""

    r: int
    g: int
    b: int
    a: Optional[int] = None


class FontOut(BaseModel):
    """Font specification for diagram labels (archimate3_Diagram.xsd FontType)."""

    name: Optional[str] = None
    size: Optional[float] = None
    style: Optional[str] = None  # space-separated: "plain" | "bold" | "italic" | "underline"
    color: Optional[RGBColorOut] = None


class StyleOut(BaseModel):
    """Visual style applied to a node or connection (archimate3_Diagram.xsd StyleType)."""

    line_color: Optional[RGBColorOut] = None
    fill_color: Optional[RGBColorOut] = None
    font: Optional[FontOut] = None
    line_width: Optional[int] = None


# ---------------------------------------------------------------------------
# Property sub-type (archimate3_Model.xsd PropertyType)
# ---------------------------------------------------------------------------


class PropertyOut(BaseModel):
    """Property instance: a reference to a PropertyDefinition and its value."""

    property_definition_ref: str
    value: str


# ---------------------------------------------------------------------------
# Top-level API output schemas
# ---------------------------------------------------------------------------


class ModelInfo(BaseModel):
    """Global metadata about the loaded ArchiMate model (archimate3_Model.xsd ModelType)."""

    identifier: str
    name: str
    documentation: Optional[str] = None
    version: Optional[str] = None
    element_count: int
    relationship_count: int
    view_count: int


class ElementOut(BaseModel):
    """Element payload aligned with archimate3_Model.xsd ElementType."""

    identifier: str
    name: str
    type: str           # value from ELEMENT_TYPES
    documentation: Optional[str] = None
    properties: list[PropertyOut] = []


class RelationshipOut(BaseModel):
    """Relationship payload aligned with archimate3_Model.xsd RelationshipType."""

    identifier: str
    name: Optional[str] = None
    type: str           # value from RELATIONSHIP_TYPES
    source: str         # IDREF → source element identifier
    source_name: Optional[str] = None
    target: str         # IDREF → target element identifier
    target_name: Optional[str] = None
    documentation: Optional[str] = None
    properties: list[PropertyOut] = []
    # Access relationship (archimate3_Model.xsd AccessTypeEnum)
    access_type: Optional[str] = None   # "Access" | "Read" | "Write" | "ReadWrite"
    # Association relationship
    is_directed: Optional[bool] = None
    # Influence relationship modifier
    modifier: Optional[str] = None


class ConnectionOut(BaseModel):
    """Diagram connection aligned with archimate3_Diagram.xsd ConnectionType."""

    identifier: str
    name: Optional[str] = None
    relationship_ref: Optional[str] = None  # IDREF → model Relationship
    source: Optional[str] = None            # IDREF → source Node identifier
    target: Optional[str] = None            # IDREF → target Node identifier
    style: Optional[StyleOut] = None


class NodeOut(BaseModel):
    """Diagram node aligned with archimate3_Diagram.xsd ViewNodeType / Element."""

    identifier: str
    name: Optional[str] = None
    element_ref: Optional[str] = None  # IDREF → model Element identifier
    x: Optional[int] = None            # nonNegativeInteger (pixels from top-left)
    y: Optional[int] = None            # nonNegativeInteger (pixels from top-left)
    w: Optional[int] = None            # positiveInteger (width)
    h: Optional[int] = None            # positiveInteger (height)
    style: Optional[StyleOut] = None
    children: list["NodeOut"] = []     # nested nodes (archimate3_Diagram.xsd Container)


NodeOut.model_rebuild()


class ViewOut(BaseModel):
    """Summary view payload aligned with archimate3_View.xsd ViewType."""

    identifier: str
    name: str
    documentation: Optional[str] = None
    viewpoint: Optional[str] = None  # value from VIEWPOINTS or custom string
    node_count: int
    connection_count: int


class ViewDetailOut(ViewOut):
    """Detailed view payload including diagram nodes and connections."""

    nodes: list[NodeOut] = []
    connections: list[ConnectionOut] = []
