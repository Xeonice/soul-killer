from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import lancedb
import os
import json

app = FastAPI(title="Soulkiller Engine")

DATA_DIR = os.environ.get("SOULKILLER_DATA", "/data")
db = None
table = None


class SoulChunk(BaseModel):
    id: str
    source: str
    content: str
    timestamp: str
    context: str
    type: str
    metadata: dict


class IngestRequest(BaseModel):
    chunks: list[SoulChunk]


class IngestResult(BaseModel):
    chunksIngested: int
    totalChunks: int


class RecallResult(BaseModel):
    chunk: SoulChunk
    similarity: float


@app.on_event("startup")
async def startup():
    global db, table
    os.makedirs(DATA_DIR, exist_ok=True)
    db = lancedb.connect(os.path.join(DATA_DIR, "vectors"))
    try:
        table = db.open_table("chunks")
    except Exception:
        table = None


@app.post("/ingest", response_model=IngestResult)
async def ingest(request: IngestRequest):
    global table
    # TODO: implement BGE-M3 embedding + LanceDB write
    # For now, store raw chunks
    records = [{"id": c.id, "content": c.content, "source": c.source,
                "timestamp": c.timestamp, "metadata": json.dumps(c.metadata)}
               for c in request.chunks]

    if table is None:
        table = db.create_table("chunks", records)
    else:
        table.add(records)

    return IngestResult(chunksIngested=len(request.chunks), totalChunks=len(table))


@app.get("/recall")
async def recall(query: str, limit: int = 5, source: Optional[str] = None):
    if table is None:
        return []
    # TODO: implement semantic search with BGE-M3
    # Placeholder: return most recent chunks
    results = table.search().limit(limit).to_list()
    return [{"chunk": r, "similarity": 0.5} for r in results]


@app.get("/status")
async def status():
    chunk_count = len(table) if table is not None else 0
    return {
        "mode": "docker",
        "chunkCount": chunk_count,
        "healthy": True,
    }
