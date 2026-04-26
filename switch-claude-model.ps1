# Claude Model Switcher
# PowerShell Version

$CONFIG_FILE = "$env:USERPROFILE\.claude\settings.json"

# GLM
$GLM_BASE_URL = "https://open.bigmodel.cn/api/anthropic"
$GLM_TOKEN = "bba1c23de23e4436b91545401025a301.SYRnzu7Bo142CrkW"
$GLM_HAIKU = "glm-4.5-air"
$GLM_SONNET = "glm-5-turbo"
$GLM_OPUS = "glm-5.1"

# DeepSeek
$DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic"
$DEEPSEEK_TOKEN = "sk-b1c69d13703d4bf7bbf7807f62be10f6"
$DEEPSEEK_HAIKU = "deepseek-chat"
$DEEPSEEK_SONNET = "deepseek-chat"
$DEEPSEEK_OPUS = "deepseek-chat"

# MiniMax
$MINIMAX_BASE_URL = "https://api.minimaxi.com/anthropic"
$MINIMAX_TOKEN = "sk-cp-DnjW8j0h_7B8GsSoGjrHmH3vvR_ezEMYGx-nxRt42X888XYL7r0t3h8gOYPOdly-U6C07SLNTrABsgAu0iRkgI94yNI3ip2URDzuU5J9a_6DTow9RZh5AWI"
$MINIMAX_HAIKU = "MiniMax-M2.5"
$MINIMAX_SONNET = "MiniMax-M2.5"
$MINIMAX_OPUS = "MiniMax-M2.5"

# Xiaomi
$XIAOMI_BASE_URL = "https://token-plan-cn.xiaomimimo.com/anthropic"
$XIAOMI_TOKEN = "tp-cnexdt9tkl8nu3e127py573vdo2u6s72bp2mwsk66pdkusfb"
$XIAOMI_HAIKU = "mimo-v2-pro"
$XIAOMI_SONNET = "mimo-v2-pro"
$XIAOMI_OPUS = "mimo-v2-pro"

# Custom
$CUSTOM_BASE_URL = "https://your-api-endpoint.com"
$CUSTOM_TOKEN = "your-custom-token-here"
$CUSTOM_HAIKU = "your-model"
$CUSTOM_SONNET = "your-model"
$CUSTOM_OPUS = "your-model"

$script:Options = @("GLM", "Claude Official", "DeepSeek", "MiniMax", "Xiaomi", "Custom")

function Apply-Config {
    param([string]$Name, [string]$BaseUrl, [string]$Token, [string]$Haiku, [string]$Sonnet, [string]$Opus)
    $configDir = Split-Path -Parent $CONFIG_FILE
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
    $jsonContent = @{ env = @{
        ANTHROPIC_AUTH_TOKEN = $Token
        ANTHROPIC_BASE_URL = $BaseUrl
        API_TIMEOUT_MS = "3000000"
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1
        ANTHROPIC_DEFAULT_HAIKU_MODEL = $Haiku
        ANTHROPIC_DEFAULT_SONNET_MODEL = $Sonnet
        ANTHROPIC_DEFAULT_OPUS_MODEL = $Opus
    }} | ConvertTo-Json -Depth 10
    Set-Content -Path $CONFIG_FILE -Value $jsonContent -Encoding UTF8
    Write-Host "[OK] Switched to: $Name" -ForegroundColor Green
    exit 0
}

function Get-CurrentInfo {
    if (Test-Path $CONFIG_FILE) {
        $content = Get-Content $CONFIG_FILE -Raw | ConvertFrom-Json
        return "Current: " + $content.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
    }
    return "Current: Not configured"
}

function Show-Menu {
    param([int]$Selected)
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Claude Model Switcher" -ForegroundColor Cyan
    Write-Host "   Arrow Keys + Enter to select" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host (Get-CurrentInfo)
    Write-Host ""
    for ($i = 0; $i -lt $script:Options.Count; $i++) {
        if ($i -eq $Selected) { Write-Host "> " $script:Options[$i] -ForegroundColor Green }
        else { Write-Host "  " $script:Options[$i] }
    }
    Write-Host ""
    Write-Host "Arrows: move | Enter: select | Q: quit" -ForegroundColor Yellow
}

function Process-Choice {
    param([string]$Choice)
    switch ($Choice) {
        "GLM" { Apply-Config "GLM" $GLM_BASE_URL $GLM_TOKEN $GLM_HAIKU $GLM_SONNET $GLM_OPUS }
        "Claude Official" { Remove-Item $CONFIG_FILE -Force -EA SilentlyContinue; Write-Host "[OK] Switched to Claude Official" -ForegroundColor Green; exit 0 }
        "DeepSeek" { Apply-Config "DeepSeek" $DEEPSEEK_BASE_URL $DEEPSEEK_TOKEN $DEEPSEEK_HAIKU $DEEPSEEK_SONNET $DEEPSEEK_OPUS }
        "MiniMax" { Apply-Config "MiniMax" $MINIMAX_BASE_URL $MINIMAX_TOKEN $MINIMAX_HAIKU $MINIMAX_SONNET $MINIMAX_OPUS }
        "Xiaomi" { Apply-Config "Xiaomi" $XIAOMI_BASE_URL $XIAOMI_TOKEN $XIAOMI_HAIKU $XIAOMI_SONNET $XIAOMI_OPUS }
        "Custom" { Apply-Config "Custom" $CUSTOM_BASE_URL $CUSTOM_TOKEN $CUSTOM_HAIKU $CUSTOM_SONNET $CUSTOM_OPUS }
    }
}

function Show-BuiltinSelect {
    $selected = 0
    $total = $script:Options.Count
    Show-Menu -Selected $selected
    while ($true) {
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        switch ($key.VirtualKeyCode) {
            38 { if ($selected -gt 0) { $selected--; Show-Menu -Selected $selected } }
            40 { if ($selected -lt ($total - 1)) { $selected++; Show-Menu -Selected $selected } }
            13 { Process-Choice -Choice $script:Options[$selected]; exit 0 }
            81 { exit 0 }
            113 { exit 0 }
        }
    }
}

$configDir = Split-Path -Parent $CONFIG_FILE
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
Show-BuiltinSelect
