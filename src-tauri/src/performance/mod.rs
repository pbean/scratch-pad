/// Comprehensive Performance Monitoring Module
///
/// Implements comprehensive performance monitoring for both backend and frontend
/// with real-time metrics collection, analysis, and optimization recommendations.
///
/// Week 3 Day 9 Implementation: Task 9.1 - Performance Metrics
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub mod analytics;
pub mod backend;
pub mod frontend;
pub mod system;

/// Performance metrics for a single operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationMetrics {
    /// Operation identifier
    pub operation_id: String,
    /// Operation type (search, note_crud, settings, etc.)
    pub operation_type: String,
    /// Start timestamp (milliseconds since epoch)
    pub start_timestamp: u64,
    /// Duration in milliseconds
    pub duration_ms: u64,
    /// Success/failure status
    pub success: bool,
    /// Error message if failed
    pub error_message: Option<String>,
    /// Memory usage at operation start (bytes)
    pub memory_usage_start: Option<u64>,
    /// Memory usage at operation end (bytes)
    pub memory_usage_end: Option<u64>,
    /// Additional context data
    pub context: HashMap<String, String>,
}

/// System performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    /// Timestamp when metrics were collected
    pub timestamp: u64,
    /// Memory usage in bytes
    pub memory_usage: u64,
    /// CPU usage percentage (0-100)
    pub cpu_usage: Option<f64>,
    /// Number of active database connections
    pub active_db_connections: u32,
    /// Number of operations in progress
    pub operations_in_progress: u32,
    /// Cache statistics
    pub cache_stats: CacheMetrics,
}

/// Cache performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheMetrics {
    /// Total number of cache entries
    pub total_entries: u32,
    /// Cache hit rate (0.0 - 1.0)
    pub hit_rate: f64,
    /// Average lookup time in microseconds
    pub avg_lookup_time_us: u64,
    /// Memory used by cache in bytes
    pub memory_usage: u64,
    /// Number of evictions in the last period
    pub recent_evictions: u32,
}

/// Performance alert levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertLevel {
    Info,
    Warning,
    Error,
    Critical,
}

/// Performance alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    /// Unique alert identifier
    pub id: String,
    /// Alert level
    pub level: AlertLevel,
    /// Alert message
    pub message: String,
    /// Timestamp when alert was triggered
    pub timestamp: u64,
    /// Related operation metrics
    pub related_metrics: Option<OperationMetrics>,
    /// Whether alert is still active
    pub is_active: bool,
    /// Suggested action to resolve the alert
    pub suggested_action: Option<String>,
}

/// Performance summary over a time period
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSummary {
    /// Period start timestamp
    pub period_start: u64,
    /// Period end timestamp
    pub period_end: u64,
    /// Total operations processed
    pub total_operations: u64,
    /// Average operation duration
    pub avg_operation_duration_ms: f64,
    /// 95th percentile operation duration
    pub p95_operation_duration_ms: f64,
    /// Success rate (0.0 - 1.0)
    pub success_rate: f64,
    /// Number of active alerts
    pub active_alerts: u32,
    /// Performance score (0-100)
    pub performance_score: u8,
    /// Memory efficiency score (0-100)
    pub memory_efficiency_score: u8,
}

/// Performance budget thresholds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceBudget {
    /// Maximum allowed operation duration (ms)
    pub max_operation_duration_ms: u64,
    /// Maximum memory usage (bytes)
    pub max_memory_usage_bytes: u64,
    /// Target cache hit rate (0.0 - 1.0)
    pub target_cache_hit_rate: f64,
    /// Maximum CPU usage percentage (0-100)
    pub max_cpu_usage_percent: f64,
}

impl Default for PerformanceBudget {
    fn default() -> Self {
        Self {
            max_operation_duration_ms: 100,
            max_memory_usage_bytes: 512 * 1024 * 1024, // 512MB
            target_cache_hit_rate: 0.85,
            max_cpu_usage_percent: 80.0,
        }
    }
}

/// Main performance monitoring system
pub struct PerformanceMonitor {
    /// Operation history for analysis
    operation_history: Arc<Mutex<VecDeque<OperationMetrics>>>,
    /// System metrics history
    system_history: Arc<Mutex<VecDeque<SystemMetrics>>>,
    /// Active performance alerts
    alerts: Arc<Mutex<Vec<PerformanceAlert>>>,
    /// Performance budget configuration
    budget: Arc<Mutex<PerformanceBudget>>,
    /// Current operations in progress
    active_operations: Arc<Mutex<HashMap<String, Instant>>>,
}

impl PerformanceMonitor {
    /// Create new performance monitor
    pub fn new() -> Self {
        Self {
            operation_history: Arc::new(Mutex::new(VecDeque::with_capacity(1000))),
            system_history: Arc::new(Mutex::new(VecDeque::with_capacity(1000))),
            alerts: Arc::new(Mutex::new(Vec::new())),
            budget: Arc::new(Mutex::new(PerformanceBudget::default())),
            active_operations: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start tracking an operation
    pub fn start_operation(
        &self,
        operation_id: String,
        operation_type: String,
    ) -> OperationTracker<'_> {
        let start_time = Instant::now();
        let start_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let memory_usage_start = self.get_memory_usage();

        // Record operation start
        if let Ok(mut active) = self.active_operations.lock() {
            active.insert(operation_id.clone(), start_time);
        }

        OperationTracker {
            operation_id,
            operation_type,
            start_time,
            start_timestamp,
            memory_usage_start,
            monitor: self,
            completed: false,
        }
    }

    /// Record a completed operation
    pub fn record_operation(&self, metrics: OperationMetrics) {
        // Remove from active operations
        if let Ok(mut active) = self.active_operations.lock() {
            active.remove(&metrics.operation_id);
        }

        // Add to history
        if let Ok(mut history) = self.operation_history.lock() {
            history.push_back(metrics.clone());

            // Keep only last 1000 operations
            if history.len() > 1000 {
                history.pop_front();
            }
        }

        // Check for performance budget violations
        self.check_budget_violations(&metrics);
    }

    /// Record system metrics
    pub fn record_system_metrics(&self, metrics: SystemMetrics) {
        if let Ok(mut history) = self.system_history.lock() {
            history.push_back(metrics.clone());

            // Keep only last 1000 metrics
            if history.len() > 1000 {
                history.pop_front();
            }
        }

        // Check for system-level alerts
        self.check_system_alerts(&metrics);
    }

    /// Get current memory usage
    pub fn get_memory_usage(&self) -> Option<u64> {
        // This is a placeholder - in a real implementation, this would
        // use platform-specific APIs to get actual memory usage
        Some(100 * 1024 * 1024) // 100MB placeholder
    }

    /// Get active performance alerts
    pub fn get_active_alerts(&self) -> Vec<PerformanceAlert> {
        self.alerts
            .lock()
            .map(|alerts| alerts.iter().filter(|a| a.is_active).cloned().collect())
            .unwrap_or_default()
    }

    /// Get performance summary for a time period
    pub fn get_performance_summary(&self, period_hours: u64) -> PerformanceSummary {
        let cutoff_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
            - (period_hours * 3600 * 1000);

        let history = self.operation_history.lock().unwrap();
        let relevant_ops: Vec<_> = history
            .iter()
            .filter(|op| op.start_timestamp >= cutoff_time)
            .collect();

        if relevant_ops.is_empty() {
            return PerformanceSummary {
                period_start: cutoff_time,
                period_end: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                total_operations: 0,
                avg_operation_duration_ms: 0.0,
                p95_operation_duration_ms: 0.0,
                success_rate: 1.0,
                active_alerts: self.get_active_alerts().len() as u32,
                performance_score: 100,
                memory_efficiency_score: 100,
            };
        }

        let total_operations = relevant_ops.len() as u64;
        let successful_ops = relevant_ops.iter().filter(|op| op.success).count() as u64;
        let success_rate = successful_ops as f64 / total_operations as f64;

        let avg_duration = relevant_ops
            .iter()
            .map(|op| op.duration_ms as f64)
            .sum::<f64>()
            / total_operations as f64;

        // Calculate 95th percentile
        let mut durations: Vec<_> = relevant_ops.iter().map(|op| op.duration_ms).collect();
        durations.sort();
        let p95_index = ((durations.len() as f64) * 0.95) as usize;
        let p95_duration = durations.get(p95_index).copied().unwrap_or(0) as f64;

        let performance_score = self.calculate_performance_score(&relevant_ops);
        let memory_efficiency_score = self.calculate_memory_efficiency_score(&relevant_ops);

        PerformanceSummary {
            period_start: cutoff_time,
            period_end: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            total_operations,
            avg_operation_duration_ms: avg_duration,
            p95_operation_duration_ms: p95_duration,
            success_rate,
            active_alerts: self.get_active_alerts().len() as u32,
            performance_score,
            memory_efficiency_score,
        }
    }

    /// Get current performance budget
    pub fn get_budget(&self) -> PerformanceBudget {
        self.budget
            .lock()
            .map(|budget| budget.clone())
            .unwrap_or_default()
    }

    /// Update performance budget
    pub fn update_budget(&self, new_budget: PerformanceBudget) {
        if let Ok(mut budget) = self.budget.lock() {
            *budget = new_budget;
        }
    }

    /// Check for budget violations and create alerts
    fn check_budget_violations(&self, metrics: &OperationMetrics) {
        let budget = self.get_budget();

        if metrics.duration_ms > budget.max_operation_duration_ms {
            self.create_alert(
                AlertLevel::Warning,
                format!(
                    "Operation '{}' exceeded duration budget ({} ms > {} ms)",
                    metrics.operation_type, metrics.duration_ms, budget.max_operation_duration_ms
                ),
                Some(metrics.clone()),
                Some("Consider optimizing the operation or increasing the budget".to_string()),
            );
        }
    }

    /// Check for system-level alerts
    fn check_system_alerts(&self, metrics: &SystemMetrics) {
        let budget = self.get_budget();

        if let Some(cpu_usage) = metrics.cpu_usage {
            if cpu_usage > budget.max_cpu_usage_percent {
                self.create_alert(
                    AlertLevel::Warning,
                    format!(
                        "CPU usage exceeded budget ({:.1}% > {:.1}%)",
                        cpu_usage, budget.max_cpu_usage_percent
                    ),
                    None,
                    Some("Monitor system load and consider optimizations".to_string()),
                );
            }
        }

        if metrics.memory_usage > budget.max_memory_usage_bytes {
            self.create_alert(
                AlertLevel::Error,
                format!(
                    "Memory usage exceeded budget ({} bytes > {} bytes)",
                    metrics.memory_usage, budget.max_memory_usage_bytes
                ),
                None,
                Some("Check for memory leaks and optimize memory usage".to_string()),
            );
        }
    }

    /// Create a new performance alert
    fn create_alert(
        &self,
        level: AlertLevel,
        message: String,
        related_metrics: Option<OperationMetrics>,
        suggested_action: Option<String>,
    ) {
        let alert = PerformanceAlert {
            id: format!("alert_{}", uuid::Uuid::new_v4()),
            level,
            message,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            related_metrics,
            is_active: true,
            suggested_action,
        };

        if let Ok(mut alerts) = self.alerts.lock() {
            alerts.push(alert);

            // Keep only last 100 alerts
            if alerts.len() > 100 {
                alerts.remove(0);
            }
        }
    }

    /// Calculate overall performance score
    fn calculate_performance_score(&self, operations: &[&OperationMetrics]) -> u8 {
        if operations.is_empty() {
            return 100;
        }

        let avg_duration = operations
            .iter()
            .map(|op| op.duration_ms as f64)
            .sum::<f64>()
            / operations.len() as f64;

        let success_rate =
            operations.iter().filter(|op| op.success).count() as f64 / operations.len() as f64;

        // Calculate score based on duration and success rate
        let duration_score = if avg_duration < 25.0 {
            100.0
        } else if avg_duration < 50.0 {
            90.0
        } else if avg_duration < 100.0 {
            75.0
        } else if avg_duration < 200.0 {
            60.0
        } else {
            40.0
        };

        let success_score = success_rate * 100.0;

        // Weighted average
        ((duration_score * 0.6) + (success_score * 0.4)) as u8
    }

    /// Calculate memory efficiency score
    fn calculate_memory_efficiency_score(&self, operations: &[&OperationMetrics]) -> u8 {
        if operations.is_empty() {
            return 100;
        }

        // Calculate average memory usage change
        let memory_changes: Vec<_> = operations
            .iter()
            .filter_map(|op| {
                if let (Some(start), Some(end)) = (op.memory_usage_start, op.memory_usage_end) {
                    Some(end as i64 - start as i64)
                } else {
                    None
                }
            })
            .collect();

        if memory_changes.is_empty() {
            return 100;
        }

        let avg_change = memory_changes.iter().sum::<i64>() as f64 / memory_changes.len() as f64;

        // Score based on memory growth
        if avg_change < 1024.0 {
            // < 1KB growth
            100
        } else if avg_change < 10240.0 {
            // < 10KB growth
            90
        } else if avg_change < 102400.0 {
            // < 100KB growth
            75
        } else if avg_change < 1048576.0 {
            // < 1MB growth
            60
        } else {
            40
        }
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Operation tracker for measuring individual operation performance
pub struct OperationTracker<'a> {
    operation_id: String,
    operation_type: String,
    start_time: Instant,
    start_timestamp: u64,
    memory_usage_start: Option<u64>,
    monitor: &'a PerformanceMonitor,
    completed: bool,
}

impl<'a> OperationTracker<'a> {
    /// Add context information to the operation
    pub fn add_context(&mut self, _key: String, _value: String) {
        // Context would be stored for inclusion in the final metrics
        // For now, this is a placeholder
    }

    /// Complete the operation with success
    pub fn complete_success(mut self) {
        self.complete_with_result(true, None);
        self.completed = true;
    }

    /// Complete the operation with error
    pub fn complete_error(mut self, error_message: String) {
        self.complete_with_result(false, Some(error_message));
        self.completed = true;
    }

    /// Complete the operation with custom result
    fn complete_with_result(&self, success: bool, error_message: Option<String>) {
        let duration = self.start_time.elapsed();
        let memory_usage_end = self.monitor.get_memory_usage();

        let metrics = OperationMetrics {
            operation_id: self.operation_id.clone(),
            operation_type: self.operation_type.clone(),
            start_timestamp: self.start_timestamp,
            duration_ms: duration.as_millis() as u64,
            success,
            error_message,
            memory_usage_start: self.memory_usage_start,
            memory_usage_end,
            context: HashMap::new(), // Would include context from add_context calls
        };

        self.monitor.record_operation(metrics);
    }
}

impl<'a> Drop for OperationTracker<'a> {
    fn drop(&mut self) {
        // If the tracker is dropped without explicit completion, mark as success
        // This prevents incomplete operations from being lost
        if !self.completed {
            let duration = self.start_time.elapsed();
            let memory_usage_end = self.monitor.get_memory_usage();

            let metrics = OperationMetrics {
                operation_id: self.operation_id.clone(),
                operation_type: self.operation_type.clone(),
                start_timestamp: self.start_timestamp,
                duration_ms: duration.as_millis() as u64,
                success: true, // Assume success if not explicitly marked as failure
                error_message: None,
                memory_usage_start: self.memory_usage_start,
                memory_usage_end,
                context: HashMap::new(),
            };

            self.monitor.record_operation(metrics);
        }
    }
}

/// Global performance monitor instance
static PERFORMANCE_MONITOR: std::sync::OnceLock<PerformanceMonitor> = std::sync::OnceLock::new();

/// Get the global performance monitor
pub fn get_performance_monitor() -> &'static PerformanceMonitor {
    PERFORMANCE_MONITOR.get_or_init(|| PerformanceMonitor::new())
}

/// Initialize performance monitoring system
pub fn initialize_performance_monitoring() {
    let _monitor = get_performance_monitor();

    // Start background metrics collection
    tokio::spawn(async {
        let mut interval = tokio::time::interval(Duration::from_secs(30));

        loop {
            interval.tick().await;

            // Collect system metrics
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;

            let system_metrics = SystemMetrics {
                timestamp,
                memory_usage: get_performance_monitor().get_memory_usage().unwrap_or(0),
                cpu_usage: None,           // Would be populated with actual CPU usage
                active_db_connections: 1,  // Placeholder
                operations_in_progress: 0, // Would be tracked
                cache_stats: CacheMetrics {
                    total_entries: 0,
                    hit_rate: 0.0,
                    avg_lookup_time_us: 0,
                    memory_usage: 0,
                    recent_evictions: 0,
                },
            };

            get_performance_monitor().record_system_metrics(system_metrics);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_performance_monitor_creation() {
        let monitor = PerformanceMonitor::new();
        let budget = monitor.get_budget();
        assert_eq!(budget.max_operation_duration_ms, 100);
        assert_eq!(budget.target_cache_hit_rate, 0.85);
    }

    #[test]
    fn test_operation_tracking() {
        let monitor = PerformanceMonitor::new();
        let tracker = monitor.start_operation("test_op".to_string(), "test".to_string());

        tracker.complete_success();

        let summary = monitor.get_performance_summary(1);
        assert_eq!(summary.total_operations, 1);
        assert_eq!(summary.success_rate, 1.0);
    }

    #[test]
    fn test_performance_budget() {
        let monitor = PerformanceMonitor::new();
        let new_budget = PerformanceBudget {
            max_operation_duration_ms: 200,
            max_memory_usage_bytes: 1024 * 1024 * 1024,
            target_cache_hit_rate: 0.9,
            max_cpu_usage_percent: 70.0,
        };

        monitor.update_budget(new_budget.clone());
        let retrieved_budget = monitor.get_budget();

        assert_eq!(retrieved_budget.max_operation_duration_ms, 200);
        assert_eq!(retrieved_budget.target_cache_hit_rate, 0.9);
    }

    #[test]
    fn test_performance_score_calculation() {
        let monitor = PerformanceMonitor::new();

        // Create test operations
        let operations = vec![
            OperationMetrics {
                operation_id: "1".to_string(),
                operation_type: "test".to_string(),
                start_timestamp: 1000,
                duration_ms: 25,
                success: true,
                error_message: None,
                memory_usage_start: Some(100),
                memory_usage_end: Some(100),
                context: HashMap::new(),
            },
            OperationMetrics {
                operation_id: "2".to_string(),
                operation_type: "test".to_string(),
                start_timestamp: 1000,
                duration_ms: 30,
                success: true,
                error_message: None,
                memory_usage_start: Some(100),
                memory_usage_end: Some(100),
                context: HashMap::new(),
            },
        ];

        let ops_refs: Vec<_> = operations.iter().collect();
        let score = monitor.calculate_performance_score(&ops_refs);

        // Should get a high score for fast, successful operations
        assert!(score >= 90);
    }

    #[test]
    fn test_memory_efficiency_calculation() {
        let monitor = PerformanceMonitor::new();

        // Create test operations with minimal memory growth
        let operations = vec![OperationMetrics {
            operation_id: "1".to_string(),
            operation_type: "test".to_string(),
            start_timestamp: 1000,
            duration_ms: 25,
            success: true,
            error_message: None,
            memory_usage_start: Some(1000),
            memory_usage_end: Some(1100), // 100 bytes growth
            context: HashMap::new(),
        }];

        let ops_refs: Vec<_> = operations.iter().collect();
        let score = monitor.calculate_memory_efficiency_score(&ops_refs);

        // Should get high score for minimal memory growth
        assert!(score >= 90);
    }

    #[test]
    fn test_alert_generation() {
        let monitor = PerformanceMonitor::new();

        // Set a low budget threshold
        monitor.update_budget(PerformanceBudget {
            max_operation_duration_ms: 10,
            max_memory_usage_bytes: 1024,
            target_cache_hit_rate: 0.9,
            max_cpu_usage_percent: 50.0,
        });

        // Create an operation that exceeds the budget
        let slow_operation = OperationMetrics {
            operation_id: "slow_op".to_string(),
            operation_type: "slow_test".to_string(),
            start_timestamp: 1000,
            duration_ms: 50, // Exceeds 10ms budget
            success: true,
            error_message: None,
            memory_usage_start: Some(100),
            memory_usage_end: Some(100),
            context: HashMap::new(),
        };

        monitor.record_operation(slow_operation);

        let alerts = monitor.get_active_alerts();
        assert!(!alerts.is_empty());
        assert!(alerts[0].message.contains("exceeded duration budget"));
    }
}
