"""Tests pour l'API ArchiMate (api/main.py).

Structure:
- Tests unitaires : helpers internes testés avec des mocks (pas de modèle réel).
- Tests d'intégration : TestClient FastAPI sur le modèle open-exchange.xml réel.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import (
    _connection_out,
    _element_out,
    _get_model_info,
    _hex_to_rgb,
    _node_out,
    _rel_out,
    _view_out,
    app,
    _model,
)
from api.schemas import (
    ACCESS_TYPES,
    ELEMENT_TYPES,
    RELATIONSHIP_TYPES,
    VIEWPOINTS,
    ConnectionOut,
    ElementOut,
    NodeOut,
    PropertyOut,
    RGBColorOut,
    RelationshipOut,
    ViewDetailOut,
    ViewOut,
)

client = TestClient(app)

UNKNOWN_ID = "id-does-not-exist"


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture(scope="module")
def elements_data():
    return client.get("/elements").json()


@pytest.fixture(scope="module")
def known_element(elements_data):
    return next((e for e in elements_data if e.get("identifier") and e.get("type")), elements_data[0])


@pytest.fixture(scope="module")
def known_element_type(known_element):
    return known_element["type"]


@pytest.fixture(scope="module")
def known_element_name_fragment(known_element):
    name = known_element.get("name") or ""
    return (name[:3] if len(name) >= 3 else name).lower()


@pytest.fixture(scope="module")
def relationships_data():
    return client.get("/relationships").json()


@pytest.fixture(scope="module")
def known_relationship(relationships_data):
    return next((r for r in relationships_data if r.get("identifier") and r.get("type")), relationships_data[0])


@pytest.fixture(scope="module")
def known_relationship_type(known_relationship):
    return known_relationship["type"]


@pytest.fixture(scope="module")
def known_view():
    views = client.get("/views").json()
    return next((v for v in views if v.get("identifier")), views[0])


# ===========================================================================
# Unit tests – schema constants (archimate3_Model.xsd / archimate3_View.xsd)
# ===========================================================================


class TestSchemaConstants:
    def test_element_types_count(self):
        assert len(ELEMENT_TYPES) == 62

    def test_element_types_business_layer(self):
        expected = {
            "BusinessActor", "BusinessRole", "BusinessCollaboration", "BusinessInterface",
            "BusinessProcess", "BusinessFunction", "BusinessInteraction", "BusinessEvent",
            "BusinessService", "BusinessObject", "Contract", "Representation", "Product",
        }
        assert expected <= ELEMENT_TYPES

    def test_element_types_application_layer(self):
        expected = {
            "ApplicationComponent", "ApplicationCollaboration", "ApplicationInterface",
            "ApplicationFunction", "ApplicationInteraction", "ApplicationProcess",
            "ApplicationEvent", "ApplicationService", "DataObject",
        }
        assert expected <= ELEMENT_TYPES

    def test_element_types_technology_layer(self):
        expected = {
            "Node", "Device", "SystemSoftware", "TechnologyCollaboration",
            "TechnologyInterface", "Path", "CommunicationNetwork", "TechnologyFunction",
            "TechnologyProcess", "TechnologyInteraction", "TechnologyEvent",
            "TechnologyService", "Artifact",
        }
        assert expected <= ELEMENT_TYPES

    def test_element_types_motivation(self):
        expected = {
            "Stakeholder", "Driver", "Assessment", "Goal", "Outcome",
            "Principle", "Requirement", "Constraint", "Meaning", "Value",
        }
        assert expected <= ELEMENT_TYPES

    def test_element_types_strategy(self):
        assert {"Resource", "Capability", "CourseOfAction", "ValueStream"} <= ELEMENT_TYPES

    def test_element_types_impl_migration(self):
        assert {"WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"} <= ELEMENT_TYPES

    def test_element_types_composites_junctions(self):
        assert {"Grouping", "Location", "AndJunction", "OrJunction"} <= ELEMENT_TYPES

    def test_relationship_types_all_eleven(self):
        assert RELATIONSHIP_TYPES == {
            "Composition", "Aggregation", "Assignment", "Realization", "Serving",
            "Access", "Influence", "Triggering", "Flow", "Specialization", "Association",
        }

    def test_access_types(self):
        assert ACCESS_TYPES == {"Access", "Read", "Write", "ReadWrite"}

    def test_viewpoints_not_empty(self):
        assert len(VIEWPOINTS) >= 20

    def test_viewpoints_contains_standard(self):
        assert "Layered" in VIEWPOINTS
        assert "Motivation" in VIEWPOINTS
        assert "Strategy" in VIEWPOINTS


# ===========================================================================
# Unit tests – _hex_to_rgb helper
# ===========================================================================


class TestHexToRgb:
    def test_white(self):
        c = _hex_to_rgb("#FFFFFF")
        assert c == RGBColorOut(r=255, g=255, b=255)

    def test_black(self):
        c = _hex_to_rgb("#000000")
        assert c == RGBColorOut(r=0, g=0, b=0)

    def test_color(self):
        c = _hex_to_rgb("#5C5C5C")
        assert c.r == 92
        assert c.g == 92
        assert c.b == 92

    def test_without_hash(self):
        c = _hex_to_rgb("FF0000")
        assert c == RGBColorOut(r=255, g=0, b=0)

    def test_none_input(self):
        assert _hex_to_rgb(None) is None

    def test_empty_string(self):
        assert _hex_to_rgb("") is None

    def test_invalid_length(self):
        assert _hex_to_rgb("#FFF") is None

    def test_invalid_hex(self):
        assert _hex_to_rgb("#ZZZZZZ") is None


# ===========================================================================
# Unit tests – _element_out helper
# ===========================================================================


class TestElementOutHelper:
    def _make_element(self, uuid="elem-001", name="My Component",
                      etype="ApplicationComponent", desc=None, props=None):
        e = MagicMock()
        e.uuid = uuid
        e.name = name
        e.type = etype
        e.desc = desc
        e.props = props or {}
        return e

    def test_identifier_mapped_from_uuid(self):
        result = _element_out(self._make_element())
        assert result.identifier == "elem-001"

    def test_name_and_type(self):
        result = _element_out(self._make_element())
        assert result.name == "My Component"
        assert result.type == "ApplicationComponent"

    def test_documentation_from_desc(self):
        result = _element_out(self._make_element(desc="Some doc"))
        assert result.documentation == "Some doc"

    def test_documentation_none_when_no_desc(self):
        result = _element_out(self._make_element(desc=None))
        assert result.documentation is None

    def test_properties_converted_from_dict(self):
        result = _element_out(self._make_element(props={"Capability Level": "0", "Status": "active"}))
        assert len(result.properties) == 2
        refs = {p.property_definition_ref for p in result.properties}
        assert "Capability Level" in refs
        assert "Status" in refs

    def test_property_value_as_string(self):
        result = _element_out(self._make_element(props={"key": "val"}))
        assert result.properties[0].value == "val"

    def test_empty_props_gives_empty_list(self):
        result = _element_out(self._make_element(props=None))
        assert result.properties == []

    def test_returns_element_out_type(self):
        assert isinstance(_element_out(self._make_element()), ElementOut)


# ===========================================================================
# Unit tests – _rel_out helper
# ===========================================================================


class TestRelOutHelper:
    def _make_rel(self, uuid="rel-001", rtype="Association", name=None,
                  desc=None, props=None, access_type=None, is_directed=None,
                  influence_strength=None):
        r = MagicMock()
        r.uuid = uuid
        r.type = rtype
        r.name = name
        r.desc = desc
        r.props = props or {}
        r.access_type = access_type
        r.is_directed = is_directed
        r.influence_strength = influence_strength
        # MagicMock's `name` kwarg sets the mock's internal repr, not `.name`.
        # Set the attribute explicitly after creation.
        src = MagicMock()
        src.uuid = "src-001"
        src.name = "Source"
        r.source = src
        tgt = MagicMock()
        tgt.uuid = "tgt-001"
        tgt.name = "Target"
        r.target = tgt
        return r

    def test_identifier_mapped(self):
        result = _rel_out(self._make_rel())
        assert result.identifier == "rel-001"

    def test_source_and_target_uuids(self):
        result = _rel_out(self._make_rel())
        assert result.source == "src-001"
        assert result.target == "tgt-001"

    def test_source_name_and_target_name(self):
        result = _rel_out(self._make_rel())
        assert result.source_name == "Source"
        assert result.target_name == "Target"

    def test_documentation_from_desc(self):
        result = _rel_out(self._make_rel(desc="Relation doc"))
        assert result.documentation == "Relation doc"

    def test_access_type_set_for_access_rel(self):
        result = _rel_out(self._make_rel(rtype="Access", access_type="Write"))
        assert result.access_type == "Write"

    def test_access_type_none_for_non_access_rel(self):
        result = _rel_out(self._make_rel(rtype="Flow", access_type="Write"))
        assert result.access_type is None

    def test_is_directed_set_for_association(self):
        result = _rel_out(self._make_rel(rtype="Association", is_directed=True))
        assert result.is_directed is True

    def test_is_directed_none_for_non_association(self):
        result = _rel_out(self._make_rel(rtype="Serving", is_directed=True))
        assert result.is_directed is None

    def test_modifier_set_for_influence(self):
        result = _rel_out(self._make_rel(rtype="Influence", influence_strength="+"))
        assert result.modifier == "+"

    def test_modifier_none_for_non_influence(self):
        result = _rel_out(self._make_rel(rtype="Flow", influence_strength="+"))
        assert result.modifier is None

    def test_returns_relationship_out_type(self):
        assert isinstance(_rel_out(self._make_rel()), RelationshipOut)


# ===========================================================================
# Unit tests – _node_out helper
# ===========================================================================


class TestNodeOutHelper:
    def _make_node(self, uuid="node-001", name=None, ref=None,
                   x=10, y=20, w=120, h=55, fill_color="#FFFFFF",
                   line_color="#000000", nodes=None):
        n = MagicMock()
        n.uuid = uuid
        n.name = name
        n.ref = ref
        n.x = x
        n.y = y
        n.w = w
        n.h = h
        n.fill_color = fill_color
        n.line_color = line_color
        n.font_name = None
        n.font_size = None
        n.font_color = None
        n.nodes = nodes or []
        return n

    def test_identifier_mapped(self):
        result = _node_out(self._make_node())
        assert result.identifier == "node-001"

    def test_coordinates_as_int(self):
        result = _node_out(self._make_node(x=10, y=20, w=120, h=55))
        assert result.x == 10
        assert result.y == 20
        assert result.w == 120
        assert result.h == 55

    def test_element_ref_from_string_ref(self):
        result = _node_out(self._make_node(ref="elem-abc"))
        assert result.element_ref == "elem-abc"

    def test_element_ref_from_object_ref(self):
        ref_obj = MagicMock(uuid="elem-xyz")
        result = _node_out(self._make_node(ref=ref_obj))
        assert result.element_ref == "elem-xyz"

    def test_element_ref_none_when_no_ref(self):
        result = _node_out(self._make_node(ref=None))
        assert result.element_ref is None

    def test_style_fill_and_line_colors(self):
        result = _node_out(self._make_node(fill_color="#FF0000", line_color="#0000FF"))
        assert result.style is not None
        assert result.style.fill_color == RGBColorOut(r=255, g=0, b=0)
        assert result.style.line_color == RGBColorOut(r=0, g=0, b=255)

    def test_children_populated(self):
        child = self._make_node(uuid="child-001")
        parent = self._make_node(uuid="parent-001", nodes=[child])
        result = _node_out(parent)
        assert len(result.children) == 1
        assert result.children[0].identifier == "child-001"

    def test_returns_node_out_type(self):
        assert isinstance(_node_out(self._make_node()), NodeOut)


# ===========================================================================
# Unit tests – _connection_out helper
# ===========================================================================


class TestConnectionOutHelper:
    def _make_conn(self, uuid="conn-001", name=None, ref="rel-001",
                   src_uuid="node-src", tgt_uuid="node-tgt",
                   line_color=None, line_width=None):
        c = MagicMock()
        c.uuid = uuid
        c.name = name
        c.ref = ref
        c.source = MagicMock(uuid=src_uuid)
        c.target = MagicMock(uuid=tgt_uuid)
        c.line_color = line_color
        c.line_width = line_width
        c.font_name = None
        c.font_size = None
        c.font_color = None
        return c

    def test_identifier_mapped(self):
        result = _connection_out(self._make_conn())
        assert result.identifier == "conn-001"

    def test_relationship_ref(self):
        result = _connection_out(self._make_conn(ref="rel-abc"))
        assert result.relationship_ref == "rel-abc"

    def test_source_and_target_uuids(self):
        result = _connection_out(self._make_conn(src_uuid="n1", tgt_uuid="n2"))
        assert result.source == "n1"
        assert result.target == "n2"

    def test_style_line_color(self):
        result = _connection_out(self._make_conn(line_color="#5C5C5C"))
        assert result.style is not None
        assert result.style.line_color == RGBColorOut(r=92, g=92, b=92)

    def test_style_none_when_no_styling(self):
        result = _connection_out(self._make_conn(line_color=None, line_width=None))
        assert result.style is None

    def test_returns_connection_out_type(self):
        assert isinstance(_connection_out(self._make_conn()), ConnectionOut)


# ===========================================================================
# Unit tests – _view_out helper
# ===========================================================================


class TestViewOutHelper:
    def _make_view(self, uuid="view-001", name="My View", desc=None,
                   primary_viewpoint=None, nodes=None, conns=None):
        v = MagicMock()
        v.uuid = uuid
        v.name = name
        v.desc = desc
        v.primary_viewpoint = primary_viewpoint
        v.nodes = nodes or []
        v.conns = conns or []
        return v

    def test_identifier_mapped(self):
        result = _view_out(self._make_view())
        assert result.identifier == "view-001"

    def test_name(self):
        result = _view_out(self._make_view())
        assert result.name == "My View"

    def test_documentation_from_desc(self):
        result = _view_out(self._make_view(desc="View doc"))
        assert result.documentation == "View doc"

    def test_viewpoint_from_primary_viewpoint(self):
        result = _view_out(self._make_view(primary_viewpoint="Layered"))
        assert result.viewpoint == "Layered"

    def test_node_count(self):
        nodes = [MagicMock() for _ in range(3)]
        result = _view_out(self._make_view(nodes=nodes))
        assert result.node_count == 3

    def test_connection_count(self):
        conns = [MagicMock() for _ in range(5)]
        result = _view_out(self._make_view(conns=conns))
        assert result.connection_count == 5

    def test_summary_returns_view_out(self):
        result = _view_out(self._make_view())
        assert isinstance(result, ViewOut)

    def test_detail_returns_view_detail_out(self):
        result = _view_out(self._make_view(), detail=True)
        assert isinstance(result, ViewDetailOut)


# ===========================================================================
# Integration tests – GET /
# ===========================================================================


class TestModelInfo:
    def test_status_ok(self):
        assert client.get("/").status_code == 200

    def test_response_shape(self):
        data = client.get("/").json()
        assert "identifier" in data
        assert "name" in data
        assert "element_count" in data
        assert "relationship_count" in data
        assert "view_count" in data

    def test_model_name_not_empty(self):
        data = client.get("/").json()
        assert isinstance(data["name"], str)
        assert data["name"].strip() != ""

    def test_counts_are_positive(self):
        data = client.get("/").json()
        assert data["element_count"] > 0
        assert data["relationship_count"] > 0
        assert data["view_count"] > 0

    def test_identifier_not_empty(self):
        data = client.get("/").json()
        assert data["identifier"].strip() != ""


# ===========================================================================
# Integration tests – GET /elements/types
# ===========================================================================


class TestElementTypes:
    def test_status_ok(self):
        assert client.get("/elements/types").status_code == 200

    def test_returns_list_of_strings(self):
        data = client.get("/elements/types").json()
        assert isinstance(data, list)
        assert all(isinstance(t, str) for t in data)

    def test_sorted(self):
        data = client.get("/elements/types").json()
        assert data == sorted(data)

    def test_no_duplicates(self):
        data = client.get("/elements/types").json()
        assert len(data) == len(set(data))

    def test_contains_known_type(self, known_element_type):
        data = client.get("/elements/types").json()
        assert known_element_type in data

    def test_all_types_are_valid_archimate(self):
        data = client.get("/elements/types").json()
        for t in data:
            assert t in ELEMENT_TYPES, f"Type '{t}' absent de la spécification ArchiMate 3.1"


# ===========================================================================
# Integration tests – GET /elements
# ===========================================================================


class TestListElements:
    def test_status_ok(self):
        assert client.get("/elements").status_code == 200

    def test_returns_all_elements(self):
        data = client.get("/elements").json()
        assert len(data) == len(_model.elements)

    def test_element_shape(self):
        data = client.get("/elements").json()
        e = data[0]
        assert "identifier" in e
        assert "name" in e
        assert "type" in e
        assert "documentation" in e
        assert "properties" in e

    def test_properties_is_list(self):
        data = client.get("/elements").json()
        assert all(isinstance(e["properties"], list) for e in data)

    def test_property_shape(self):
        data = client.get("/elements").json()
        elem_with_props = next((e for e in data if e["properties"]), None)
        if elem_with_props:
            p = elem_with_props["properties"][0]
            assert "property_definition_ref" in p
            assert "value" in p

    def test_filter_by_type(self, known_element_type):
        data = client.get(f"/elements?type={known_element_type}").json()
        assert len(data) > 0
        assert all(e["type"] == known_element_type for e in data)

    def test_filter_by_type_empty_result(self):
        data = client.get("/elements?type=Capability&name=xyznotfound123").json()
        assert data == []

    def test_filter_by_invalid_type_returns_422(self):
        r = client.get("/elements?type=NonExistentType")
        assert r.status_code == 422

    def test_filter_by_name_case_insensitive(self, known_element_name_fragment):
        if not known_element_name_fragment:
            pytest.skip("Aucun nom d'élément exploitable.")
        data = client.get(f"/elements?name={known_element_name_fragment}").json()
        assert len(data) > 0
        assert all(known_element_name_fragment in (e.get("name") or "").lower() for e in data)

    def test_filter_by_name_no_result(self):
        assert client.get("/elements?name=xyznotfound123").json() == []

    def test_filter_combined(self, known_element_type, known_element_name_fragment):
        if not known_element_name_fragment:
            pytest.skip("Aucun nom d'élément exploitable.")
        data = client.get(f"/elements?type={known_element_type}&name={known_element_name_fragment}").json()
        assert all(e["type"] == known_element_type for e in data)


# ===========================================================================
# Integration tests – GET /elements/{id}
# ===========================================================================


class TestGetElement:
    def test_known_id_ok(self, known_element):
        r = client.get(f"/elements/{known_element['identifier']}")
        assert r.status_code == 200

    def test_known_id_data(self, known_element):
        data = client.get(f"/elements/{known_element['identifier']}").json()
        assert data["identifier"] == known_element["identifier"]
        assert data["name"] == known_element["name"]
        assert data["type"] == known_element["type"]

    def test_unknown_id_404(self):
        assert client.get(f"/elements/{UNKNOWN_ID}").status_code == 404

    def test_404_message_contains_id(self):
        assert UNKNOWN_ID in client.get(f"/elements/{UNKNOWN_ID}").json()["detail"]

    def test_element_properties_is_list(self, known_element):
        data = client.get(f"/elements/{known_element['identifier']}").json()
        assert isinstance(data["properties"], list)


# ===========================================================================
# Integration tests – GET /relationships/types
# ===========================================================================


class TestRelationshipTypes:
    def test_status_ok(self):
        assert client.get("/relationships/types").status_code == 200

    def test_sorted(self):
        data = client.get("/relationships/types").json()
        assert data == sorted(data)

    def test_contains_known_type(self, known_relationship_type):
        data = client.get("/relationships/types").json()
        assert known_relationship_type in data

    def test_all_types_are_valid_archimate(self):
        data = client.get("/relationships/types").json()
        for t in data:
            assert t in RELATIONSHIP_TYPES, f"Type '{t}' absent de la spécification ArchiMate 3.1"


# ===========================================================================
# Integration tests – GET /relationships
# ===========================================================================


class TestListRelationships:
    def test_status_ok(self):
        assert client.get("/relationships").status_code == 200

    def test_returns_all_relationships(self):
        data = client.get("/relationships").json()
        assert len(data) == len(_model.relationships)

    def test_relationship_shape(self):
        r = client.get("/relationships").json()[0]
        assert "identifier" in r
        assert "type" in r
        assert "source" in r
        assert "target" in r
        assert "documentation" in r
        assert "properties" in r

    def test_filter_by_type(self, known_relationship_type):
        data = client.get(f"/relationships?type={known_relationship_type}").json()
        assert len(data) > 0
        assert all(r["type"] == known_relationship_type for r in data)

    def test_filter_by_invalid_type_returns_422(self):
        assert client.get("/relationships?type=NotARelType").status_code == 422

    def test_filter_by_source_id(self, known_relationship):
        source = known_relationship["source"]
        data = client.get(f"/relationships?source_id={source}").json()
        assert len(data) > 0
        assert all(r["source"] == source for r in data)

    def test_filter_by_target_id(self, known_relationship):
        target = known_relationship["target"]
        data = client.get(f"/relationships?target_id={target}").json()
        assert len(data) > 0
        assert all(r["target"] == target for r in data)

    def test_filter_no_result(self):
        assert client.get(f"/relationships?source_id={UNKNOWN_ID}").json() == []

    def test_source_and_target_names_present(self):
        data = client.get("/relationships").json()
        assert all("source_name" in r and "target_name" in r for r in data)

    def test_access_relationships_have_access_type(self):
        data = client.get("/relationships?type=Access").json()
        if data:
            for r in data:
                if r["access_type"] is not None:
                    assert r["access_type"] in ACCESS_TYPES

    def test_association_relationships_have_is_directed(self):
        data = client.get("/relationships?type=Association").json()
        if data:
            for r in data:
                assert "is_directed" in r

    def test_influence_relationships_have_modifier(self):
        data = client.get("/relationships?type=Influence").json()
        if data:
            for r in data:
                assert "modifier" in r


# ===========================================================================
# Integration tests – GET /relationships/{id}
# ===========================================================================


class TestGetRelationship:
    def test_known_id_ok(self, known_relationship):
        assert client.get(f"/relationships/{known_relationship['identifier']}").status_code == 200

    def test_known_id_data(self, known_relationship):
        data = client.get(f"/relationships/{known_relationship['identifier']}").json()
        assert data["identifier"] == known_relationship["identifier"]
        assert data["type"] == known_relationship["type"]

    def test_unknown_id_404(self):
        assert client.get(f"/relationships/{UNKNOWN_ID}").status_code == 404


# ===========================================================================
# Integration tests – GET /views
# ===========================================================================


class TestListViews:
    def test_status_ok(self):
        assert client.get("/views").status_code == 200

    def test_returns_all_views(self):
        data = client.get("/views").json()
        assert len(data) == len(_model.views)

    def test_view_shape(self):
        v = client.get("/views").json()[0]
        assert "identifier" in v
        assert "name" in v
        assert "node_count" in v
        assert "connection_count" in v
        assert "viewpoint" in v
        assert "documentation" in v

    def test_node_count_is_int(self):
        data = client.get("/views").json()
        assert all(isinstance(v["node_count"], int) for v in data)

    def test_connection_count_is_int(self):
        data = client.get("/views").json()
        assert all(isinstance(v["connection_count"], int) for v in data)

    def test_contains_known_view(self, known_view):
        ids = [v["identifier"] for v in client.get("/views").json()]
        assert known_view["identifier"] in ids


# ===========================================================================
# Integration tests – GET /views/{id}
# ===========================================================================


class TestGetView:
    def test_known_id_ok(self, known_view):
        assert client.get(f"/views/{known_view['identifier']}").status_code == 200

    def test_known_id_data(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        assert data["identifier"] == known_view["identifier"]
        assert data["name"] == known_view["name"]

    def test_nodes_present(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        assert "nodes" in data
        assert len(data["nodes"]) == data["node_count"]

    def test_connections_present(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        assert "connections" in data
        assert len(data["connections"]) == data["connection_count"]

    def test_node_shape(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        if not data["nodes"]:
            pytest.skip("La vue sélectionnée ne contient pas de nœuds.")
        n = data["nodes"][0]
        assert "identifier" in n
        assert "element_ref" in n
        assert "x" in n
        assert "y" in n
        assert "w" in n
        assert "h" in n
        assert "style" in n
        assert "children" in n

    def test_node_coordinates_are_int(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        for n in data["nodes"]:
            if n["x"] is not None:
                assert isinstance(n["x"], int)
            if n["w"] is not None:
                assert isinstance(n["w"], int)

    def test_node_style_rgb_colors(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        for n in data["nodes"]:
            if n.get("style") and n["style"].get("fill_color"):
                fc = n["style"]["fill_color"]
                assert "r" in fc and "g" in fc and "b" in fc
                assert 0 <= fc["r"] <= 255
                assert 0 <= fc["g"] <= 255
                assert 0 <= fc["b"] <= 255

    def test_connection_shape(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        if not data["connections"]:
            pytest.skip("La vue sélectionnée ne contient pas de connexions.")
        c = data["connections"][0]
        assert "identifier" in c
        assert "relationship_ref" in c
        assert "source" in c
        assert "target" in c

    def test_connection_source_references_node(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        if not data["connections"]:
            pytest.skip("La vue sélectionnée ne contient pas de connexions.")
        node_ids = {n["identifier"] for n in data["nodes"]}
        for c in data["connections"]:
            if c["source"]:
                assert c["source"] in node_ids

    def test_connection_relationship_ref_valid(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        rel_ids = {r["identifier"] for r in client.get("/relationships").json()}
        for c in data["connections"]:
            if c["relationship_ref"]:
                assert c["relationship_ref"] in rel_ids

    def test_node_element_ref_references_known_element(self, known_view):
        data = client.get(f"/views/{known_view['identifier']}").json()
        elem_ids = {e["identifier"] for e in client.get("/elements").json()}
        refs = [n["element_ref"] for n in data["nodes"] if n["element_ref"]]
        if refs:
            assert any(ref in elem_ids for ref in refs)

    def test_unknown_id_404(self):
        assert client.get(f"/views/{UNKNOWN_ID}").status_code == 404


# ===========================================================================
# Integration tests – MCP service
# ===========================================================================


class TestMCPService:
    def test_mcp_service_is_mounted(self):
        with TestClient(app) as c:
            r = c.get("/mcp")
            assert r.status_code in {200, 307, 405, 406}

    def test_mcp_service_not_500(self):
        with TestClient(app) as c:
            assert c.get("/mcp/").status_code != 500

    def test_mcp_jsonrpc_initialize_and_list_tools(self):
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }
        with TestClient(app) as c:
            init_resp = c.post(
                "/mcp/",
                headers=headers,
                json={
                    "jsonrpc": "2.0",
                    "id": "init-1",
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2025-03-26",
                        "capabilities": {},
                        "clientInfo": {"name": "pytest", "version": "1.0"},
                    },
                },
            )
            assert init_resp.status_code == 200
            assert "text/event-stream" in init_resp.headers.get("content-type", "")
            session_id = init_resp.headers.get("mcp-session-id")
            assert session_id

            init_line = next(
                (line for line in init_resp.text.splitlines() if line.startswith("data: ")),
                None,
            )
            assert init_line is not None
            init_payload = json.loads(init_line.replace("data: ", "", 1))
            assert init_payload["jsonrpc"] == "2.0"
            assert "result" in init_payload

            tools_resp = c.post(
                "/mcp/",
                headers={**headers, "mcp-session-id": session_id},
                json={"jsonrpc": "2.0", "id": "tools-1", "method": "tools/list", "params": {}},
            )
            assert tools_resp.status_code == 200
            tools_line = next(
                (line for line in tools_resp.text.splitlines() if line.startswith("data: ")),
                None,
            )
            tools_payload = json.loads(tools_line.replace("data: ", "", 1))
            tools = tools_payload["result"]["tools"]

            expected_tools = {
                "get_model_info_tool",
                "list_element_types_tool",
                "list_elements_tool",
                "get_element_tool",
                "list_relationship_types_tool",
                "list_relationships_tool",
                "get_relationship_tool",
                "list_views_tool",
                "get_view_tool",
            }
            registered = {t["name"] for t in tools}
            assert expected_tools <= registered
