# Instrukce pro Antigravity Agenta (`edupage-calendar-sync`)

Tento repozitář slouží k nastavení a provozu automatické synchronizace **EduPage ➡️ Google Tasks (domácí úkoly)** a **Google Calendar (ohlášené písemky/testy podle rozvrhu)**.

## 1. Pokud uživatel žádá o instalaci / prvotní nastavení (zejména na Windows)

Pokud ještě neexistuje soubor `.agents/plugins/edupage/mcp_config.json` nebo `~/.gemini/config/edupage-tasks.json` (`%USERPROFILE%\.gemini\config\edupage-tasks.json` na Windows), proveď instalaci sám krok za krokem:

1. **Zkontroluj `uvx`**:
   - Na Windows ověř `uvx --version`. Pokud chybí, nainstaluj `uv` příkazem:
     ```powershell
     powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
     ```
2. **Zkontroluj plugin `gcalendar`**:
   - Pokud není nainstalovaný oficiální plugin Google Calendar, nabídni uživateli kartu:
     `<plugin-card catalog-id="antigravity-plugins-official/plugin/gcalendar"></plugin-card>`
3. **Vyžádej si od uživatele 3 údaje** (pokud je ještě nezadal):
   - Žákovské přihlašovací jméno do EduPage (`EDUPAGE_USERNAME`)
   - Heslo do EduPage (`EDUPAGE_PASSWORD`)
   - Google Apps Script Web App URL (`https://script.google.com/macros/s/.../exec`). Pokud ho uživatel ještě nemá, vypiš mu stručný návod z `README.md` (zkopírovat `google-apps-script/appsscript.json` a `google-apps-script/Code.gs` na `https://script.google.com` a nasadit jako Web App: *Execute as: Me*, *Who has access: Anyone*).
4. **Vygeneruj konfigurační soubory (bez nutnosti ručně spouštět PowerShell skript)**:
   - Zkopíruj složku `.agents/plugins/edupage` do globální konfigurace uživatele (`~/.gemini/config/plugins/edupage`, na Windows `%USERPROFILE%\.gemini\config\plugins\edupage`).
   - Ze šablony `.agents/plugins/edupage/mcp_config.template.json` vytvoř `mcp_config.json` (jak v `.agents/plugins/edupage/mcp_config.json`, tak v globálním `~/.gemini/config/plugins/edupage/mcp_config.json`) a vyplň do něj `EDUPAGE_USERNAME` a `EDUPAGE_PASSWORD`.
   - Ulož Web App URL do `config.local.json` v kořeni repozitáře i do `~/.gemini/config/edupage-tasks.json` ve tvaru:
     ```json
     {
       "gtasks_webapp_url": "https://script.google.com/macros/s/.../exec"
     }
     ```
   - Vytvoř naplánovanou automatizaci (sidecar) v `~/.gemini/config/sidecars/edupage-homework-sync/sidecar.json` podle šablony `sidecars/edupage-homework-sync/sidecar.template.json`.
5. **Ověř funkčnost**:
   - Vyzvi uživatele k restartu Antigravity (aby se načetl MCP server `edupage`), a po restartu proveď testovací synchronizaci podle skill `homework-to-calendar`.

---

## 2. Rozdíly mezi Windows a Linuxem (DŮLEŽITÉ)

- **Spouštění Pythonu**:
  - Na **Windows** nepoužívej `python3` (Windows Store alias často selže), vždy používej `uv run python` nebo `python`.
  - Příklad volání `push_tasks.py` na Windows i Linuxu:
    ```bash
    uv run python scripts/push_tasks.py --file tasks_payload.json
    ```
    *(Pro větší nebo víceřádkové JSON payloady s českou diakritikou na Windows v PowerShellu VŽDY nejprve zapiš JSON v UTF-8 do dočasného souboru a předej ho přes `--file`, abys předešel rozbití uvozovek a kódování v PowerShellu!)*
- **Cesty**:
  - Domovský adresář konfigurace je `~/.gemini/config` (na Windows `$env:USERPROFILE\.gemini\config`).
- **Režim EduPage MCP**:
  - EduPage MCP server je v `mcp_config.json` záměrně spouštěn v **Read-Only** režimu (zapisovací nástroje `choose_meal`, `sign_off_meal`, `rate_meal`, `send_message`, `custom_request` jsou odstraněny). Nikdy se nepokoušej do EduPage nic zapisovat.
