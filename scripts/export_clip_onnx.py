"""
Exports the exact openai/clip-vit-base-patch32 text encoder and tokenizer assets to web/public/models/
for local offline inference.
"""

import sys
import os
import json
from pathlib import Path

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import torch
import torch.nn as nn
import onnx
import onnxruntime as ort
from transformers import CLIPModel, CLIPTokenizer

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "web" / "public" / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_NAME = "openai/clip-vit-base-patch32"


class CLIPTextEncoderWrapper(nn.Module):
    """Isolates the CLIP text model and text projection to output 512-dim features."""
    def __init__(self, clip_model):
        super().__init__()
        self.text_model = clip_model.text_model
        self.text_projection = clip_model.text_projection

    def forward(self, input_ids, attention_mask):
        text_outputs = self.text_model(input_ids=input_ids, attention_mask=attention_mask)
        pooled = text_outputs[1]  # pooled_output
        return self.text_projection(pooled)


def export():
    print(f"Loading {MODEL_NAME}...")
    clip = CLIPModel.from_pretrained(MODEL_NAME)
    tok = CLIPTokenizer.from_pretrained(MODEL_NAME)

    wrapper = CLIPTextEncoderWrapper(clip)
    wrapper.eval()

    # 1. Save Tokenizer Assets
    print("Saving tokenizer assets to web/public/models/...")
    tok.save_vocabulary(str(OUTPUT_DIR))
    
    config_dict = {
        "model_name": MODEL_NAME,
        "max_length": 77,
        "projection_dim": 512,
        "vocab_size": tok.vocab_size,
        "bos_token_id": tok.bos_token_id,
        "eos_token_id": tok.eos_token_id,
        "pad_token_id": tok.pad_token_id,
    }
    with open(OUTPUT_DIR / "config.json", "w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=2)

    # 2. Export ONNX Graph
    raw_onnx_path = OUTPUT_DIR / "temp_raw.onnx"
    final_onnx_path = OUTPUT_DIR / "clip-text-encoder.onnx"

    dummy_input = tok(["a photo of satellite change"], padding="max_length", max_length=77, return_tensors="pt")
    input_ids = dummy_input["input_ids"]
    attention_mask = dummy_input["attention_mask"]

    print("Exporting PyTorch model to ONNX...")
    torch.onnx.export(
        wrapper,
        (input_ids, attention_mask),
        str(raw_onnx_path),
        input_names=["input_ids", "attention_mask"],
        output_names=["text_features"],
        dynamic_axes={
            "input_ids": {0: "batch_size"},
            "attention_mask": {0: "batch_size"},
            "text_features": {0: "batch_size"},
        },
        opset_version=18,
    )

    print("Consolidating into a self-contained ONNX file...")
    onnx_model = onnx.load(str(raw_onnx_path), load_external_data=True)
    onnx.save(onnx_model, str(final_onnx_path), save_as_external_data=False)

    # Clean up temporary split files if generated
    if raw_onnx_path.exists():
        raw_onnx_path.unlink()
    data_file = OUTPUT_DIR / "temp_raw.onnx.data"
    if data_file.exists():
        data_file.unlink()

    file_size_mb = final_onnx_path.stat().st_size / (1024 * 1024)
    print(f"Final ONNX Model saved at: {final_onnx_path} ({file_size_mb:.2f} MB)")

    # 3. Verify Inference & Parity
    print("Verifying ONNX Runtime inference...")
    sess = ort.InferenceSession(str(final_onnx_path))
    ort_outs = sess.run(None, {"input_ids": input_ids.numpy(), "attention_mask": attention_mask.numpy()})
    onnx_feat = ort_outs[0]

    with torch.no_grad():
        pt_feat = wrapper(input_ids, attention_mask).numpy()

    pt_norm = pt_feat / (pt_feat ** 2).sum() ** 0.5
    onnx_norm = onnx_feat / (onnx_feat ** 2).sum() ** 0.5

    cosine = float((pt_norm * onnx_norm).sum())
    max_diff = float(abs(pt_norm - onnx_norm).max())

    print(f"Cosine Similarity (PyTorch vs ONNX): {cosine:.8f}")
    print(f"Max Element Difference:             {max_diff:.8e}")

    assert cosine > 0.99999, f"Cosine similarity {cosine} below 0.99999 threshold"
    print("EXPORT & NUMERICAL VERIFICATION SUCCESSFUL!")


if __name__ == "__main__":
    export()
