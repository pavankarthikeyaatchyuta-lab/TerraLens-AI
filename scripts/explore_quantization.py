"""
Exploration script to test different quantization schemes for clip-text-encoder.onnx
and measure cosine similarity and max element difference against FP32.
"""

import sys
import json
import time
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FP32_MODEL = ROOT / "web" / "public" / "models" / "clip-text-encoder.onnx"
OUTPUT_DIR = ROOT / "scratch"
OUTPUT_DIR.mkdir(exist_ok=True)

from scripts.encode_query import init_assets, tokenize

test_queries = [
    "urban expansion and new construction near river",
    "water reservoir shoreline drying and lake shrinkage",
    "forest road clearing corridor and tree removal",
    "coastal port reclamation and ocean harbor pier",
    "solar panel farm photovoltaic arrays in desert terrain",
    "flooded farmland near a river",
    "new construction around an urban area",
    "large vehicle concentrations on open ground",
    "road expansion near agricultural land",
    "shrinking water bodies",
]

# Run FP32 baseline
fp32_sess = ort.InferenceSession(str(FP32_MODEL), providers=["CPUExecutionProvider"])

fp32_vectors = {}
for q in test_queries:
    ids, mask = tokenize(q)
    out = fp32_sess.run(["text_features"], {"input_ids": ids, "attention_mask": mask})[0][0]
    out = out / np.linalg.norm(out)
    fp32_vectors[q] = out

def evaluate_model(model_path, label):
    size_mb = Path(model_path).stat().st_size / (1024 * 1024)
    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    cos_sims = []
    max_diffs = []
    t0 = time.time()
    for q in test_queries:
        ids, mask = tokenize(q)
        out = sess.run(["text_features"], {"input_ids": ids, "attention_mask": mask})[0][0]
        out = out / np.linalg.norm(out)
        cos = np.dot(out, fp32_vectors[q])
        diff = np.max(np.abs(out - fp32_vectors[q]))
        cos_sims.append(cos)
        max_diffs.append(diff)
    total_time = (time.time() - t0) * 1000
    avg_cos = np.mean(cos_sims)
    min_cos = np.min(cos_sims)
    max_diff = np.max(max_diffs)
    print(f"[{label}] Size: {size_mb:.2f} MB | Avg Cos: {avg_cos:.6f} | Min Cos: {min_cos:.6f} | Max Diff: {max_diff:.6f} | Latency: {total_time/len(test_queries):.1f}ms/q")
    return avg_cos, min_cos, size_mb

print("Baseline FP32 evaluated.")

# Experiment 1: Standard dynamic QInt8
p1 = OUTPUT_DIR / "clip_qint8_std.onnx"
if not p1.exists():
    quantize_dynamic(str(FP32_MODEL), str(p1), weight_type=QuantType.QInt8)
evaluate_model(p1, "Exp 1: QInt8 Standard")

# Experiment 2: QInt8 per_channel=True
p2 = OUTPUT_DIR / "clip_qint8_per_channel.onnx"
if not p2.exists():
    quantize_dynamic(str(FP32_MODEL), str(p2), weight_type=QuantType.QInt8, per_channel=True)
evaluate_model(p2, "Exp 2: QInt8 per_channel=True")

# Experiment 3: QUInt8 per_channel=True
p3 = OUTPUT_DIR / "clip_quint8_per_channel.onnx"
if not p3.exists():
    quantize_dynamic(str(FP32_MODEL), str(p3), weight_type=QuantType.QUInt8, per_channel=True)
evaluate_model(p3, "Exp 3: QUInt8 per_channel=True")

# Experiment 4: Exclude text_projection and LayerNorm
# Let's see what node names exist
model_proto = onnx.load(str(FP32_MODEL))
all_node_names = [n.name for n in model_proto.graph.node]
projection_nodes = [n for n in all_node_names if "projection" in n.lower() or "layernorm" in n.lower() or "final" in n.lower()]
print(f"Found {len(projection_nodes)} projection/norm nodes: {projection_nodes[:5]}")

p4 = OUTPUT_DIR / "clip_qint8_selective.onnx"
if not p4.exists():
    quantize_dynamic(
        str(FP32_MODEL),
        str(p4),
        weight_type=QuantType.QInt8,
        per_channel=True,
        nodes_to_exclude=projection_nodes
    )
evaluate_model(p4, "Exp 4: QInt8 Selective (exclude projection/LN)")
