"""Retrieval service architecture for candidate location discovery."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
from PIL import Image

from terralens.app.models.location import Location
from terralens.app.services.metadata_service import MetadataService


@dataclass
class RetrievalCandidate:
    """Represents a candidate location returned from a search query."""
    location: Location
    engine_name: str
    match_reason: str
    is_exact_match: bool = False
    # Strictly None in Phase 1 to prevent deceptive AI claims
    similarity_score: Optional[float] = None


class BaseRetrievalService(ABC):
    """Abstract interface for location retrieval services."""

    @abstractmethod
    def search(
        self,
        query: str = "",
        reference_image: Optional[Image.Image] = None,
        sensor_filter: Optional[str] = None,
        tag_filter: Optional[str] = None,
        max_cloud: Optional[float] = None
    ) -> List[RetrievalCandidate]:
        """Executes a search over candidate satellite locations."""
        pass


class PrototypeMetadataRetrievalService(BaseRetrievalService):
    """Phase 1 retrieval engine using structured metadata, keyword relevance, and lexical tagging.

    Explicitly non-neural to remain strictly honest until CLIP and FAISS
    vector search indices are integrated in Phase 2.
    """

    def __init__(self, metadata_service: MetadataService):
        self.meta_service = metadata_service
        self.engine_name = "Prototype (Metadata & Lexical)"

    def search(
        self,
        query: str = "",
        reference_image: Optional[Image.Image] = None,
        sensor_filter: Optional[str] = None,
        tag_filter: Optional[str] = None,
        max_cloud: Optional[float] = None
    ) -> List[RetrievalCandidate]:
        """Retrieves and ranks candidate locations matching user filters and search terms."""
        # Start with filtered locations from catalog
        locations = self.meta_service.filter_locations(
            sensor=sensor_filter,
            tag=tag_filter,
            max_cloud=max_cloud
        )

        query_clean = query.strip().lower()
        candidates: List[RetrievalCandidate] = []

        if not query_clean and reference_image is None:
            # Empty search returns all catalogued locations
            for loc in locations:
                candidates.append(
                    RetrievalCandidate(
                        location=loc,
                        engine_name=self.engine_name,
                        match_reason="Catalog exploration (no search filter applied)",
                        is_exact_match=True,
                        similarity_score=None
                    )
                )
            return candidates

        # Keyword matching
        query_terms = [t for t in query_clean.replace(",", " ").split() if len(t) > 2]

        for loc in locations:
            matches: List[str] = []

            # Check tags
            for tag in loc.tags:
                tag_lower = tag.lower()
                if any(term in tag_lower for term in query_terms) or tag_lower in query_clean:
                    matches.append(f"Tag: '{tag}'")

            # Check name and description
            name_lower = loc.name.lower()
            desc_lower = loc.description.lower()
            for term in query_terms:
                if term in name_lower:
                    matches.append(f"Name match: '{term}'")
                elif term in desc_lower:
                    matches.append(f"Context match: '{term}'")

            if reference_image is not None:
                matches.append("Visual Reference: Staged for Phase 2 Vector Embedding")

            if matches or not query_terms:
                reason = ", ".join(matches) if matches else "Location filter matched"
                candidates.append(
                    RetrievalCandidate(
                        location=loc,
                        engine_name=self.engine_name,
                        match_reason=reason,
                        is_exact_match=len(matches) > 0,
                        similarity_score=None  # No fake scores
                    )
                )

        return candidates
