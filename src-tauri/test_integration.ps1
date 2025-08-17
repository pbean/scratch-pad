#!/usr/bin/env pwsh

# PowerShell script for running integration tests on Windows
# This is the Windows equivalent of test_integration.sh

Write-Host "Running integration tests on Windows..." -ForegroundColor Green

# Set error action preference
$ErrorActionPreference = "Stop"

try {
    # Run cross-platform tests
    Write-Host "Running cross-platform tests..." -ForegroundColor Yellow
    cargo test --test cross_platform_tests --release

    # Run integration tests
    Write-Host "Running integration tests..." -ForegroundColor Yellow
    cargo test --test integration_tests --release

    # Run IPC integration tests
    Write-Host "Running IPC integration tests..." -ForegroundColor Yellow
    cargo test --test ipc_integration_tests --release

    # Run window management tests
    Write-Host "Running window management tests..." -ForegroundColor Yellow
    cargo test --test window_management_tests --release

    Write-Host "All integration tests passed!" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "Integration tests failed: $_" -ForegroundColor Red
    exit 1
}