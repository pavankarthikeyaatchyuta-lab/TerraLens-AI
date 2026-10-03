"""
Encodes arbitrary text into a 512-dimensional L2-normalized CLIP embedding vector.
Used as the verified local server/Python tier for TerraLens AI.
"""

import sys
import json
import argparse
import re
from pathlib import Path
import numpy as np

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "web" / "public" / "models"

_BPE_RANKS = None
_VOCAB = None
_SESSION = None

def get_pairs(word):
    pairs = set()
    prev_char = word[0]
    for char in word[1:]:
        pairs.add((prev_char, char))
        prev_char = char
    return pairs

def bpe(token, bpe_ranks):
    word = tuple(token[:-1]) + (token[-1] + '</w>',)
    pairs = get_pairs(word)
    if not pairs:
        return [token + '</w>']
    while True:
        min_pair = None
        min_rank = float('inf')
        for pair in pairs:
            key = f"{pair[0]} {pair[1]}"
            rank = bpe_ranks.get(key, float('inf'))
            if rank < min_rank:
                min_rank = rank
                min_pair = pair
        if min_pair is None or min_rank == float('inf'):
            break
        first, second = min_pair
        new_word = []
        i = 0
        while i < len(word):
            try:
                j = word.index(first, i)
                new_word.extend(word[i:j])
                i = j
            except ValueError:
                new_word.extend(word[i:])
                break
            if i < len(word) - 1 and word[i] == first and word[i+1] == second:
                new_word.append(first + second)
                i += 2
            else:
                new_word.append(word[i])
                i += 1
        word = tuple(new_word)
        if len(word) == 1:
            break
        pairs = get_pairs(word)
    return list(word)

_PAT = re.compile(r"""<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[a-zA-Z]+|[0-9]|[^\s0-9a-zA-Z]+""", re.IGNORECASE)

def init_assets():
    global _BPE_RANKS, _VOCAB, _SESSION
    if _BPE_RANKS is None:
        with open(MODELS_DIR / "bpe_ranks.json", "r", encoding="utf-8") as f:
            _BPE_RANKS = json.load(f)
    if _VOCAB is None:
        with open(MODELS_DIR / "vocab.json", "r", encoding="utf-8") as f:
            _VOCAB = json.load(f)
    if _SESSION is None:
        import onnxruntime as ort
        _SESSION = ort.InferenceSession(str(MODELS_DIR / "clip-text-encoder.onnx"), providers=["CPUExecutionProvider"])

def tokenize(text: str):
    init_assets()
    clean_q = re.sub(r"\s+", " ", text.strip().lower())
    words = _PAT.findall(clean_q)
    tokens = [49406]  # <|startoftext|>
    for w in words:
        for piece in bpe(w, _BPE_RANKS):
            if piece in _VOCAB:
                tokens.append(_VOCAB[piece])
    tokens.append(49407)  # <|endoftext|>
    tokens = tokens[:77]
    real_len = len(tokens)
    mask = [1] * real_len + [0] * (77 - real_len)
    tokens = tokens + [49407] * (77 - real_len)
    return np.array([tokens], dtype=np.int64), np.array([mask], dtype=np.int64)

def encode_text(query: str):
    init_assets()
    input_ids, attention_mask = tokenize(query)
    out = _SESSION.run(["text_features"], {"input_ids": input_ids, "attention_mask": attention_mask})[0][0]
    norm = np.linalg.norm(out)
    if norm > 0:
        out = out / norm
    return [float(x) for x in out]

def main():
    parser = argparse.ArgumentParser(description="Encode arbitrary text to 512-dim CLIP embedding")
    parser.add_argument("query", nargs="?", default="", help="Query string")
    parser.add_argument("--json", action="store_true", help="Output pure JSON")
    args = parser.parse_args()

    q = args.query.strip()
    if not q:
        # Check stdin
        q = sys.stdin.read().strip()
    if not q:
        print(json.dumps({"error": "No query provided"}), file=sys.stderr)
        sys.exit(1)

    vec = encode_text(q)
    result = {
        "query": q,
        "dimension": len(vec),
        "vector": vec
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
