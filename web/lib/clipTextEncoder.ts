/**
 * Client-side packaged ONNX / WASM CLIP text encoder.
 *
 * Model: openai/clip-vit-base-patch32 (text encoder + projection)
 * Output: 512-dimensional L2-normalized embedding vector.
 *
 * Implements byte-pair encoding (BPE) tokenization matching HuggingFace/OpenAI CLIP exactly.
 * Uses packaged standalone onnxruntime-web WASM binary for 100% offline local inference.
 */

// Global caches for tokenizer assets and ONNX session
let bpeRanksCache: Record<string, number> | null = null;
let vocabCache: Record<string, number> | null = null;
let sessionPromise: Promise<any> | null = null;

export interface TokenizerAssets {
  bpeRanks: Record<string, number>;
  vocab: Record<string, number>;
}

export async function loadTokenizerAssets(): Promise<TokenizerAssets> {
  if (bpeRanksCache && vocabCache) {
    return { bpeRanks: bpeRanksCache, vocab: vocabCache };
  }

  const [ranksRes, vocabRes] = await Promise.all([
    fetch("/models/bpe_ranks.json"),
    fetch("/models/vocab.json"),
  ]);

  if (!ranksRes.ok || !vocabRes.ok) {
    throw new Error(`Failed to load CLIP tokenizer assets: ranks=${ranksRes.status}, vocab=${vocabRes.status}`);
  }

  bpeRanksCache = await ranksRes.json();
  vocabCache = await vocabRes.json();
  return { bpeRanks: bpeRanksCache!, vocab: vocabCache! };
}

function getPairs(word: string[]): Set<string> {
  const pairs = new Set<string>();
  let prev = word[0];
  for (let i = 1; i < word.length; i++) {
    pairs.add(`${prev} ${word[i]}`);
    prev = word[i];
  }
  return pairs;
}

function bpe(token: string, bpeRanks: Record<string, number>): string[] {
  let word: string[] = token.slice(0, -1).split("");
  word.push(token.slice(-1) + "</w>");

  let pairs = getPairs(word);
  if (pairs.size === 0) {
    return [token + "</w>"];
  }

  while (true) {
    let minPair: string | null = null;
    let minRank = Infinity;

    for (const pair of pairs) {
      const rank = bpeRanks[pair];
      if (rank !== undefined && rank < minRank) {
        minRank = rank;
        minPair = pair;
      }
    }

    if (!minPair || minRank === Infinity) {
      break;
    }

    const [first, second] = minPair.split(" ");
    const newWord: string[] = [];
    let i = 0;

    while (i < word.length) {
      const j = word.indexOf(first, i);
      if (j === -1) {
        newWord.push(...word.slice(i));
        break;
      }
      newWord.push(...word.slice(i, j));
      i = j;

      if (i < word.length - 1 && word[i] === first && word[i + 1] === second) {
        newWord.push(first + second);
        i += 2;
      } else {
        newWord.push(word[i]);
        i += 1;
      }
    }

    word = newWord;
    if (word.length === 1) break;
    pairs = getPairs(word);
  }

  return word;
}

const REGEX_PAT = /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[a-zA-Z]+|[0-9]|[^\s0-9a-zA-Z]+/gi;

export function tokenizeText(
  text: string,
  bpeRanks: Record<string, number>,
  vocab: Record<string, number>
): { inputIds: BigInt64Array; attentionMask: BigInt64Array } {
  const clean = text.trim().toLowerCase().replace(/\s+/g, " ");
  const matches = clean.match(REGEX_PAT) || [];

  const tokens: number[] = [49406]; // <|startoftext|>
  for (const match of matches) {
    const pieces = bpe(match, bpeRanks);
    for (const piece of pieces) {
      if (vocab[piece] !== undefined) {
        tokens.push(vocab[piece]);
      }
    }
  }
  tokens.push(49407); // <|endoftext|>

  // Truncate to 77 max length
  const validLength = Math.min(tokens.length, 77);
  const truncated = tokens.slice(0, validLength);

  const inputIds = new BigInt64Array(77);
  const attentionMask = new BigInt64Array(77);

  for (let i = 0; i < 77; i++) {
    if (i < validLength) {
      inputIds[i] = BigInt(truncated[i]);
      attentionMask[i] = BigInt(1);
    } else {
      inputIds[i] = BigInt(49407); // Pad with <|endoftext|>
      attentionMask[i] = BigInt(0);
    }
  }

  return { inputIds, attentionMask };
}

/**
 * Loads ONNX Runtime Web via standalone bundle without webpack bundler parse conflicts.
 */
export async function loadOrt(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("Client ONNX inference is only available in browser environment");
  }

  if ((window as any).ort) {
    return (window as any).ort;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-ort-loader="true"]') as HTMLScriptElement;
    if (existingScript) {
      if ((window as any).ort) {
        resolve((window as any).ort);
      } else {
        existingScript.addEventListener("load", () => resolve((window as any).ort));
        existingScript.addEventListener("error", () => reject(new Error("Failed to load /onnx/ort.min.js")));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "/onnx/ort.min.js";
    script.async = true;
    script.setAttribute("data-ort-loader", "true");
    script.onload = () => {
      const ort = (window as any).ort;
      if (ort) {
        ort.env.wasm.wasmPaths = "/onnx/";
        ort.env.wasm.numThreads = 1;
        resolve(ort);
      } else {
        reject(new Error("window.ort was not defined after loading /onnx/ort.min.js"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load script /onnx/ort.min.js"));
    document.head.appendChild(script);
  });
}

async function getInferenceSession(): Promise<{ session: any; ort: any }> {
  const ort = await loadOrt();
  if (sessionPromise) {
    const session = await sessionPromise;
    return { session, ort };
  }

  sessionPromise = (async () => {
    ort.env.wasm.wasmPaths = "/onnx/";
    ort.env.wasm.numThreads = 1;

    const session = await ort.InferenceSession.create("/models/clip-text-encoder.onnx", {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return session;
  })();

  const session = await sessionPromise;
  return { session, ort };
}

/**
 * Encodes an arbitrary natural-language query into a 512-dim L2-normalized CLIP embedding vector.
 */
export async function encodeQueryClient(query: string): Promise<number[]> {
  const [{ bpeRanks, vocab }, { session, ort }] = await Promise.all([
    loadTokenizerAssets(),
    getInferenceSession(),
  ]);

  const { inputIds, attentionMask } = tokenizeText(query, bpeRanks, vocab);

  const tensorInputIds = new ort.Tensor("int64", inputIds, [1, 77]);
  const tensorAttentionMask = new ort.Tensor("int64", attentionMask, [1, 77]);

  const feeds = {
    input_ids: tensorInputIds,
    attention_mask: tensorAttentionMask,
  };

  const results = await session.run(feeds);
  const outputTensor = results.text_features;
  const rawData = outputTensor.data as Float32Array;

  // L2-normalize vector
  let sumSq = 0;
  for (let i = 0; i < rawData.length; i++) {
    sumSq += rawData[i] * rawData[i];
  }
  const norm = Math.sqrt(sumSq);

  const normalized = new Array<number>(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    normalized[i] = norm > 0 ? rawData[i] / norm : 0;
  }

  return normalized;
}
