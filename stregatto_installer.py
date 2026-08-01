import os
import sys
import zipfile
import urllib.request
import winreg
import subprocess
from pathlib import Path
import time

# Configurazioni
APP_DIR = Path(os.environ["LOCALAPPDATA"]) / "StregattoEdge"
NODE_DIR = APP_DIR / "node"

NODE_URL = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip"
TAILSCALE_URL = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"

def ensure_dirs():
    APP_DIR.mkdir(parents=True, exist_ok=True)
    NODE_DIR.mkdir(parents=True, exist_ok=True)

def download_with_progress(url, dest, desc):
    print(f"Scaricamento di {desc}...")
    urllib.request.urlretrieve(url, dest)
    print(f"{desc} scaricato con successo.")

def install_node():
    node_exe = NODE_DIR / "node-v20.11.1-win-x64" / "node.exe"
    if node_exe.exists():
        print("Node.js Portable è già presente.")
        return node_exe.parent
    
    zip_path = APP_DIR / "node.zip"
    download_with_progress(NODE_URL, zip_path, "Node.js (Portable ZIP)")
    
    print("Estrazione di Node.js...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(NODE_DIR)
    
    os.remove(zip_path)
    print("Node.js estratto con successo.")
    return NODE_DIR / "node-v20.11.1-win-x64"

def install_tailscale(auth_key):
    ts_installer = APP_DIR / "tailscale-setup.exe"
    download_with_progress(TAILSCALE_URL, ts_installer, "Tailscale VPN")
    print("Installazione di Tailscale in background...")
    subprocess.run([str(ts_installer), "/quiet"], check=True)
    
    # Attendiamo che il servizio parta
    time.sleep(5)
    
    # Eseguiamo il login con la chiave fornita
    ts_cli = r"C:\Program Files\Tailscale\tailscale.exe"
    print("Connessione alla rete Zero-Trust...")
    subprocess.run([ts_cli, "up", "--authkey", auth_key, "--hostname", "Stregatto-Edge"], check=True)
    
    # Recuperiamo l'IP di Tailscale per stamparlo
    result = subprocess.run([ts_cli, "ip", "-4"], capture_output=True, text=True)
    return result.stdout.strip()

def setup_startup(node_bin_dir):
    print("Configurazione del Server MCP in background...")
    
    bat_path = APP_DIR / "run_stregatto_edge.bat"
    vbs_path = APP_DIR / "run_stregatto_edge.vbs"
    
    # Crea il file batch che lancia DesktopCommander
    bat_content = f"""@echo off
set PATH={node_bin_dir};%PATH%
start /b npx -y @wonderwhy-er/desktop-commander-mcp
"""
    bat_path.write_text(bat_content, encoding="utf-8")
    
    # Crea il VBScript che lancia il batch invisibilmente
    vbs_content = f"""Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "{bat_path}" & Chr(34), 0
Set WshShell = Nothing
"""
    vbs_path.write_text(vbs_content, encoding="utf-8")
    
    # Aggiungi al registro
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
    winreg.SetValueEx(key, "StregattoEdgeServer", 0, winreg.REG_SZ, str(vbs_path))
    winreg.CloseKey(key)
    
    os.startfile(str(vbs_path))

def main():
    print("=======================================")
    print("  INSTALLER STREGATTO EDGE (TAILSCALE) ")
    print("=======================================\n")
    print("Questo installer unirà il tuo PC alla rete VPN dello Stregatto e avvierà il Server MCP.\n")
    
    auth_key = input("Inserisci la tua Tailscale Auth Key (inizia con tskey-): ").strip()
    if not auth_key:
        print("Errore: L'Auth Key è obbligatoria.")
        input("Premi Invio per uscire...")
        sys.exit(1)
        
    ensure_dirs()
    node_bin = install_node()
    ip = install_tailscale(auth_key)
    setup_startup(node_bin)
    
    print("\n=======================================")
    print("✅ Installazione Completata con Successo!")
    print(f"Il tuo IP Sicuro sulla VPN è: {ip}")
    print("=======================================\n")
    print("Apri le Impostazioni dello Stregatto e inserisci questo come MCP URL:")
    print(f"http://{ip}:8000/sse")
    print("\nPuoi chiudere questa finestra.")
    input()

if __name__ == "__main__":
    main()
