# EduPage ➡️ Google Tasks & Google Calendar (Antigravity Plugin)

Tento repozitář obsahuje plugin **`edupage`** pro Antigravity, který v **Read-Only režimu** čte data z EduPage a synchronizuje:
1. **Domácí úkoly (`homework`) ➡️ Google Tasks** (s odškrtávacím checkboxem v Google Kalendáři, datem zobrazení `due` nastaveným na okamžitý den zjištění a `[Deadline: ...]` nastaveným na den před odevzdáním přímo v titulku + rozvrhem hodiny v popisu).
2. **Ohlášené testy a písemky ➡️ Google Calendar Events** (informativní událost přesně v čase vyučovací hodiny daného předmětu podle rozvrhu z EduPage).
3. **Denní přehled ze školy (`school-day-summary`)** – souhrn „co se dělo / bude dít ve škole“.

---

## Struktura repozitáře

```text
.
├── .agents/
│   └── plugins/
│       └── edupage/
│           ├── plugin.json                         # Manifest pluginu
│           ├── mcp_config.template.json            # Šablona Read-Only EduPage MCP serveru
│           ├── scripts/
│           │   └── push_tasks.py                   # Skript pro zápis úkolů do Google Tasks
│           └── skills/
│               ├── homework-to-calendar/SKILL.md   # Skill pro synchronizaci DÚ a testů
│               └── school-day-summary/SKILL.md     # Skill pro denní přehled ze školy
├── google-apps-script/
│   ├── Code.gs                                     # Kód pro script.google.com (Google Tasks most)
│   └── appsscript.json                             # Manifest zapínající Google Tasks API
├── scripts/
│   └── push_tasks.py                               # Multiplatformní Python skript (Windows/Linux)
├── sidecars/
│   └── edupage-homework-sync/
│       └── sidecar.template.json                   # Šablona plánované automatizace (Po–Pá 15:00 a 18:00)
└── install-windows.ps1                             # Automatický instalátor pro Windows
```

*(Lokální soubory s hesly `.agents/plugins/edupage/mcp_config.json` a `config.local.json` jsou v `.gitignore`, takže se nikdy necommitnou do Gitu).*

---

## Návod na instalaci pro syny (Windows)

### Krok 1: Nasazení Google Tasks mostu na Google účtu syna (1 minuta)
1. Pod Google účtem syna otevři **[script.google.com](https://script.google.com)** a klikni na **Nový projekt** (*New project*).
2. Vlevo klikni na **Nastavení projektu** (ozubené kolečko) a zaškrtni **Zobrazit soubor manifestu „appsscript.json“ v editoru**.
3. Vrať se do **Editoru (`< >`)**:
   - Do souboru **`appsscript.json`** zkopíruj obsah [`google-apps-script/appsscript.json`](google-apps-script/appsscript.json).
   - Do souboru **`Code.gs`** zkopíruj obsah [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
   - Ulož projekt (**`Ctrl+S`**).
4. Vpravo nahoře klikni na **Nasadit (Deploy) > Nové nasazení (New deployment)**:
   - Typ: **Webová aplikace (Web app)**
   - Spustit jako (*Execute as*): **Já (*Me*)**
   - Kdo má přístup (*Who has access*): **Kdokoliv (*Anyone*)**
   - Klikni na **Nasadit (Deploy)**, povol oprávnění pro Google Tasks a zkopíruj výslednou **Web app URL** (`https://script.google.com/macros/s/.../exec`).

### Krok 2: Spuštění instalátoru na Windows
Naklonuj tento repozitář na počítači syna a v PowerShellu v jeho složce spusť:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

Skript:
1. Zkontroluje (a případně doinstaluje) `uv` / `uvx`.
2. Zeptá se na žákovské přihlašovací jméno a heslo do EduPage a na zkopírované **Web app URL**.
3. Nainstaluje Read-Only plugin `edupage` a vytvoří naplánovanou úlohu **EduPage Homework & Tests Sync** (každý všední den v 15:00 a 18:00).

### Krok 3: Zapnutí v Antigravity
1. Restartuj Antigravity.
2. V Antigravity přidej a přihlas oficiální plugin **Google Calendar** (pro zápis písemek/testů).
3. V levém panelu otevři **Scheduled Tasks** (*Automations*) a zapni **`EduPage Homework & Tests Sync`**.
