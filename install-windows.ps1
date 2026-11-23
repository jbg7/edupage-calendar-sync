# PowerShell instalátor pro Windows (Antigravity EduPage -> Google Tasks & Calendar)
# Spuštění v PowerShellu:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Instalace EduPage -> Google Tasks & Calendar (Windows)  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Kontrola uv / uvx
if (-not (Get-Command "uvx" -ErrorAction SilentlyContinue)) {
    Write-Host "[1/4] 'uvx' nebylo nalezeno. Instaluji 'uv'..." -ForegroundColor Yellow
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
} else {
    Write-Host "[1/4] 'uvx' je nainstalováno." -ForegroundColor Green
}

# 2. Načtení údajů od uživatele
Write-Host ""
Write-Host "[2/4] Nastavení přihlašovacích údajů:" -ForegroundColor Cyan
$EduUser = Read-Host "Zadej žákovské přihlašovací jméno do EduPage (např. email)"
$EduPassSecure = Read-Host "Zadej heslo do EduPage" -AsSecureString
$EduPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($EduPassSecure))
$WebAppUrl = Read-Host "Zadej Google Apps Script Web App URL (https://script.google.com/macros/s/.../exec)"

# 3. Nakopírování pluginu globálně do ~/.gemini/config/plugins/edupage (i lokálně do projektu)
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GlobalConfigDir = Join-Path $env:USERPROFILE ".gemini\config"
$GlobalPluginDir = Join-Path $GlobalConfigDir "plugins\edupage"
$LocalPluginDir  = Join-Path $RepoRoot ".agents\plugins\edupage"

Write-Host ""
Write-Host "[3/4] Kopíruji plugin 'edupage' do $GlobalPluginDir ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $GlobalPluginDir | Out-Null
Copy-Item -Path (Join-Path $LocalPluginDir "*") -Destination $GlobalPluginDir -Recurse -Force

# Vygenerování mcp_config.json (s Read-Only ochranou)
$McpConfigObj = @{
    mcpServers = @{
        edupage = @{
            command = "uvx"
            args = @(
                "--from",
                "edupage-mcp-full",
                "python",
                "-c",
                "import edupage_mcp; [edupage_mcp.server.remove_tool(t) for t in ('choose_meal', 'sign_off_meal', 'rate_meal', 'send_message', 'custom_request')]; edupage_mcp.main()"
            )
            env = @{
                EDUPAGE_USERNAME = $EduUser
                EDUPAGE_PASSWORD = $EduPass
            }
        }
    }
}
$McpConfigJson = $McpConfigObj | ConvertTo-Json -Depth 6
Set-Content -Path (Join-Path $GlobalPluginDir "mcp_config.json") -Value $McpConfigJson -Encoding UTF8
Set-Content -Path (Join-Path $LocalPluginDir "mcp_config.json") -Value $McpConfigJson -Encoding UTF8

# Uložení Web App URL pro push_tasks.py
$TasksConfigJson = @{ gtasks_webapp_url = $WebAppUrl } | ConvertTo-Json
Set-Content -Path (Join-Path $GlobalConfigDir "edupage-tasks.json") -Value $TasksConfigJson -Encoding UTF8
Set-Content -Path (Join-Path $RepoRoot "config.local.json") -Value $TasksConfigJson -Encoding UTF8

# 4. Vytvoření Scheduled Automation (sidecar.json)
$SidecarDir = Join-Path $GlobalConfigDir "sidecars\edupage-homework-sync"
New-Item -ItemType Directory -Force -Path $SidecarDir | Out-Null
$PushScriptPath = Join-Path $GlobalPluginDir "scripts\push_tasks.py"

$SidecarObj = @{
    builtin = "schedule"
    args = @(
        "CRON_TZ=Europe/Prague 0 15,18 * * 1-5",
        "agentapi",
        "new-conversation",
        "--",
        "Použij skill homework-to-calendar: zkontroluj v EduPage nadcházející domácí úkoly a ohlášené testy podle rozvrhu, nové domácí úkoly odešli přes skript '$PushScriptPath' do Google Tasks (s due na dnešek a deadlinem den před odevzdáním v titulku) a případné testy zapiš přes gcalendar na přesnou vyučovací hodinu."
    )
    restart_policy = "always"
    display_name = "EduPage Homework & Tests Sync"
    description = "Každý všední den v 15:00 a 18:00 (Europe/Prague) zkontroluje nové domácí úkoly a testy v EduPage a zapíše je do Google Tasks / Google Kalendáře."
    agent_permissions = @{
        access_grants = @(
            "mcp(edupage_edupage/get_subdomains)",
            "mcp(edupage_edupage/get_timeline)",
            "mcp(edupage_edupage/get_homework_material)",
            "mcp(edupage_edupage/get_my_timetable)",
            "mcp(edupage_edupage/get_student_timetable)",
            "mcp(edupage_edupage/get_day_summary)",
            "command(uvx)",
            "command(python)"
        )
    }
}
$SidecarJson = $SidecarObj | ConvertTo-Json -Depth 6
Set-Content -Path (Join-Path $SidecarDir "sidecar.json") -Value $SidecarJson -Encoding UTF8

Write-Host "[4/4] Automatizace 'EduPage Homework & Tests Sync' byla vytvořena." -ForegroundColor Green
Write-Host ""
Write-Host "HOTOVO! Nyní v Antigravity:" -ForegroundColor Green
Write-Host "  1. Restartuj Antigravity."
Write-Host "  2. Nainstaluj a přihlas plugin 'Google Calendar' (pro zápis testů do kalendáře)."
Write-Host "  3. V levém panelu otevři 'Scheduled Tasks' (Automations) a zapni 'EduPage Homework & Tests Sync'."
