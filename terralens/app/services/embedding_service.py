"""Embedding service abstraction and CLIP model implementation for multi-modal satellite search."""

import os
from abc import ABC, abstractmethod
import hashlib
import logging
from typing import List, Union, Optional, Any
import numpy as np
from PIL import Image

os.environ.setdefault("HF_HUB_DISABLE_DISK_INTEGRITY_CHECK", "1")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

from terralens.app.utils.config import config

logger = logging.getLogger("terralens.embedding_service")


class BaseEmbeddingModel(ABC):
    """Abstract vision-language embedding model interface."""

    def __init__(self, model_name: str, model_label: str = "CLIP baseline"):
        self.model_name = model_name
        self.model_label = model_label

    @abstractmethod
    def embed_text(self, text: Union[str, List[str]]) -> np.ndarray:
        """Computes L2-normalized float32 embedding vector(s) for input text."""
        pass

    @abstractmethod
    def embed_image(self, image: Union[Image.Image, List[Image.Image]]) -> np.ndarray:
        """Computes L2-normalized float32 embedding vector(s) for input image(s)."""
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        """Returns the vector dimensionality of this embedding model."""
        pass

    @staticmethod
    def normalize_vectors(vectors: np.ndarray) -> np.ndarray:
        """Ensures vectors have unit L2 norm so inner product equals cosine similarity."""
        vectors = np.asarray(vectors, dtype=np.float32)
        if vectors.ndim == 1:
            norm = np.linalg.norm(vectors)
            return vectors / (norm + 1e-12)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / np.maximum(norms, 1e-12)


class CLIPEmbeddingModel(BaseEmbeddingModel):
    """Vision-language embedding model powered by OpenAI's CLIP architecture.

    Clearly labelled as 'CLIP baseline' to remain technically honest,
    as this general foundation model has not yet undergone remote-sensing specific fine-tuning.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        model_label: str = "CLIP baseline",
        device: Optional[str] = None
    ):
        super().__init__(model_name=model_name or config.EMBEDDING_MODEL_NAME, model_label=model_label)
        self.device = device or config.DEVICE
        self._model = None
        self._tokenizer = None
        self._image_processor = None
        self._dim = 512
        self._initialized = False
        self.cold_start_time_ms: Optional[float] = None

    def _ensure_loaded(self) -> None:
        """Lazily loads weights, tokenizer, and image processor into memory."""
        if self._initialized:
            return

        import time
        import torch
        from transformers import CLIPModel, CLIPTokenizer, CLIPImageProcessor

        t0 = time.perf_counter()
        logger.info(f"Loading {self.model_label} ({self.model_name}) on device '{self.device}'...")
        try:
            # Try loading with local_files_only first for maximum speed
            try:
                self._model = CLIPModel.from_pretrained(self.model_name, local_files_only=True)
                self._tokenizer = CLIPTokenizer.from_pretrained(self.model_name, local_files_only=True)
                self._image_processor = CLIPImageProcessor.from_pretrained(self.model_name, local_files_only=True)
            except Exception:
                # Fallback to standard from_pretrained
                self._model = CLIPModel.from_pretrained(self.model_name)
                self._tokenizer = CLIPTokenizer.from_pretrained(self.model_name)
                self._image_processor = CLIPImageProcessor.from_pretrained(self.model_name)

            self._model.to(self.device)
            self._model.eval()
            self._dim = getattr(self._model, "projection_dim", 512)
            self.cold_start_time_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            self._initialized = True
            logger.info(f"Successfully loaded {self.model_label} with dimension {self._dim} in {self.cold_start_time_ms:.1f}ms.")
        except Exception as e:
            logger.error(f"Failed to load CLIP embedding model {self.model_name}: {e}")
            raise RuntimeError(
                f"Failed to initialize CLIP embedding model '{self.model_name}'. "
                f"Ensure 'transformers', 'torch', and model weights are accessible. Root error: {e}"
            ) from e

    def get_dimension(self) -> int:
        self._ensure_loaded()
        return self._dim

    @staticmethod
    def _extract_tensor(features: Any):
        """Extracts the underlying torch.Tensor from transformers 5.0 output structures."""
        if hasattr(features, "pooler_output") and features.pooler_output is not None:
            return features.pooler_output
        if isinstance(features, (tuple, list)):
            return features[0]
        return features

    def embed_text(self, text: Union[str, List[str]]) -> np.ndarray:
        self._ensure_loaded()
        import torch

        if isinstance(text, str):
            text_inputs = [text]
            single_input = True
        else:
            text_inputs = text
            single_input = False

        with torch.no_grad():
            inputs = self._tokenizer(
                text_inputs,
                padding=True,
                truncation=True,
                max_length=77,
                return_tensors="pt"
            ).to(self.device)
            text_output = self._model.get_text_features(**inputs)
            tensor = self._extract_tensor(text_output)
            embeddings = tensor.cpu().numpy()

        normalized = self.normalize_vectors(embeddings)
        return normalized[0] if single_input else normalized

    def embed_image(self, image: Union[Image.Image, List[Image.Image]]) -> np.ndarray:
        self._ensure_loaded()
        import torch

        if isinstance(image, Image.Image):
            image_inputs = [image.convert("RGB")]
            single_input = True
        else:
            image_inputs = [img.convert("RGB") for img in image]
            single_input = False

        with torch.no_grad():
            inputs = self._image_processor(images=image_inputs, return_tensors="pt").to(self.device)
            image_output = self._model.get_image_features(**inputs)
            tensor = self._extract_tensor(image_output)
            embeddings = tensor.cpu().numpy()

        normalized = self.normalize_vectors(embeddings)
        return normalized[0] if single_input else normalized


class MockEmbeddingModel(BaseEmbeddingModel):
    """Deterministic mock embedding model for instant, offline unit tests without weight downloading."""

    def __init__(self, dimension: int = 512, model_label: str = "Mock Embedding Model"):
        super().__init__(model_name="mock-model", model_label=model_label)
        self.dimension = dimension

    def get_dimension(self) -> int:
        return self.dimension

    def _hash_to_vector(self, seed_str: str) -> np.ndarray:
        hasher = hashlib.sha256(seed_str.encode("utf-8"))
        digest = hasher.digest()
        # Seed local RNG deterministically
        seed = int.from_bytes(digest[:4], "big")
        rng = np.random.RandomState(seed)
        vec = rng.randn(self.dimension).astype(np.float32)
        return self.normalize_vectors(vec)

    def embed_text(self, text: Union[str, List[str]]) -> np.ndarray:
        if isinstance(text, str):
            return self._hash_to_vector(f"txt_{text.strip().lower()}")
        return np.array([self._hash_to_vector(f"txt_{t.strip().lower()}") for t in text], dtype=np.float32)

    def embed_image(self, image: Union[Image.Image, List[Image.Image]]) -> np.ndarray:
        if isinstance(image, Image.Image):
            seed = f"img_{image.size}_{image.mode}_{image.getpixel((0,0))}"
            return self._hash_to_vector(seed)
        res = [self._hash_to_vector(f"img_{img.size}_{img.mode}_{img.getpixel((0,0))}") for img in image]
        return np.array(res, dtype=np.float32)


# Global cached singleton instance
_GLOBAL_MODEL: Optional[BaseEmbeddingModel] = None


def get_embedding_model(use_mock: bool = False) -> BaseEmbeddingModel:
    """Returns the singleton embedding model instance."""
    global _GLOBAL_MODEL
    if _GLOBAL_MODEL is not None:
        if use_mock and not isinstance(_GLOBAL_MODEL, MockEmbeddingModel):
            return MockEmbeddingModel()
        return _GLOBAL_MODEL

    if use_mock:
        _GLOBAL_MODEL = MockEmbeddingModel()
    else:
        _GLOBAL_MODEL = CLIPEmbeddingModel()

    return _GLOBAL_MODEL
