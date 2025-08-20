/// Mock Repository Implementations
/// 
/// This module provides mock implementations for all repository traits,
/// enabling isolated unit testing of service business logic without database dependencies.
/// 
/// ## Features
/// - Call tracking for verification in tests
/// - State management for simulating database operations
/// - Configurable responses for success and error scenarios
/// - Thread-safe implementations using Arc<Mutex<>>
/// - Full async trait compatibility

pub mod note_repository_mock;
pub mod settings_repository_mock;
pub mod search_repository_mock;

// Re-export all mock implementations
pub use note_repository_mock::MockNoteRepository;
pub use settings_repository_mock::MockSettingsRepository;
pub use search_repository_mock::MockSearchRepository;

use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// Shared state management for mock repositories
#[derive(Debug, Clone)]
pub struct MockRepositoryState<T> {
    data: Arc<Mutex<HashMap<String, T>>>,
    call_tracker: Arc<Mutex<MockCallTracker>>,
}

impl<T> MockRepositoryState<T> {
    pub fn new() -> Self {
        Self {
            data: Arc::new(Mutex::new(HashMap::new())),
            call_tracker: Arc::new(Mutex::new(MockCallTracker::new())),
        }
    }
    
    pub fn insert(&self, key: String, value: T) {
        let mut data = self.data.lock().unwrap();
        data.insert(key, value);
    }
    
    pub fn get(&self, key: &str) -> Option<T> 
    where 
        T: Clone,
    {
        let data = self.data.lock().unwrap();
        data.get(key).cloned()
    }
    
    pub fn remove(&self, key: &str) -> Option<T> {
        let mut data = self.data.lock().unwrap();
        data.remove(key)
    }
    
    pub fn contains_key(&self, key: &str) -> bool {
        let data = self.data.lock().unwrap();
        data.contains_key(key)
    }
    
    pub fn clear(&self) {
        let mut data = self.data.lock().unwrap();
        data.clear();
        let mut tracker = self.call_tracker.lock().unwrap();
        tracker.reset();
    }
    
    pub fn len(&self) -> usize {
        let data = self.data.lock().unwrap();
        data.len()
    }
    
    pub fn all_values(&self) -> Vec<T> 
    where 
        T: Clone,
    {
        let data = self.data.lock().unwrap();
        data.values().cloned().collect()
    }
    
    pub fn track_call(&self, method: &str) {
        let mut tracker = self.call_tracker.lock().unwrap();
        tracker.track_call(method);
    }
    
    pub fn get_call_count(&self, method: &str) -> usize {
        let tracker = self.call_tracker.lock().unwrap();
        tracker.get_call_count(method)
    }
    
    pub fn get_total_calls(&self) -> usize {
        let tracker = self.call_tracker.lock().unwrap();
        tracker.get_total_calls()
    }
    
    // Alias methods for compatibility with existing mock code
    pub fn record_call(&self, method: String) {
        self.track_call(&method);
    }
    
    pub fn get_all_data(&self) -> HashMap<String, T> 
    where 
        T: Clone,
    {
        let data = self.data.lock().unwrap();
        data.clone()
    }
    
    pub fn set_data(&self, key: String, value: T) {
        self.insert(key, value);
    }
    
    pub fn get_calls(&self) -> Vec<String> {
        let tracker = self.call_tracker.lock().unwrap();
        tracker.calls.keys().cloned().collect()
    }
    
    pub fn clear_calls(&self) {
        let mut tracker = self.call_tracker.lock().unwrap();
        tracker.reset();
    }
}

impl<T> Default for MockRepositoryState<T> {
    fn default() -> Self {
        Self::new()
    }
}

/// Call tracking utility for mock repositories
#[derive(Debug, Clone)]
pub struct MockCallTracker {
    calls: HashMap<String, usize>,
    total_calls: usize,
}

impl MockCallTracker {
    pub fn new() -> Self {
        Self {
            calls: HashMap::new(),
            total_calls: 0,
        }
    }
    
    pub fn track_call(&mut self, method: &str) {
        *self.calls.entry(method.to_string()).or_insert(0) += 1;
        self.total_calls += 1;
    }
    
    pub fn get_call_count(&self, method: &str) -> usize {
        self.calls.get(method).copied().unwrap_or(0)
    }
    
    pub fn get_total_calls(&self) -> usize {
        self.total_calls
    }
    
    pub fn get_all_calls(&self) -> HashMap<String, usize> {
        self.calls.clone()
    }
    
    pub fn reset(&mut self) {
        self.calls.clear();
        self.total_calls = 0;
    }
    
    pub fn was_called(&self, method: &str) -> bool {
        self.calls.contains_key(method)
    }
    
    pub fn assert_called(&self, method: &str) {
        assert!(self.was_called(method), "Method '{}' was not called", method);
    }
    
    pub fn assert_called_times(&self, method: &str, expected: usize) {
        let actual = self.get_call_count(method);
        assert_eq!(actual, expected, 
                   "Method '{}' was called {} times, expected {}", 
                   method, actual, expected);
    }
    
    pub fn assert_not_called(&self, method: &str) {
        assert!(!self.was_called(method), "Method '{}' was called unexpectedly", method);
    }
}

impl Default for MockCallTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_mock_repository_state() {
        let state: MockRepositoryState<String> = MockRepositoryState::new();
        
        // Test basic operations
        state.insert("key1".to_string(), "value1".to_string());
        assert_eq!(state.get("key1"), Some("value1".to_string()));
        assert!(state.contains_key("key1"));
        assert_eq!(state.len(), 1);
        
        // Test removal
        let removed = state.remove("key1");
        assert_eq!(removed, Some("value1".to_string()));
        assert!(!state.contains_key("key1"));
        assert_eq!(state.len(), 0);
    }
    
    #[test]
    fn test_mock_call_tracker() {
        let mut tracker = MockCallTracker::new();
        
        // Test call tracking
        tracker.track_call("method1");
        tracker.track_call("method1");
        tracker.track_call("method2");
        
        assert_eq!(tracker.get_call_count("method1"), 2);
        assert_eq!(tracker.get_call_count("method2"), 1);
        assert_eq!(tracker.get_call_count("method3"), 0);
        assert_eq!(tracker.get_total_calls(), 3);
        
        // Test assertions
        tracker.assert_called("method1");
        tracker.assert_called_times("method1", 2);
        tracker.assert_not_called("method3");
        
        // Test reset
        tracker.reset();
        assert_eq!(tracker.get_total_calls(), 0);
        assert!(!tracker.was_called("method1"));
    }
    
    #[test]
    #[should_panic(expected = "Method 'nonexistent' was not called")]
    fn test_call_tracker_assert_called_panic() {
        let tracker = MockCallTracker::new();
        tracker.assert_called("nonexistent");
    }
    
    #[test]
    #[should_panic(expected = "was called 0 times, expected 1")]
    fn test_call_tracker_assert_called_times_panic() {
        let tracker = MockCallTracker::new();
        tracker.assert_called_times("nonexistent", 1);
    }
}