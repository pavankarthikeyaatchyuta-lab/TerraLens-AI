"""Retrieval service architecture for candidate location discovery via semantic embeddings and FAISS."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
import logging
from typing import List, Optional, Tuple, Dict, Any
from PIL import Image

from terralens.app.models.location import Location
from terralens.app.models.scene import Scene
from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.embedding_service import BaseEmbeddingModel, get_embedding_model
from terralens.app.services.index_service import IndexService
from terralens.app.utils.image_utils import load_image_safely

logger = logging.getLogger("terralens.retrieval_service")


@dataclass
class RetrievalCandidate:
    """Represents a candidate location returned from a search query."""
    location: Location
    engine_name: str
    match_reason: str
    is_exact_match: bool = False
    similarity_score: Optional[float] = None
    similarity_label: str = "Semantic Similarity"
    matched_scene_id: Optional[str] = None
    matched_date: Optional[str] = None


class BaseRetrievalService(ABC):
    """Abstract interface for location retrieval services."""

    @abstractmethod
    def search(
        self,
        query: str = "",
        reference_image: Optional[Image.Image] = None,
        sensor_filter: Optional[str] = None,
        tag_filter: Optional[str] = None,
        max_cloud: Optional[float] = None,
        top_k: int = 5,
    ) -> List[RetrievalCandidate]:
        """Executes a search over candidate satellite locations."""
        pass

    @abstractmethod
    def find_similar_locations(
        self,
        target_location_id: str,
        scene_type: str = "after",
        top_k: int = 4
    ) -> List[RetrievalCandidate]:
        """Discovers similar indexed satellite locations given a target scene."""
        pass


class PrototypeMetadataRetrievalService(BaseRetrievalService):
    """Phase 1 fallback retrieval engine using structured metadata, keyword relevance, and lexical tagging."""

    def __init__(self, metadata_service: MetadataService):
        self.meta_service = metadata_service
        self.engine_name = "Prototype (Metadata & Lexical)"

    def search(
        self,
        query: str = "",
        reference_image: Optional[Image.Image] = None,
        sensor_filter: Optional[str] = None,
        tag_filter: Optional[str] = None,
        max_cloud: Optional[float] = None,
        top_k: int = 5,
    ) -> List[RetrievalCandidate]:
        """Retrieves and ranks candidate locations matching user filters and search terms."""
        locations = self.meta_service.filter_locations(
            sensor=sensor_filter,
            tag=tag_filter,
            max_cloud=max_cloud
        )

        query_clean = query.strip().lower()
        candidates: List[RetrievalCandidate] = []

        if not query_clean and reference_image is None:
            for loc in locations:
                candidates.append(
                    RetrievalCandidate(
                        location=loc,
                        engine_name=self.engine_name,
                        match_reason="Catalog exploration (no search filter applied)",
                        is_exact_match=True,
                        similarity_score=None,
                        similarity_label="Metadata Match",
                    )
                )
            return candidates[:top_k]

        query_terms = [t for t in query_clean.replace(",", " ").split() if len(t) > 2]

        for loc in locations:
            matches: List[str] = []

            for tag in loc.tags:
                tag_lower = tag.lower()
                if any(term in tag_lower for term in query_terms) or tag_lower in query_clean:
                    matches.append(f"Tag: '{tag}'")

            name_lower = loc.name.lower()
            desc_lower = loc.description.lower()
            for term in query_terms:
                if term in name_lower:
                    matches.append(f"Name: '{term}'")
                elif term in desc_lower:
                    matches.append(f"Context: '{term}'")

            if reference_image is not None:
                matches.append("Visual Reference: Metadata fallback active")

            if matches or not query_terms:
                reason = ", ".join(matches) if matches else "Location filter matched"
                candidates.append(
                    RetrievalCandidate(
                        location=loc,
                        engine_name=self.engine_name,
                        match_reason=reason,
                        is_exact_match=len(matches) > 0,
                        similarity_score=None,
                        similarity_label="Metadata Match",
                    )
                )

        return candidates[:top_k]

    def find_similar_locations(
        self,
        target_location_id: str,
        scene_type: str = "after",
        top_k: int = 4
    ) -> List[RetrievalCandidate]:
        target = self.meta_service.get_location_by_id(target_location_id)
        if not target:
            return []

        all_locs = [l for l in self.meta_service.get_all_locations() if l.location_id != target_location_id]
        results = []
        target_tags = set(t.lower() for t in target.tags)

        for loc in all_locs:
            shared = target_tags.intersection(set(t.lower() for t in loc.tags))
            if shared:
                results.append(
                    RetrievalCandidate(
                        location=loc,
                        engine_name=self.engine_name,
                        match_reason=f"Shared tags: {', '.join(shared)}",
                        is_exact_match=False,
                        similarity_score=None,
                        similarity_label="Metadata Similarity",
                    )
                )

        return results[:top_k]


class SemanticEmbeddingRetrievalService(BaseRetrievalService):
    """Phase 2 Semantic Retrieval Engine combining CLIP multi-modal embeddings and FAISS IndexFlatIP.

    Supports:
    1. Text queries (natural language description -> CLIP text encoder -> FAISS).
    2. Image queries (reference satellite patch -> CLIP vision encoder -> FAISS).
    3. Similar location discovery (selected satellite tile -> CLIP vision encoder -> FAISS nearest neighbors).
    4. Resilient fallback to PrototypeMetadataRetrievalService if index or model is uninitialized.
    """

    def __init__(
        self,
        metadata_service: MetadataService,
        dataset_service: DatasetService,
        index_service: Optional[IndexService] = None,
        embedding_model: Optional[BaseEmbeddingModel] = None,
    ):
        self.meta_service = metadata_service
        self.dataset_service = dataset_service
        self.index_service = index_service or IndexService()
        self.embedding_model = embedding_model or get_embedding_model()
        self.fallback_engine = PrototypeMetadataRetrievalService(metadata_service)
        self.engine_name = "Semantic Vector Search (CLIP baseline + FAISS)"

    def is_operational(self) -> Tuple[bool, str]:
        """Verifies if the semantic index and model are ready for live vector search."""
        is_valid, msg = self.index_service.validate_index_files()
        if not is_valid:
            return False, f"FAISS Index invalid or missing: {msg}"
        return True, "Ready"

    def search(
        self,
        query: str = "",
        reference_image: Optional[Image.Image] = None,
        sensor_filter: Optional[str] = None,
        tag_filter: Optional[str] = None,
        max_cloud: Optional[float] = None,
        top_k: int = 5,
    ) -> List[RetrievalCandidate]:
        """Performs vector similarity search using text query or uploaded reference image."""
        is_ready, reason = self.is_operational()
        if not is_ready:
            logger.warning(f"Semantic search falling back to metadata: {reason}")
            results = self.fallback_engine.search(
                query=query,
                reference_image=reference_image,
                sensor_filter=sensor_filter,
                tag_filter=tag_filter,
                max_cloud=max_cloud,
                top_k=top_k,
            )
            for r in results:
                r.match_reason += f" (Semantic Index not ready: {reason})"
            return results

        # If query is completely empty and no image provided, return catalog exploration
        if not query.strip() and reference_image is None:
            return self.fallback_engine.search(
                query="",
                sensor_filter=sensor_filter,
                tag_filter=tag_filter,
                max_cloud=max_cloud,
                top_k=top_k,
            )

        # 1. Compute query vector
        if reference_image is not None:
            query_vector = self.embedding_model.embed_image(reference_image)
            sim_label = "Visual Semantic Similarity"
            base_reason = "Image-to-image semantic vector match"
        else:
            query_vector = self.embedding_model.embed_text(query)
            sim_label = "Semantic Similarity"
            base_reason = f"Cross-modal text-image vector match for '{query.strip()}'"

        # 2. Query FAISS index for candidate scenes
        # Retrieve more candidates to allow downstream metadata filtering
        raw_results = self.index_service.search(query_vector=query_vector, top_k=20)

        # 3. Aggregate and deduplicate scenes by location (keep highest similarity scene per location)
        best_location_matches: Dict[str, Tuple[Dict[str, Any], float]] = {}
        for record, sim_score in raw_results:
            loc_id = record["location_id"]
            if loc_id not in best_location_matches or sim_score > best_location_matches[loc_id][1]:
                best_location_matches[loc_id] = (record, sim_score)

        # 4. Filter and rank locations
        candidates: List[RetrievalCandidate] = []
        # Sort locations by highest similarity descending
        sorted_loc_ids = sorted(
            best_location_matches.keys(),
            key=lambda lid: best_location_matches[lid][1],
            reverse=True
        )

        for loc_id in sorted_loc_ids:
            record, sim_score = best_location_matches[loc_id]
            loc = self.meta_service.get_location_by_id(loc_id)
            if not loc:
                continue

            # Apply metadata filters
            if sensor_filter and sensor_filter != "All Sensors" and loc.primary_sensor != sensor_filter:
                continue
            if tag_filter and tag_filter != "All Tags" and tag_filter.lower() not in [t.lower() for t in loc.tags]:
                continue
            if max_cloud is not None:
                sc = self.meta_service.get_scene_by_id(record.get("scene_id", ""))
                if sc and sc.cloud_percentage is not None and sc.cloud_percentage > max_cloud:
                    continue

            candidates.append(
                RetrievalCandidate(
                    location=loc,
                    engine_name=self.engine_name,
                    match_reason=f"{base_reason} (Scene: {record.get('scene_id', 'N/A')})",
                    is_exact_match=True,
                    similarity_score=round(float(sim_score), 4),
                    similarity_label=sim_label,
                    matched_scene_id=record.get("scene_id"),
                    matched_date=record.get("acquisition_date"),
                )
            )

            if len(candidates) >= top_k:
                break

        return candidates

    def find_similar_locations(
        self,
        target_location_id: str,
        scene_type: str = "after",
        top_k: int = 4
    ) -> List[RetrievalCandidate]:
        """Discovers visually/semantically similar satellite locations using a source scene embedding."""
        is_ready, reason = self.is_operational()
        if not is_ready:
            return self.fallback_engine.find_similar_locations(target_location_id, scene_type, top_k)

        target_loc = self.meta_service.get_location_by_id(target_location_id)
        if not target_loc:
            return []

        # Find target scene image path
        paths = self.dataset_service.get_location_imagery_paths(target_loc)
        target_path = paths.get(scene_type) or paths.get("after") or paths.get("before")

        if not target_path or not target_path.exists():
            logger.warning(f"Cannot find source image for {target_location_id}")
            return self.fallback_engine.find_similar_locations(target_location_id, scene_type, top_k)

        target_img = load_image_safely(target_path)
        if target_img is None:
            return self.fallback_engine.find_similar_locations(target_location_id, scene_type, top_k)

        # Compute embedding for target image
        target_vector = self.embedding_model.embed_image(target_img)

        # Search FAISS
        raw_results = self.index_service.search(query_vector=target_vector, top_k=20)

        # Filter out self (same location) and deduplicate
        best_matches: Dict[str, Tuple[Dict[str, Any], float]] = {}
        for record, sim_score in raw_results:
            loc_id = record["location_id"]
            if loc_id == target_location_id:
                continue  # Exclude target itself
            if loc_id not in best_matches or sim_score > best_matches[loc_id][1]:
                best_matches[loc_id] = (record, sim_score)

        sorted_loc_ids = sorted(best_matches.keys(), key=lambda lid: best_matches[lid][1], reverse=True)

        candidates: List[RetrievalCandidate] = []
        for loc_id in sorted_loc_ids:
            record, sim_score = best_matches[loc_id]
            loc = self.meta_service.get_location_by_id(loc_id)
            if not loc:
                continue

            candidates.append(
                RetrievalCandidate(
                    location=loc,
                    engine_name=self.engine_name,
                    match_reason=f"Visual similarity to {target_loc.name} ({record.get('scene_id')})",
                    is_exact_match=False,
                    similarity_score=round(float(sim_score), 4),
                    similarity_label="Semantic Similarity",
                    matched_scene_id=record.get("scene_id"),
                    matched_date=record.get("acquisition_date"),
                )
            )

            if len(candidates) >= top_k:
                break

        return candidates
