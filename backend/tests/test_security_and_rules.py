"""Fast unit tests that do not require a live database."""
from datetime import date, timedelta
from app.services.domain import risk_for_instrument
from app.utils.security import create_access_token, decode_access_token

def test_token_round_trip():
    token = create_access_token({"sub": "1", "role": "BUSINESS"})
    assert decode_access_token(token)["sub"] == "1"

def test_risk_priority_for_expired_instrument():
    class InstrumentStub:
        id = 1
        category = "STANDARD"
        next_verification_due_date = date.today() - timedelta(days=1)
    class Query:
        def filter(self, *args): return self
        def scalar(self): return 0
    class Db:
        def query(self, *args): return Query()
    score, level = risk_for_instrument(Db(), InstrumentStub())
    assert score >= 45
    assert level in {"HIGH", "CRITICAL"}
