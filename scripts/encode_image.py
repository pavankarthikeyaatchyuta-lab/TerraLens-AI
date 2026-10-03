"""
Encodes an input image into a 512-dimensional L2-normalized CLIP embedding vector.
Reuses terralens.app.services.embedding_service.get_embedding_model().
Smart India Hackathon 2026 - Problem Statement SIH26227
"""

import sys
import json
import base64
import io
import argparse
from pathlib import Path
from PIL import Image
import numpy as np

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from terralens.app.services.embedding_service import get_embedding_model


def encode_image_from_bytes(image_bytes: bytes) -> list[float]:
    """Encodes raw image bytes into a 512-D L2-normalized vector using CLIP."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model = get_embedding_model()
    vec = model.embed_image(img)
    vec = np.asarray(vec, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return [float(x) for x in vec]


def main():
    parser = argparse.ArgumentParser(description="Encode image to 512-dim CLIP embedding")
    parser.add_argument("--file", help="Path to image file")
    parser.add_argument("--base64", help="Base64 encoded image string")
    parser.add_argument("--scene-id", help="Scene ID to look up from catalog directly")
    args = parser.parse_args()

    # 1. Direct Scene ID lookup if requested
    if args.scene_id:
        for fname in ["eo_catalog_embeddings.json", "scene_embeddings.json"]:
            catalog_path = ROOT / "web" / "public" / "data" / fname
            if catalog_path.exists():
                with open(catalog_path, "r", encoding="utf-8") as f:
                    cat = json.load(f)
                for sc in cat.get("scenes", []):
                    if sc.get("scene_id") == args.scene_id:
                        print(json.dumps({"dimension": 512, "vector": sc["vector"], "source": "catalog_lookup"}))
                        return

    # 2. File path
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(json.dumps({"error": f"Image file not found: {args.file}"}), file=sys.stderr)
            sys.exit(1)
        with open(file_path, "rb") as f:
            raw_bytes = f.read()
        vec = encode_image_from_bytes(raw_bytes)
        print(json.dumps({"dimension": len(vec), "vector": vec, "source": "clip_image_encoder"}))
        return

    # 3. Base64 argument
    b64_str = args.base64
    if not b64_str and not sys.stdin.isatty():
        b64_str = sys.stdin.read().strip()

    if b64_str:
        # Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        try:
            raw_bytes = base64.b64decode(b64_str)
            vec = encode_image_from_bytes(raw_bytes)
            print(json.dumps({"dimension": len(vec), "vector": vec, "source": "clip_image_encoder"}))
            return
        except Exception as e:
            print(json.dumps({"error": f"Failed to decode or embed base64 image: {e}"}), file=sys.stderr)
            sys.exit(1)

    print(json.dumps({"error": "Provide --file, --base64, --scene-id, or stdin base64"}), file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
