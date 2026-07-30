$base = 'http://localhost:5000/api'
$results = @()

function Test-Endpoint {
    param($name, $url, $expectCode = 200)
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        $code = $r.StatusCode
        $pass = if ($code -eq $expectCode) { "PASS" } else { "UNEXPECTED $code" }
        $results += [pscustomobject]@{ Endpoint = $name; Code = $code; Result = $pass; Body = ($r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue | ConvertTo-Json -Depth 1 -Compress -ErrorAction SilentlyContinue) }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($null -eq $code) { $code = "ERR" }
        $pass = if ($code -eq $expectCode) { "PASS" } else { "FAIL" }
        $results += [pscustomobject]@{ Endpoint = $name; Code = $code; Result = $pass; Body = $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length)) }
    }
}

# ── Public routes (no auth needed) ──────────────────────────────────
Test-Endpoint "GET /api/health"                     "$base/health"                  200
Test-Endpoint "GET /api/issues/nearby"              "$base/issues/nearby?lat=12.97&lng=77.59"  200
Test-Endpoint "GET /api/issues/mine"                "$base/issues/mine"             200

# POST create issue (body check - expect 400 with validation errors since empty body)
try {
    $r = Invoke-WebRequest -Uri "$base/issues" -Method POST -Body '{}' -ContentType 'application/json' -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    $results += [pscustomobject]@{ Endpoint = "POST /api/issues (empty - expect 400)"; Code = $r.StatusCode; Result = "UNEXPECTED $($r.StatusCode)"; Body = "" }
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $pass = if ($code -eq 400) { "PASS (validation blocking correctly)" } else { "FAIL" }
    $results += [pscustomobject]@{ Endpoint = "POST /api/issues (empty - expect 400)"; Code = $code; Result = $pass; Body = "" }
}

Test-Endpoint "GET /api/notifications"              "$base/notifications"           401

# ── Officer routes (no auth → 401 expected) ──────────────────────────
Test-Endpoint "GET /api/officer/issues"             "$base/officer/issues"          401
Test-Endpoint "GET /api/officer/work-orders"        "$base/officer/work-orders"     401
Test-Endpoint "GET /api/officer/repairs"            "$base/officer/repairs"         401
Test-Endpoint "GET /api/officer/contractors"        "$base/officer/contractors"     401
Test-Endpoint "GET /api/officer/stats"              "$base/officer/stats"           401
Test-Endpoint "GET /api/officer/copilot/history"    "$base/officer/copilot/history" 401
Test-Endpoint "GET /api/officer/duplicates"         "$base/officer/duplicates"      401
Test-Endpoint "GET /api/officer/ai/findings"        "$base/officer/ai/findings"     401
Test-Endpoint "GET /api/officer/issues/prioritized" "$base/officer/issues/prioritized" 401

# ── 404 check (bad route) ────────────────────────────────────────────
Test-Endpoint "GET /api/nonexistent (expect 404)"   "$base/nonexistent"             404

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CivicSense API Live Endpoint Report    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$pass  = ($results | Where-Object { $_.Result -like "PASS*" }).Count
$fail  = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
$total = $results.Count

$results | Format-Table -AutoSize -Property Endpoint, Code, Result

Write-Host ""
Write-Host "TOTAL: $total  |  PASS: $pass  |  FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host ""
if ($fail -eq 0) {
    Write-Host "All endpoints responding correctly!" -ForegroundColor Green
} else {
    Write-Host "Failed routes:" -ForegroundColor Red
    $results | Where-Object { $_.Result -eq "FAIL" } | ForEach-Object { Write-Host "  - $($_.Endpoint): HTTP $($_.Code)" -ForegroundColor Red }
}
