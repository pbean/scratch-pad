// Integration test modules
mod integration_tests;
mod ipc_integration_tests;
mod cross_platform_tests;
mod window_management_tests;

// Re-export test functions for easier access
pub use integration_tests::*;
pub use ipc_integration_tests::*;
pub use cross_platform_tests::*;
pub use window_management_tests::*;