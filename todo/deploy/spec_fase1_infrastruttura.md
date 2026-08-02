# Specifica Fase 1: Infrastruttura e Stateless Backend

## 1. Obiettivo e Scope
Eliminare qualsiasi dipendenza dal File System locale per la persistenza. Preparare Stregatto al deploy su container effimeri tramite l'uso di Supabase come database PostgreSQL remoto e come Identity Provider (IdP).

## 2. Modello Dati e Connessione (Piccolo ORM)

Attualmente Stregatto usa SQLite tramite `cat.db.UserScopedDB`. Piccolo supporta nativamente Postgres.

### 2.1 File `plugins/chats/db.py` (o layer DB equivalente)
- **Logica di Connessione Fallback**:
  ```python
  import os
  from piccolo.engine.postgres import PostgresEngine
  from piccolo.engine.sqlite import SQLiteEngine

  db_url = os.environ.get("DATABASE_URL")
  if db_url and db_url.startswith("postgres"):
      # Nota: Piccolo richiede che l'URL includa il driver asincrono, es. postgresql+asyncpg://
      DB_ENGINE = PostgresEngine(config={
          'dsn': db_url.replace("postgres://", "postgresql://", 1) 
      })
  else:
      DB_ENGINE = SQLiteEngine(path='core.db')
  ```
- **Dipendenze**: Aggiornare `pyproject.toml` o `requirements.txt` aggiungendo `asyncpg`.
- **Prevenzione Conflitti Migrazioni**: Mantenere l'inizializzazione sincrona `ChatDB.create_table(if_not_exists=True).run_sync()` in modo che il container auto-configuri le tabelle al primo boot.

## 3. Autenticazione: Supabase Auth

Sostituire la logica di `plugins/simple_oauth` (OAuth puro) delegando il flusso a Supabase. Stregatto opererà come Resource Server verificando i JWT.

### 3.1 PWA (Frontend)
- **Implementazione**: Includere `import { createClient } from '@supabase/supabase-js'`.
- **Configurazione**: Caricare `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
- **Azione**: Usare `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- **Passaggio Token**: Una volta loggato, la PWA invia `session.access_token` come Header `Authorization: Bearer <token>` nelle chiamate WebSocket/HTTP verso Stregatto.

### 3.2 Backend (Stregatto Auth Middleware)
- **JWT Verification**: 
  - Sostituire il modulo di verifica o estendere l'Auth base di Cat.
  - Supabase usa JWT firmati con `SUPABASE_JWT_SECRET`.
  - Usare la libreria `PyJWT`:
    ```python
    import jwt
    from fastapi import HTTPException
    
    def verify_supabase_token(token: str) -> dict:
        try:
            # disabilita audience check se non configurato in supabase, verifica la firma
            payload = jwt.decode(token, os.environ.get("SUPABASE_JWT_SECRET"), algorithms=["HS256"], options={"verify_aud": False})
            return payload # Contiene 'sub' (User ID) e 'email'
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail="Token Supabase non valido")
    ```
- **Mapping Utente**: 
  - Mappare il `payload['sub']` (User ID UUID di Supabase) all'oggetto `User` dello Stregatto.
  - Questo `User.id` verrà utilizzato come chiave per le operazioni multi-tenant nel database (Chat, Skills, Memorie).

## 4. Criteri di Accettazione (DoD)
1. Eseguendo il container (es. `docker run`), non viene creato alcun file `core.db` se `DATABASE_URL` è presente.
2. Un utente accede dalla UI, il record viene salvato in Supabase.
3. Distruggendo e ricreando il container, effettuando il login con lo stesso account, l'utente vede lo storico delle chat intatto.
