import json
import re
from transformers import CLIPTokenizer

tok = CLIPTokenizer.from_pretrained("openai/clip-vit-base-patch32")
with open("web/public/models/bpe_ranks.json", "r", encoding="utf-8") as f:
    bpe_ranks = json.load(f)
with open("web/public/models/vocab.json", "r", encoding="utf-8") as f:
    vocab = json.load(f)

def get_pairs(word):
    pairs = set()
    prev_char = word[0]
    for char in word[1:]:
        pairs.add((prev_char, char))
        prev_char = char
    return pairs

def bpe(token):
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

test_queries = [
    "flooded farmland near a river",
    "new construction around an urban area",
    "large vehicle concentrations on open ground",
    "shrinking water bodies",
    "urban expansion",
    "wildfire burn scars",
    "solar farm installation",
    "deforestation in tropical rainforest",
    "drought affected reservoir",
    "coastal erosion after hurricane"
]

pattern = re.compile(r"""<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[a-zA-Z]+|[0-9]|[^\s0-9a-zA-Z]+""", re.IGNORECASE)

for q in test_queries:
    ref = tok(q, padding="max_length", max_length=77, truncation=True)["input_ids"]
    clean_q = re.sub(r"\s+", " ", q.strip().lower())
    words = pattern.findall(clean_q)
    bpe_tokens = [49406]
    for w in words:
        for piece in bpe(w):
            if piece in vocab:
                bpe_tokens.append(vocab[piece])
            else:
                print(f"Unknown token: {piece}")
    bpe_tokens.append(49407)
    while len(bpe_tokens) < 77:
        bpe_tokens.append(49407)
    bpe_tokens = bpe_tokens[:77]
    assert ref == bpe_tokens, f"Mismatch for '{q}':\nRef: {ref[:10]}\nGot: {bpe_tokens[:10]}"

print("ALL 10 TEST QUERIES MATCHED EXACTLY 100%!")
