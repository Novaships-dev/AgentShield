"""Recommendation schemas."""
from pydantic import BaseModel
from typing import Optional


class RecommendationItem(BaseModel):
    agent: str
    current_model: str
    suggested_model: str
    reasoning: str
    estimated_savings_pct: float


class RecommendationsResponse(BaseModel):
    data: list[RecommendationItem]
    generated_at: Optional[str] = None
