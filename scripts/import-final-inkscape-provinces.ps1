$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $root 'src\assets\rokugan-provinces.svg'
$editedPath = Join-Path $root 'tmp\inkscape\rokugan-map-editable.svg'

[xml]$source = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourcePath
[xml]$edited = Get-Content -Raw -Encoding UTF8 -LiteralPath $editedPath

$renamed = @{
    greendragon_2_02 = 'greendragon_province_1_02'; greendragon_1_01 = 'greendragon_capital_2_01'
    yellowlion_3_08 = 'greendragon_province_3_03'; orangephoenix_1_03 = 'orangephoenix_province_2_06'
    orangephoenix_3_05 = 'orangephoenix_province_1_05'; orangephoenix_2_04 = 'orangephoenix_capital_2_04'
    purpleunicorn_1_06 = 'purpleunicorn_capital_2_07'; purpleunicorn_3_10 = 'purpleunicorn_province_3_09'
    purpleunicorn_2_09 = 'purpleunicorn_province_1_08'; orangephoenix_4_11 = 'yellowlion_province_2_11'
    yellowlion_1_12 = 'yellowlion_capital_2_10'; yellowlion_2_07 = 'yellowlion_province_2_12'
    goldcoast_2_23 = 'goldcoast_province_2_24'; goldcoast_1_22 = 'goldcoast_province_3_23'
    goldcoast_3_27 = 'goldcoast_province_3_25'; redscorpion_3_14 = 'redscorpion_province_1_15'
    redscorpion_2_13 = 'redscorpion_province_3_14'; redscorpion_1_16 = 'redscorpion_capital_2_13'
    blackshadowlandsnorth_1_24 = 'blackshadowlandsnorth_province_1_29'
    blackshadowlandssouth_1_30 = 'blackshadowlandssouth_province_1_30'
    graycrab_4_21 = 'graycrab_province_2_22'; graycrab_1_26 = 'graycrab_capital_2_19'
    graycrab_3_19 = 'graycrab_province_3_21'; graycrab_2_17 = 'graycrab_province_1_20'
    lavenderislands_1_25 = 'lavenderislands_province_2_26'; lavenderislands_2_28 = 'lavenderislands_province_1_27'
    lavenderislands_3_29 = 'lavenderislands_province_1_28'; lightbluecrane_1_15 = 'lightbluecrane_capital_2_16'
    lightbluecrane_2_18 = 'lightbluecrane_province_2_17'
}

$targetGroup = $source.SelectSingleNode("//*[local-name()='g' and @id='provinces']")
foreach ($node in @($targetGroup.SelectNodes("*[local-name()='path']"))) { [void]$targetGroup.RemoveChild($node) }

$imported = 0
foreach ($path in $edited.SelectNodes("//*[local-name()='path']")) {
    $oldId = $path.GetAttribute('data-province-id')
    $newId = if ($oldId) { $renamed[$oldId] } elseif ($path.GetAttribute('id') -eq 'path60') { 'lightbluecrane_province_3_18' } else { $null }
    if (-not $newId) { continue }

    $copy = $source.ImportNode($path, $true)
    $copy.SetAttribute('id', $newId)
    $copy.SetAttribute('data-province-id', $newId)
    $copy.SetAttribute('data-province-name', $newId)
    $copy.SetAttribute('role', 'button')
    $copy.SetAttribute('tabindex', '0')
    $copy.SetAttribute('vector-effect', 'non-scaling-stroke')
    [void]$targetGroup.AppendChild($copy)
    $imported++
}

if ($imported -ne 30) { throw "Ожидалось 30 контуров, импортировано: $imported" }

$settings = [System.Xml.XmlWriterSettings]::new()
$settings.Encoding = [Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$writer = [System.Xml.XmlWriter]::Create($sourcePath, $settings)
try { $source.Save($writer) } finally { $writer.Dispose() }
Write-Output "Imported $imported province contours."
