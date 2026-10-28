param([ValidateSet('install','dev','build','test','start','lint')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
if (Get-Command pnpm -ErrorAction SilentlyContinue) { & pnpm $Task; exit $LASTEXITCODE }
$bundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs'
if (Test-Path -LiteralPath $bundledPnpm) { & node $bundledPnpm $Task; exit $LASTEXITCODE }
if (Get-Command npm -ErrorAction SilentlyContinue) { if ($Task -eq 'install') { & npm install } else { & npm run $Task }; exit $LASTEXITCODE }
throw 'Install Node.js 22 or later and npm or pnpm, then retry.'
