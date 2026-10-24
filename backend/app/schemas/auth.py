from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=settings.password_min_length, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: EmailStr
    role: str
    is_verified: bool
