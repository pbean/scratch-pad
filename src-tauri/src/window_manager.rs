use crate::error::AppError;
use crate::settings::SettingsService;
use std::sync::Arc;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Size};
use tokio::sync::Mutex;

#[derive(Debug, Clone, PartialEq)]
pub enum LayoutMode {
    Default,
    Half,
    Full,
}

impl LayoutMode {
    pub fn from_string(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "half" => LayoutMode::Half,
            "full" => LayoutMode::Full,
            _ => LayoutMode::Default,
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            LayoutMode::Default => "default".to_string(),
            LayoutMode::Half => "half".to_string(),
            LayoutMode::Full => "full".to_string(),
        }
    }
}

pub struct WindowManager {
    app_handle: AppHandle,
    settings_service: Arc<SettingsService>,
    current_layout: Arc<Mutex<LayoutMode>>,
    previous_app_focused: Arc<Mutex<bool>>,
}

impl WindowManager {
    pub fn new(app_handle: AppHandle, settings_service: Arc<SettingsService>) -> Self {
        Self {
            app_handle,
            settings_service,
            current_layout: Arc::new(Mutex::new(LayoutMode::Default)),
            previous_app_focused: Arc::new(Mutex::new(false)),
        }
    }

    /// Create a new WindowManager for testing (no-op implementation)
    #[cfg(test)]
    pub fn new_test(settings_service: Arc<SettingsService>) -> Result<Self, AppError> {
        // For testing, create a simulated window manager without actual Tauri runtime
        // This approach avoids the type mismatch between MockRuntime and Wry
        Err(AppError::Runtime {
            message: "Window manager testing requires full Tauri runtime".to_string(),
        })
    }

    /// Initialize the window manager with saved settings
    pub async fn initialize(&self) -> Result<(), AppError> {
        // Load the saved layout mode
        let layout_mode = self
            .settings_service
            .get_setting("layout_mode")
            .await?
            .unwrap_or_else(|| "default".to_string());

        let layout = LayoutMode::from_string(&layout_mode);
        let mut current = self.current_layout.lock().await;
        *current = layout;

        Ok(())
    }

    /// Show the main window with proper focus management
    pub async fn show_window(&self) -> Result<(), AppError> {
        let window = self.get_main_window()?;

        // Store that we're taking focus from another app
        let mut previous_focused = self.previous_app_focused.lock().await;
        *previous_focused = true;

        // Show and focus the window
        window.show().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to show window: {}", e),
        })?;

        window.set_focus().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to focus window: {}", e),
        })?;

        // Apply the current layout
        self.apply_current_layout().await?;

        Ok(())
    }

    /// Hide the window and return focus to the previous application
    pub async fn hide_window(&self) -> Result<(), AppError> {
        let window = self.get_main_window()?;

        // Hide the window
        window.hide().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to hide window: {}", e),
        })?;

        // Reset the previous app focused flag
        let mut previous_focused = self.previous_app_focused.lock().await;
        *previous_focused = false;

        Ok(())
    }

    /// Toggle window visibility
    pub async fn toggle_window(&self) -> Result<(), AppError> {
        let window = self.get_main_window()?;
        
        let is_visible = window.is_visible().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to check window visibility: {}", e),
        })?;

        if is_visible {
            self.hide_window().await?;
        } else {
            self.show_window().await?;
        }

        Ok(())
    }

    /// Set the layout mode
    pub async fn set_layout_mode(&self, mode: LayoutMode) -> Result<(), AppError> {
        // Update the current layout
        let mut current = self.current_layout.lock().await;
        *current = mode.clone();

        // Save to settings
        self.settings_service
            .set_setting("layout_mode", &mode.to_string())
            .await?;

        // Apply the layout if window is visible
        let window = self.get_main_window()?;
        let is_visible = window.is_visible().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to check window visibility: {}", e),
        })?;

        if is_visible {
            self.apply_layout(&mode).await?;
        }

        Ok(())
    }

    /// Get the current layout mode
    pub async fn get_layout_mode(&self) -> LayoutMode {
        let current = self.current_layout.lock().await;
        current.clone()
    }

    /// Apply the current layout mode
    async fn apply_current_layout(&self) -> Result<(), AppError> {
        let current = self.current_layout.lock().await;
        let mode = current.clone();
        drop(current);
        self.apply_layout(&mode).await
    }

    /// Apply a specific layout mode
    async fn apply_layout(&self, mode: &LayoutMode) -> Result<(), AppError> {
        let window = self.get_main_window()?;

        match mode {
            LayoutMode::Default => {
                // Default floating window: 800x600, centered
                window.set_size(Size::Logical(LogicalSize { width: 800.0, height: 600.0 }))
                    .map_err(|e| AppError::GlobalShortcut {
                        message: format!("Failed to set window size: {}", e),
                    })?;
                
                window.center().map_err(|e| AppError::GlobalShortcut {
                    message: format!("Failed to center window: {}", e),
                })?;
            }
            LayoutMode::Half => {
                // Half screen: take up half the screen width, full height
                // Position on the right side of the screen
                let monitor = window.current_monitor().map_err(|e| AppError::GlobalShortcut {
                    message: format!("Failed to get current monitor: {}", e),
                })?.ok_or_else(|| AppError::GlobalShortcut {
                    message: "No monitor found".to_string(),
                })?;

                let monitor_size = monitor.size();
                let width = monitor_size.width / 2;
                let height = monitor_size.height;
                let x = monitor_size.width / 2;
                let y = 0;

                window.set_size(Size::Physical(PhysicalSize { width, height }))
                    .map_err(|e| AppError::GlobalShortcut {
                        message: format!("Failed to set window size: {}", e),
                    })?;

                window.set_position(Position::Physical(PhysicalPosition { x: x as i32, y: y as i32 }))
                    .map_err(|e| AppError::GlobalShortcut {
                        message: format!("Failed to set window position: {}", e),
                    })?;
            }
            LayoutMode::Full => {
                // Full screen: maximize the window
                window.maximize().map_err(|e| AppError::GlobalShortcut {
                    message: format!("Failed to maximize window: {}", e),
                })?;
            }
        }

        Ok(())
    }

    /// Center the window on the current monitor
    pub async fn center_window(&self) -> Result<(), AppError> {
        let window = self.get_main_window()?;
        window.center().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to center window: {}", e),
        })?;
        Ok(())
    }

    /// Set window always on top
    pub async fn set_always_on_top(&self, always_on_top: bool) -> Result<(), AppError> {
        let window = self.get_main_window()?;
        window.set_always_on_top(always_on_top).map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to set always on top: {}", e),
        })?;
        Ok(())
    }

    /// Check if window is visible
    pub async fn is_window_visible(&self) -> Result<bool, AppError> {
        let window = self.get_main_window()?;
        window.is_visible().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to check window visibility: {}", e),
        })
    }

    /// Check if window is focused
    pub async fn is_window_focused(&self) -> Result<bool, AppError> {
        let window = self.get_main_window()?;
        window.is_focused().map_err(|e| AppError::GlobalShortcut {
            message: format!("Failed to check window focus: {}", e),
        })
    }

    /// Get the main window handle
    fn get_main_window(&self) -> Result<tauri::WebviewWindow, AppError> {
        self.app_handle
            .get_webview_window("main")
            .ok_or_else(|| AppError::GlobalShortcut {
                message: "Main window not found".to_string(),
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;


    #[test]
    fn test_layout_mode_conversion() {
        assert!(matches!(LayoutMode::from_string("default"), LayoutMode::Default));
        assert!(matches!(LayoutMode::from_string("half"), LayoutMode::Half));
        assert!(matches!(LayoutMode::from_string("full"), LayoutMode::Full));
        assert!(matches!(LayoutMode::from_string("invalid"), LayoutMode::Default));

        assert_eq!(LayoutMode::Default.to_string(), "default");
        assert_eq!(LayoutMode::Half.to_string(), "half");
        assert_eq!(LayoutMode::Full.to_string(), "full");
    }

    #[test]
    fn test_layout_mode_clone_and_debug() {
        let mode = LayoutMode::Half;
        let cloned = mode.clone();
        
        assert!(matches!(cloned, LayoutMode::Half));
        
        // Test Debug trait
        let debug_str = format!("{:?}", mode);
        assert!(debug_str.contains("Half"));
    }

    #[test]
    fn test_layout_mode_case_insensitive() {
        assert!(matches!(LayoutMode::from_string("DEFAULT"), LayoutMode::Default));
        assert!(matches!(LayoutMode::from_string("Half"), LayoutMode::Half));
        assert!(matches!(LayoutMode::from_string("FULL"), LayoutMode::Full));
        assert!(matches!(LayoutMode::from_string("HaLf"), LayoutMode::Half));
    }

    #[test]
    fn test_layout_mode_edge_cases() {
        assert!(matches!(LayoutMode::from_string(""), LayoutMode::Default));
        assert!(matches!(LayoutMode::from_string("   "), LayoutMode::Default));
        assert!(matches!(LayoutMode::from_string("unknown"), LayoutMode::Default));
        assert!(matches!(LayoutMode::from_string("123"), LayoutMode::Default));
    }

    // Note: WindowManager tests that require Tauri AppHandle cannot be unit tested
    // without a full Tauri application context. These would be integration tests.
    // The core logic (LayoutMode) is tested above.
}