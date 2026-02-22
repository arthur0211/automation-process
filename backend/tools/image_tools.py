"""Image processing utilities for screenshot analysis."""

import base64
from io import BytesIO


def decode_screenshot(data_url: str) -> bytes:
    """Decode a base64 data URL to raw image bytes."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url)


def encode_screenshot(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Encode raw image bytes to a base64 data URL."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"
