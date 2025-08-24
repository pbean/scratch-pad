import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '../../../test/test-utils'
import { StatusBar } from '../StatusBar'

describe('StatusBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const defaultProps = {
    lastSaved: null,
    isAutoSaving: false,
    saveStatus: 'idle' as const,
    wordCount: 10,
    charCount: 50,
    lineCount: 3,
    noteTitle: 'Test Note'
  }

  it('should render note title', () => {
    render(<StatusBar {...defaultProps} />)
    
    expect(screen.getByText('Test Note')).toBeInTheDocument()
  })

  it('should render word, character, and line counts', () => {
    render(<StatusBar {...defaultProps} />)
    
    expect(screen.getByText('10 words')).toBeInTheDocument()
    expect(screen.getByText('50 chars')).toBeInTheDocument()
    expect(screen.getByText('3 lines')).toBeInTheDocument()
  })

  it('should show "Not saved" when lastSaved is null and not auto-saving', () => {
    render(<StatusBar {...defaultProps} />)
    
    expect(screen.getByText('Not saved')).toBeInTheDocument()
  })

  it('should show "Saving..." when auto-saving', () => {
    render(<StatusBar {...defaultProps} saveStatus="saving" />)
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('should show "Just now" for recent saves (less than 1 minute)', () => {
    const recentSave = new Date()
    vi.setSystemTime(recentSave.getTime() + 30000) // 30 seconds later
    
    render(<StatusBar {...defaultProps} lastSaved={recentSave} saveStatus="idle" />)
    
    expect(screen.getByText('Saved Just now')).toBeInTheDocument()
  })

  it('should show minutes ago for saves within an hour', () => {
    const saveTime = new Date()
    vi.setSystemTime(saveTime.getTime() + 5 * 60 * 1000) // 5 minutes later
    
    render(<StatusBar {...defaultProps} lastSaved={saveTime} saveStatus="idle" />)
    
    expect(screen.getByText('Saved 5m ago')).toBeInTheDocument()
  })

  it('should show time for saves older than an hour', () => {
    const saveTime = new Date('2024-01-01T14:30:00')
    vi.setSystemTime(new Date('2024-01-01T16:00:00').getTime()) // 1.5 hours later
    
    render(<StatusBar {...defaultProps} lastSaved={saveTime} saveStatus="idle" />)
    
    expect(screen.getByText(/Saved.*2:30 PM/)).toBeInTheDocument()
  })

  it('should truncate long note titles', () => {
    const longTitle = 'This is a very long note title that should be truncated because it exceeds the maximum width'
    
    render(<StatusBar {...defaultProps} noteTitle={longTitle} />)
    
    const titleElement = screen.getByText(longTitle)
    expect(titleElement).toHaveClass('truncate', 'max-w-48')
  })

  it('should handle zero counts', () => {
    render(<StatusBar {...defaultProps} wordCount={0} charCount={0} lineCount={0} />)
    
    expect(screen.getByText('0 words')).toBeInTheDocument()
    expect(screen.getByText('0 chars')).toBeInTheDocument()
    expect(screen.getByText('0 lines')).toBeInTheDocument()
  })

  it('should handle large counts', () => {
    render(<StatusBar {...defaultProps} wordCount={1000} charCount={5000} lineCount={100} />)
    
    expect(screen.getByText('1000 words')).toBeInTheDocument()
    expect(screen.getByText('5000 chars')).toBeInTheDocument()
    expect(screen.getByText('100 lines')).toBeInTheDocument()
  })

  it('should apply correct CSS classes', () => {
    render(<StatusBar {...defaultProps} />)
    
    const statusBar = screen.getByText('Test Note').closest('div')?.parentElement
    expect(statusBar).toHaveClass(
      'flex',
      'items-center',
      'justify-between',
      'px-4',
      'py-2',
      'border-t',
      'border-border',
      'bg-muted/30',
      'text-xs',
      'text-muted-foreground'
    )
  })

  it('should have proper layout structure', () => {
    render(<StatusBar {...defaultProps} />)
    
    const statusBar = screen.getByText('Test Note').closest('div')?.parentElement
    const leftSection = statusBar?.firstChild
    const rightSection = statusBar?.lastChild
    
    expect(leftSection).toHaveClass('flex', 'items-center', 'gap-4')
    expect(rightSection).toHaveClass('flex', 'items-center', 'gap-4')
  })

  it('should format time correctly for different hours', () => {
    const testCases = [
      { time: '2024-01-01T09:15:00', expected: /9:15 AM/ },
      { time: '2024-01-01T13:30:00', expected: /1:30 PM/ },
      { time: '2024-01-01T00:00:00', expected: /12:00 AM/ },
      { time: '2024-01-01T12:00:00', expected: /12:00 PM/ },
      { time: '2024-01-01T23:45:00', expected: /11:45 PM/ }
    ]
    
    testCases.forEach(({ time, expected }) => {
      const saveTime = new Date(time)
      vi.setSystemTime(saveTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours later
      
      const { unmount } = render(<StatusBar {...defaultProps} lastSaved={saveTime} saveStatus="idle" />)
      
      expect(screen.getByText(expected)).toBeInTheDocument()
      
      unmount()
    })
  })

  it('should handle edge case of exactly 1 minute', () => {
    const saveTime = new Date()
    vi.setSystemTime(saveTime.getTime() + 60 * 1000) // Exactly 1 minute later
    
    render(<StatusBar {...defaultProps} lastSaved={saveTime} saveStatus="idle" />)
    
    expect(screen.getByText('Saved 1m ago')).toBeInTheDocument()
  })

  it('should handle edge case of exactly 1 hour', () => {
    const saveTime = new Date('2024-01-01T14:00:00')
    vi.setSystemTime(new Date('2024-01-01T15:00:00').getTime()) // Exactly 1 hour later
    
    render(<StatusBar {...defaultProps} lastSaved={saveTime} saveStatus="idle" />)
    
    expect(screen.getByText(/Saved.*2:00 PM/)).toBeInTheDocument()
  })

  it('should prioritize auto-saving status over last saved', () => {
    const recentSave = new Date()
    
    render(<StatusBar {...defaultProps} lastSaved={recentSave} saveStatus="saving" />)
    
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.queryByText(/Saved/)).not.toBeInTheDocument()
  })

  it('should handle empty note title', () => {
    render(<StatusBar {...defaultProps} noteTitle="" />)
    
    const titleElement = screen.getByText('Not saved').parentElement?.querySelector('.font-medium')
    expect(titleElement).toBeInTheDocument()
    expect(titleElement).toHaveTextContent('')
  })

  it('should handle special characters in note title', () => {
    const specialTitle = 'Note with "quotes" & symbols <>'
    
    render(<StatusBar {...defaultProps} noteTitle={specialTitle} />)
    
    expect(screen.getByText(specialTitle)).toBeInTheDocument()
  })

  it('should maintain consistent spacing', () => {
    render(<StatusBar {...defaultProps} />)
    
    const leftSection = screen.getByText('Test Note').parentElement
    const rightSection = screen.getByText('10 words').parentElement
    
    expect(leftSection).toHaveClass('gap-4')
    expect(rightSection).toHaveClass('gap-4')
  })
})