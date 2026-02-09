$dir = "c:\Users\kamle\Downloads\InOut Billing\InOut Billing\backend\src\Template\Sale-Invoice-Template"
$renames = @{
    "saleinvoicedefault.html" = "Template-Default.html";
    "saleinvoice_1.html" = "Template-1.html";
    "saleinvoice_2.html" = "Template-2.html";
    "saleinvoice_3.html" = "Template-3.html";
    "saleinvoice_4.html" = "Template-4.html";
    "saleinvoice_5.html" = "Template-5.html";
    "saleinvoice_6.html" = "Template-6.html";
    "saleinvoice_7.html" = "Template-7.html";
    "saleinvoice_8.html" = "Template-8.html";
    "saleinvoice_9.html" = "Template-9.html";
    "saleinvoice_10.html" = "Template-10.html";
    "saleinvoice_11.html" = "Template-11.html";
    "saleinvoice_12.html" = "Template-12.html";
    "saleinvoice_13.html" = "Template-13.html";
    "saleinvoice_A5_1.html" = "Template-A5.html";
    "saleinvoice_A5_2_1.html" = "Template-A5-2.html";
    "saleinvoice_A5_3_1.html" = "Template-A5-3.html";
    "saleinvoice_A5_4_1.html" = "Template-A5-4.html";
    "saleinvoice_A5_5_1.html" = "Template-A5-5.html";
    "saleinvoice_thermal_1.html" = "Thermal-Template-1.html";
    "saleinvoice_thermal_2.html" = "Thermal-Template-2.html";
    "saleinvoice_thermal_3.html" = "Thermal-Template-3.html"
}

foreach ($key in $renames.Keys) {
    $oldPath = Join-Path $dir $key
    $newPath = Join-Path $dir $renames[$key]
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName $renames[$key]
        Write-Host "Renamed $key to $($renames[$key])"
    } else {
        Write-Host "File not found: $key"
    }
}
