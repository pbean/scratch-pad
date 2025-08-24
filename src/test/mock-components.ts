/**
 * Comprehensive UI component mocks for testing
 * These mocks simplify complex UI components to make tests more predictable
 */

import React from 'react'

// Radix UI Tabs Components - show all content simultaneously
export const TabsMocks = {
  Tabs: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tabs-root', ...props }, children),
  
  TabsList: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tabs-list', role: 'tablist', ...props }, children),
  
  TabsTrigger: ({ children, value, ...props }: any) => 
    React.createElement('button', { 
      'data-testid': `tab-trigger-${value}`, 
      role: 'tab',
      ...props 
    }, children),
  
  TabsContent: ({ children, value, ...props }: any) => 
    React.createElement('div', { 
      'data-testid': `tab-content-${value}`,
      role: 'tabpanel',
      ...props 
    }, children)
}

// Radix UI Select Components
export const SelectMocks = {
  Select: ({ children, onValueChange, ...props }: any) => {
    const [value, setValue] = React.useState(props.defaultValue || '')
    return React.createElement('div', { 
      'data-testid': 'select-root',
      ...props 
    }, React.Children.map(children, child => 
      React.cloneElement(child, { value, onValueChange: (v: string) => {
        setValue(v)
        onValueChange?.(v)
      }})
    ))
  },
  
  SelectTrigger: ({ children, ...props }: any) => 
    React.createElement('button', { 
      'data-testid': 'select-trigger',
      role: 'combobox',
      ...props 
    }, children),
  
  SelectContent: ({ children, ...props }: any) => 
    React.createElement('div', { 
      'data-testid': 'select-content',
      role: 'listbox',
      ...props 
    }, children),
  
  SelectItem: ({ children, value, ...props }: any) => 
    React.createElement('div', { 
      'data-testid': `select-item-${value}`,
      role: 'option',
      ...props 
    }, children),
  
  SelectValue: ({ placeholder, ...props }: any) => 
    React.createElement('span', { 
      'data-testid': 'select-value',
      ...props 
    }, placeholder)
}

// VirtualList Component - render all items without virtualization
export const VirtualListMock = ({ 
  items, 
  renderItem, 
  className,
  onItemClick,
  selectedIndex = -1,
  itemHeight,
  containerHeight 
}: any) => {
  return React.createElement('div', { 
    className,
    'data-testid': 'virtual-list',
    style: { height: containerHeight, overflow: 'auto' }
  }, items.map((item: any, index: number) => {
    const uniqueKey = item.id || `item-${index}`
    return React.createElement('div', {
      key: uniqueKey,
      'data-testid': `virtual-list-item-${index}`,
      onClick: () => onItemClick?.(item, index),
      className: selectedIndex === index ? 'selected' : '',
      style: { height: itemHeight }
    }, renderItem(item, index, selectedIndex === index))
  }))
}

// Card Components - simplify nested structure
export const CardMocks = {
  Card: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'card', ...props }, children),
  
  CardHeader: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'card-header', ...props }, children),
  
  CardContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'card-content', ...props }, children),
  
  CardTitle: ({ children, ...props }: any) => 
    React.createElement('h3', { 'data-testid': 'card-title', ...props }, children),
  
  CardDescription: ({ children, ...props }: any) => 
    React.createElement('p', { 'data-testid': 'card-description', ...props }, children)
}

// Button Component
export const ButtonMock = ({ children, onClick, ...props }: any) => 
  React.createElement('button', { 
    'data-testid': props['data-testid'] || 'button',
    onClick,
    ...props 
  }, children)

// Input Component
export const InputMock = ({ ...props }: any) => 
  React.createElement('input', { 
    'data-testid': props['data-testid'] || 'input',
    ...props 
  })

// Label Component
export const LabelMock = ({ children, ...props }: any) => 
  React.createElement('label', { 
    'data-testid': 'label',
    ...props 
  }, children)

// Switch Component
export const SwitchMock = ({ checked, onCheckedChange, ...props }: any) => 
  React.createElement('button', { 
    'data-testid': props['data-testid'] || 'switch',
    role: 'switch',
    'aria-checked': checked,
    onClick: () => onCheckedChange?.(!checked),
    ...props 
  }, checked ? 'ON' : 'OFF')