# Deploy su Hetzner VPS (Stregatto Cloud)

Questa guida spiega come rilasciare lo Stregatto in produzione su un server dedicato (VPS) Hetzner, unendolo alla tua rete privata VPN Zero-Trust tramite Tailscale.

## Requisiti
1. Un server VPS Hetzner con sistema operativo Ubuntu o Debian.
2. Un account Tailscale e una "Auth Key" (generabile dalla dashboard di Tailscale).
3. Le tue credenziali (es. Supabase) salvate nel file `.env`.

## Procedura di Rilascio

1. **Accedi al server via SSH:**
   Collegati al tuo nuovo VPS Hetzner:
   ```bash
   ssh root@<IP_DEL_TUO_SERVER>
   ```

2. **Clona il repository:**
   ```bash
   git clone https://github.com/gabrielefuoco/stregatto.git
   cd stregatto
   ```

3. **Prepara le Variabili d'Ambiente:**
   Crea o copia il file `.env` all'interno della cartella clonata:
   ```bash
   nano .env
   # Incolla le tue variabili, salva con CTRL+X, poi Y e Invio.
   ```

4. **Avvia il Setup Automatizzato:**
   Lancia lo script preparato appositamente per questa architettura:
   ```bash
   bash setup_hetzner.sh
   ```

## Cosa fa lo script `setup_hetzner.sh`?
- Controlla e installa **Docker** in automatico.
- Installa **Tailscale** nativamente a livello di sistema operativo.
- Ti chiede la tua **Tailscale Auth Key** per unire in sicurezza il VPS alla tua rete.
- Usa `docker-compose up -d --build` per lanciare lo Stregatto, basandosi sul nostro `Dockerfile` alleggerito e mappandolo sulla porta 80.

## Post-Deploy e PWA
Una volta che i container sono in esecuzione:
- Visita l'IP del server dal browser del tuo smartphone o tablet.
- Grazie ai file `manifest.json` e `sw.js`, il browser ti permetterà di **"Aggiungere a schermata Home"**.
- L'interfaccia si aprirà a schermo intero (Standalone), senza barre di navigazione, offrendo l'esperienza di un'App nativa connessa 24/7.

## Sicurezza (Zero-Trust)
Non ci sono porte esposte in modo insicuro. La connessione tra il "Cervello" in Cloud e le azioni eseguite sul tuo PC Windows passa esclusivamente all'interno del tunnel cifrato WireGuard fornito da Tailscale. Nessun utente esterno può impartire comandi se non è stato autenticato all'interno della mesh VPN.
