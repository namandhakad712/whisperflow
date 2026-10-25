# Generates WhisperFlow icons (original artwork): gradient rounded square + waveform bars.
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$outPath, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $c1 = [System.Drawing.Color]::FromArgb(255, 34, 211, 238)
  $c2 = [System.Drawing.Color]::FromArgb(255, 14, 165, 233)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)

  $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($rounded) {
    $r = [int]($size * 0.22)
    $shape.AddArc($rect.X, $rect.Y, 2 * $r, 2 * $r, 180, 90)
    $shape.AddArc($rect.Right - 2 * $r, $rect.Y, 2 * $r, 2 * $r, 270, 90)
    $shape.AddArc($rect.Right - 2 * $r, $rect.Bottom - 2 * $r, 2 * $r, 2 * $r, 0, 90)
    $shape.AddArc($rect.X, $rect.Bottom - 2 * $r, 2 * $r, 2 * $r, 90, 90)
    $shape.CloseFigure()
  } else {
    $shape.AddEllipse($rect)
  }
  $g.FillPath($bg, $shape)

  # waveform bars (proportions of the favicon design): x, heightFactor
  $bars = @(
    @{ x = 0.22; h = 0.19 },
    @{ x = 0.36; h = 0.44 },
    @{ x = 0.50; h = 0.69 },
    @{ x = 0.64; h = 0.38 },
    @{ x = 0.78; h = 0.13 }
  )
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 11, 18, 32))
  foreach ($b in $bars) {
    $bw = $size * 0.078
    $bh = $size * $b.h
    $bx = $size * $b.x - $bw / 2
    $by = ($size - $bh) / 2
    $barRect = New-Object System.Drawing.RectangleF([float]$bx, [float]$by, [float]$bw, [float]$bh)
    $barPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $br = $bw / 2
    $barPath.AddArc($barRect.X, $barRect.Y, 2 * $br, 2 * $br, 180, 90)
    $barPath.AddArc($barRect.Right - 2 * $br, $barRect.Y, 2 * $br, 2 * $br, 270, 90)
    $barPath.AddArc($barRect.Right - 2 * $br, $barRect.Bottom - 2 * $br, 2 * $br, 2 * $br, 0, 90)
    $barPath.AddArc($barRect.X, $barRect.Bottom - 2 * $br, 2 * $br, 2 * $br, 90, 90)
    $barPath.CloseFigure()
    $g.FillPath($dark, $barPath)
  }

  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $outPath ($size x $size)"
}

$root = Split-Path -Parent $PSScriptRoot
$res = Join-Path $root "resources"
New-Item -ItemType Directory -Force -Path $res | Out-Null
New-Icon 256 (Join-Path $res "icon.png") $true
New-Icon 32 (Join-Path $res "tray.png") $true
New-Icon 512 (Join-Path $res "icon@2x.png") $true
