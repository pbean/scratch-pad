# API Documentation

This document provides comprehensive documentation for the Scratch Pad application's API, including security features implemented in Week 1.

## Overview

The Scratch Pad API is built on Tauri's IPC (Inter-Process Communication) system with comprehensive security validation. All API endpoints implement:

- **Operation context validation** with source attribution
- **Capability-based access control** 
- **Input validation and sanitization**
- **Frequency-based abuse prevention**
- **Comprehensive error handling**

## Security Architecture

### Operation Context

All API operations require an operation context that defines:

```rust
pub struct OperationContext {
    pub source: OperationSource,     // CLI, IPC, Direct, Plugin
    pub capabilities: Vec<OperationCapability>,  // Required permissions
    pub frequency_limit: Option<u32>, // Operations per minute
    pub timestamp: Instant,          // For frequency tracking
}
```

### Capabilities

| Capability | Description | Sources Allowed |
|-----------|-------------|-----------------|
| `ReadNotes` | Read note data | All sources |
| `WriteNotes` | Create/update notes | All sources |
| `DeleteNotes` | Delete notes | Direct, Plugin |
| `Search` | Search operations | All sources |
| `SystemAccess` | System-level operations | Direct |
| `FileExport` | File export operations | Direct |
| `PluginManagement` | Plugin operations | Direct |

### Frequency Limits

| Source | Limit (ops/minute) | Description |
|--------|-------------------|-------------|
| CLI | 10 | Terminal integration |
| IPC | 15 | Frontend communication |
| Direct | 100 | UI operations |
| Plugin | Configurable | Per-plugin settings |

## API Endpoints

### Note Management

#### `create_note(content: string)`

Creates a new note with security validation.

**Parameters:**
- `content: string` - Note content (max 1MB, validated for malicious patterns)

**Returns:**
- `Note` - Created note object

**Security Features:**
- Content validation (size limits, pattern detection)
- Operation context validation
- Frequency limit enforcement
- Input sanitization

**Example:**
```typescript
const note = await invoke('create_note', { 
  content: 'My secure note content' 
});
```

**Error Handling:**
```typescript
try {
  const note = await invoke('create_note', { content });
} catch (error) {
  if (error.includes('frequency_limit')) {
    // Handle rate limiting
  } else if (error.includes('Content too long')) {
    // Handle size limit
  } else if (error.includes('malicious')) {
    // Handle security validation failure
  }
}
```

#### `update_note(note: Note)`

Updates an existing note with comprehensive validation.

**Parameters:**
- `note: Note` - Complete note object with updated content

**Returns:**
- `Note` - Updated note object

**Security Features:**
- ID validation (positive integers, bounds checking)
- Content validation (size limits, malicious pattern detection)
- Operation context with WriteNotes capability
- Frequency limit enforcement

**Example:**
```typescript
const updatedNote = await invoke('update_note', {
  note: {
    id: 1,
    content: 'Updated content',
    created_at: '2025-01-20T10:00:00Z',
    updated_at: '2025-01-20T11:00:00Z',
    is_pinned: false
  }
});
```

#### `delete_note(id: number)`

Deletes a note with capability validation.

**Parameters:**
- `id: number` - Note ID (must be positive integer)

**Returns:**
- `void`

**Security Features:**
- ID validation (positive integers, bounds checking)
- DeleteNotes capability requirement
- IPC source validation (Direct/Plugin only for deletes)

**Example:**
```typescript
await invoke('delete_note', { id: 1 });
```

#### `get_note(id: number)`

Retrieves a single note by ID.

**Parameters:**
- `id: number` - Note ID

**Returns:**
- `Note | null` - Note object or null if not found

**Security Features:**
- ID validation
- ReadNotes capability requirement
- Frequency limit enforcement

#### `get_notes_paginated(offset: number, limit: number)`

Retrieves notes with pagination and validation.

**Parameters:**
- `offset: number` - Starting position (max 100,000)
- `limit: number` - Number of notes to retrieve (max 1,000)

**Returns:**
- `Note[]` - Array of note objects

**Security Features:**
- Pagination parameter validation
- Offset/limit bounds checking
- ReadNotes capability requirement
- Performance protection via limits

**Example:**
```typescript
const notes = await invoke('get_notes_paginated', {
  offset: 0,
  limit: 50
});
```

### Search Operations

#### `search_notes(query: string)`

Performs full-text search with injection protection.

**Parameters:**
- `query: string` - Search query (max 1000 characters)

**Returns:**
- `Note[]` - Array of matching notes

**Security Features:**
- Query length validation
- SQL injection prevention
- FTS5 query sanitization
- Malicious pattern detection
- Search capability requirement

**Protected Against:**
- SQL injection: `'; DROP TABLE notes; --`
- Command injection: `$(rm -rf /)`
- Script injection: `<script>alert(1)</script>`
- Union attacks: `UNION SELECT * FROM users`

**Example:**
```typescript
const results = await invoke('search_notes', {
  query: 'project AND task'
});
```

### Settings Management

#### `get_setting(key: string)`

Retrieves a setting value with validation.

**Parameters:**
- `key: string` - Setting key (alphanumeric, dots, underscores only)

**Returns:**
- `string | null` - Setting value or null

**Security Features:**
- Key format validation (regex: `^[a-zA-Z0-9._-]+$`)
- Key length limit (1024 characters)
- SystemAccess capability for sensitive settings

#### `save_setting(key: string, value: string)`

Saves a setting with comprehensive validation.

**Parameters:**
- `key: string` - Setting key
- `value: string` - Setting value

**Returns:**
- `void`

**Security Features:**
- Key/value format validation
- Length limits (1024 characters each)
- Malicious content detection
- Input sanitization

**Example:**
```typescript
await invoke('save_setting', {
  key: 'theme.mode',
  value: 'dark'
});
```

### Global Shortcuts

#### `register_global_shortcut(shortcut: string)`

Registers a global keyboard shortcut.

**Parameters:**
- `shortcut: string` - Shortcut definition (e.g., "Ctrl+Shift+N")

**Returns:**
- `void`

**Security Features:**
- Shortcut format validation
- Length limits (50 characters)
- Pattern validation (modifier+key format)
- SystemAccess capability requirement

**Example:**
```typescript
await invoke('register_global_shortcut', {
  shortcut: 'Ctrl+Shift+N'
});
```

### Window Management

#### `set_window_layout(layout: LayoutMode)`

Sets the window layout mode.

**Parameters:**
- `layout: LayoutMode` - Layout mode enum

**Returns:**
- `void`

**Security Features:**
- Enum validation
- SystemAccess capability requirement

### Error Reporting

#### `report_frontend_error(error_report: FrontendErrorReport)`

Reports frontend errors to the backend for logging.

**Parameters:**
- `error_report: FrontendErrorReport` - Error details

**Returns:**
- `void`

**Security Features:**
- Error report validation
- Content sanitization
- SystemAccess capability requirement

## Error Handling

### Error Types

The API uses a comprehensive error system with the following categories:

| Error Type | Description | HTTP Equivalent |
|-----------|-------------|-----------------|
| `Validation` | Input validation failure | 400 Bad Request |
| `NotFound` | Resource not found | 404 Not Found |
| `PermissionDenied` | Insufficient capabilities | 403 Forbidden |
| `RateLimit` | Frequency limit exceeded | 429 Too Many Requests |
| `Internal` | Server error | 500 Internal Server Error |

### Common Error Messages

**Validation Errors:**
```
"Content too long. Maximum 1048576 characters allowed"
"Path traversal detected"
"Search query contains potentially dangerous content"
"Setting key contains invalid characters"
"Operation frequency limit exceeded for IPC: 15 operations per minute"
```

**Capability Errors:**
```
"Source IPC does not have capability DeleteNotes"
"FileExport capability required"
"SystemAccess capability required"
```

**Security Errors:**
```
"Content contains potentially dangerous patterns"
"IPC content exceeds maximum size limit"
"Invalid JSON in IPC content"
"IPC file operations restricted to temp directories"
```

### Error Handling Best Practices

1. **Always handle errors** - Never assume API calls will succeed
2. **Check error types** - Different errors require different handling
3. **Don't expose errors to users** - Log security errors, show user-friendly messages
4. **Implement retry logic** - For frequency limit errors, implement exponential backoff
5. **Validate inputs client-side** - Reduce server-side validation errors

**Example Error Handling:**
```typescript
try {
  const note = await invoke('create_note', { content });
} catch (error: any) {
  console.error('API Error:', error);
  
  if (error.includes('frequency_limit')) {
    // Show rate limit message, implement backoff
    showNotification('Too many requests. Please wait a moment.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else if (error.includes('Content too long')) {
    // Handle content size limit
    showNotification('Note content is too long. Maximum size is 1MB.');
  } else if (error.includes('malicious')) {
    // Handle security validation (don't expose details)
    showNotification('Note content contains invalid characters.');
  } else {
    // Generic error handling
    showNotification('Failed to create note. Please try again.');
  }
}
```

## Security Testing

### Testing Security Features

All API endpoints have comprehensive security tests covering:

**Path Traversal Protection:**
```bash
cd src-tauri && cargo test path_traversal_security_tests
```

**Injection Prevention:**
```bash
cd src-tauri && cargo test injection_prevention_tests
```

**Access Control:**
```bash
cd src-tauri && cargo test access_control_tests
```

**Frequency Controls:**
```bash
cd src-tauri && cargo test frequency_control_tests
```

### Security Test Examples

**Testing Capability Validation:**
```rust
#[test]
fn test_delete_note_capability_validation() {
    // IPC source should not be able to delete notes
    let context = OperationContext::new_ipc(vec![OperationCapability::DeleteNotes]);
    let result = validator.validate_operation_context(&context);
    assert!(result.is_err());
}
```

**Testing Frequency Controls:**
```rust
#[test]
fn test_cli_frequency_limits() {
    let validator = SecurityValidator::new();
    
    // Attempt 11 CLI operations (limit is 10)
    for i in 0..11 {
        let context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
        let result = validator.validate_operation_context(&context);
        
        if i < 10 {
            assert!(result.is_ok(), "Operation {} should succeed", i);
        } else {
            assert!(result.is_err(), "Operation {} should fail due to rate limit", i);
        }
    }
}
```

## Migration from Legacy API

### Changes in Week 1 Security Update

**All endpoints now require:**
1. Operation context creation
2. Capability validation  
3. Input validation
4. Frequency limit checking

**Breaking Changes:**
- Error messages now include more specific validation information
- Rate limiting may cause operations to fail if limits are exceeded
- Some operations restricted based on source (e.g., IPC cannot delete notes)

**Migration Guide:**
1. Update error handling to account for new error types
2. Implement client-side input validation to reduce API errors
3. Add retry logic for frequency limit errors
4. Update tests to account for new security validations

## Performance Considerations

### Validation Overhead

Security validation adds minimal performance overhead:
- **Path validation**: < 1ms per operation
- **Content validation**: < 2ms per operation  
- **Frequency tracking**: < 0.1ms per operation
- **Capability checking**: < 0.1ms per operation

### Optimization Tips

1. **Client-side validation**: Validate inputs before API calls
2. **Batch operations**: Use paginated endpoints efficiently
3. **Cache settings**: Avoid repeated setting lookups
4. **Error handling**: Implement proper retry logic with backoff

## Version History

- **v0.1.0 (Week 1)**: Comprehensive security framework implementation
  - Operation source attribution system
  - Capability-based access control
  - Input validation framework
  - Frequency-based abuse prevention
  - Path traversal protection
  - IPC security boundaries

---

**Last Updated**: January 24, 2025 (Week 1 Sprint Completion)
**Security Contact**: Create a GitHub issue with the `security` label for security-related API questions.