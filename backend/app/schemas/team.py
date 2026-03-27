"""Team schemas."""
from pydantic import BaseModel, EmailStr
from typing import Literal, Optional


class InviteRequest(BaseModel):
    email: EmailStr
    role: Literal["admin", "member"] = "member"


class MemberUpdate(BaseModel):
    role: Optional[Literal["admin", "member"]] = None
    team_label: Optional[str] = None


class MemberResponse(BaseModel):
    id: str
    email: str
    role: str
    team_label: Optional[str] = None
    created_at: str


class InviteResponse(BaseModel):
    message: str
    email: str
