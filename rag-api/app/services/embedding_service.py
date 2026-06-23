from fastembed import TextEmbedding

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = TextEmbedding("BAAI/bge-small-en-v1.5")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _get_model()
    return [[float(x) for x in vec] for vec in model.embed(texts)]
