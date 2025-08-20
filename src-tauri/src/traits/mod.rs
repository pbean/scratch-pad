/// Trait-based Service Architecture
/// 
/// This module defines trait boundaries for service decoupling to enable isolated testing
/// and better maintainability. All traits maintain exact compatibility with existing
/// functionality while providing clear boundaries for dependency injection.

pub mod repository;
pub mod services;

// Re-export repository traits
pub use repository::{NoteRepository, SettingsRepository, SearchRepository};

// Re-export service traits with clear naming to avoid conflicts
pub use services::{
    SearchService as SearchServiceTrait, 
    SettingsService as SettingsServiceTrait, 
    WindowManager as WindowManagerTrait
};