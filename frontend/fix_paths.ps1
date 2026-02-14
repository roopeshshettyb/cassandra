
$files = Get-ChildItem -Path "d:\Chatbot\cassandra\frontend\src" -Recurse -Include *.tsx,*.ts,*.js,*.jsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $newContent = $content -replace 'from "@/', 'from "'
    $newContent = $newContent -replace "from '@/", "from '"
    $newContent = $newContent -replace 'import "@/', 'import "'
    $newContent = $newContent -replace "import '@/", "import '"
    
    if ($content -ne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent
        Write-Host "Updated $($file.Name)"
    }
}
