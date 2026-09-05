import re
from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_REGEX = re.compile(r"^[\w\.\+\-]+@[\w\-]+(\.[\w\-]+)+$")


class UserCreate(BaseModel):
    full_name: str
    email: str = Field(min_length=5, max_length=150)
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

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_REGEX.match(value):
            raise ValueError("Invalid email address format")
        return value

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
    email: str
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
