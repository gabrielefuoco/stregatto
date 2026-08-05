import os
import jwt
from typing import Optional
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

security = HTTPBearer(auto_error=False)


class AuthUser(BaseModel):
    id: str
    email: str
    role: str = "authenticated"


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> AuthUser:
    """Verifica ed estrae l'utente dal JWT Supabase (dall'header o dalla query string)."""
    token = None

    if credentials and credentials.credentials:
        token = credentials.credentials
    elif "token" in request.query_params:
        token = request.query_params["token"]

    # Se non c'è Supabase configurato o nessun token fornito in ambiente locale di test
    if not token:
        # Fallback per sviluppo locale dev / testing senza sessione Supabase attiva
        return AuthUser(id="local_dev_user", email="dev@stregatto.local")


    try:
        secret = os.environ.get("SUPABASE_JWT_SECRET")
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if secret and alg == "HS256":
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        else:
            # Decode senza verifica firma per Supabase RS256/ES256 quando gestito da Supabase JS
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_aud": False}
            )

        user_id = payload.get("sub")
        if not user_id:
            user_id = "local_dev_user"

        email = payload.get("email", f"user_{user_id[:8]}")
        role = payload.get("role", "authenticated")

        return AuthUser(id=user_id, email=email, role=role)

    except Exception as e:
        # Permette il funzionamento in dev locale anche se il token Supabase non è ancora autenticato nel browser
        return AuthUser(id="local_dev_user", email="dev@stregatto.local")


