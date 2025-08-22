/*!
 * High-Resolution Test Performance Tracking for Rust
 * 
 * Provides microsecond-precision timing for Rust test duration monitoring,
 * performance budgets, and test optimization insights. Integrates with
 * the frontend performance tracking system.
 */

use std::collections::{HashMap, BTreeMap};
use std::fmt;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/// High-resolution timestamp with multiple precision levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighResTimestamp {
    /// Epoch milliseconds (SystemTime equivalent)
    pub epoch_ms: u64,
    /// High-resolution monotonic time (Instant equivalent)
    pub mono_ns: u64,
    /// Thread-local CPU time if available
    pub cpu_ns: Option<u64>,
}

/// Test performance metrics collected during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestPerformanceMetrics {
    /// Unique test identifier
    pub test_id: String,
    /// Test name/description
    pub test_name: String,
    /// Test module path
    pub test_module: String,
    /// Start timestamp
    pub start_time: HighResTimestamp,
    /// End timestamp
    pub end_time: Option<HighResTimestamp>,
    /// Total duration in microseconds
    pub duration_micros: Option<u64>,
    /// Setup phase duration in microseconds
    pub setup_duration_micros: Option<u64>,
    /// Execution phase duration in microseconds
    pub execution_duration_micros: Option<u64>,
    /// Cleanup phase duration in microseconds
    pub cleanup_duration_micros: Option<u64>,
    /// Memory usage at start (bytes)
    pub memory_start_bytes: Option<u64>,
    /// Memory usage at end (bytes)
    pub memory_end_bytes: Option<u64>,
    /// Peak memory usage during test (bytes)
    pub memory_peak_bytes: Option<u64>,
    /// Test result status
    pub status: TestStatus,
    /// Error message if failed
    pub error: Option<String>,
    /// Custom performance markers
    pub markers: Vec<PerformanceMarker>,
    /// Performance budget violations
    pub budget_violations: Vec<BudgetViolation>,
}

/// Test execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TestStatus {
    Passed,
    Failed,
    Ignored,
    Timeout,
    Panicked,
}

/// Custom performance markers within a test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMarker {
    /// Marker name
    pub name: String,
    /// Timestamp when marker was created
    pub timestamp: HighResTimestamp,
    /// Duration from test start in microseconds
    pub from_start_micros: u64,
    /// Optional metadata
    pub metadata: Option<serde_json::Value>,
}

/// Performance budget configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceBudget {
    /// Maximum allowed test duration in microseconds
    pub max_duration_micros: u64,
    /// Maximum allowed setup time in microseconds
    pub max_setup_micros: Option<u64>,
    /// Maximum allowed memory usage in bytes
    pub max_memory_bytes: Option<u64>,
    /// Maximum allowed markers (prevent excessive profiling)
    pub max_markers: Option<usize>,
    /// Custom budget rules
    pub custom_rules: Vec<BudgetRule>,
}

/// Custom budget rule definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetRule {
    /// Rule name
    pub name: String,
    /// Rule description
    pub description: String,
    /// Severity level
    pub severity: BudgetSeverity,
}

/// Budget violation severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BudgetSeverity {
    Warning,
    Error,
}

/// Budget violation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetViolation {
    /// Rule that was violated
    pub rule: String,
    /// Actual value that caused violation
    pub actual_value: u64,
    /// Expected/budgeted value
    pub budgeted_value: u64,
    /// Severity level
    pub severity: BudgetSeverity,
    /// Descriptive message
    pub message: String,
}

/// Aggregated performance statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    /// Total number of tests analyzed
    pub total_tests: usize,
    /// Tests that passed performance budgets
    pub passing_tests: usize,
    /// Tests that failed performance budgets
    pub failing_tests: usize,
    /// Average test duration in microseconds
    pub avg_duration_micros: u64,
    /// Median test duration in microseconds
    pub median_duration_micros: u64,
    /// 95th percentile duration in microseconds
    pub p95_duration_micros: u64,
    /// Fastest test duration in microseconds
    pub min_duration_micros: u64,
    /// Slowest test duration in microseconds
    pub max_duration_micros: u64,
    /// Total test suite duration in microseconds
    pub total_duration_micros: u64,
    /// Tests grouped by module
    pub tests_by_module: BTreeMap<String, Vec<String>>,
}

/// Performance report configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceReportConfig {
    /// Output format
    pub format: ReportFormat,
    /// Include detailed metrics
    pub include_details: bool,
    /// Include performance trends
    pub include_trends: bool,
    /// Minimum duration threshold for inclusion (microseconds)
    pub min_duration_micros: Option<u64>,
    /// Group results by test module
    pub group_by_module: bool,
}

/// Report output format
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReportFormat {
    Json,
    Csv,
    Console,
}

// ============================================================================
// GLOBAL PERFORMANCE TRACKER
// ============================================================================

/// Global performance tracking state
struct PerformanceTracker {
    metrics: HashMap<String, TestPerformanceMetrics>,
    current_test: Option<TestPerformanceMetrics>,
    budgets: HashMap<String, PerformanceBudget>,
    global_budget: Option<PerformanceBudget>,
    enabled: bool,
    start_time: Instant,
}

impl PerformanceTracker {
    fn new() -> Self {
        Self {
            metrics: HashMap::new(),
            current_test: None,
            budgets: HashMap::new(),
            global_budget: None,
            enabled: true,
            start_time: Instant::now(),
        }
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn get_all_metrics(&self) -> Vec<TestPerformanceMetrics> {
        self.metrics.values().cloned().collect()
    }

    fn get_metrics(&self, test_id: &str) -> Option<&TestPerformanceMetrics> {
        self.metrics.get(test_id)
    }

    fn clear(&mut self) {
        self.metrics.clear();
        self.current_test = None;
    }

    fn set_budget(&mut self, test_id: String, budget: PerformanceBudget) {
        self.budgets.insert(test_id, budget);
    }

    fn set_global_budget(&mut self, budget: PerformanceBudget) {
        self.global_budget = Some(budget);
    }

    fn start_test(&mut self, test_id: String, test_name: String, test_module: String) -> TestPerformanceMetrics {
        if !self.enabled {
            return self.create_dummy_metrics(test_id, test_name, test_module);
        }

        let start_time = create_high_res_timestamp();
        let metrics = TestPerformanceMetrics {
            test_id: test_id.clone(),
            test_name,
            test_module,
            start_time,
            end_time: None,
            duration_micros: None,
            setup_duration_micros: None,
            execution_duration_micros: None,
            cleanup_duration_micros: None,
            memory_start_bytes: get_memory_usage(),
            memory_end_bytes: None,
            memory_peak_bytes: None,
            status: TestStatus::Passed,
            error: None,
            markers: Vec::new(),
            budget_violations: Vec::new(),
        };

        self.current_test = Some(metrics.clone());
        self.metrics.insert(test_id, metrics.clone());
        metrics
    }

    fn end_test(&mut self, status: TestStatus, error: Option<String>) {
        if !self.enabled || self.current_test.is_none() {
            return;
        }

        let end_time = create_high_res_timestamp();
        if let Some(ref mut current) = self.current_test {
            current.end_time = Some(end_time.clone());
            current.status = status;
            current.error = error;

            // Calculate durations
            current.duration_micros = Some(calculate_microseconds_diff(&current.start_time, &end_time));

            // Memory metrics
            current.memory_end_bytes = get_memory_usage();

            // Check performance budgets
            self.check_budgets(&mut current.clone());

            // Update in metrics map
            self.metrics.insert(current.test_id.clone(), current.clone());
        }

        self.current_test = None;
    }

    fn add_marker(&mut self, name: String, metadata: Option<serde_json::Value>) {
        if !self.enabled || self.current_test.is_none() {
            return;
        }

        if let Some(ref mut current) = self.current_test {
            let timestamp = create_high_res_timestamp();
            let from_start_micros = calculate_microseconds_diff(&current.start_time, &timestamp);

            current.markers.push(PerformanceMarker {
                name,
                timestamp,
                from_start_micros,
                metadata,
            });
        }
    }

    fn mark_setup_complete(&mut self) {
        if !self.enabled || self.current_test.is_none() {
            return;
        }

        if let Some(ref mut current) = self.current_test {
            let setup_end_time = create_high_res_timestamp();
            current.setup_duration_micros = Some(calculate_microseconds_diff(&current.start_time, &setup_end_time));
            self.add_marker("setup_complete".to_string(), None);
        }
    }

    fn mark_execution_start(&mut self) {
        if !self.enabled {
            return;
        }
        self.add_marker("execution_start".to_string(), None);
    }

    fn mark_cleanup_start(&mut self) {
        if !self.enabled {
            return;
        }
        self.add_marker("cleanup_start".to_string(), None);
    }

    fn check_budgets(&self, metrics: &mut TestPerformanceMetrics) {
        let budget = self.budgets.get(&metrics.test_id).or(self.global_budget.as_ref());
        if let (Some(budget), Some(duration)) = (budget, metrics.duration_micros) {
            // Check duration budget
            if duration > budget.max_duration_micros {
                metrics.budget_violations.push(BudgetViolation {
                    rule: "max_duration".to_string(),
                    actual_value: duration,
                    budgeted_value: budget.max_duration_micros,
                    severity: BudgetSeverity::Error,
                    message: format!(
                        "Test exceeded maximum duration: {} > {}",
                        format_microseconds(duration),
                        format_microseconds(budget.max_duration_micros)
                    ),
                });
            }

            // Check setup duration budget
            if let (Some(max_setup), Some(setup_duration)) = (budget.max_setup_micros, metrics.setup_duration_micros) {
                if setup_duration > max_setup {
                    metrics.budget_violations.push(BudgetViolation {
                        rule: "max_setup_duration".to_string(),
                        actual_value: setup_duration,
                        budgeted_value: max_setup,
                        severity: BudgetSeverity::Warning,
                        message: format!(
                            "Test setup exceeded budget: {} > {}",
                            format_microseconds(setup_duration),
                            format_microseconds(max_setup)
                        ),
                    });
                }
            }

            // Check memory budget
            if let (Some(max_memory), Some(peak_memory)) = (budget.max_memory_bytes, metrics.memory_peak_bytes) {
                if peak_memory > max_memory {
                    metrics.budget_violations.push(BudgetViolation {
                        rule: "max_memory".to_string(),
                        actual_value: peak_memory,
                        budgeted_value: max_memory,
                        severity: BudgetSeverity::Error,
                        message: format!(
                            "Test exceeded memory budget: {} > {}",
                            format_bytes(peak_memory),
                            format_bytes(max_memory)
                        ),
                    });
                }
            }

            // Check marker count budget
            if let Some(max_markers) = budget.max_markers {
                if metrics.markers.len() > max_markers {
                    metrics.budget_violations.push(BudgetViolation {
                        rule: "max_markers".to_string(),
                        actual_value: metrics.markers.len() as u64,
                        budgeted_value: max_markers as u64,
                        severity: BudgetSeverity::Warning,
                        message: format!(
                            "Test exceeded marker budget: {} > {}",
                            metrics.markers.len(),
                            max_markers
                        ),
                    });
                }
            }
        }
    }

    fn create_dummy_metrics(&self, test_id: String, test_name: String, test_module: String) -> TestPerformanceMetrics {
        TestPerformanceMetrics {
            test_id,
            test_name,
            test_module,
            start_time: create_high_res_timestamp(),
            end_time: None,
            duration_micros: None,
            setup_duration_micros: None,
            execution_duration_micros: None,
            cleanup_duration_micros: None,
            memory_start_bytes: None,
            memory_end_bytes: None,
            memory_peak_bytes: None,
            status: TestStatus::Passed,
            error: None,
            markers: Vec::new(),
            budget_violations: Vec::new(),
        }
    }
}

static PERFORMANCE_TRACKER: OnceLock<Arc<Mutex<PerformanceTracker>>> = OnceLock::new();

fn get_tracker() -> &'static Arc<Mutex<PerformanceTracker>> {
    PERFORMANCE_TRACKER.get_or_init(|| Arc::new(Mutex::new(PerformanceTracker::new())))
}

// ============================================================================
// HIGH-RESOLUTION TIMING UTILITIES
// ============================================================================

/// Create high-resolution timestamp with multiple precision levels
pub fn create_high_res_timestamp() -> HighResTimestamp {
    let epoch_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mono_ns = get_tracker()
        .lock()
        .unwrap()
        .start_time
        .elapsed()
        .as_nanos() as u64;

    // CPU time is not easily available in stable Rust
    let cpu_ns = None;

    HighResTimestamp {
        epoch_ms,
        mono_ns,
        cpu_ns,
    }
}

/// Calculate difference between two timestamps in microseconds
pub fn calculate_microseconds_diff(start: &HighResTimestamp, end: &HighResTimestamp) -> u64 {
    let diff_ns = end.mono_ns.saturating_sub(start.mono_ns);
    diff_ns / 1000 // Convert to microseconds
}

/// Format microseconds for human-readable display
pub fn format_microseconds(micros: u64) -> String {
    if micros >= 1_000_000 {
        format!("{:.2}s", micros as f64 / 1_000_000.0)
    } else if micros >= 1_000 {
        format!("{:.2}ms", micros as f64 / 1_000.0)
    } else {
        format!("{}μs", micros)
    }
}

/// Format bytes for human-readable display
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    format!("{:.2}{}", size, UNITS[unit_index])
}

/// Get current memory usage (placeholder - requires platform-specific implementation)
fn get_memory_usage() -> Option<u64> {
    // In a real implementation, this would use platform-specific APIs
    // For now, return None as memory tracking is optional
    None
}

// ============================================================================
// PERFORMANCE BUDGET PRESETS
// ============================================================================

/// Common performance budget presets
pub mod performance_budgets {
    use super::*;

    /// Fast unit tests (< 100ms)
    pub fn unit_fast() -> PerformanceBudget {
        PerformanceBudget {
            max_duration_micros: 100_000, // 100ms
            max_setup_micros: Some(10_000), // 10ms
            max_memory_bytes: Some(50_000_000), // 50MB
            max_markers: Some(10),
            custom_rules: Vec::new(),
        }
    }

    /// Standard unit tests (< 1s)
    pub fn unit_standard() -> PerformanceBudget {
        PerformanceBudget {
            max_duration_micros: 1_000_000, // 1s
            max_setup_micros: Some(100_000), // 100ms
            max_memory_bytes: Some(100_000_000), // 100MB
            max_markers: Some(20),
            custom_rules: Vec::new(),
        }
    }

    /// Integration tests (< 5s)
    pub fn integration() -> PerformanceBudget {
        PerformanceBudget {
            max_duration_micros: 5_000_000, // 5s
            max_setup_micros: Some(1_000_000), // 1s
            max_memory_bytes: Some(500_000_000), // 500MB
            max_markers: Some(50),
            custom_rules: Vec::new(),
        }
    }

    /// Database tests (< 10s)
    pub fn database() -> PerformanceBudget {
        PerformanceBudget {
            max_duration_micros: 10_000_000, // 10s
            max_setup_micros: Some(2_000_000), // 2s
            max_memory_bytes: Some(1_000_000_000), // 1GB
            max_markers: Some(100),
            custom_rules: Vec::new(),
        }
    }
}

// ============================================================================
// TEST INTEGRATION MACROS AND FUNCTIONS
// ============================================================================

/// Initialize performance tracking for a test
pub fn start_test_tracking(test_name: &str, test_module: &str) -> String {
    let test_id = format!("{}::{}", test_module, test_name);
    get_tracker()
        .lock()
        .unwrap()
        .start_test(test_id.clone(), test_name.to_string(), test_module.to_string());
    test_id
}

/// End performance tracking for a test
pub fn end_test_tracking(status: TestStatus, error: Option<String>) {
    get_tracker()
        .lock()
        .unwrap()
        .end_test(status, error);
}

/// Add a performance marker
pub fn mark(name: &str, metadata: Option<serde_json::Value>) {
    get_tracker()
        .lock()
        .unwrap()
        .add_marker(name.to_string(), metadata);
}

/// Time a specific operation within a test
pub async fn time_operation<F, T>(name: &str, operation: F) -> Result<T, Box<dyn std::error::Error>>
where
    F: std::future::Future<Output = Result<T, Box<dyn std::error::Error>>>,
{
    let start_marker = format!("{}_start", name);
    let end_marker = format!("{}_end", name);

    mark(&start_marker, None);
    
    match operation.await {
        Ok(result) => {
            mark(&end_marker, None);
            Ok(result)
        }
        Err(error) => {
            let error_marker = format!("{}_error", name);
            mark(&error_marker, Some(serde_json::json!({
                "error": error.to_string()
            })));
            Err(error)
        }
    }
}

/// Set performance budget for current test
pub fn set_test_budget(budget: PerformanceBudget) {
    let tracker = get_tracker();
    let mut tracker_guard = tracker.lock().unwrap();
    
    if let Some(ref current) = tracker_guard.current_test {
        tracker_guard.set_budget(current.test_id.clone(), budget);
    }
}

/// Generate performance statistics
pub fn generate_performance_stats() -> PerformanceStats {
    let tracker = get_tracker();
    let tracker_guard = tracker.lock().unwrap();
    let all_metrics = tracker_guard.get_all_metrics();

    let mut durations: Vec<u64> = all_metrics
        .iter()
        .filter_map(|m| m.duration_micros)
        .collect();
    durations.sort_unstable();

    let total_tests = all_metrics.len();
    let passing_tests = all_metrics
        .iter()
        .filter(|m| m.budget_violations.is_empty())
        .count();
    let failing_tests = total_tests - passing_tests;

    let avg_duration_micros = if !durations.is_empty() {
        durations.iter().sum::<u64>() / durations.len() as u64
    } else {
        0
    };

    let median_duration_micros = if !durations.is_empty() {
        durations[durations.len() / 2]
    } else {
        0
    };

    let p95_duration_micros = if !durations.is_empty() {
        durations[(durations.len() as f64 * 0.95) as usize]
    } else {
        0
    };

    let mut tests_by_module: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for metric in &all_metrics {
        tests_by_module
            .entry(metric.test_module.clone())
            .or_default()
            .push(metric.test_name.clone());
    }

    PerformanceStats {
        total_tests,
        passing_tests,
        failing_tests,
        avg_duration_micros,
        median_duration_micros,
        p95_duration_micros,
        min_duration_micros: durations.first().copied().unwrap_or(0),
        max_duration_micros: durations.last().copied().unwrap_or(0),
        total_duration_micros: durations.iter().sum(),
        tests_by_module,
    }
}

/// Generate performance report
pub fn generate_performance_report(config: &PerformanceReportConfig) -> String {
    let stats = generate_performance_stats();
    let tracker = get_tracker();
    let tracker_guard = tracker.lock().unwrap();
    let all_metrics = tracker_guard.get_all_metrics();

    match config.format {
        ReportFormat::Json => {
            let report = serde_json::json!({
                "stats": stats,
                "metrics": if config.include_details { Some(&all_metrics) } else { None }
            });
            serde_json::to_string_pretty(&report).unwrap_or_else(|_| "Error generating JSON report".to_string())
        }
        ReportFormat::Csv => generate_csv_report(&all_metrics),
        ReportFormat::Console => generate_console_report(&stats, &all_metrics),
    }
}

fn generate_csv_report(metrics: &[TestPerformanceMetrics]) -> String {
    let mut lines = vec!["TestName,TestModule,Duration(μs),Status,BudgetViolations,MemoryUsed(bytes)".to_string()];

    for metric in metrics {
        let duration = metric.duration_micros.unwrap_or(0);
        let violations = metric.budget_violations.len();
        let memory = metric.memory_end_bytes.unwrap_or(0);

        lines.push(format!(
            "\"{}\",\"{}\",{},{:?},{},{}",
            metric.test_name,
            metric.test_module,
            duration,
            metric.status,
            violations,
            memory
        ));
    }

    lines.join("\n")
}

fn generate_console_report(stats: &PerformanceStats, metrics: &[TestPerformanceMetrics]) -> String {
    let mut lines = Vec::new();

    lines.push("📊 Rust Test Performance Report".to_string());
    lines.push("=".repeat(50));
    lines.push("".to_string());

    // Summary stats
    lines.push(format!("Total Tests: {}", stats.total_tests));
    lines.push(format!(
        "Passing Budget: {} ({:.1}%)",
        stats.passing_tests,
        stats.passing_tests as f64 / stats.total_tests as f64 * 100.0
    ));
    lines.push(format!(
        "Failing Budget: {} ({:.1}%)",
        stats.failing_tests,
        stats.failing_tests as f64 / stats.total_tests as f64 * 100.0
    ));
    lines.push(format!("Total Duration: {}", format_microseconds(stats.total_duration_micros)));
    lines.push(format!("Average Duration: {}", format_microseconds(stats.avg_duration_micros)));
    lines.push(format!("Median Duration: {}", format_microseconds(stats.median_duration_micros)));
    lines.push(format!("95th Percentile: {}", format_microseconds(stats.p95_duration_micros)));
    lines.push("".to_string());

    // Slowest tests
    let mut slowest_tests: Vec<_> = metrics
        .iter()
        .filter(|m| m.duration_micros.is_some())
        .collect();
    slowest_tests.sort_by(|a, b| {
        b.duration_micros.unwrap_or(0).cmp(&a.duration_micros.unwrap_or(0))
    });
    slowest_tests.truncate(10);

    if !slowest_tests.is_empty() {
        lines.push("🐌 Slowest Tests:".to_string());
        for test in slowest_tests {
            lines.push(format!(
                "  {} - {}::{}",
                format_microseconds(test.duration_micros.unwrap()),
                test.test_module,
                test.test_name
            ));
        }
        lines.push("".to_string());
    }

    // Budget violations
    let violating_tests: Vec<_> = metrics
        .iter()
        .filter(|m| !m.budget_violations.is_empty())
        .collect();

    if !violating_tests.is_empty() {
        lines.push("⚠️  Budget Violations:".to_string());
        for test in violating_tests {
            lines.push(format!("  {}::{}", test.test_module, test.test_name));
            for violation in &test.budget_violations {
                lines.push(format!("    - {}", violation.message));
            }
        }
        lines.push("".to_string());
    }

    lines.join("\n")
}

// ============================================================================
// TEST HELPER MACROS
// ============================================================================

/// Macro to wrap test functions with performance tracking
#[macro_export]
macro_rules! timed_test {
    ($test_fn:ident, $budget:expr) => {
        #[test]
        fn $test_fn() {
            use $crate::testing::performance_tracking::*;
            
            let test_name = stringify!($test_fn);
            let test_module = module_path!();
            
            // Set budget before starting test
            let _test_id = start_test_tracking(test_name, test_module);
            set_test_budget($budget);
            
            // Run the actual test
            let result = std::panic::catch_unwind(|| {
                // Call the actual test function
                super::$test_fn();
            });
            
            // End tracking based on result
            match result {
                Ok(_) => end_test_tracking(TestStatus::Passed, None),
                Err(err) => {
                    let error_msg = if let Some(s) = err.downcast_ref::<&str>() {
                        s.to_string()
                    } else if let Some(s) = err.downcast_ref::<String>() {
                        s.clone()
                    } else {
                        "Test panicked".to_string()
                    };
                    end_test_tracking(TestStatus::Panicked, Some(error_msg));
                    std::panic::resume_unwind(err);
                }
            }
        }
    };
}

// ============================================================================
// INTEGRATION WITH MAIN TEST INFRASTRUCTURE
// ============================================================================

impl fmt::Display for TestStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TestStatus::Passed => write!(f, "passed"),
            TestStatus::Failed => write!(f, "failed"),
            TestStatus::Ignored => write!(f, "ignored"),
            TestStatus::Timeout => write!(f, "timeout"),
            TestStatus::Panicked => write!(f, "panicked"),
        }
    }
}

impl fmt::Display for BudgetSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BudgetSeverity::Warning => write!(f, "warning"),
            BudgetSeverity::Error => write!(f, "error"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timestamp_creation() {
        let ts1 = create_high_res_timestamp();
        std::thread::sleep(Duration::from_millis(1));
        let ts2 = create_high_res_timestamp();
        
        assert!(ts2.epoch_ms >= ts1.epoch_ms);
        assert!(ts2.mono_ns > ts1.mono_ns);
    }

    #[test]
    fn test_microsecond_calculation() {
        let ts1 = create_high_res_timestamp();
        std::thread::sleep(Duration::from_millis(10));
        let ts2 = create_high_res_timestamp();
        
        let diff = calculate_microseconds_diff(&ts1, &ts2);
        assert!(diff >= 10_000); // At least 10ms = 10,000μs
        assert!(diff < 20_000);  // Less than 20ms (reasonable upper bound)
    }

    #[test]
    fn test_format_functions() {
        assert_eq!(format_microseconds(500), "500μs");
        assert_eq!(format_microseconds(1_500), "1.50ms");
        assert_eq!(format_microseconds(1_500_000), "1.50s");
        
        assert_eq!(format_bytes(1024), "1.00KB");
        assert_eq!(format_bytes(1048576), "1.00MB");
    }
}