use crate::error::AppError;
use crate::settings::SettingsService;
use std::sync::Arc;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size};
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
    app_handle: Option<AppHandle>,
    settings_service: Arc<SettingsService>,
    current_layout: Arc<Mutex<LayoutMode>>,
    _previous_app_focused: Arc<Mutex<bool>>,
    is_test_mode: bool,
}

impl WindowManager {
    pub fn new(app_handle: AppHandle, settings_service: Arc<SettingsService>) -> Self {
        Self {
            app_handle: Some(app_handle),
            settings_service,
            current_layout: Arc::new(Mutex::new(LayoutMode::Default)),
            _previous_app_focused: Arc::new(Mutex::new(false)),
            is_test_mode: false,
        }
    }

    /// Create a new WindowManager for testing (no-op implementation)
    #[cfg(test)]
    pub fn new_test(_settings_service: Arc<SettingsService>) -> Result<Self, AppError> {
        // For testing, create a simulated window manager without actual Tauri runtime
        Ok(Self {
            app_handle: None,
            settings_service: _settings_service,
            current_layout: Arc::new(Mutex::new(LayoutMode::Default)),
            _previous_app_focused: Arc::new(Mutex::new(false)),
            is_test_mode: true,
        })
    }

    /// Initialize the window manager with saved settings
    pub async fn initialize(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            // In test mode, just load saved layout setting
            let _layout = self
                .settings_service
                .get_setting("window_layout")
                .await?
                .unwrap_or_else(|| "default".to_string());
            return Ok(());
        }

        // Load saved layout mode
        let layout_str = self
            .settings_service
            .get_setting("window_layout")
            .await?
            .unwrap_or_else(|| "default".to_string());

        let layout = LayoutMode::from_string(&layout_str);
        
        // Set the layout mode
        {
            let mut current_layout = self.current_layout.lock().await;
            *current_layout = layout;
        }

        // Apply the layout
        self.apply_current_layout().await?;

        Ok(())
    }

    /// Toggle the window visibility
    pub async fn toggle_window(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| AppError::Runtime {
                message: format!("Failed to hide window: {}", e),
            })?;
        } else {
            window.show().map_err(|e| AppError::Runtime {
                message: format!("Failed to show window: {}", e),
            })?;
            window.set_focus().map_err(|e| AppError::Runtime {
                message: format!("Failed to focus window: {}", e),
            })?;
        }

        Ok(())
    }

    /// Show the window
    pub async fn show_window(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        window.show().map_err(|e| AppError::Runtime {
            message: format!("Failed to show window: {}", e),
        })?;

        Ok(())
    }

    /// Hide the window
    pub async fn hide_window(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        window.hide().map_err(|e| AppError::Runtime {
            message: format!("Failed to hide window: {}", e),
        })?;

        Ok(())
    }

    /// Check if the window is currently visible
    pub async fn is_window_visible(&self) -> Result<bool, AppError> {
        if self.is_test_mode {
            return Ok(true);
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        window.is_visible().map_err(|e| AppError::Runtime {
            message: format!("Failed to check window visibility: {}", e),
        })
    }

    /// Set the window layout mode
    pub async fn set_layout_mode(&self, layout: LayoutMode) -> Result<(), AppError> {
        {
            let mut current_layout = self.current_layout.lock().await;
            *current_layout = layout.clone();
        }

        // Save the layout mode to settings
        self.settings_service
            .set_setting("window_layout", &layout.to_string())
            .await?;

        if !self.is_test_mode {
            // Apply the layout
            self.apply_current_layout().await?;
        }

        Ok(())
    }

    /// Get the current layout mode
    pub async fn get_layout_mode(&self) -> LayoutMode {
        let current_layout = self.current_layout.lock().await;
        current_layout.clone()
    }

    /// Apply the current layout to the window
    async fn apply_current_layout(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        let layout = {
            let current_layout = self.current_layout.lock().await;
            current_layout.clone()
        };

        // Get monitor size for calculations
        let monitor = window.current_monitor().map_err(|e| AppError::Runtime {
            message: format!("Failed to get current monitor: {}", e),
        })?;

        if let Some(monitor) = monitor {
            let monitor_size = monitor.size();
            let monitor_position = monitor.position();

            match layout {
                LayoutMode::Default => {
                    // Center the window with default size
                    let width = 600;
                    let height = 400;
                    let x = monitor_position.x + (monitor_size.width as i32 - width) / 2;
                    let y = monitor_position.y + (monitor_size.height as i32 - height) / 2;

                    window.set_size(Size::Physical(PhysicalSize { width: width as u32, height: height as u32 }))
                        .map_err(|e| AppError::Runtime {
                            message: format!("Failed to set window size: {}", e),
                        })?;

                    window.set_position(Position::Physical(PhysicalPosition { x, y }))
                        .map_err(|e| AppError::Runtime {
                            message: format!("Failed to set window position: {}", e),
                        })?;
                },
                LayoutMode::Half => {
                    // Take up half the screen width
                    let width = monitor_size.width / 2;
                    let height = monitor_size.height;
                    let x = monitor_position.x + (monitor_size.width as i32 / 2);
                    let y = monitor_position.y;

                    window.set_size(Size::Physical(PhysicalSize { width, height }))
                        .map_err(|e| AppError::Runtime {
                            message: format!("Failed to set window size: {}", e),
                        })?;

                    window.set_position(Position::Physical(PhysicalPosition { x, y }))
                        .map_err(|e| AppError::Runtime {
                            message: format!("Failed to set window position: {}", e),
                        })?;
                },
                LayoutMode::Full => {
                    // Maximize the window
                    window.maximize().map_err(|e| AppError::Runtime {
                        message: format!("Failed to maximize window: {}", e),
                    })?;
                },
            }
        }

        Ok(())
    }

    /// Focus the window
    pub async fn focus_window(&self) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        window.set_focus().map_err(|e| AppError::Runtime {
            message: format!("Failed to focus window: {}", e),
        })?;

        Ok(())
    }

    /// Set window position
    pub async fn set_window_position(&self, x: i32, y: i32) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        window.set_position(Position::Physical(PhysicalPosition { x, y }))
            .map_err(|e| AppError::Runtime {
                message: format!("Failed to set window position: {}", e),
            })?;

        Ok(())
    }

    /// Get current window position
    pub async fn get_window_position(&self) -> Result<(i32, i32), AppError> {
        if self.is_test_mode {
            return Ok((100, 100));
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        let position = window.outer_position().map_err(|e| AppError::Runtime {
            message: format!("Failed to get window position: {}", e),
        })?;

        Ok((position.x, position.y))
    }

    /// Set window size
    pub async fn set_window_size(&self, width: u32, height: u32) -> Result<(), AppError> {
        if self.is_test_mode {
            return Ok(());
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        window.set_size(Size::Physical(PhysicalSize { width, height }))
            .map_err(|e| AppError::Runtime {
                message: format!("Failed to set window size: {}", e),
            })?;

        Ok(())
    }

    /// Get current window size
    pub async fn get_window_size(&self) -> Result<(u32, u32), AppError> {
        if self.is_test_mode {
            return Ok((600, 400));
        }

        let app_handle = self.app_handle.as_ref().ok_or_else(|| AppError::Runtime {
            message: "AppHandle not available".to_string(),
        })?;

        let window = app_handle.get_webview_window("main").ok_or_else(|| AppError::Runtime {
            message: "Main window not found".to_string(),
        })?;

        let size = window.outer_size().map_err(|e| AppError::Runtime {
            message: format!("Failed to get window size: {}", e),
        })?;

        Ok((size.width, size.height))
    }
}