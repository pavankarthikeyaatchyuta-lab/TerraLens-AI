"""
Exports BPE merge ranks and vocabulary from tokenizer.json for clean, exact TypeScript CLIP tokenization.
"""

import sys
import json
from pathlib import Path

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "web" / "public" / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

tok_json_path = OUTPUT_DIR / "tokenizer.json"
if not tok_json_path.exists():
    from transformers import CLIPTokenizerFast
    tok = CLIPTokenizerFast.from_pretrained("openai/clip-vit-base-patch32")
    tok.save_pretrained(str(OUTPUT_DIR))

with open(tok_json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

merges = data["model"]["merges"]
vocab = data["model"]["vocab"]

bpe_ranks = {f"{pair[0]} {pair[1]}": i for i, pair in enumerate(merges)}

with open(OUTPUT_DIR / "bpe_ranks.json", "w", encoding="utf-8") as f:
    json.dump(bpe_ranks, f)

with open(OUTPUT_DIR / "vocab.json", "w", encoding="utf-8") as f:
    json.dump(vocab, f)

print(f"Exported {len(bpe_ranks)} BPE ranks to {OUTPUT_DIR / 'bpe_ranks.json'}")
print(f"Exported {len(vocab)} vocab items to {OUTPUT_DIR / 'vocab.json'}")
