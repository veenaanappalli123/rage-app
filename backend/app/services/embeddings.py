from functools import lru_cache
from sentence_transformers import SentenceTransformer
from app.core.config import EMBEDDING_MODEL


@lru_cache(maxsize=1)
def get_embedding_model():
    return SentenceTransformer(EMBEDDING_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    model = get_embedding_model()
    vectors = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False
    )
    return vectors.tolist()
