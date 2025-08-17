# Scratch Pad

A floating notepad application for developers built with Tauri, React, and TypeScript.

## Features

- Floating window that stays on top
- Quick note-taking with auto-save
- Syntax highlighting for code snippets
- Customizable themes and fonts
- Cross-platform support (Windows, macOS, Linux)

## Development

### Prerequisites

- Node.js (v18 or later)
- pnpm
- Rust (for Tauri)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm tauri:dev
   ```

### Available Scripts

- `pnpm dev` - Start Vite development server
- `pnpm build` - Build the frontend
- `pnpm tauri:dev` - Start Tauri development mode
- `pnpm tauri:build` - Build the Tauri application
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Tauri (Rust)
- **Build Tool**: Vite
- **Package Manager**: pnpm

## Project Structure

```
src/
├── components/     # React components
│   └── ui/        # shadcn/ui components
├── hooks/         # Custom React hooks
├── lib/           # Utility libraries
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
├── App.tsx        # Main application component
└── main.tsx       # Application entry point
```