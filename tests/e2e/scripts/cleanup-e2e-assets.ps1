param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$apiBase = if ($env:E2E_API_BASE_URL) { $env:E2E_API_BASE_URL } else { "http://127.0.0.1:9000/api" }
$domain = if ($env:E2E_BUSINESS_DOMAIN) { $env:E2E_BUSINESS_DOMAIN } else { "bd_public" }
$headers = @{
    "x-business-domain" = $domain
    Accept              = "application/json"
}

$patterns = @('^at_e2e_', '^e2e_', '^demo_', '^quick_api_')

function Test-AssetName([string]$Name) {
    if (-not $Name) { return $false }
    foreach ($pattern in $patterns) {
        if ($Name -match $pattern) { return $true }
    }
    return $false
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        $Body
    )
    if ($DryRun) { return }
    $params = @{
        Method  = $Method
        Uri     = $Url
        Headers = $headers
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 20)
        $params.ContentType = "application/json"
    }
    try {
        Invoke-RestMethod @params | Out-Null
    } catch {
        Write-Warning "$Method $Url failed: $($_.Exception.Message)"
    }
}

function Get-AllPages {
    param(
        [string]$ListUrl
    )
    $items = @()
    for ($page = 1; $page -le 50; $page++) {
        $url = "$ListUrl&page=$page&page_size=100"
        $body = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
        $pageItems = @($body.data)
        if ($pageItems.Count -eq 0) { break }
        $items += $pageItems
        $total = [int]($body.total)
        if ($page * 100 -ge $total) { break }
    }
    return $items
}

Write-Host "Cleaning E2E assets from $apiBase (DryRun=$DryRun)"

$summary = @{ operators = 0; toolboxes = 0; mcps = 0; skills = 0 }

foreach ($op in (Get-AllPages "$apiBase/agent-operator-integration/v1/operator/info/list?")) {
    if (-not (Test-AssetName $op.name)) { continue }
    $summary.operators++
    if (-not $DryRun) {
        Invoke-Api POST "$apiBase/agent-operator-integration/v1/operator/status" @(
            @{ operator_id = $op.operator_id; version = $op.version; status = "offline" }
        )
        Invoke-Api DELETE "$apiBase/agent-operator-integration/v1/operator/delete" @(
            @{ operator_id = $op.operator_id; version = $op.version }
        )
    }
}

foreach ($box in (Get-AllPages "$apiBase/agent-operator-integration/v1/tool-box/list?")) {
    $name = if ($box.box_name) { $box.box_name } else { $box.name }
    if (-not (Test-AssetName $name)) { continue }
    $summary.toolboxes++
    if (-not $DryRun) {
        Invoke-Api POST "$apiBase/agent-operator-integration/v1/tool-box/$($box.box_id)/status" @{ status = "offline" }
        Invoke-Api DELETE "$apiBase/agent-operator-integration/v1/tool-box/$($box.box_id)" $null
    }
}

foreach ($mcp in (Get-AllPages "$apiBase/agent-operator-integration/v1/mcp/list?")) {
    if (-not (Test-AssetName $mcp.name)) { continue }
    $summary.mcps++
    if (-not $DryRun) {
        Invoke-Api POST "$apiBase/agent-operator-integration/v1/mcp/$($mcp.mcp_id)/status" @{ status = "offline" }
        Invoke-Api DELETE "$apiBase/agent-operator-integration/v1/mcp/$($mcp.mcp_id)" $null
    }
}

foreach ($skill in (Get-AllPages "$apiBase/agent-operator-integration/v1/skills?")) {
    if (-not (Test-AssetName $skill.name)) { continue }
    $summary.skills++
    if (-not $DryRun) {
        Invoke-Api PUT "$apiBase/agent-operator-integration/v1/skills/$($skill.skill_id)/status" @{ status = "offline" }
        Invoke-Api DELETE "$apiBase/agent-operator-integration/v1/skills/$($skill.skill_id)" $null
    }
}

Write-Host ("Summary: operators={0} toolboxes={1} mcps={2} skills={3}" -f `
    $summary.operators, $summary.toolboxes, $summary.mcps, $summary.skills)
