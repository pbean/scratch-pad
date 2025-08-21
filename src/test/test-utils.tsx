import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render function that renders into document.body by default
// Optimized for React 19 concurrent features
function render(
  ui: ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof rtlRender> {
  // Create a new container for each render to avoid conflicts
  const container = document.createElement('div')
  container.setAttribute('data-testid', 'test-container')
  document.body.appendChild(container)
  
  // Enhanced render options for React 19 compatibility
  const renderOptions: RenderOptions = {
    container,
    // Support React 19's concurrent features
    legacyRoot: false,
    ...options,
  }
  
  return rtlRender(ui, renderOptions)
}

// Re-export everything from testing-library/react
export * from '@testing-library/react'

// Export our custom render function
export { render }