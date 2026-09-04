from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "BUSINESS"
    organization_name: str | None = None
    contact_number: str | None = None
    address: str | None = None
    state: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    role_specific_info: dict | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        value = value.upper()
        if value not in {"BUSINESS", "LMO", "GATC", "ADMIN"}:
            raise ValueError("Invalid role")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    organization_name: str | None = None
    contact_number: str | None = None
    address: str | None = None
    state: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    role_specific_info: dict | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    organization_name: str | None = None
    contact_number: str | None = None
    address: str | None = None
    state: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    role_specific_info: dict | None = None
