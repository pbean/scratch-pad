import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

function SimpleComponent() {
  return <div>Hello World</div>
}

describe.skip('React rendering debug', () => {
  it('should debug the rendering environment', () => {
    const testRoot = document.getElementById('test-root')!
    const result = render(<SimpleComponent />, { container: testRoot })
    console.log('Document body innerHTML:', document.body.innerHTML)
    console.log('Container innerHTML:', result.container.innerHTML)
    console.log('Screen debug:', screen.debug())
  })
  
  it('should render a simple component using screen queries', () => {
    const testRoot = document.getElementById('test-root')!
    render(<SimpleComponent />, { container: testRoot })
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})