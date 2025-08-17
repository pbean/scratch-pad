#!/bin/bash

# Development environment setup script for Scratch Pad
# This script helps set up the development environment on Unix-like systems

set -e

echo "🚀 Setting up Scratch Pad development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running on supported OS
OS=$(uname -s)
case $OS in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "Detected OS: $MACHINE"

# Check for required tools
check_command() {
    if command -v $1 &> /dev/null; then
        print_status "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Install Node.js and pnpm
if ! check_command node; then
    print_warning "Node.js not found. Please install Node.js 20 or later from https://nodejs.org/"
    exit 1
fi

if ! check_command pnpm; then
    echo "Installing pnpm..."
    npm install -g pnpm
    print_status "pnpm installed"
fi

# Install Rust
if ! check_command rustc; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
    print_status "Rust installed"
fi

# Install Tauri CLI
if ! check_command tauri; then
    echo "Installing Tauri CLI..."
    cargo install tauri-cli
    print_status "Tauri CLI installed"
fi

# Platform-specific dependencies
if [ "$MACHINE" = "Linux" ]; then
    echo "Installing Linux dependencies..."
    
    # Detect package manager
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y \
            libwebkit2gtk-4.0-dev \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf \
            libssl-dev \
            pkg-config
        print_status "Linux dependencies installed (apt)"
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y \
            webkit2gtk4.0-devel \
            openssl-devel \
            curl \
            wget \
            libappindicator-gtk3-devel \
            librsvg2-devel
        print_status "Linux dependencies installed (dnf)"
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --needed \
            webkit2gtk \
            base-devel \
            curl \
            wget \
            openssl \
            appmenu-gtk-module \
            gtk3 \
            libappindicator-gtk3 \
            librsvg
        print_status "Linux dependencies installed (pacman)"
    else
        print_warning "Unknown package manager. Please install WebKit2GTK and other dependencies manually."
    fi
elif [ "$MACHINE" = "Mac" ]; then
    # Check for Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        echo "Installing Xcode Command Line Tools..."
        xcode-select --install
        print_warning "Please complete the Xcode Command Line Tools installation and run this script again."
        exit 1
    fi
    print_status "Xcode Command Line Tools are installed"
fi

# Install project dependencies
echo "Installing project dependencies..."
pnpm install
print_status "Project dependencies installed"

# Run initial build to verify setup
echo "Running initial build to verify setup..."
pnpm build
print_status "Initial build successful"

# Run tests to verify everything works
echo "Running tests to verify setup..."
pnpm test --run
cd src-tauri && cargo test
print_status "All tests passed"

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm tauri dev    - Start development server"
echo "  pnpm tauri build  - Build production app"
echo "  pnpm test         - Run frontend tests"
echo "  pnpm lint         - Run linter"
echo ""
echo "Happy coding! 🚀"