$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectSvgPath = Join-Path $repositoryRoot 'src\assets\rokugan-provinces.svg'
$userSvgPath = 'C:\Users\tomko\Downloads\rokugan-map-editable.svg'

if (-not (Test-Path -LiteralPath $userSvgPath)) {
    throw "Не найден сохранённый пользователем SVG: $userSvgPath"
}

[xml]$projectSvg = Get-Content -Raw -LiteralPath $projectSvgPath
[xml]$userSvg = Get-Content -Raw -LiteralPath $userSvgPath

$userPaths = @{}
foreach ($path in $userSvg.SelectNodes("//*[local-name()='path' and @data-province-id]")) {
    $userPaths[$path.GetAttribute('data-province-id')] = $path
}

# The project IDs were renamed to match the agreed numbered clan territories;
# the user's Inkscape document retains the original path IDs.
$sourceIdByProjectId = @{
    'orangephoenix_3_05' = 'orangephoenix_1_03'
    'orangephoenix_1_03' = 'orangephoenix_2_04'
    'orangephoenix_2_04' = 'orangephoenix_3_05'
    'yellowlion_2_07' = 'orangephoenix_4_11'
    'yellowlion_3_08' = 'yellowlion_2_07'
    'greendragon_3_08' = 'yellowlion_3_08'
}

$restored = @()
foreach ($path in $projectSvg.SelectNodes("//*[local-name()='path' and @data-province-id]")) {
    $projectId = $path.GetAttribute('data-province-id')
    $sourceId = $sourceIdByProjectId[$projectId]
    if (-not $sourceId) { $sourceId = $projectId }
    $userPath = $userPaths[$sourceId]

    if ($userPath) {
        $path.SetAttribute('d', $userPath.GetAttribute('d'))
    } else {
        $restored += $projectId
    }
}

$settings = New-Object System.Xml.XmlWriterSettings
$settings.Encoding = [Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$settings.NewLineChars = "`n"
$writer = [System.Xml.XmlWriter]::Create($projectSvgPath, $settings)
try { $projectSvg.Save($writer) }
finally { $writer.Dispose() }

Write-Output ("Kept existing geometry for missing user paths: " + ($restored -join ', '))
