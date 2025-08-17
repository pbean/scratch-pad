#!/bin/bash

# Scratch Pad Installation Validation Script
# This script validates the installation and basic functionality across platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Platform detection
detect_platform() {
    case "$(uname -s)" in
        Linux*)     PLATFORM=Linux;;
        Darwin*)    PLATFORM=macOS;;
        CYGWIN*|MINGW*|MSYS*) PLATFORM=Windows;;
        *)          PLATFORM="Unknown";;
    esac
    log_info "Detected platform: $PLATFORM"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate system requirements
validate_system_requirements() {
    log_info "Validating system requirements..."
    
    case $PLATFORM in
        Linux)
            # Check for required libraries
            if command_exists pkg-config; then
                if pkg-config --exists webkit2gtk-4.0; then
                    log_success "WebKit2GTK found"
                else
                    log_error "WebKit2GTK not found. Install with: sudo apt-get install libwebkit2gtk-4.0-dev"
                    return 1
                fi
                
                if pkg-config --exists gtk+-3.0; then
                    log_success "GTK3 found"
                else
                    log_error "GTK3 not found. Install with: sudo apt-get install libgtk-3-dev"
                    return 1
                fi
            else
                log_warning "pkg-config not found, cannot verify libraries"
            fi
            ;;
        macOS)
            # Check macOS version
            MACOS_VERSION=$(sw_vers -productVersion)
            REQUIRED_VERSION="10.13"
            if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$MACOS_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]]; then
                log_success "macOS version $MACOS_VERSION meets requirements (>= $REQUIRED_VERSION)"
            else
                log_error "macOS version $MACOS_VERSION is below required version $REQUIRED_VERSION"
                return 1
            fi
            ;;
        Windows)
            # Check Windows version (basic check)
            log_info "Windows platform detected - manual verification of Windows 10+ required"
            ;;
    esac
    
    log_success "System requirements validation completed"
}

# Find Scratch Pad executable
find_executable() {
    log_info "Looking for Scratch Pad executable..."
    
    # Common installation paths
    POSSIBLE_PATHS=(
        "/usr/bin/scratch-pad"
        "/usr/local/bin/scratch-pad"
        "/opt/scratch-pad/scratch-pad"
        "$HOME/.local/bin/scratch-pad"
        "/Applications/scratch-pad.app/Contents/MacOS/scratch-pad"
        "C:/Program Files/scratch-pad/scratch-pad.exe"
        "C:/Program Files (x86)/scratch-pad/scratch-pad.exe"
    )
    
    # Check if it's in PATH
    if command_exists scratch-pad; then
        SCRATCH_PAD_EXEC="scratch-pad"
        log_success "Found scratch-pad in PATH"
        return 0
    fi
    
    # Check common paths
    for path in "${POSSIBLE_PATHS[@]}"; do
        if [[ -f "$path" ]]; then
            SCRATCH_PAD_EXEC="$path"
            log_success "Found scratch-pad at: $path"
            return 0
        fi
    done
    
    log_error "Scratch Pad executable not found"
    log_info "Please ensure Scratch Pad is installed and accessible"
    return 1
}

# Test basic functionality
test_basic_functionality() {
    log_info "Testing basic functionality..."
    
    # Test version command (if supported)
    if timeout 10s "$SCRATCH_PAD_EXEC" --version >/dev/null 2>&1; then
        VERSION=$("$SCRATCH_PAD_EXEC" --version 2>/dev/null || echo "Unknown")
        log_success "Version check passed: $VERSION"
    else
        log_warning "Version check not available or timed out"
    fi
    
    # Test help command (if supported)
    if timeout 10s "$SCRATCH_PAD_EXEC" --help >/dev/null 2>&1; then
        log_success "Help command available"
    else
        log_warning "Help command not available or timed out"
    fi
    
    # Test creating a note from command line (if supported)
    TEST_NOTE="Test note from validation script - $(date)"
    if timeout 10s "$SCRATCH_PAD_EXEC" "$TEST_NOTE" >/dev/null 2>&1; then
        log_success "Command line note creation test passed"
    else
        log_warning "Command line note creation test failed or not supported"
    fi
}

# Test file permissions
test_file_permissions() {
    log_info "Testing file permissions..."
    
    if [[ -x "$SCRATCH_PAD_EXEC" ]]; then
        log_success "Executable has correct permissions"
    else
        log_error "Executable does not have execute permissions"
        return 1
    fi
    
    # Test if we can read the executable
    if [[ -r "$SCRATCH_PAD_EXEC" ]]; then
        log_success "Executable is readable"
    else
        log_error "Executable is not readable"
        return 1
    fi
}

# Test desktop integration (Linux/macOS)
test_desktop_integration() {
    log_info "Testing desktop integration..."
    
    case $PLATFORM in
        Linux)
            DESKTOP_FILE="/usr/share/applications/scratch-pad.desktop"
            if [[ -f "$DESKTOP_FILE" ]]; then
                log_success "Desktop file found: $DESKTOP_FILE"
                
                # Validate desktop file
                if command_exists desktop-file-validate; then
                    if desktop-file-validate "$DESKTOP_FILE" 2>/dev/null; then
                        log_success "Desktop file is valid"
                    else
                        log_warning "Desktop file validation failed"
                    fi
                else
                    log_info "desktop-file-validate not available, skipping validation"
                fi
            else
                log_warning "Desktop file not found at $DESKTOP_FILE"
            fi
            
            # Check for icons
            ICON_SIZES=(32 128)
            for size in "${ICON_SIZES[@]}"; do
                ICON_PATH="/usr/share/icons/hicolor/${size}x${size}/apps/scratch-pad.png"
                if [[ -f "$ICON_PATH" ]]; then
                    log_success "Icon found: ${size}x${size}"
                else
                    log_warning "Icon not found: ${size}x${size}"
                fi
            done
            ;;
        macOS)
            APP_BUNDLE="/Applications/scratch-pad.app"
            if [[ -d "$APP_BUNDLE" ]]; then
                log_success "Application bundle found: $APP_BUNDLE"
                
                # Check Info.plist
                PLIST="$APP_BUNDLE/Contents/Info.plist"
                if [[ -f "$PLIST" ]]; then
                    log_success "Info.plist found"
                else
                    log_warning "Info.plist not found"
                fi
            else
                log_warning "Application bundle not found at $APP_BUNDLE"
            fi
            ;;
    esac
}

# Test data directory access
test_data_directory() {
    log_info "Testing data directory access..."
    
    case $PLATFORM in
        Linux)
            DATA_DIR="$HOME/.local/share/scratch-pad"
            ;;
        macOS)
            DATA_DIR="$HOME/Library/Application Support/scratch-pad"
            ;;
        Windows)
            DATA_DIR="$APPDATA/scratch-pad"
            ;;
    esac
    
    log_info "Expected data directory: $DATA_DIR"
    
    # Create directory if it doesn't exist (application should do this)
    if [[ ! -d "$DATA_DIR" ]]; then
        log_info "Data directory doesn't exist yet (normal for fresh installation)"
    else
        log_success "Data directory exists"
        
        # Check if we can write to it
        TEST_FILE="$DATA_DIR/test_write_permissions"
        if touch "$TEST_FILE" 2>/dev/null; then
            rm -f "$TEST_FILE"
            log_success "Data directory is writable"
        else
            log_error "Cannot write to data directory"
            return 1
        fi
    fi
}

# Generate validation report
generate_report() {
    log_info "Generating validation report..."
    
    REPORT_FILE="scratch-pad-validation-report.txt"
    
    cat > "$REPORT_FILE" << EOF
Scratch Pad Installation Validation Report
==========================================

Date: $(date)
Platform: $PLATFORM
User: $(whoami)
Hostname: $(hostname)

System Information:
- OS: $(uname -a)
- Shell: $SHELL

Validation Results:
- Executable found: ${SCRATCH_PAD_EXEC:-"NOT FOUND"}
- System requirements: $([[ $SYSTEM_REQ_OK == "true" ]] && echo "PASSED" || echo "FAILED")
- File permissions: $([[ $FILE_PERM_OK == "true" ]] && echo "PASSED" || echo "FAILED")
- Basic functionality: $([[ $BASIC_FUNC_OK == "true" ]] && echo "PASSED" || echo "FAILED")
- Desktop integration: $([[ $DESKTOP_INT_OK == "true" ]] && echo "PASSED" || echo "FAILED")
- Data directory: $([[ $DATA_DIR_OK == "true" ]] && echo "PASSED" || echo "FAILED")

Overall Status: $([[ $OVERALL_STATUS == "PASSED" ]] && echo "INSTALLATION VALID" || echo "ISSUES DETECTED")

EOF

    if [[ $OVERALL_STATUS != "PASSED" ]]; then
        cat >> "$REPORT_FILE" << EOF

Recommendations:
- Verify Scratch Pad is properly installed
- Check system requirements are met
- Ensure proper file permissions
- Try reinstalling if issues persist

For support, visit: https://github.com/pinkydprojects/scratch-pad/issues
EOF
    fi
    
    log_success "Validation report saved to: $REPORT_FILE"
}

# Main validation function
main() {
    log_info "Starting Scratch Pad installation validation..."
    log_info "=========================================="
    
    # Initialize status variables
    SYSTEM_REQ_OK="false"
    FILE_PERM_OK="false"
    BASIC_FUNC_OK="false"
    DESKTOP_INT_OK="false"
    DATA_DIR_OK="false"
    OVERALL_STATUS="FAILED"
    
    # Detect platform
    detect_platform
    
    # Run validation steps
    if validate_system_requirements; then
        SYSTEM_REQ_OK="true"
    fi
    
    if find_executable; then
        if test_file_permissions; then
            FILE_PERM_OK="true"
        fi
        
        if test_basic_functionality; then
            BASIC_FUNC_OK="true"
        fi
    fi
    
    if test_desktop_integration; then
        DESKTOP_INT_OK="true"
    fi
    
    if test_data_directory; then
        DATA_DIR_OK="true"
    fi
    
    # Determine overall status
    if [[ $SYSTEM_REQ_OK == "true" && $FILE_PERM_OK == "true" && $BASIC_FUNC_OK == "true" ]]; then
        OVERALL_STATUS="PASSED"
    fi
    
    # Generate report
    generate_report
    
    # Final status
    log_info "=========================================="
    if [[ $OVERALL_STATUS == "PASSED" ]]; then
        log_success "Validation completed successfully!"
        log_info "Scratch Pad appears to be properly installed and functional."
        exit 0
    else
        log_error "Validation completed with issues."
        log_info "Please check the validation report for details."
        log_info "Report saved to: $REPORT_FILE"
        exit 1
    fi
}

# Run main function
main "$@"