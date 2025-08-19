// Integration test modules
mod integration_tests;
mod ipc_integration_tests;
mod cross_platform_tests;
mod window_management_tests;

// Security test modules - Track ID: TEST-AUTO-001
mod security_test_suite;
mod validation_unit_tests;

// Re-export test functions for easier access
pub use integration_tests::*;
pub use ipc_integration_tests::*;
pub use cross_platform_tests::*;
pub use window_management_tests::*;
pub use security_test_suite::*;
pub use validation_unit_tests::*;