"""Supabase Auth Handler per Stregatto.

Questo plugin sostituisce l'autenticazione nativa di base.
Invece di generare JWT e gestirli, intercetta il token JWT proveniente dal
frontend (PWA) firmato da Supabase, lo verifica con la chiave segreta (SUPABASE_JWT_SECRET)
e lo mappa sull'oggetto User dello Stregatto, garantendo un'infrastruttura Multi-Tenant sicura.
"""

import os
import jwt
from typing import Optional

from cat import log, config
from cat.base import Auth
from cat.auth.user import User

class SupabaseAuth(Auth):
    slug = "supabase"
    name = "Supabase Auth"
    description = "Autenticazione passiva e verifica dei Token JWT di Supabase."

    async def authorize_user_from_jwt(self, token: str) -> Optional[User]:
        """Verifica il JWT di Supabase e lo mappa sull'utente Stregatto."""
        
        # Prende la secret dal .env (se non definita usa quella di default)
        secret = os.getenv("SUPABASE_JWT_SECRET", config.JWT_SECRET)
        
        if not secret:
            log.error("SUPABASE_JWT_SECRET non definita nel file .env!")
            return None

        try:
            # Decodifica esplicitamente il JWT di Supabase
            # Disabilitiamo temporaneamente verify_aud nel caso in cui Supabase
            # imposti un audience specifico ("authenticated" o stringhe custom).
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            
            # Supabase usa 'sub' come UUID dell'utente
            user_id = payload.get("sub")
            if not user_id:
                log.warning("JWT invalido: Nessun 'sub' trovato nel payload Supabase.")
                return None
                
            # Mappa i campi specifici di Supabase al modello User dello Stregatto
            email = payload.get("email", f"user_{user_id[:8]}")
            role = payload.get("role", "authenticated")
            
            log.info(f"Supabase Auth: Accesso consentito per {email} ({user_id})")
            
            return User(
                id=user_id,
                name=email,
                roles=[role] if role else ["authenticated"]
            )
            
        except jwt.ExpiredSignatureError:
            log.warning("Supabase Auth: Il token JWT è scaduto.")
            return None
        except jwt.InvalidTokenError as e:
            log.warning(f"Supabase Auth: Token JWT invalido. Dettagli: {e}")
            return None
        except Exception as e:
            log.error(f"Supabase Auth: Errore imprevisto durante la verifica JWT: {e}")
            return None
