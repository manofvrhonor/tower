# Сканирует assets/hdri/ и пишет manifest.json (для Netlify, где нет listing).
# Локально с npx serve listing работает и без этого скрипта.
$dir = Join-Path $PSScriptRoot '..\assets\hdri'
$out = Join-Path $dir 'manifest.json'
$ext = @('.hdr', '.jpg', '.jpeg', '.png')
$names = Get-ChildItem -Path $dir -File |
  Where-Object { $ext -contains $_.Extension.ToLower() } |
  Sort-Object Name |
  ForEach-Object { $_.Name }
$json = ($names | ConvertTo-Json -Compress)
if (-not $names) { $json = '[]' }
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Host "manifest.json: $($names.Count) file(s)"
