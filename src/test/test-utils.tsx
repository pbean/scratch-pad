import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render function that works with React 19 without complexity
function render(
  ui: ReactElement,
  options: RenderOptions = {}
): ReturnType<typeof rtlRender> {
  return rtlRender(ui, options)
}

// Re-export everything from testing-library/react
export * from '@testing-library/react'

// Export our custom render
export { render }