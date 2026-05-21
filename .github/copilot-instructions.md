---
description: "Global instructions for GitHub Copilot to ensure consistent code generation across the project."
applyTo: "**/*"
---

# Copilot Instructions

## Comment Style

All produced code must contain comments written in **Google Style**:

- **Python**: use Google Style docstrings (`Args:`, `Returns:`, `Raises:`, `Example:`).
- **Functions and classes**: always document with a Google Style docstring.
- **Inline comments**: clear and concise, explaining the *why* rather than the *what*.

### Python Example (Google Style)

```python
def fetch_data(url: str, timeout: int = 30) -> dict:
    """Fetches JSON data from the given URL.

    Args:
        url: The URL to fetch data from.
        timeout: Request timeout in seconds. Defaults to 30.

    Returns:
        A dictionary containing the parsed JSON response.

    Raises:
        ValueError: If the URL is empty.
        requests.HTTPError: If the HTTP request fails.
    """
```
