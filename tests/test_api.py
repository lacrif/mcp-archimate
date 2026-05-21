"""
Tests unitaires pour l'API ArchiMate (api/main.py).
Utilise le TestClient de FastAPI (httpx) — pas de serveur nécessaire.
"""
import json
import pytest
from fastapi.testclient import TestClient

from api.main import app, _model

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

UNKNOWN_ID = "id-does-not-exist"


@pytest.fixture(scope="module")
def model_info():
    return client.get("/").json()


@pytest.fixture(scope="module")
def elements_data():
    return client.get("/elements").json()


@pytest.fixture(scope="module")
def known_element(elements_data):
    # Prend un element representatif du jeu de donnees courant.
    return next((e for e in elements_data if e.get("uuid") and e.get("type")), elements_data[0])


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
    return next((r for r in relationships_data if r.get("uuid") and r.get("type")), relationships_data[0])


@pytest.fixture(scope="module")
def known_relationship_type(known_relationship):
    return known_relationship["type"]


@pytest.fixture(scope="module")
def known_view():
    views = client.get("/views").json()
    return next((v for v in views if v.get("uuid")), views[0])


# ---------------------------------------------------------------------------
# GET / — Model info
# ---------------------------------------------------------------------------

class TestModelInfo:
    def test_status_ok(self):
        r = client.get("/")
        assert r.status_code == 200

    def test_response_shape(self):
        data = client.get("/").json()
        assert "uuid" in data
        assert "name" in data
        assert "element_count" in data
        assert "relationship_count" in data
        assert "view_count" in data

    def test_model_name_not_empty(self, model_info):
        assert isinstance(model_info["name"], str)
        assert model_info["name"].strip() != ""

    def test_counts_are_positive(self):
        data = client.get("/").json()
        assert data["element_count"] > 0
        assert data["relationship_count"] > 0
        assert data["view_count"] > 0


# ---------------------------------------------------------------------------
# GET /elements/types
# ---------------------------------------------------------------------------

class TestElementTypes:
    def test_status_ok(self):
        r = client.get("/elements/types")
        assert r.status_code == 200

    def test_returns_list_of_strings(self):
        data = client.get("/elements/types").json()
        assert isinstance(data, list)
        assert all(isinstance(t, str) for t in data)

    def test_sorted(self):
        data = client.get("/elements/types").json()
        assert data == sorted(data)

    def test_contains_known_type(self, known_element_type):
        data = client.get("/elements/types").json()
        assert known_element_type in data

    def test_no_duplicates(self):
        data = client.get("/elements/types").json()
        assert len(data) == len(set(data))


# ---------------------------------------------------------------------------
# GET /elements
# ---------------------------------------------------------------------------

class TestListElements:
    def test_status_ok(self):
        r = client.get("/elements")
        assert r.status_code == 200

    def test_returns_all_elements(self):
        data = client.get("/elements").json()
        assert len(data) == len(_model.elements)

    def test_element_shape(self):
        data = client.get("/elements").json()
        e = data[0]
        assert "uuid" in e
        assert "name" in e
        assert "type" in e

    def test_filter_by_type(self, known_element_type):
        data = client.get(f"/elements?type={known_element_type}").json()
        assert len(data) > 0
        assert all(e["type"] == known_element_type for e in data)

    def test_filter_by_type_empty_result(self):
        data = client.get("/elements?type=NonExistentType").json()
        assert data == []

    def test_filter_by_name_case_insensitive(self, known_element_name_fragment):
        if not known_element_name_fragment:
            pytest.skip("Aucun nom d'element exploitable pour ce test.")
        data = client.get(f"/elements?name={known_element_name_fragment}").json()
        assert len(data) > 0
        assert all(known_element_name_fragment in (e.get("name") or "").lower() for e in data)

    def test_filter_by_name_no_result(self):
        data = client.get("/elements?name=xyznotfound123").json()
        assert data == []

    def test_filter_combined(self, known_element_type, known_element_name_fragment):
        if not known_element_name_fragment:
            pytest.skip("Aucun nom d'element exploitable pour ce test.")
        data = client.get(
            f"/elements?type={known_element_type}&name={known_element_name_fragment}"
        ).json()
        assert all(e["type"] == known_element_type for e in data)
        assert all(known_element_name_fragment in (e.get("name") or "").lower() for e in data)


# ---------------------------------------------------------------------------
# GET /elements/{id}
# ---------------------------------------------------------------------------

class TestGetElement:
    def test_known_id_ok(self, known_element):
        r = client.get(f"/elements/{known_element['uuid']}")
        assert r.status_code == 200

    def test_known_id_data(self, known_element):
        data = client.get(f"/elements/{known_element['uuid']}").json()
        assert data["uuid"] == known_element["uuid"]
        assert data["name"] == known_element["name"]
        assert data["type"] == known_element["type"]

    def test_unknown_id_404(self):
        r = client.get(f"/elements/{UNKNOWN_ID}")
        assert r.status_code == 404

    def test_404_message(self):
        r = client.get(f"/elements/{UNKNOWN_ID}")
        assert UNKNOWN_ID in r.json()["detail"]

    def test_element_with_props(self, known_element):
        data = client.get(f"/elements/{known_element['uuid']}").json()
        assert isinstance(data["props"], dict)


# ---------------------------------------------------------------------------
# GET /relationships/types
# ---------------------------------------------------------------------------

class TestRelationshipTypes:
    def test_status_ok(self):
        r = client.get("/relationships/types")
        assert r.status_code == 200

    def test_contains_known_type(self, known_relationship_type):
        data = client.get("/relationships/types").json()
        assert known_relationship_type in data

    def test_sorted(self):
        data = client.get("/relationships/types").json()
        assert data == sorted(data)


# ---------------------------------------------------------------------------
# GET /relationships
# ---------------------------------------------------------------------------

class TestListRelationships:
    def test_status_ok(self):
        r = client.get("/relationships")
        assert r.status_code == 200

    def test_returns_all_relationships(self):
        data = client.get("/relationships").json()
        assert len(data) == len(_model.relationships)

    def test_relationship_shape(self):
        data = client.get("/relationships").json()
        r = data[0]
        assert "uuid" in r
        assert "type" in r
        assert "source_id" in r
        assert "target_id" in r

    def test_filter_by_type(self, known_relationship_type):
        data = client.get(f"/relationships?type={known_relationship_type}").json()
        assert len(data) > 0
        assert all(r["type"] == known_relationship_type for r in data)

    def test_filter_by_source_id(self, known_relationship):
        source_id = known_relationship["source_id"]
        data = client.get(f"/relationships?source_id={source_id}").json()
        assert len(data) > 0
        assert all(r["source_id"] == source_id for r in data)

    def test_filter_by_target_id(self, known_relationship):
        target_id = known_relationship["target_id"]
        data = client.get(f"/relationships?target_id={target_id}").json()
        assert len(data) > 0
        assert all(r["target_id"] == target_id for r in data)

    def test_filter_no_result(self):
        data = client.get(f"/relationships?source_id={UNKNOWN_ID}").json()
        assert data == []

    def test_source_and_target_names_present(self):
        data = client.get("/relationships").json()
        assert all("source_name" in r and "target_name" in r for r in data)


# ---------------------------------------------------------------------------
# GET /relationships/{id}
# ---------------------------------------------------------------------------

class TestGetRelationship:
    def test_known_id_ok(self, known_relationship):
        r = client.get(f"/relationships/{known_relationship['uuid']}")
        assert r.status_code == 200

    def test_known_id_data(self, known_relationship):
        data = client.get(f"/relationships/{known_relationship['uuid']}").json()
        assert data["uuid"] == known_relationship["uuid"]
        assert data["type"] == known_relationship["type"]

    def test_unknown_id_404(self):
        r = client.get(f"/relationships/{UNKNOWN_ID}")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /views
# ---------------------------------------------------------------------------

class TestListViews:
    def test_status_ok(self):
        r = client.get("/views")
        assert r.status_code == 200

    def test_returns_all_views(self):
        data = client.get("/views").json()
        assert len(data) == len(_model.views)

    def test_view_shape(self):
        data = client.get("/views").json()
        v = data[0]
        assert "uuid" in v
        assert "name" in v
        assert "node_count" in v

    def test_node_count_is_int(self):
        data = client.get("/views").json()
        assert all(isinstance(v["node_count"], int) for v in data)

    def test_contains_known_view(self, known_view):
        data = client.get("/views").json()
        ids = [v["uuid"] for v in data]
        assert known_view["uuid"] in ids


# ---------------------------------------------------------------------------
# GET /views/{id}
# ---------------------------------------------------------------------------

class TestGetView:
    def test_known_id_ok(self, known_view):
        r = client.get(f"/views/{known_view['uuid']}")
        assert r.status_code == 200

    def test_known_id_data(self, known_view):
        data = client.get(f"/views/{known_view['uuid']}").json()
        assert data["uuid"] == known_view["uuid"]
        assert data["name"] == known_view["name"]

    def test_nodes_present(self, known_view):
        data = client.get(f"/views/{known_view['uuid']}").json()
        assert "nodes" in data
        assert len(data["nodes"]) == data["node_count"]

    def test_node_shape(self, known_view):
        data = client.get(f"/views/{known_view['uuid']}").json()
        if not data["nodes"]:
            pytest.skip("La vue selectionnee ne contient pas de noeuds.")
        n = data["nodes"][0]
        assert "uuid" in n
        assert "element_id" in n
        assert "x" in n
        assert "y" in n
        assert "w" in n
        assert "h" in n

    def test_node_element_id_references_known_element(self, known_view):
        view_data = client.get(f"/views/{known_view['uuid']}").json()
        elem_ids = {e["uuid"] for e in client.get("/elements").json()}
        referenced_ids = []
        for node in view_data["nodes"]:
            if node["element_id"]:
                assert isinstance(node["element_id"], str)
                referenced_ids.append(node["element_id"])

        # Selon les exports OEFF, certains noeuds de vue peuvent pointer vers des refs
        # non exposees par /elements. On verifie qu'au moins une correspondance existe
        # quand la vue contient des references.
        if referenced_ids:
            assert any(ref_id in elem_ids for ref_id in referenced_ids)

    def test_unknown_id_404(self):
        r = client.get(f"/views/{UNKNOWN_ID}")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# MCP service
# ---------------------------------------------------------------------------

class TestMCPService:
    def test_mcp_service_is_mounted(self):
        with TestClient(app) as mcp_client:
            r = mcp_client.get("/mcp")
            # Le transport streamable-http peut refuser GET, mais l'endpoint ne doit pas etre 404.
            assert r.status_code in {200, 307, 405, 406}

    def test_mcp_service_is_initialized(self):
        with TestClient(app) as mcp_client:
            r = mcp_client.get("/mcp/")
            # Sans header Accept adapte, le transport repond souvent 406; un 500 indique un probleme de lifespan.
            assert r.status_code != 500

    def test_mcp_jsonrpc_initialize_and_list_tools(self):
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }

        with TestClient(app) as mcp_client:
            init_resp = mcp_client.post(
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

            init_data_line = next(
                (line for line in init_resp.text.splitlines() if line.startswith("data: ")),
                None,
            )
            assert init_data_line is not None
            init_payload = json.loads(init_data_line.replace("data: ", "", 1))
            assert init_payload["jsonrpc"] == "2.0"
            assert init_payload["id"] == "init-1"
            assert "result" in init_payload

            tools_resp = mcp_client.post(
                "/mcp/",
                headers={**headers, "mcp-session-id": session_id},
                json={
                    "jsonrpc": "2.0",
                    "id": "tools-1",
                    "method": "tools/list",
                    "params": {},
                },
            )

            assert tools_resp.status_code == 200
            tools_data_line = next(
                (line for line in tools_resp.text.splitlines() if line.startswith("data: ")),
                None,
            )
            assert tools_data_line is not None
            tools_payload = json.loads(tools_data_line.replace("data: ", "", 1))
            assert tools_payload["jsonrpc"] == "2.0"
            assert tools_payload["id"] == "tools-1"
            tools = tools_payload["result"]["tools"]
            assert any(t["name"] == "get_model_info_tool" for t in tools)
