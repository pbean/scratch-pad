import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Enhanced build optimizations
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React chunks
          if (id.includes('react') || id.includes('react-dom')) {
            return 'vendor';
          }
          // UI library chunks
          if (id.includes('lucide-react') || id.includes('@radix-ui')) {
            return 'ui';
          }
          // Utility chunks
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'utils';
          }
          // Tauri specific
          if (id.includes('@tauri-apps')) {
            return 'tauri';
          }
          // State management
          if (id.includes('zustand')) {
            return 'store';
          }
          // Node modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize chunk naming for better caching
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `img/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    // Enhanced minification with esbuild
    minify: 'esbuild',
    // Optimize chunk sizes
    chunkSizeWarningLimit: 600,
    // Disable source maps for production
    sourcemap: false,
    // Optimize CSS
    cssMinify: true,
    // Enable tree shaking
    target: 'esnext',
    // Optimize module resolution
    modulePreload: {
      polyfill: false,
    },
    // Additional optimizations
    reportCompressedSize: false,
    // Optimize asset inlining
    assetsInlineLimit: 4096,
  },

  // Enhanced optimization options
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'lucide-react',
      '@tauri-apps/api/core',
    ],
    exclude: ['@tauri-apps/api'],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
