FROM python:3.13-slim

# Installazione dipendenze minime di sistema e NodeJS (per fallback locale MCP)
RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Installazione `uv` per gestione dipendenze Python ultraveloce
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Copia dei file di lock per caching layer
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# Copia del resto del codice
COPY . .

# Variabili d'ambiente per far partire il server
ENV PORT=80
EXPOSE 80

# Avvio diretto senza proxy
CMD ["uv", "run", "python", "-m", "cat.main"]
