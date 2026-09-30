"""Configuration and environment management for TerraLens AI."""

import os
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

# Find project root directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


@dataclass(frozen=True)
class AppConfig:
    """Application configuration container."""

    # Project directories
    PROJECT_ROOT: Path = BASE_DIR
    DATA_DIR: Path = BASE_DIR / os.getenv("TERRALENS_DATA_DIR", "data")
    METADATA_PATH: Path = BASE_DIR / os.getenv("TERRALENS_METADATA_PATH", "data/metadata/locations.json")
    SAMPLES_DIR: Path = BASE_DIR / "data/samples"
    INDEX_DIR: Path = BASE_DIR / os.getenv("TERRALENS_INDEX_DIR", "indexes")

    # Branding & Operational Mode
    APP_NAME: str = "TerraLens AI"
    APP_TAGLINE: str = "Semantic Satellite Intelligence"
    APP_SUBHEADING: str = "Semantic Retrieval + Multi-Temporal Change Analysis"
    SYSTEM_MODE: str = "LOCAL PROTOTYPE"
    DATASET_LABEL: str = os.getenv("TERRALENS_DATASET_NAME", "Prototype Dataset (SIH-2026 Sandbox)")
    PROBLEM_STATEMENT: str = "SIH26227 - Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery"

    # Runtime Flags
    DEBUG: bool = os.getenv("TERRALENS_DEBUG", "true").lower() in ("1", "true", "yes")
    LOG_LEVEL: str = os.getenv("TERRALENS_LOG_LEVEL", "INFO")
    STRICT_METADATA: bool = os.getenv("TERRALENS_STRICT_METADATA", "true").lower() in ("1", "true", "yes")

    # Semantic Retrieval & Vector Index (Phase 2)
    EMBEDDING_MODEL_NAME: str = os.getenv("TERRALENS_EMBEDDING_MODEL", "openai/clip-vit-base-patch32")
    EMBEDDING_MODEL_LABEL: str = "CLIP baseline"
    DEVICE: str = os.getenv("TERRALENS_DEVICE", "cpu")
    FAISS_INDEX_PATH: Path = BASE_DIR / os.getenv("TERRALENS_FAISS_INDEX_PATH", "indexes/satellite_embeddings.index")
    FAISS_METADATA_PATH: Path = BASE_DIR / os.getenv("TERRALENS_FAISS_METADATA_PATH", "indexes/satellite_embeddings_metadata.json")


# Global singleton config
config = AppConfig()
