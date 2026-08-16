param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\tmp\inkscape')
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mapPath = Join-Path $repositoryRoot 'public\assets\rokugan-map.png'
$provincePath = Join-Path $repositoryRoot 'src\assets\rokugan-provinces.svg'
$starsPath = Join-Path $repositoryRoot 'public\assets\rokugan-honor-stars.svg'

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$cleanMapPath = Join-Path $OutputDirectory 'rokugan-map-clean.png'
$documentPath = Join-Path $OutputDirectory 'rokugan-map-editable.svg'

# The source PNG contains C2PA chunks which some Inkscape builds cannot import.
# Bitmap.Save writes a standard PNG while leaving the original asset untouched.
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile($mapPath)
try {
    $clean = New-Object System.Drawing.Bitmap $source.Width, $source.Height
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($clean)
        try { $graphics.DrawImageUnscaled($source, 0, 0) }
        finally { $graphics.Dispose() }
        $clean.Save($cleanMapPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally { $clean.Dispose() }
}
finally { $source.Dispose() }

function Read-NestedSvg([string]$Path) {
    $content = Get-Content -Raw -LiteralPath $Path
    return [regex]::Replace($content, '^\s*<\?xml[^>]*\?>\s*', '')
}

$provinces = Read-NestedSvg $provincePath
$provinces = $provinces.Replace('fill="transparent" stroke="transparent"', 'fill="none" stroke="#ff00ff"')
$stars = Read-NestedSvg $starsPath
$relativeMapPath = 'rokugan-map-clean.png'

$document = @"
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="1024" height="1536" viewBox="0 0 1024 1536">
  <g inkscape:groupmode="layer" inkscape:label="Карта PNG (чистая копия)" id="map-raster">
    <image id="rokugan-map" x="-256" y="256" width="1536" height="1024" href="$relativeMapPath" xlink:href="$relativeMapPath" transform="rotate(-90 512 768)" />
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Границы провинций (SVG)" id="province-borders">
    $provinces
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Звёзды" id="honor-stars">
    $stars
  </g>
</svg>
"@

[IO.File]::WriteAllText($documentPath, $document, [Text.UTF8Encoding]::new($false))

$inkscapeCandidates = @(@(
    (Get-Command inkscape.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source),
    (Join-Path $env:ProgramFiles 'Inkscape\bin\inkscape.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inkscape\bin\inkscape.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

if ($inkscapeCandidates) {
    Write-Output ("Opening with: " + $inkscapeCandidates[0])
    Start-Process -FilePath $inkscapeCandidates[0] -ArgumentList ('"{0}"' -f $documentPath)
} else {
    Start-Process -FilePath $documentPath
}

Write-Output $documentPath
