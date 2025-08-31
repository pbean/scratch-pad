import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render function that renders into document.body by default
function render(
  ui: ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof rtlRender> {
  // Create a new container for each render to avoid conflicts
  const container = document.createElement('div')
  document.body.appendChild(container)
  
  return rtlRender(ui, {
    container,
    ...options,
  })
}

// Re-export everything from testing-library/react
export * from '@testing-library/react'
// Re-export expect from vitest for convenience
export { expect } from 'vitest'

// Export our custom render function
export { render }