"""Services package for TerraLens AI."""

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.embedding_service import (
    BaseEmbeddingModel,
    CLIPEmbeddingModel,
    MockEmbeddingModel,
    get_embedding_model,
)
from terralens.app.services.index_service import IndexService
from terralens.app.services.retrieval_service import (
    BaseRetrievalService,
    PrototypeMetadataRetrievalService,
    SemanticEmbeddingRetrievalService,
    RetrievalCandidate,
)
from terralens.app.services.temporal_service import (
    TemporalAnalysisService,
    TemporalPair,
    ChangeAnalysisResult,
)
from terralens.app.services.provenance_service import ProvenanceService

__all__ = [
    "MetadataService",
    "DatasetService",
    "BaseEmbeddingModel",
    "CLIPEmbeddingModel",
    "MockEmbeddingModel",
    "get_embedding_model",
    "IndexService",
    "BaseRetrievalService",
    "PrototypeMetadataRetrievalService",
    "SemanticEmbeddingRetrievalService",
    "RetrievalCandidate",
    "TemporalAnalysisService",
    "TemporalPair",
    "ChangeAnalysisResult",
    "ProvenanceService",
]
