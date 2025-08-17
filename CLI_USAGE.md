# Command Line Interface Usage

The scratch-pad application supports command-line interface for creating notes directly from the terminal.

## Basic Usage

### Create a note with content

```bash
# Direct content as arguments
scratch-pad "This is my note content"

# Multiple words
scratch-pad "This is a longer note" "with multiple parts"

# Using the create subcommand
scratch-pad create "This is a note created with the create command"
```

### Show help

```bash
scratch-pad --help
scratch-pad create --help
```

### Show version

```bash
scratch-pad --version
```

## Features

### Single Instance Management

- Only one GUI instance can run at a time
- If GUI is already running, CLI commands will communicate with the existing instance
- If no GUI is running, CLI commands will create notes directly in the database

### Cross-Platform Support

- Works on Windows, macOS, and Ubuntu
- Uses platform-appropriate temporary directories for IPC communication
- Handles platform-specific process management

### Feedback

- CLI provides immediate feedback when notes are created
- Shows note ID, content preview, and creation timestamp
- Indicates when notes are sent to existing GUI instance

## Examples

### Basic note creation

```bash
$ scratch-pad "Fix the login bug"
✓ Note created successfully!
  ID: 1
  Content: Fix the login bug
  Created: 2025-08-17 03:12:54
```

### Long note with truncated display

```bash
$ scratch-pad "This is a very long note that will be truncated in the display but stored completely in the database"
✓ Note created successfully!
  ID: 2
  Content: This is a very long note that will be truncated...
  Created: 2025-08-17 03:13:15
```

### Communication with existing instance

```bash
$ scratch-pad "Another note while GUI is running"
✓ Note sent to existing scratch-pad instance!
```

### Error handling

```bash
$ scratch-pad
# Launches GUI if no other instance is running
# Or shows error if another instance is already running

$ scratch-pad
Another instance of scratch-pad is already running.
```

## Integration with Scripts

The CLI can be easily integrated into shell scripts and workflows:

```bash
#!/bin/bash
# Quick note script
scratch-pad "TODO: $(date): $1"
```

```bash
# Git commit note
git log -1 --pretty=format:"%h %s" | xargs scratch-pad
```

## Technical Details

### IPC Communication

- Uses file-based IPC for communication between CLI and GUI instances
- Temporary files are created in platform-specific temp directories
- IPC files are automatically cleaned up after processing

### Database Access

- CLI directly accesses the SQLite database when no GUI instance is running
- Database is located at `scratch_pad.db` in the application directory
- All CLI operations are atomic and safe for concurrent access

### Process Management

- Uses lock files to detect running instances
- Handles stale lock files from crashed processes
- Proper cleanup on application exit
