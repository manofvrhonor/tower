# Сканирует assets/models/machine/{attach,box,core,drum,end} и junk/.
# Пишет assets/models/machine-manifest.json — только vis .glb (без _COL).
# Запускать после добавления новых деталей в папки стадий сборки.
$modelsRoot = Join-Path $PSScriptRoot '..\assets\models'
$machineDir = Join-Path $modelsRoot 'machine'
$junkDir = Join-Path $modelsRoot 'junk'
$out = Join-Path $modelsRoot 'machine-manifest.json'

function Get-VisGlbs($dir) {
  if (-not (Test-Path $dir)) { return @() }
  Get-ChildItem -Path $dir -File -Filter '*.glb' |
    Where-Object { $_.Name -notmatch '_COL\.glb$' } |
    Sort-Object Name |
    ForEach-Object { $_.Name }
}

$manifest = [ordered]@{
  attach = @(Get-VisGlbs (Join-Path $machineDir 'attach'))
  box    = @(Get-VisGlbs (Join-Path $machineDir 'box'))
  core   = @(Get-VisGlbs (Join-Path $machineDir 'core'))
  drum   = @(Get-VisGlbs (Join-Path $machineDir 'drum'))
  end    = @(Get-VisGlbs (Join-Path $machineDir 'end'))
  junk   = @(Get-VisGlbs $junkDir)
}

$json = ($manifest | ConvertTo-Json -Compress -Depth 4)
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Host "machine-manifest.json: attach=$($manifest.attach.Count) box=$($manifest.box.Count) core=$($manifest.core.Count) drum=$($manifest.drum.Count) end=$($manifest.end.Count) junk=$($manifest.junk.Count)"
