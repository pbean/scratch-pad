# Scratch Pad Installation Validation Script for Windows
# This script validates the installation and basic functionality on Windows

param(
    [switch]$Verbose,
    [switch]$GenerateReport = $true
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Colors for output
$Colors = @{
    Info = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
}

# Logging functions
function Write-LogInfo {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Info
}

function Write-LogSuccess {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Success
}

function Write-LogWarning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Warning
}

function Write-LogError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Error
}

# Global variables for validation results
$ValidationResults = @{
    SystemRequirements = $false
    ExecutableFound = $false
    FilePermissions = $false
    BasicFunctionality = $false
    DesktopIntegration = $false
    DataDirectory = $false
}

$ScratchPadExecutable = $null

# Validate system requirements
function Test-SystemRequirements {
    Write-LogInfo "Validating system requirements..."
    
    # Check Windows version
    $WindowsVersion = [System.Environment]::OSVersion.Version
    $RequiredVersion = [Version]"10.0.0.0"
    
    if ($WindowsVersion -ge $RequiredVersion) {
        Write-LogSuccess "Windows version $($WindowsVersion) meets requirements (>= Windows 10)"
        $ValidationResults.SystemRequirements = $true
    } else {
        Write-LogError "Windows version $($WindowsVersion) is below required version (Windows 10)"
        return $false
    }
    
    # Check for WebView2
    $WebView2Paths = @(
        "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application",
        "${env:ProgramFiles}\Microsoft\EdgeWebView\Application",
        "${env:LOCALAPPDATA}\Microsoft\EdgeWebView\Application"
    )
    
    $WebView2Found = $false
    foreach ($Path in $WebView2Paths) {
        if (Test-Path $Path) {
            Write-LogSuccess "WebView2 found at: $Path"
            $WebView2Found = $true
            break
        }
    }
    
    if (-not $WebView2Found) {
        Write-LogWarning "WebView2 not found in common locations. It may be installed elsewhere or will be installed automatically."
    }
    
    Write-LogSuccess "System requirements validation completed"
    return $true
}

# Find Scratch Pad executable
function Find-ScratchPadExecutable {
    Write-LogInfo "Looking for Scratch Pad executable..."
    
    # Common installation paths
    $PossiblePaths = @(
        "${env:ProgramFiles}\scratch-pad\scratch-pad.exe",
        "${env:ProgramFiles(x86)}\scratch-pad\scratch-pad.exe",
        "${env:LOCALAPPDATA}\Programs\scratch-pad\scratch-pad.exe",
        "${env:APPDATA}\scratch-pad\scratch-pad.exe"
    )
    
    # Check if it's in PATH
    $PathExecutable = Get-Command "scratch-pad" -ErrorAction SilentlyContinue
    if ($PathExecutable) {
        $script:ScratchPadExecutable = $PathExecutable.Source
        Write-LogSuccess "Found scratch-pad in PATH: $($script:ScratchPadExecutable)"
        $ValidationResults.ExecutableFound = $true
        return $true
    }
    
    # Check common paths
    foreach ($Path in $PossiblePaths) {
        if (Test-Path $Path) {
            $script:ScratchPadExecutable = $Path
            Write-LogSuccess "Found scratch-pad at: $Path"
            $ValidationResults.ExecutableFound = $true
            return $true
        }
    }
    
    Write-LogError "Scratch Pad executable not found"
    Write-LogInfo "Please ensure Scratch Pad is installed and accessible"
    return $false
}

# Test basic functionality
function Test-BasicFunctionality {
    Write-LogInfo "Testing basic functionality..."
    
    if (-not $script:ScratchPadExecutable) {
        Write-LogError "No executable found to test"
        return $false
    }
    
    try {
        # Test version command (if supported)
        $VersionOutput = & $script:ScratchPadExecutable --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-LogSuccess "Version check passed: $VersionOutput"
        } else {
            Write-LogWarning "Version check not available"
        }
        
        # Test help command (if supported)
        $HelpOutput = & $script:ScratchPadExecutable --help 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-LogSuccess "Help command available"
        } else {
            Write-LogWarning "Help command not available"
        }
        
        # Test creating a note from command line (if supported)
        $TestNote = "Test note from validation script - $(Get-Date)"
        $NoteOutput = & $script:ScratchPadExecutable $TestNote 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-LogSuccess "Command line note creation test passed"
        } else {
            Write-LogWarning "Command line note creation test failed or not supported"
        }
        
        $ValidationResults.BasicFunctionality = $true
        return $true
    }
    catch {
        Write-LogError "Error testing basic functionality: $($_.Exception.Message)"
        return $false
    }
}

# Test file permissions
function Test-FilePermissions {
    Write-LogInfo "Testing file permissions..."
    
    if (-not $script:ScratchPadExecutable) {
        Write-LogError "No executable found to test permissions"
        return $false
    }
    
    try {
        # Check if file exists and is readable
        if (Test-Path $script:ScratchPadExecutable -PathType Leaf) {
            Write-LogSuccess "Executable exists and is accessible"
            
            # Get file info
            $FileInfo = Get-Item $script:ScratchPadExecutable
            Write-LogInfo "File size: $($FileInfo.Length) bytes"
            Write-LogInfo "Last modified: $($FileInfo.LastWriteTime)"
            
            $ValidationResults.FilePermissions = $true
            return $true
        } else {
            Write-LogError "Executable file is not accessible"
            return $false
        }
    }
    catch {
        Write-LogError "Error checking file permissions: $($_.Exception.Message)"
        return $false
    }
}

# Test desktop integration
function Test-DesktopIntegration {
    Write-LogInfo "Testing desktop integration..."
    
    # Check for Start Menu shortcut
    $StartMenuPaths = @(
        "${env:ProgramData}\Microsoft\Windows\Start Menu\Programs\scratch-pad.lnk",
        "${env:APPDATA}\Microsoft\Windows\Start Menu\Programs\scratch-pad.lnk"
    )
    
    $ShortcutFound = $false
    foreach ($Path in $StartMenuPaths) {
        if (Test-Path $Path) {
            Write-LogSuccess "Start Menu shortcut found: $Path"
            $ShortcutFound = $true
            break
        }
    }
    
    if (-not $ShortcutFound) {
        Write-LogWarning "Start Menu shortcut not found"
    }
    
    # Check for desktop shortcut
    $DesktopShortcut = "$env:USERPROFILE\Desktop\scratch-pad.lnk"
    if (Test-Path $DesktopShortcut) {
        Write-LogSuccess "Desktop shortcut found"
    } else {
        Write-LogInfo "Desktop shortcut not found (may not have been created during installation)"
    }
    
    # Check registry entries (basic check)
    try {
        $UninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        $ScratchPadEntry = Get-ItemProperty $UninstallKey | Where-Object { $_.DisplayName -like "*scratch-pad*" }
        
        if ($ScratchPadEntry) {
            Write-LogSuccess "Registry entry found for uninstallation"
        } else {
            Write-LogWarning "Registry entry not found (may be installed per-user)"
        }
    }
    catch {
        Write-LogWarning "Could not check registry entries: $($_.Exception.Message)"
    }
    
    $ValidationResults.DesktopIntegration = $true
    return $true
}

# Test data directory access
function Test-DataDirectory {
    Write-LogInfo "Testing data directory access..."
    
    $DataDir = "${env:APPDATA}\scratch-pad"
    Write-LogInfo "Expected data directory: $DataDir"
    
    if (-not (Test-Path $DataDir)) {
        Write-LogInfo "Data directory doesn't exist yet (normal for fresh installation)"
        
        # Try to create it to test permissions
        try {
            New-Item -Path $DataDir -ItemType Directory -Force | Out-Null
            Write-LogSuccess "Successfully created data directory"
            
            # Test write permissions
            $TestFile = Join-Path $DataDir "test_write_permissions.txt"
            "Test" | Out-File -FilePath $TestFile -Encoding UTF8
            
            if (Test-Path $TestFile) {
                Remove-Item $TestFile -Force
                Write-LogSuccess "Data directory is writable"
                $ValidationResults.DataDirectory = $true
                return $true
            }
        }
        catch {
            Write-LogError "Cannot create or write to data directory: $($_.Exception.Message)"
            return $false
        }
    } else {
        Write-LogSuccess "Data directory exists"
        
        # Test write permissions
        try {
            $TestFile = Join-Path $DataDir "test_write_permissions.txt"
            "Test" | Out-File -FilePath $TestFile -Encoding UTF8
            
            if (Test-Path $TestFile) {
                Remove-Item $TestFile -Force
                Write-LogSuccess "Data directory is writable"
                $ValidationResults.DataDirectory = $true
                return $true
            }
        }
        catch {
            Write-LogError "Cannot write to data directory: $($_.Exception.Message)"
            return $false
        }
    }
    
    return $false
}

# Generate validation report
function New-ValidationReport {
    Write-LogInfo "Generating validation report..."
    
    $ReportFile = "scratch-pad-validation-report.txt"
    $OverallStatus = if (($ValidationResults.SystemRequirements -and $ValidationResults.ExecutableFound -and $ValidationResults.FilePermissions -and $ValidationResults.BasicFunctionality)) { "PASSED" } else { "FAILED" }
    
    $ReportContent = @"
Scratch Pad Installation Validation Report
==========================================

Date: $(Get-Date)
Platform: Windows
User: $env:USERNAME
Computer: $env:COMPUTERNAME

System Information:
- OS: $((Get-WmiObject Win32_OperatingSystem).Caption)
- Version: $([System.Environment]::OSVersion.Version)
- Architecture: $env:PROCESSOR_ARCHITECTURE
- PowerShell: $($PSVersionTable.PSVersion)

Validation Results:
- Executable found: $(if ($script:ScratchPadExecutable) { $script:ScratchPadExecutable } else { "NOT FOUND" })
- System requirements: $(if ($ValidationResults.SystemRequirements) { "PASSED" } else { "FAILED" })
- File permissions: $(if ($ValidationResults.FilePermissions) { "PASSED" } else { "FAILED" })
- Basic functionality: $(if ($ValidationResults.BasicFunctionality) { "PASSED" } else { "FAILED" })
- Desktop integration: $(if ($ValidationResults.DesktopIntegration) { "PASSED" } else { "FAILED" })
- Data directory: $(if ($ValidationResults.DataDirectory) { "PASSED" } else { "FAILED" })

Overall Status: $(if ($OverallStatus -eq "PASSED") { "INSTALLATION VALID" } else { "ISSUES DETECTED" })

"@

    if ($OverallStatus -ne "PASSED") {
        $ReportContent += @"

Recommendations:
- Verify Scratch Pad is properly installed
- Check system requirements are met
- Ensure proper file permissions
- Try reinstalling if issues persist
- Run as administrator if permission issues occur

For support, visit: https://github.com/pinkydprojects/scratch-pad/issues
"@
    }
    
    $ReportContent | Out-File -FilePath $ReportFile -Encoding UTF8
    Write-LogSuccess "Validation report saved to: $ReportFile"
    
    return $OverallStatus
}

# Main validation function
function Start-Validation {
    Write-LogInfo "Starting Scratch Pad installation validation..."
    Write-LogInfo "=========================================="
    
    # Run validation steps
    Test-SystemRequirements
    
    if (Find-ScratchPadExecutable) {
        Test-FilePermissions
        Test-BasicFunctionality
    }
    
    Test-DesktopIntegration
    Test-DataDirectory
    
    # Generate report if requested
    $OverallStatus = "FAILED"
    if ($GenerateReport) {
        $OverallStatus = New-ValidationReport
    }
    
    # Final status
    Write-LogInfo "=========================================="
    if ($OverallStatus -eq "PASSED") {
        Write-LogSuccess "Validation completed successfully!"
        Write-LogInfo "Scratch Pad appears to be properly installed and functional."
        exit 0
    } else {
        Write-LogError "Validation completed with issues."
        Write-LogInfo "Please check the validation report for details."
        if ($GenerateReport) {
            Write-LogInfo "Report saved to: scratch-pad-validation-report.txt"
        }
        exit 1
    }
}

# Run the validation
Start-Validation