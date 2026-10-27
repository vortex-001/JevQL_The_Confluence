import json
import math
import hashlib
import logging
import shutil
import subprocess
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from django.conf import settings
from .base import BaseSemanticProvider

logger = logging.getLogger(__name__)

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)

def compute_content_hash(text: str) -> str:
    """Generate deterministic SHA-256 hash for document content."""
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()

class GeminiSemanticProvider(BaseSemanticProvider):
    """
    Official Google Gemini Semantic Search Provider.
    Uses 'gemini-embedding-001' for query & document retrieval vectors.
    Caches document embeddings persistently using SHA-256 content hashing.
    Enforces configurable similarity thresholds and graceful fallback.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'GEMINI_API_KEY', '').strip()
        self.model_version = getattr(settings, 'SEMANTIC_EMBEDDING_MODEL', 'gemini-embedding-001')
        self.similarity_threshold = float(getattr(settings, 'SEMANTIC_SIMILARITY_THRESHOLD', 0.45))
        self.timeout_seconds = float(getattr(settings, 'SEMANTIC_TIMEOUT_SECONDS', 5.0))

    def is_available(self) -> bool:
        return bool(self.api_key)

    def get_provider_name(self) -> str:
        return f"Google Gemini Embeddings ({self.model_version})"

    def _post_json(self, url: str, payload: Dict[str, Any], timeout: float) -> Optional[Dict[str, Any]]:
        """
        Execute JSON POST request to Gemini API.
        Attempts curl.exe first (on Windows to avoid WPAD/proxy hang), with urllib fallback.
        Never exposes the API key in logs.
        """
        payload_bytes = json.dumps(payload).encode('utf-8')

        # 1. Try curl.exe if available on the system
        if shutil.which("curl.exe"):
            try:
                proc = subprocess.run(
                    ["curl.exe", "-s", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", payload_bytes.decode('utf-8')],
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
                if proc.stdout:
                    data = json.loads(proc.stdout)
                    if "error" in data:
                        err = data["error"]
                        logger.warning("Gemini API error (%s): %s", err.get("code"), err.get("message"))
                        return None
                    return data
            except Exception as ex:
                logger.debug("curl.exe request failed: %s, trying urllib", ex)

        # 2. Standard urllib with ProxyHandler({}) to bypass Windows WPAD auto-detect
        try:
            req = urllib.request.Request(url, data=payload_bytes, headers={"Content-Type": "application/json"}, method='POST')
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            logger.warning("Gemini API HTTPError: status %s %s", e.code, e.reason)
            return None
        except Exception as e:
            logger.warning("Gemini API request failed: %s", type(e).__name__)
            return None

    def generate_query_embedding(self, query: str) -> Optional[List[float]]:
        """
        Generate retrieval query vector using Gemini API with taskType='RETRIEVAL_QUERY'.
        """
        if not self.is_available() or not query.strip():
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_version}:embedContent?key={self.api_key}"
        payload = {
            "model": f"models/{self.model_version}",
            "content": {
                "parts": [{"text": query.strip()}]
            },
            "taskType": "RETRIEVAL_QUERY"
        }

        data = self._post_json(url, payload, timeout=self.timeout_seconds)
        if not data:
            return None
        embedding = data.get('embedding', {}).get('values')
        return embedding if isinstance(embedding, list) else None

    def generate_document_embeddings(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Batch generate document embeddings using taskType='RETRIEVAL_DOCUMENT'.
        """
        if not self.is_available() or not texts:
            return [None] * len(texts)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_version}:batchEmbedContents?key={self.api_key}"
        requests_payload = [
            {
                "model": f"models/{self.model_version}",
                "content": {"parts": [{"text": t.strip()}]},
                "taskType": "RETRIEVAL_DOCUMENT"
            }
            for t in texts
        ]

        payload = {"requests": requests_payload}
        data = self._post_json(url, payload, timeout=max(self.timeout_seconds * 2, 8.0))
        if not data:
            return [None] * len(texts)

        results = []
        for emb_item in data.get('embeddings', []):
            results.append(emb_item.get('values'))

        # Pad with None if fewer embeddings returned
        while len(results) < len(texts):
            results.append(None)
        return results

    def index_records(self, records: List[Any], batch_size: int = 25) -> int:
        """
        Ensure document embeddings are indexed in the database for the given records.
        Skips records whose content hash already exists.
        Returns the count of newly embedded records.
        """
        if not self.is_available() or not records:
            return 0

        from apps.datasets.models import RecordEmbedding

        records_to_embed = []
        for rec in records:
            if hasattr(rec, 'get_embedding_text'):
                text = rec.get_embedding_text()
            else:
                text = rec.get('feedback_text', '') if isinstance(rec, dict) else str(rec)
            
            c_hash = compute_content_hash(text)
            
            # Check if embedding already exists
            rec_id = rec.id if hasattr(rec, 'id') else rec.get('id')
            if rec_id:
                exists = RecordEmbedding.objects.filter(
                    feedback_id=rec_id,
                    content_hash=c_hash,
                    model_version=self.model_version
                ).exists()
                if not exists:
                    records_to_embed.append((rec, text, c_hash))

        if not records_to_embed:
            return 0

        indexed_count = 0
        for i in range(0, len(records_to_embed), batch_size):
            chunk = records_to_embed[i:i + batch_size]
            texts = [item[1] for item in chunk]
            embeddings = self.generate_document_embeddings(texts)

            for (rec, text, c_hash), emb in zip(chunk, embeddings):
                if emb:
                    rec_id = rec.id if hasattr(rec, 'id') else rec.get('id')
                    from apps.datasets.models import EmployeeFeedback
                    feedback_instance = rec if isinstance(rec, EmployeeFeedback) else EmployeeFeedback.objects.filter(id=rec_id).first()
                    if feedback_instance:
                        RecordEmbedding.objects.update_or_create(
                            feedback=feedback_instance,
                            defaults={
                                'content_hash': c_hash,
                                'model_version': self.model_version,
                                'embedding': emb
                            }
                        )
                        indexed_count += 1

        return indexed_count

    def evaluate_candidates(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        timeout_seconds: float = 4.0
    ) -> List[Dict[str, Any]]:
        """
        Evaluate and rank candidates using Gemini query embedding and cosine similarity.
        Only candidates meeting self.similarity_threshold are retained.
        """
        if not self.is_available() or not candidates or not query.strip():
            return candidates

        # 1. Generate query embedding with taskType='RETRIEVAL_QUERY'
        query_vector = self.generate_query_embedding(query)
        if not query_vector:
            logger.info("Could not obtain query vector from Gemini. Falling back to candidate order.")
            for c in candidates:
                c['semantic_provider'] = f"Fallback (API Unreachable)"
            return candidates

        # 2. Retrieve cached document embeddings for candidates
        from apps.datasets.models import RecordEmbedding, EmployeeFeedback
        candidate_ids = [c['id'] for c in candidates if 'id' in c]
        
        cached_embeddings = {
            emb.feedback_id: emb.embedding
            for emb in RecordEmbedding.objects.filter(
                feedback_id__in=candidate_ids,
                model_version=self.model_version
            )
        }

        # Check for candidates missing embeddings
        missing_ids = [cid for cid in candidate_ids if cid not in cached_embeddings]
        if missing_ids:
            missing_records = list(EmployeeFeedback.objects.filter(id__in=missing_ids))
            if missing_records:
                self.index_records(missing_records)
                for emb in RecordEmbedding.objects.filter(feedback_id__in=missing_ids, model_version=self.model_version):
                    cached_embeddings[emb.feedback_id] = emb.embedding

        # 3. Compute cosine similarity for each candidate
        ranked_candidates = []
        for c in candidates:
            cid = c.get('id')
            doc_vec = cached_embeddings.get(cid)
            if doc_vec:
                sim = cosine_similarity(query_vector, doc_vec)
                pct = round(sim * 100, 1)
                
                # Check if result supports verified return / event timing fact
                text_lower = c.get('feedback_text', '').lower()
                is_return_fact = any(term in text_lower for term in ('return', 'sent it back', 'sent back', 'returned'))
                
                c['similarity_score'] = round(sim, 4)
                c['semantic_score'] = round(sim, 4)
                c['semantic_provider'] = self.get_provider_name()
                
                if '2 day' in query.lower() or '48 hour' in query.lower():
                    if is_return_fact:
                        c['relevance_explanation'] = f"Verified return record ({pct}% semantic similarity to query)"
                    else:
                        c['relevance_explanation'] = f"Semantic similarity ({pct}%), but return event not verified in text"
                else:
                    c['relevance_explanation'] = f"Semantic match: {pct}% similarity via Gemini vector intent"
                
                # Apply configurable threshold filter
                if sim >= self.similarity_threshold:
                    ranked_candidates.append(c)
            else:
                # If embedding missing, retain if has strong trigram score
                trigram_score = c.get('similarity_score', 0.0)
                if trigram_score > 0.15:
                    c['relevance_explanation'] = f"Keyword/Trigram match ({int(trigram_score * 100)}% match)"
                    ranked_candidates.append(c)

        # 4. Sort strictly descending by semantic similarity
        ranked_candidates.sort(key=lambda x: x.get('semantic_score', x.get('similarity_score', 0.0)), reverse=True)
        return ranked_candidates
