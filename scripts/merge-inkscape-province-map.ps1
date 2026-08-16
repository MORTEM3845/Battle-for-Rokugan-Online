$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $repositoryRoot 'src\assets\rokugan-provinces.svg'
$editedPath = Join-Path $repositoryRoot 'tmp\inkscape\rokugan-map-editable.svg'

if (-not (Test-Path -LiteralPath $editedPath)) {
    throw "Не найден рабочий SVG: $editedPath"
}

[xml]$source = Get-Content -Raw -LiteralPath $sourcePath
[xml]$edited = Get-Content -Raw -LiteralPath $editedPath

$editedPaths = @{}
foreach ($path in $edited.SelectNodes("//*[local-name()='path' and @data-province-id]")) {
    $editedPaths[$path.GetAttribute('data-province-id')] = $path
}

# These IDs follow the user-marked, printed regions. The last number is a stable
# technical suffix; the first number is the territory number within its clan.
$renamedIds = @{
    'orangephoenix_1_03' = 'orangephoenix_3_05'
    'orangephoenix_2_04' = 'orangephoenix_1_03'
    'orangephoenix_3_05' = 'orangephoenix_2_04'
    'orangephoenix_4_11' = 'yellowlion_2_07'
    'yellowlion_2_07' = 'yellowlion_3_08'
    'yellowlion_3_08' = 'greendragon_3_08'
}

$restored = @()
foreach ($path in $source.SelectNodes("//*[local-name()='path' and @data-province-id]")) {
    $oldId = $path.GetAttribute('data-province-id')
    $editedPath = $editedPaths[$oldId]
    if ($editedPath) {
        $path.SetAttribute('d', $editedPath.GetAttribute('d'))
    } else {
        $restored += $oldId
    }

    if ($renamedIds.ContainsKey($oldId)) {
        $newId = $renamedIds[$oldId]
        $path.SetAttribute('id', $newId)
        $path.SetAttribute('data-province-id', $newId)
    }
}

$settings = New-Object System.Xml.XmlWriterSettings
$settings.Encoding = [Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$settings.NewLineChars = "`n"
$writer = [System.Xml.XmlWriter]::Create($sourcePath, $settings)
try { $source.Save($writer) }
finally { $writer.Dispose() }

Write-Output ("Restored original geometry for: " + ($restored -join ', '))
Write-Output ("Updated: $sourcePath")
