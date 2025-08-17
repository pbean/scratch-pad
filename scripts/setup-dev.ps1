#!/usr/bin/env pwsh

# Development environment setup script for Scratch Pad (Windows)
# This script helps set up the development environment on Windows

param(
    [switch]$SkipVisualStudio
)

Write-Host "🚀 Setting up Scratch Pad development environment on Windows..." -ForegroundColor Green

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        Write-Host "✓ $Command is installed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "✗ $Command is not installed" -ForegroundColor Red
        return $false
    }
}

# Check for Node.js
if (-not (Test-Command "node")) {
    Write-Host "⚠ Node.js not found. Please install Node.js 20 or later from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Node.js version
$nodeVersion = node --version
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan

# Install pnpm if not present
if (-not (Test-Command "pnpm")) {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "✓ pnpm installed" -ForegroundColor Green
}

# Check for Rust
if (-not (Test-Command "rustc")) {
    Write-Host "Installing Rust..." -ForegroundColor Yellow
    
    # Download and install Rust
    $rustupUrl = "https://win.rustup.rs/x86_64"
    $rustupPath = "$env:TEMP\rustup-init.exe"
    
    Write-Host "Downloading Rust installer..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath
    
    Write-Host "Running Rust installer..." -ForegroundColor Cyan
    Start-Process -FilePath $rustupPath -ArgumentList "-y" -Wait
    
    # Refresh environment variables
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    
    Write-Host "✓ Rust installed" -ForegroundColor Green
}

# Check Rust version
$rustVersion = rustc --version
Write-Host "Rust version: $rustVersion" -ForegroundColor Cyan

# Install Tauri CLI
if (-not (Test-Command "tauri")) {
    Write-Host "Installing Tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli
    Write-Host "✓ Tauri CLI installed" -ForegroundColor Green
}

# Check for Visual Studio Build Tools
if (-not $SkipVisualStudio) {
    Write-Host "Checking for Visual Studio Build Tools..." -ForegroundColor Cyan
    
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsInstalls = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
        if ($vsInstalls.Count -gt 0) {
            Write-Host "✓ Visual Studio Build Tools found" -ForegroundColor Green
        } else {
            Write-Host "⚠ Visual Studio Build Tools not found. Please install Visual Studio Community or Build Tools with C++ development tools." -ForegroundColor Yellow
            Write-Host "Download from: https://visualstudio.microsoft.com/downloads/" -ForegroundColor Cyan
        }
    } else {
        Write-Host "⚠ Visual Studio installer not found. Please install Visual Studio Community or Build Tools." -ForegroundColor Yellow
    }
}

# Install project dependencies
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
pnpm install
Write-Host "✓ Project dependencies installed" -ForegroundColor Green

# Run initial build to verify setup
Write-Host "Running initial build to verify setup..." -ForegroundColor Yellow
try {
    pnpm build
    Write-Host "✓ Initial build successful" -ForegroundColor Green
}
catch {
    Write-Host "✗ Build failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}

# Run tests to verify everything works
Write-Host "Running tests to verify setup..." -ForegroundColor Yellow
try {
    pnpm test --run
    Set-Location src-tauri
    cargo test
    Set-Location ..
    Write-Host "✓ All tests passed" -ForegroundColor Green
}
catch {
    Write-Host "⚠ Some tests failed, but setup is likely complete." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Development environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  pnpm tauri dev    - Start development server" -ForegroundColor White
Write-Host "  pnpm tauri build  - Build production app" -ForegroundColor White
Write-Host "  pnpm test         - Run frontend tests" -ForegroundColor White
Write-Host "  pnpm lint         - Run linter" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green