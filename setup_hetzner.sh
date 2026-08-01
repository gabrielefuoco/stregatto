#!/bin/bash
set -e

echo "======================================"
echo " STREGATTO CLOUD - HETZNER SETUP SCRIPT"
echo "======================================"

# 1. Controlla e installa Docker
if ! command -v docker &> /dev/null; then
    echo "Installazione di Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "Docker già installato."
fi

# 2. Controlla e installa Tailscale
if ! command -v tailscale &> /dev/null; then
    echo "Installazione di Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
else
    echo "Tailscale già installato."
fi

# 3. Chiedi la Tailscale Auth Key e avvia VPN nativa sul server
if ! tailscale status &> /dev/null; then
    read -p "Inserisci la tua Tailscale Auth Key (es. tskey-auth-...): " TS_KEY
    if [ -n "$TS_KEY" ]; then
        echo "Connessione alla VPN Zero-Trust..."
        sudo tailscale up --authkey=$TS_KEY --hostname=Stregatto-Cloud
    else
        echo "Errore: Auth Key necessaria per la VPN."
        exit 1
    fi
else
    echo "Il server è già connesso alla rete Tailscale."
fi

# 4. Compila e avvia il container
echo "Avvio della build Docker e rilascio di Stregatto Cloud..."
docker compose up -d --build

echo "======================================"
echo "DEPLOY COMPLETATO CON SUCCESSO!"
echo "Lo Stregatto è raggiungibile sull'IP pubblico del tuo VPS Hetzner sulla porta 80."
echo "I dispositivi 'Stregatto-Edge' possono ora ricevere comandi."
echo "======================================"
