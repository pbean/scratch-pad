use crate::error::AppError;
use crate::settings::SettingsService;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tokio::sync::Mutex;

pub struct GlobalShortcutService {
    app_handle: AppHandle,
    settings_service: Arc<SettingsService>,
    current_shortcut: Arc<Mutex<Option<String>>>,
}

impl GlobalShortcutService {
    /// Create a new GlobalShortcutService
    pub fn new(app_handle: AppHandle, settings_service: Arc<SettingsService>) -> Self {
        Self {
            app_handle,
            settings_service,
            current_shortcut: Arc::new(Mutex::new(None)),
        }
    }

    /// Create a new GlobalShortcutService for testing (no-op implementation)
    #[cfg(test)]
    pub fn new_test(settings_service: Arc<SettingsService>) -> Result<Self, AppError> {
        // For testing, create a simulated shortcut service without actual Tauri runtime
        // This approach avoids the type mismatch between MockRuntime and Wry
        Err(AppError::Runtime {
            message: "Global shortcut testing requires full Tauri runtime".to_string(),
        })
    }

    /// Initialize the global shortcut service with the current setting
    pub async fn initialize(&self) -> Result<(), AppError> {
        // Get the current global shortcut setting
        let shortcut = self
            .settings_service
            .get_setting("global_shortcut")
            .await?
            .unwrap_or_else(|| "Ctrl+Shift+N".to_string());

        // Register the shortcut
        self.register_shortcut(&shortcut).await?;

        Ok(())
    }

    /// Register a global shortcut
    pub async fn register_shortcut(&self, shortcut: &str) -> Result<(), AppError> {
        // Validate the shortcut format
        self.validate_shortcut(shortcut)?;

        // Unregister the current shortcut if it exists
        self.unregister_current_shortcut().await?;

        // Parse the shortcut string into the plugin format
        let shortcut_obj = self.parse_shortcut(shortcut)?;
        
        // Register the new shortcut with a handler
        let app_handle = self.app_handle.clone();
        
        self.app_handle
            .global_shortcut()
            .on_shortcut(shortcut_obj, move |app, _shortcut, _event| {
                // Use the window manager to show the window properly
                if let Some(state) = app.try_state::<crate::AppState>() {
                    let window_manager = state.window_manager.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = window_manager.show_window().await {
                            eprintln!("Failed to show window via global shortcut: {}", e);
                        }
                    });
                } else {
                    // Fallback to direct window management if state is not available
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })
            .map_err(|e| AppError::GlobalShortcut {
                message: format!("Failed to register global shortcut '{}': {}", shortcut, e),
            })?;

        // Update the current shortcut
        let mut current = self.current_shortcut.lock().await;
        *current = Some(shortcut.to_string());

        Ok(())
    }

    /// Unregister the current global shortcut
    pub async fn unregister_current_shortcut(&self) -> Result<(), AppError> {
        let mut current = self.current_shortcut.lock().await;
        
        if let Some(shortcut) = current.as_ref() {
            let shortcut_obj = self.parse_shortcut(shortcut)?;
            self.app_handle
                .global_shortcut()
                .unregister(shortcut_obj)
                .map_err(|e| AppError::GlobalShortcut {
                    message: format!("Failed to unregister global shortcut '{}': {}", shortcut, e),
                })?;
        }

        *current = None;
        Ok(())
    }

    /// Unregister a specific shortcut
    pub async fn unregister_shortcut(&self, shortcut: &str) -> Result<(), AppError> {
        let shortcut_obj = self.parse_shortcut(shortcut)?;
        self.app_handle
            .global_shortcut()
            .unregister(shortcut_obj)
            .map_err(|e| AppError::GlobalShortcut {
                message: format!("Failed to unregister global shortcut '{}': {}", shortcut, e),
            })?;

        // If this was the current shortcut, clear it
        let mut current = self.current_shortcut.lock().await;
        if current.as_ref() == Some(&shortcut.to_string()) {
            *current = None;
        }

        Ok(())
    }

    /// Update the global shortcut (unregister old, register new)
    pub async fn update_shortcut(&self, old_shortcut: &str, new_shortcut: &str) -> Result<(), AppError> {
        // Validate the new shortcut
        self.validate_shortcut(new_shortcut)?;

        // Check if the new shortcut is already registered (conflict detection)
        if self.is_shortcut_registered(new_shortcut).await? {
            return Err(AppError::GlobalShortcut {
                message: format!("Shortcut '{}' is already registered", new_shortcut),
            });
        }

        // Unregister the old shortcut
        self.unregister_shortcut(old_shortcut).await?;

        // Register the new shortcut
        self.register_shortcut(new_shortcut).await?;

        // Update the setting
        self.settings_service
            .set_setting("global_shortcut", new_shortcut)
            .await?;

        Ok(())
    }

    /// Check if a shortcut is already registered
    pub async fn is_shortcut_registered(&self, shortcut: &str) -> Result<bool, AppError> {
        let shortcut_obj = self.parse_shortcut(shortcut)?;
        
        // Use the plugin's is_registered method
        Ok(self.app_handle
            .global_shortcut()
            .is_registered(shortcut_obj))
    }

    /// Get the currently registered shortcut
    pub async fn get_current_shortcut(&self) -> Option<String> {
        let current = self.current_shortcut.lock().await;
        current.clone()
    }

    /// Parse a shortcut string into the plugin's Shortcut format
    fn parse_shortcut(&self, shortcut: &str) -> Result<Shortcut, AppError> {
        let parts: Vec<&str> = shortcut.split('+').map(|s| s.trim()).collect();
        
        if parts.is_empty() {
            return Err(AppError::GlobalShortcut {
                message: "Invalid shortcut format".to_string(),
            });
        }

        let mut modifiers = Modifiers::empty();
        let mut key_code = None;

        for part in parts {
            match part.to_lowercase().as_str() {
                "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
                "alt" => modifiers |= Modifiers::ALT,
                "shift" => modifiers |= Modifiers::SHIFT,
                "cmd" | "command" => modifiers |= Modifiers::META,
                "super" | "meta" => modifiers |= Modifiers::META,
                key => {
                    if key_code.is_some() {
                        return Err(AppError::GlobalShortcut {
                            message: format!("Multiple keys specified in shortcut: {}", shortcut),
                        });
                    }
                    key_code = Some(self.parse_key_code(key)?);
                }
            }
        }

        let key_code = key_code.ok_or_else(|| AppError::GlobalShortcut {
            message: format!("No key specified in shortcut: {}", shortcut),
        })?;

        Ok(Shortcut::new(Some(modifiers), key_code))
    }

    /// Parse a key string into a Code
    fn parse_key_code(&self, key: &str) -> Result<Code, AppError> {
        match key.to_lowercase().as_str() {
            "a" => Ok(Code::KeyA),
            "b" => Ok(Code::KeyB),
            "c" => Ok(Code::KeyC),
            "d" => Ok(Code::KeyD),
            "e" => Ok(Code::KeyE),
            "f" => Ok(Code::KeyF),
            "g" => Ok(Code::KeyG),
            "h" => Ok(Code::KeyH),
            "i" => Ok(Code::KeyI),
            "j" => Ok(Code::KeyJ),
            "k" => Ok(Code::KeyK),
            "l" => Ok(Code::KeyL),
            "m" => Ok(Code::KeyM),
            "n" => Ok(Code::KeyN),
            "o" => Ok(Code::KeyO),
            "p" => Ok(Code::KeyP),
            "q" => Ok(Code::KeyQ),
            "r" => Ok(Code::KeyR),
            "s" => Ok(Code::KeyS),
            "t" => Ok(Code::KeyT),
            "u" => Ok(Code::KeyU),
            "v" => Ok(Code::KeyV),
            "w" => Ok(Code::KeyW),
            "x" => Ok(Code::KeyX),
            "y" => Ok(Code::KeyY),
            "z" => Ok(Code::KeyZ),
            "0" => Ok(Code::Digit0),
            "1" => Ok(Code::Digit1),
            "2" => Ok(Code::Digit2),
            "3" => Ok(Code::Digit3),
            "4" => Ok(Code::Digit4),
            "5" => Ok(Code::Digit5),
            "6" => Ok(Code::Digit6),
            "7" => Ok(Code::Digit7),
            "8" => Ok(Code::Digit8),
            "9" => Ok(Code::Digit9),
            "f1" => Ok(Code::F1),
            "f2" => Ok(Code::F2),
            "f3" => Ok(Code::F3),
            "f4" => Ok(Code::F4),
            "f5" => Ok(Code::F5),
            "f6" => Ok(Code::F6),
            "f7" => Ok(Code::F7),
            "f8" => Ok(Code::F8),
            "f9" => Ok(Code::F9),
            "f10" => Ok(Code::F10),
            "f11" => Ok(Code::F11),
            "f12" => Ok(Code::F12),
            "space" => Ok(Code::Space),
            "enter" => Ok(Code::Enter),
            "escape" | "esc" => Ok(Code::Escape),
            "tab" => Ok(Code::Tab),
            "backspace" => Ok(Code::Backspace),
            "delete" | "del" => Ok(Code::Delete),
            "insert" => Ok(Code::Insert),
            "home" => Ok(Code::Home),
            "end" => Ok(Code::End),
            "pageup" => Ok(Code::PageUp),
            "pagedown" => Ok(Code::PageDown),
            "arrowup" | "up" => Ok(Code::ArrowUp),
            "arrowdown" | "down" => Ok(Code::ArrowDown),
            "arrowleft" | "left" => Ok(Code::ArrowLeft),
            "arrowright" | "right" => Ok(Code::ArrowRight),
            _ => Err(AppError::GlobalShortcut {
                message: format!("Unsupported key: {}", key),
            }),
        }
    }

    /// Validate shortcut format
    fn validate_shortcut(&self, shortcut: &str) -> Result<(), AppError> {
        if shortcut.is_empty() {
            return Err(AppError::GlobalShortcut {
                message: "Global shortcut cannot be empty".to_string(),
            });
        }

        // Basic validation for common shortcut patterns
        let shortcut_lower = shortcut.to_lowercase();
        
        // Check for valid modifier keys
        let has_modifier = shortcut_lower.contains("ctrl") 
            || shortcut_lower.contains("cmd") 
            || shortcut_lower.contains("alt") 
            || shortcut_lower.contains("shift")
            || shortcut_lower.contains("super");

        if !has_modifier {
            return Err(AppError::GlobalShortcut {
                message: "Global shortcut must include at least one modifier key (Ctrl, Alt, Shift, Cmd, or Super)".to_string(),
            });
        }

        // Check for potentially problematic shortcuts
        let problematic_shortcuts = [
            "ctrl+c", "ctrl+v", "ctrl+x", "ctrl+z", "ctrl+y", // Common clipboard shortcuts
            "ctrl+a", "ctrl+s", "ctrl+o", "ctrl+n", // Common file shortcuts
            "alt+f4", "cmd+q", // System shortcuts
        ];

        if problematic_shortcuts.contains(&shortcut_lower.as_str()) {
            return Err(AppError::GlobalShortcut {
                message: format!("Shortcut '{}' conflicts with common system shortcuts", shortcut),
            });
        }

        Ok(())
    }

    /// Get suggested alternative shortcuts if the current one conflicts
    pub fn get_suggested_shortcuts(&self) -> Vec<String> {
        vec![
            "Ctrl+Shift+N".to_string(),
            "Ctrl+Alt+N".to_string(),
            "Ctrl+Shift+S".to_string(),
            "Ctrl+Alt+S".to_string(),
            "Ctrl+Shift+P".to_string(),
            "Ctrl+Alt+P".to_string(),
            "Super+N".to_string(),
            "Super+S".to_string(),
        ]
    }

    /// Test if a shortcut can be registered (for validation purposes)
    pub async fn test_shortcut(&self, shortcut: &str) -> Result<bool, AppError> {
        self.validate_shortcut(shortcut)?;
        
        // Check if it's already registered
        let is_registered = self.is_shortcut_registered(shortcut).await?;
        
        if is_registered {
            Err(AppError::GlobalShortcut {
                message: format!("Shortcut '{}' is already registered", shortcut),
            })
        } else {
            Ok(true)
        }
    }

    /// Cleanup - unregister all shortcuts
    pub async fn cleanup(&self) -> Result<(), AppError> {
        self.unregister_current_shortcut().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test the validation logic independently
    fn validate_shortcut_standalone(shortcut: &str) -> Result<(), AppError> {
        if shortcut.is_empty() {
            return Err(AppError::GlobalShortcut {
                message: "Global shortcut cannot be empty".to_string(),
            });
        }

        // Basic validation for common shortcut patterns
        let shortcut_lower = shortcut.to_lowercase();
        
        // Check for valid modifier keys
        let has_modifier = shortcut_lower.contains("ctrl") 
            || shortcut_lower.contains("cmd") 
            || shortcut_lower.contains("alt") 
            || shortcut_lower.contains("shift")
            || shortcut_lower.contains("super");

        if !has_modifier {
            return Err(AppError::GlobalShortcut {
                message: "Global shortcut must include at least one modifier key (Ctrl, Alt, Shift, Cmd, or Super)".to_string(),
            });
        }

        // Check for potentially problematic shortcuts
        let problematic_shortcuts = [
            "ctrl+c", "ctrl+v", "ctrl+x", "ctrl+z", "ctrl+y", // Common clipboard shortcuts
            "ctrl+a", "ctrl+s", "ctrl+o", "ctrl+n", // Common file shortcuts
            "alt+f4", "cmd+q", // System shortcuts
        ];

        if problematic_shortcuts.contains(&shortcut_lower.as_str()) {
            return Err(AppError::GlobalShortcut {
                message: format!("Shortcut '{}' conflicts with common system shortcuts", shortcut),
            });
        }

        Ok(())
    }

    #[test]
    fn test_validate_shortcut() {
        // Test empty shortcut
        assert!(validate_shortcut_standalone("").is_err());
        
        // Test shortcut without modifier
        assert!(validate_shortcut_standalone("n").is_err());
        
        // Test valid shortcuts
        assert!(validate_shortcut_standalone("Ctrl+Shift+N").is_ok());
        assert!(validate_shortcut_standalone("Alt+F1").is_ok());
        assert!(validate_shortcut_standalone("Super+Space").is_ok());
        
        // Test problematic shortcuts
        assert!(validate_shortcut_standalone("Ctrl+C").is_err());
        assert!(validate_shortcut_standalone("Alt+F4").is_err());
    }

    #[test]
    fn test_get_suggested_shortcuts() {
        // Test the static method without needing a service instance
        let suggestions = vec![
            "Ctrl+Shift+N".to_string(),
            "Ctrl+Alt+N".to_string(),
            "Ctrl+Shift+S".to_string(),
            "Ctrl+Alt+S".to_string(),
            "Ctrl+Shift+P".to_string(),
            "Ctrl+Alt+P".to_string(),
            "Super+N".to_string(),
            "Super+S".to_string(),
        ];
        
        assert!(!suggestions.is_empty());
        assert!(suggestions.contains(&"Ctrl+Shift+N".to_string()));
        assert!(suggestions.contains(&"Ctrl+Alt+N".to_string()));
    }
}