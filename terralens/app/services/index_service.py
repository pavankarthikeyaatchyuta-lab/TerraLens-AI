"""Vector index service managing FAISS similarity indexes and metadata mappings."""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import faiss

from terralens.app.utils.config import config

logger = logging.getLogger("terralens.index_service")


class IndexService:
    """Manages creation, validation, loading, and querying of FAISS satellite vector indexes."""

    def __init__(
        self,
        index_path: Optional[Path] = None,
        metadata_path: Optional[Path] = None,
    ):
        self.index_path = Path(index_path or config.FAISS_INDEX_PATH)
        self.metadata_path = Path(metadata_path or config.FAISS_METADATA_PATH)
        self._index: Optional[faiss.IndexFlatIP] = None
        self._metadata: Optional[Dict[str, Any]] = None
        self._records: List[Dict[str, Any]] = []

    @property
    def is_loaded(self) -> bool:
        """Returns True if the FAISS index and metadata are currently loaded in memory."""
        return self._index is not None and self._metadata is not None

    def validate_index_files(self) -> Tuple[bool, str]:
        """Validates index presence, schema integrity, and file references on disk."""
        if not self.index_path.exists():
            return False, f"FAISS index file missing at: {self.index_path}"

        if not self.metadata_path.exists():
            return False, f"Index metadata mapping file missing at: {self.metadata_path}"

        try:
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            return False, f"Corrupted JSON in metadata mapping {self.metadata_path}: {e}"

        expected_count = meta.get("total_vectors", meta.get("total_scenes", 0))
        records = meta.get("records", meta.get("scenes", []))

        if len(records) != expected_count:
            return False, f"Metadata record count ({len(records)}) mismatches total_vectors ({expected_count})"

        # Verify FAISS index can be read
        try:
            idx = faiss.read_index(str(self.index_path))
            if idx.ntotal != expected_count:
                return False, f"FAISS index vector count ({idx.ntotal}) does not match metadata ({expected_count})"
        except Exception as e:
            return False, f"Failed to load FAISS index file: {e}"

        return True, "Index and metadata verified successfully."

    def load(self) -> bool:
        """Loads the FAISS index and metadata mapping from disk."""
        is_valid, msg = self.validate_index_files()
        if not is_valid:
            logger.warning(f"Cannot load index: {msg}")
            return False

        try:
            self._index = faiss.read_index(str(self.index_path))
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self._metadata = json.load(f)
            self._records = self._metadata.get("records", self._metadata.get("scenes", []))
            logger.info(f"Loaded FAISS index with {self._index.ntotal} vectors from {self.index_path}")
            return True
        except Exception as e:
            logger.error(f"Error loading FAISS index: {e}")
            self._index = None
            self._metadata = None
            self._records = []
            return False

    def build_and_save(
        self,
        vectors: np.ndarray,
        records: List[Dict[str, Any]],
        model_name: str,
        dimension: int
    ) -> None:
        """Builds a new IndexFlatIP FAISS index and writes it along with metadata mapping to disk.

        Uses normalized vectors + inner product (IndexFlatIP) to achieve exact cosine similarity.
        """
        vectors = np.asarray(vectors, dtype=np.float32)
        if len(vectors) != len(records):
            raise ValueError(f"Vector count ({len(vectors)}) must match record count ({len(records)})")

        if vectors.shape[1] != dimension:
            raise ValueError(f"Vector dimensionality ({vectors.shape[1]}) does not match model dimension ({dimension})")

        # Create FAISS IndexFlatIP
        idx = faiss.IndexFlatIP(dimension)
        idx.add(vectors)

        # Prepare directories
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)

        # Write FAISS binary
        faiss.write_index(idx, str(self.index_path))

        # Write metadata mapping
        metadata_payload = {
            "model_name": model_name,
            "embedding_dimension": dimension,
            "metric": "cosine_similarity (IndexFlatIP with L2 normalized vectors)",
            "total_vectors": len(records),
            "records": records,
        }
        with open(self.metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata_payload, f, indent=2)

        self._index = idx
        self._metadata = metadata_payload
        self._records = records
        logger.info(f"Saved FAISS index ({len(records)} vectors) to {self.index_path}")

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 5
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Queries the FAISS index with a normalized query vector and returns top_k (record, similarity)."""
        if not self.is_loaded:
            if not self.load():
                return []

        query = np.asarray(query_vector, dtype=np.float32)
        if query.ndim == 1:
            query = np.expand_dims(query, axis=0)

        # Ensure query is L2 normalized
        norm = np.linalg.norm(query)
        if norm > 0:
            query = query / norm

        k = min(top_k, self._index.ntotal)
        if k <= 0:
            return []

        # FAISS search
        similarities, indices = self._index.search(query, k)

        results: List[Tuple[Dict[str, Any], float]] = []
        for rank in range(k):
            idx = int(indices[0][rank])
            sim = float(similarities[0][rank])
            if 0 <= idx < len(self._records):
                record = self._records[idx]
                results.append((record, sim))

        return results

    def get_summary(self) -> Dict[str, Any]:
        """Returns diagnostic status of the vector index."""
        is_valid, msg = self.validate_index_files()
        total_vectors = self._index.ntotal if self._index else (
            self._metadata.get("total_vectors", 0) if self._metadata else 0
        )
        return {
            "is_valid": is_valid,
            "is_loaded": self.is_loaded,
            "validation_message": msg,
            "total_vectors": total_vectors,
            "dimension": self._metadata.get("embedding_dimension") if self._metadata else None,
            "model_name": self._metadata.get("model_name") if self._metadata else None,
            "index_path": str(self.index_path),
            "metadata_path": str(self.metadata_path),
        }
