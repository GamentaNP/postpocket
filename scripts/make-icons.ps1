# Regenerates the PostPocket PNG icons. Windows PowerShell / .NET System.Drawing.
Add-Type -AssemblyName System.Drawing

$S = 512
$bmp = New-Object System.Drawing.Bitmap($S, $S)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Pure monochrome: solid black background, white glyph.
$amber = [System.Drawing.Color]::FromArgb(255, 0, 0, 0)
$amberLight = [System.Drawing.Color]::FromArgb(255, 0, 0, 0)
$ink = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

# Amber gradient background
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 0)),
  (New-Object System.Drawing.Point($S, $S)),
  $amberLight, $amber)
$g.FillRectangle($bg, 0, 0, $S, $S)

$pen = New-Object System.Drawing.Pen($ink, 22)
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$inkBrush = New-Object System.Drawing.SolidBrush($ink)

# Pocket outline (open top, V-shaped bottom)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddLine(95, 150, 95, 320)
$path.AddArc(95, 300, 40, 40, 180, 90)
$path.AddLine(135, 360, 232, 414)
$path.AddLine(256, 428, 280, 414)
$path.AddLine(377, 360, 377, 340)
$path.AddArc(377, 300, 40, 40, 0, 90)
$path.AddLine(417, 320, 417, 150)
$g.DrawPath($pen, $path)

# Photo frame inside the pocket
$g.DrawRectangle($pen, 150, 125, 212, 150)
$g.FillEllipse($inkBrush, 312, 145, 28, 28)
$g.FillPolygon($inkBrush, @(
  (New-Object System.Drawing.Point(166, 262)),
  (New-Object System.Drawing.Point(232, 190)),
  (New-Object System.Drawing.Point(298, 262))
))
$g.FillPolygon($inkBrush, @(
  (New-Object System.Drawing.Point(268, 262)),
  (New-Object System.Drawing.Point(320, 210)),
  (New-Object System.Drawing.Point(350, 262))
))

$outDir = Join-Path $PSScriptRoot '..\icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

foreach ($size in 16, 48, 128) {
  $small = New-Object System.Drawing.Bitmap($size, $size)
  $sg = [System.Drawing.Graphics]::FromImage($small)
  $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $sg.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
  $pathOut = Join-Path $outDir ("icon{0}.png" -f $size)
  $small.Save($pathOut, [System.Drawing.Imaging.ImageFormat]::Png)
  $sg.Dispose(); $small.Dispose()
  Write-Host "wrote $pathOut"
}

$g.Dispose(); $bmp.Dispose()
