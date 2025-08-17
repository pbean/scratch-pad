# Maintainer: PinkyD <maintainer@example.com>
pkgname=scratch-pad
pkgver=0.1.0
pkgrel=1
pkgdesc="A floating, keyboard-driven notepad designed for developers"
arch=('x86_64')
url="https://github.com/pinkydprojects/scratch-pad"
license=('MIT')
depends=('webkit2gtk' 'gtk3' 'libayatana-appindicator')
makedepends=('rust' 'nodejs' 'pnpm' 'git')
provides=('scratch-pad')
conflicts=('scratch-pad-bin' 'scratch-pad-git')
source=("$pkgname-$pkgver.tar.gz::https://github.com/pinkydprojects/scratch-pad/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')  # Will be updated for each release

prepare() {
    cd "$pkgname-$pkgver"
    
    # Install Node.js dependencies
    pnpm install --frozen-lockfile
}

build() {
    cd "$pkgname-$pkgver"
    
    # Set Rust environment
    export RUSTUP_TOOLCHAIN=stable
    export CARGO_TARGET_DIR=target
    
    # Build the frontend
    pnpm build
    
    # Build the Tauri application
    pnpm tauri build
}

check() {
    cd "$pkgname-$pkgver"
    
    # Run frontend tests
    pnpm test --run
    
    # Run backend tests
    cd src-tauri
    cargo test --release
}

package() {
    cd "$pkgname-$pkgver"
    
    # Install the binary
    install -Dm755 "src-tauri/target/release/$pkgname" "$pkgdir/usr/bin/$pkgname"
    
    # Install desktop file
    install -Dm644 "src-tauri/scratch-pad.desktop" "$pkgdir/usr/share/applications/$pkgname.desktop"
    
    # Install icons
    for size in 32 128; do
        install -Dm644 "src-tauri/icons/${size}x${size}.png" \
            "$pkgdir/usr/share/icons/hicolor/${size}x${size}/apps/$pkgname.png"
    done
    
    # Install license
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
    
    # Install documentation
    install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
    install -Dm644 docs/USER_GUIDE.md "$pkgdir/usr/share/doc/$pkgname/USER_GUIDE.md"
    install -Dm644 docs/INSTALLATION.md "$pkgdir/usr/share/doc/$pkgname/INSTALLATION.md"
}