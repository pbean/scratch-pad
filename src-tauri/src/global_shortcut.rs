use crate::error::AppError;
use crate::settings::SettingsService;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tokio::sync::Mutex;

pub struct GlobalShortcutService {
    app_handle: Option<AppHandle>,
    settings_service: Arc<SettingsService>,
    current_shortcut: Arc<Mutex<Option<String>>>,
    is_test_mode: bool,
}

impl GlobalShortcutService {
    /// Create a new GlobalShortcutService
    pub fn new(app_handle: AppHandle, settings_service: Arc<SettingsService>) -> Self {
        Self {
            app_handle: Some(app_handle),
            settings_service,
            current_shortcut: Arc::new(Mutex::new(None)),
            is_test_mode: false,
        }
    }

    /// Create a new GlobalShortcutService for testing (no-op implementation)
    #[cfg(test)]
    pub fn new_test(settings_service: Arc<SettingsService>) -> Result<Self, AppError> {
        // For testing, create a simulated shortcut service without actual Tauri runtime
        Ok(Self {
            app_handle: None,
            settings_service,
            current_shortcut: Arc::new(Mutex::new(None)),
            is_test_mode: true,
        })
    }

    /// Initialize the global shortcut service with the current setting
    pub async fn initialize(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            // In test mode, just validate the current shortcut setting
            let _shortcut = self
                .settings_service
                .get_setting("global_shortcut")
                .await?
                .unwrap_or_else(|| "Ctrl+Shift+N".to_string());
            return Ok(());
        }

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
        if self.is_test_mode {
            // In test mode, just validate and store the shortcut
            self.validate_shortcut(shortcut)?;
            let mut current = self.current_shortcut.lock().await;
            *current = Some(shortcut.to_string());
            return Ok(());
        }

        // Validate the shortcut format
        self.validate_shortcut(shortcut)?;

        // Unregister the current shortcut if it exists
        self.unregister_current_shortcut().await?;

        // Parse the shortcut string into the plugin format
        let shortcut_obj = self.parse_shortcut(shortcut)?;
        
        // Register the new shortcut - the callback handler is set up at the plugin level
        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;
        
        app_handle
            .global_shortcut()
            .register(shortcut_obj)
            .map_err(|e| AppError::Runtime {
                message: format!("Failed to register global shortcut: {}", e),
            })?;

        // Store the current shortcut
        let mut current = self.current_shortcut.lock().await;
        *current = Some(shortcut.to_string());

        // Update the setting
        self.settings_service
            .set_setting("global_shortcut", shortcut)
            .await?;

        Ok(())
    }

    /// Unregister the current global shortcut
    pub async fn unregister_current_shortcut(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            // In test mode, just clear the stored shortcut
            let mut current = self.current_shortcut.lock().await;
            *current = None;
            return Ok(());
        }

        let current = self.current_shortcut.lock().await;
        if let Some(shortcut) = current.as_ref() {
            let shortcut_obj = self.parse_shortcut(shortcut)?;
            let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
                message: "AppHandle not available".to_string(),
            })?;
            
            app_handle
                .global_shortcut()
                .unregister(shortcut_obj)
                .map_err(|e| AppError::Runtime {
                    message: format!("Failed to unregister global shortcut: {}", e),
                })?;
        }
        Ok(())
    }

    /// Get the current registered shortcut
    pub async fn get_current_shortcut(&self) -> Option<String> {
        let current = self.current_shortcut.lock().await;
        current.clone()
    }

    /// Cleanup method for shutdown
    pub async fn cleanup(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }
        
        self.unregister_current_shortcut().await
    }

    /// Validate a shortcut string format
    fn validate_shortcut(&self, shortcut: &str) -> Result<(), AppError> {
        // Basic validation - ensure it contains modifier keys
        let normalized = shortcut.to_lowercase();
        
        if !normalized.contains("ctrl") && !normalized.contains("alt") && !normalized.contains("shift") && !normalized.contains("meta") {
            return Err(AppError::Validation {
                field: "shortcut".to_string(),
                message: "Global shortcuts must include at least one modifier key (Ctrl, Alt, Shift, or Meta)".to_string(),
            });
        }

        // Check for valid key combinations
        let parts: Vec<&str> = shortcut.split('+').map(|s| s.trim()).collect();
        if parts.len() < 2 {
            return Err(AppError::Validation {
                field: "shortcut".to_string(),
                message: "Invalid shortcut format. Use format like 'Ctrl+Shift+N'".to_string(),
            });
        }

        Ok(())
    }

    /// Parse a shortcut string into a Shortcut object
    fn parse_shortcut(&self, shortcut: &str) -> Result<Shortcut, AppError> {
        let parts: Vec<&str> = shortcut.split('+').map(|s| s.trim()).collect();
        
        let mut modifiers = Modifiers::empty();
        let mut key_code = None;

        for part in parts {
            match part.to_lowercase().as_str() {
                "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
                "alt" => modifiers |= Modifiers::ALT,
                "shift" => modifiers |= Modifiers::SHIFT,
                "meta" | "cmd" | "super" => modifiers |= Modifiers::META,
                key => {
                    if key_code.is_some() {
                        return Err(AppError::Validation {
                            field: "shortcut".to_string(),
                            message: "Multiple key codes specified in shortcut".to_string(),
                        });
                    }
                    
                    key_code = Some(match key.to_uppercase().as_str() {
                        "A" => Code::KeyA,
                        "B" => Code::KeyB,
                        "C" => Code::KeyC,
                        "D" => Code::KeyD,
                        "E" => Code::KeyE,
                        "F" => Code::KeyF,
                        "G" => Code::KeyG,
                        "H" => Code::KeyH,
                        "I" => Code::KeyI,
                        "J" => Code::KeyJ,
                        "K" => Code::KeyK,
                        "L" => Code::KeyL,
                        "M" => Code::KeyM,
                        "N" => Code::KeyN,
                        "O" => Code::KeyO,
                        "P" => Code::KeyP,
                        "Q" => Code::KeyQ,
                        "R" => Code::KeyR,
                        "S" => Code::KeyS,
                        "T" => Code::KeyT,
                        "U" => Code::KeyU,
                        "V" => Code::KeyV,
                        "W" => Code::KeyW,
                        "X" => Code::KeyX,
                        "Y" => Code::KeyY,
                        "Z" => Code::KeyZ,
                        "1" => Code::Digit1,
                        "2" => Code::Digit2,
                        "3" => Code::Digit3,
                        "4" => Code::Digit4,
                        "5" => Code::Digit5,
                        "6" => Code::Digit6,
                        "7" => Code::Digit7,
                        "8" => Code::Digit8,
                        "9" => Code::Digit9,
                        "0" => Code::Digit0,
                        "F1" => Code::F1,
                        "F2" => Code::F2,
                        "F3" => Code::F3,
                        "F4" => Code::F4,
                        "F5" => Code::F5,
                        "F6" => Code::F6,
                        "F7" => Code::F7,
                        "F8" => Code::F8,
                        "F9" => Code::F9,
                        "F10" => Code::F10,
                        "F11" => Code::F11,
                        "F12" => Code::F12,
                        "SPACE" => Code::Space,
                        "ENTER" => Code::Enter,
                        "ESCAPE" => Code::Escape,
                        "TAB" => Code::Tab,
                        _ => {
                            return Err(AppError::Validation {
                                field: "shortcut".to_string(),
                                message: format!("Unsupported key: {}", key),
                            });
                        }
                    });
                }
            }
        }

        let key_code = key_code.ok_or_else(|| AppError::Validation {
            field: "shortcut".to_string(),
            message: "No key code specified in shortcut".to_string(),
        })?;

        Ok(Shortcut::new(Some(modifiers), key_code))
    }
}