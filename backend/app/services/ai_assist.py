"""Replaceable, assistive-only OCR/detection interface."""
from dataclasses import dataclass

@dataclass(frozen=True)
class ExtractionResult:
    serial_number: str | None
    model: str | None
    manufacturer: str | None
    confidence: float
    provider: str = "demo-placeholder"

class InstrumentAiAssistant:
    def extract(self, _: bytes) -> ExtractionResult:
        """Production can replace this with YOLO/PaddleOCR; it never approves a record."""
        return ExtractionResult(None, None, None, 0.0)
