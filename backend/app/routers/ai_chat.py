from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.smart_ecosystem import AIChatRequest, AIChatResponse
from app.services.local_ai_assistant import LocalAIAssistant
from app.utils.security import decode_access_token

router = APIRouter(prefix="/ai", tags=["Local AI Assistant"])


@router.post("/chat", response_model=AIChatResponse)
def handle_ai_chat(
    payload: AIChatRequest,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db)
):
    """Local, offline, role-based Legal Metrology intelligent copilot."""
    user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            claims = decode_access_token(token)
            user_id = claims.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
        except Exception:
            user = None

    if not user:
        # Create a virtual public citizen user context
        user = User(
            id=0,
            full_name="Citizen / Guest",
            email="citizen@public.gov.in",
            role="PUBLIC",
            is_active=True
        )

    assistant = LocalAIAssistant(db=db, user=user)
    result = assistant.answer_query(payload.query)

    return AIChatResponse(
        response=result.get("response", "I am your Legal Metrology Assistant. How can I assist you?"),
        role=user.role,
        quick_actions=result.get("quick_actions", []),
        confidence=result.get("confidence", 0.95),
    )
