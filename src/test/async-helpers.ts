import { waitFor, screen } from '@testing-library/react'
import { act } from 'react'
import userEvent from '@testing-library/user-event'

/**
 * Wait for any loading indicators to disappear
 */
export async function waitForLoadingToComplete() {
  await waitFor(() => {
    const loadingElements = screen.queryAllByText(/loading/i)
    const spinners = screen.queryAllByRole('progressbar')
    const skeletons = screen.queryAllByTestId('skeleton')
    const inlineLoading = screen.queryAllByTestId('inline-loading')
    const loadingSpinner = screen.queryAllByTestId('loading-spinner')
    
    expect(
      loadingElements.length + 
      spinners.length + 
      skeletons.length + 
      inlineLoading.length +
      loadingSpinner.length
    ).toBe(0)
  }, { timeout: 3000 })
}

/**
 * Wait for command palette to be ready
 */
export async function waitForCommandPalette() {
  await waitFor(() => {
    const input = screen.queryByTestId('command-search-input') || 
                 screen.queryByPlaceholderText(/search/i) ||
                 screen.queryByRole('textbox')
    expect(input).toBeInTheDocument()
  }, { timeout: 2000 })
}

/**
 * Type text with proper act wrapping
 */
export async function typeWithAct(element: HTMLElement, text: string) {
  const user = userEvent.setup()
  await act(async () => {
    await user.type(element, text)
  })
}

/**
 * Click element with proper act wrapping
 */
export async function clickWithAct(element: HTMLElement) {
  const user = userEvent.setup()
  await act(async () => {
    await user.click(element)
  })
}

/**
 * Wait for async state updates to complete
 */
export async function waitForStateUpdate() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

/**
 * Wait for note to load in the view
 */
export async function waitForNoteToLoad() {
  await waitFor(() => {
    const textarea = screen.queryByRole('textbox') ||
                    screen.queryByTestId('note-content') ||
                    screen.queryByPlaceholderText(/start typing/i)
    expect(textarea).toBeInTheDocument()
  }, { timeout: 2000 })
}

/**
 * Wait for search results to appear
 */
export async function waitForSearchResults() {
  await waitFor(() => {
    const results = screen.queryAllByTestId(/search-item/i) ||
                   screen.queryAllByRole('listitem')
    expect(results.length).toBeGreaterThan(0)
  }, { timeout: 2000 })
}

/**
 * Properly setup user event instance with delays
 */
export function setupUser() {
  return userEvent.setup({ delay: null })
}