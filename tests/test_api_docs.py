from fastapi.testclient import TestClient

from backend.api_server import app


def test_swagger_and_openapi_are_served():
    with TestClient(app) as client:
        docs_response = client.get("/docs")
        assert docs_response.status_code == 200
        assert "Swagger UI" in docs_response.text

        openapi_response = client.get("/openapi.json")
        assert openapi_response.status_code == 200
        payload = openapi_response.json()
        assert payload["info"]["title"] == "MAET Terminal API"
