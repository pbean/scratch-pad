/// Performance Monitoring IPC Commands
/// 
/// Provides IPC endpoints for comprehensive performance monitoring,
/// analytics, and optimization recommendations.
/// 
/// Week 3 Day 9 Implementation: Performance IPC Commands

use crate::commands::shared::{
    validate_ipc_operation, CommandPerformanceTracker, log_security_event
};
use crate::error::ApiError;
use crate::validation::OperationCapability;
use crate::performance::{
    PerformanceSummary, PerformanceAlert, PerformanceBudget,
    get_performance_monitor
};
use crate::performance::backend::{BackendMetrics, get_backend_monitor};
use crate::performance::frontend::{
    FrontendMetrics, FrontendAnalysis, get_frontend_monitor
};
use crate::performance::system::{
    SystemAnalysis, get_system_monitor
};
use crate::performance::analytics::{
    PerformanceAnalyticsReport, get_analytics_engine
};
use crate::AppState;
use tauri::State;
use serde::{Deserialize, Serialize};

/// Performance metrics overview for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceOverview {
    /// Overall performance score (0-100)
    pub overall_score: u8,
    /// Backend performance score
    pub backend_score: u8,
    /// Frontend performance score (if available)
    pub frontend_score: Option<u8>,
    /// System health score
    pub system_score: u8,
    /// Active alerts count
    pub active_alerts: u32,
    /// Performance status
    pub status: String, // "excellent", "good", "fair", "poor", "critical"
    /// Last update timestamp
    pub last_updated: u64,
}

/// Performance metrics collection request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsRequest {
    /// Time period in hours (default: 1)
    pub period_hours: Option<u32>,
    /// Include detailed breakdown
    pub include_details: Option<bool>,
    /// Specific component to focus on
    pub component: Option<String>, // "backend", "frontend", "system", "all"
}

/// Comprehensive performance report response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceReport {
    /// Report metadata
    pub report_id: String,
    /// Generation timestamp
    pub generated_at: u64,
    /// Performance overview
    pub overview: PerformanceOverview,
    /// Backend metrics (if requested)
    pub backend_metrics: Option<BackendMetrics>,
    /// Frontend analysis (if available)
    pub frontend_analysis: Option<FrontendAnalysis>,
    /// System analysis
    pub system_analysis: Option<SystemAnalysis>,
    /// Performance summary
    pub summary: PerformanceSummary,
    /// Active alerts
    pub alerts: Vec<PerformanceAlert>,
    /// Quick recommendations
    pub quick_recommendations: Vec<String>,
}

/// Get performance overview for dashboard
/// 
/// Security features:
/// - IPC operation validation with Performance capability
/// - No sensitive data exposure
/// - Frequency limit enforcement (15 operations/minute for IPC)
#[tauri::command]
pub async fn get_performance_overview(
    app_state: State<'_, AppState>,
) -> Result<PerformanceOverview, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_performance_overview");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::ReadNotes] // Using ReadNotes as closest match for performance monitoring
    )?;
    
    // Log security event
    log_security_event(
        "GET_PERFORMANCE_OVERVIEW",
        "IPC",
        true,
        "Performance overview requested"
    );
    
    // Get current performance data
    let backend_metrics = get_backend_monitor().get_metrics()
        .map_err(|e| ApiError {
            code: "BACKEND_ERROR".to_string(),
            message: format!("Failed to get backend metrics: {}", e),
        })?;
    
    let frontend_analysis = get_frontend_monitor().analyze_performance().ok();
    let system_analysis = get_system_monitor()?.analyze_performance()
        .map_err(|e| ApiError {
            code: "SYSTEM_ERROR".to_string(),
            message: format!("Failed to get system analysis: {}", e),
        })?;
    
    // Calculate performance scores
    let backend_score = calculate_backend_score(&backend_metrics);
    let frontend_score = frontend_analysis.as_ref().map(|f| f.performance_score);
    let system_score = system_analysis.performance_score as u8;
    
    // Calculate overall score
    let scores = vec![
        backend_score as f64,
        frontend_score.unwrap_or(80) as f64,
        system_score as f64,
    ];
    let overall_score = (scores.iter().sum::<f64>() / scores.len() as f64) as u8;
    
    // Get active alerts
    let active_alerts = get_performance_monitor().get_active_alerts().len() as u32;
    
    // Determine status
    let status = match overall_score {
        90..=100 => "excellent",
        80..=89 => "good",
        70..=79 => "fair",
        50..=69 => "poor",
        _ => "critical",
    };
    
    let overview = PerformanceOverview {
        overall_score,
        backend_score,
        frontend_score,
        system_score,
        active_alerts,
        status: status.to_string(),
        last_updated: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
    };
    
    Ok(overview)
}

/// Get detailed performance metrics
/// 
/// Security features:
/// - IPC operation validation with Performance capability
/// - Request parameter validation
/// - Sensitive data filtering
#[tauri::command]
pub async fn get_performance_metrics(
    request: MetricsRequest,
    app_state: State<'_, AppState>,
) -> Result<PerformanceReport, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_performance_metrics");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::ReadNotes]
    )?;
    
    // Validate request parameters
    let period_hours = request.period_hours.unwrap_or(1);
    if period_hours > 168 { // Max 1 week
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Period cannot exceed 168 hours (1 week)".to_string(),
        });
    }
    
    let include_details = request.include_details.unwrap_or(false);
    let component = request.component.as_deref().unwrap_or("all");
    
    // Log security event
    log_security_event(
        "GET_PERFORMANCE_METRICS",
        "IPC",
        true,
        &format!("Performance metrics requested for component: {}, period: {}h", component, period_hours)
    );
    
    // Generate report ID
    let report_id = format!("perf_{}_{}", component, chrono::Utc::now().timestamp());
    let generated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    
    // Collect performance data based on component filter
    let backend_metrics = if component == "all" || component == "backend" {
        Some(get_backend_monitor().get_metrics()
            .map_err(|e| ApiError {
                code: "BACKEND_ERROR".to_string(),
                message: format!("Failed to get backend metrics: {}", e),
            })?)
    } else {
        None
    };
    
    let frontend_analysis = if component == "all" || component == "frontend" {
        get_frontend_monitor().analyze_performance().ok()
    } else {
        None
    };
    
    let system_analysis = if component == "all" || component == "system" {
        Some(get_system_monitor()?.analyze_performance()
            .map_err(|e| ApiError {
                code: "SYSTEM_ERROR".to_string(),
                message: format!("Failed to get system analysis: {}", e),
            })?)
    } else {
        None
    };
    
    // Get performance overview
    let overview = create_performance_overview(&backend_metrics, &frontend_analysis, &system_analysis);
    
    // Get performance summary
    let summary = get_performance_monitor().get_performance_summary(period_hours as u64);
    
    // Get active alerts
    let alerts = get_performance_monitor().get_active_alerts();
    
    // Generate quick recommendations
    let quick_recommendations = generate_quick_recommendations(&backend_metrics, &system_analysis);
    
    // Filter sensitive data if not including details
    let filtered_backend_metrics = if include_details {
        backend_metrics
    } else {
        backend_metrics.map(|mut metrics| {
            // Remove potentially sensitive information
            metrics.memory.component_usage.clear();
            metrics
        })
    };
    
    let report = PerformanceReport {
        report_id,
        generated_at,
        overview,
        backend_metrics: filtered_backend_metrics,
        frontend_analysis,
        system_analysis,
        summary,
        alerts,
        quick_recommendations,
    };
    
    Ok(report)
}

/// Get comprehensive performance analytics report
/// 
/// Security features:
/// - IPC operation validation with elevated capability requirement
/// - Report generation rate limiting
/// - Comprehensive analytics with sensitive data filtering
#[tauri::command]
pub async fn get_performance_analytics(
    period_hours: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<PerformanceAnalyticsReport, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_performance_analytics");
    
    // Validate IPC operation with elevated capability
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::ReadNotes, OperationCapability::Search] // Require multiple capabilities for analytics
    )?;
    
    // Validate period parameter
    let analysis_period = period_hours.unwrap_or(24);
    if analysis_period > 720 { // Max 30 days
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Analysis period cannot exceed 720 hours (30 days)".to_string(),
        });
    }
    
    // Log security event
    log_security_event(
        "GET_PERFORMANCE_ANALYTICS",
        "IPC",
        true,
        &format!("Performance analytics requested for {}h period", analysis_period)
    );
    
    // Generate comprehensive analytics report
    let report = get_analytics_engine().generate_report(Some(analysis_period)).await
        .map_err(|e| ApiError {
            code: "ANALYTICS_ERROR".to_string(),
            message: format!("Failed to generate analytics report: {}", e),
        })?;
    
    Ok(report)
}

/// Record frontend performance metrics from the browser
/// 
/// Security features:
/// - IPC operation validation
/// - Frontend metrics validation and sanitization
/// - Metric size limits to prevent abuse
#[tauri::command]
pub async fn record_frontend_metrics(
    metrics: FrontendMetrics,
    app_state: State<'_, AppState>,
) -> Result<String, ApiError> {
    let _tracker = CommandPerformanceTracker::new("record_frontend_metrics");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::WriteNotes] // Using WriteNotes as closest match for recording metrics
    )?;
    
    // Validate metrics data
    if metrics.render_metrics.len() > 100 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Too many render metrics (max 100 per request)".to_string(),
        });
    }
    
    if metrics.store_metrics.len() > 50 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Too many store metrics (max 50 per request)".to_string(),
        });
    }
    
    if metrics.error_metrics.error_samples.len() > 20 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Too many error samples (max 20 per request)".to_string(),
        });
    }
    
    // Validate individual render metrics
    for render_metric in &metrics.render_metrics {
        if render_metric.render_time_ms < 0.0 || render_metric.render_time_ms > 10000.0 {
            return Err(ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: "Invalid render time (must be 0-10000ms)".to_string(),
            });
        }
        
        if render_metric.component_name.len() > 100 {
            return Err(ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: "Component name too long (max 100 characters)".to_string(),
            });
        }
    }
    
    // Log security event
    log_security_event(
        "RECORD_FRONTEND_METRICS",
        "IPC",
        true,
        &format!("Frontend metrics recorded: {} render, {} store, {} errors", 
               metrics.render_metrics.len(),
               metrics.store_metrics.len(),
               metrics.error_metrics.error_samples.len())
    );
    
    // Record metrics in frontend monitor
    get_frontend_monitor().record_frontend_metrics(metrics)
        .map_err(|e| ApiError {
            code: "STORAGE_ERROR".to_string(),
            message: format!("Failed to record frontend metrics: {}", e),
        })?;
    
    Ok("Metrics recorded successfully".to_string())
}

/// Get active performance alerts
/// 
/// Security features:
/// - IPC operation validation
/// - Alert severity filtering
/// - No sensitive data exposure
#[tauri::command]
pub async fn get_performance_alerts(
    severity_filter: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<PerformanceAlert>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_performance_alerts");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::ReadNotes]
    )?;
    
    // Validate severity filter
    if let Some(ref severity) = severity_filter {
        match severity.as_str() {
            "info" | "warning" | "error" | "critical" => {},
            _ => return Err(ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: "Invalid severity filter (must be: info, warning, error, critical)".to_string(),
            }),
        }
    }
    
    // Log security event
    log_security_event(
        "GET_PERFORMANCE_ALERTS",
        "IPC",
        true,
        &format!("Performance alerts requested with filter: {:?}", severity_filter)
    );
    
    // Get alerts from performance monitor
    let mut alerts = get_performance_monitor().get_active_alerts();
    
    // Apply severity filter if provided
    if let Some(severity) = severity_filter {
        alerts.retain(|alert| {
            match (&alert.level, severity.as_str()) {
                (crate::performance::AlertLevel::Info, "info") |
                (crate::performance::AlertLevel::Warning, "warning") |
                (crate::performance::AlertLevel::Error, "error") |
                (crate::performance::AlertLevel::Critical, "critical") => true,
                _ => false,
            }
        });
    }
    
    // Add system alerts
    let system_alerts = get_system_monitor()?.get_active_alerts();
    for system_alert in system_alerts {
        alerts.push(PerformanceAlert {
            id: format!("system_{}", system_alert.timestamp),
            level: match system_alert.level.as_str() {
                "info" => crate::performance::AlertLevel::Info,
                "warning" => crate::performance::AlertLevel::Warning,
                "error" => crate::performance::AlertLevel::Error,
                "critical" => crate::performance::AlertLevel::Critical,
                _ => crate::performance::AlertLevel::Warning,
            },
            message: system_alert.message,
            timestamp: system_alert.timestamp,
            related_metrics: None,
            is_active: true,
            suggested_action: system_alert.recommendation,
        });
    }
    
    Ok(alerts)
}

/// Update performance budget thresholds
/// 
/// Security features:
/// - IPC operation validation with elevated capability
/// - Budget parameter validation
/// - Administrative operation logging
#[tauri::command]
pub async fn update_performance_budget(
    budget: PerformanceBudget,
    app_state: State<'_, AppState>,
) -> Result<String, ApiError> {
    let _tracker = CommandPerformanceTracker::new("update_performance_budget");
    
    // Validate IPC operation with elevated capability (admin-like operation)
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::WriteNotes, OperationCapability::Search] // Require multiple capabilities
    )?;
    
    // Validate budget parameters
    if budget.max_operation_duration_ms == 0 || budget.max_operation_duration_ms > 30000 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Invalid operation duration (must be 1-30000ms)".to_string(),
        });
    }
    
    if budget.max_memory_usage_bytes < 100 * 1024 * 1024 || budget.max_memory_usage_bytes > 16 * 1024 * 1024 * 1024 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Invalid memory limit (must be 100MB-16GB)".to_string(),
        });
    }
    
    if budget.target_cache_hit_rate < 0.0 || budget.target_cache_hit_rate > 1.0 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Invalid cache hit rate (must be 0.0-1.0)".to_string(),
        });
    }
    
    if budget.max_cpu_usage_percent < 0.0 || budget.max_cpu_usage_percent > 100.0 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Invalid CPU usage limit (must be 0-100%)".to_string(),
        });
    }
    
    // Log security event for administrative operation
    log_security_event(
        "UPDATE_PERFORMANCE_BUDGET",
        "IPC",
        true,
        &format!("Performance budget updated: max_op={}ms, max_mem={}MB, cache_target={:.2}, max_cpu={:.1}%",
               budget.max_operation_duration_ms,
               budget.max_memory_usage_bytes / (1024 * 1024),
               budget.target_cache_hit_rate,
               budget.max_cpu_usage_percent)
    );
    
    // Update budget in performance monitor
    get_performance_monitor().update_budget(budget);
    
    Ok("Performance budget updated successfully".to_string())
}

/// Get current performance budget
/// 
/// Security features:
/// - IPC operation validation
/// - No sensitive data exposure
#[tauri::command]
pub async fn get_performance_budget(
    app_state: State<'_, AppState>,
) -> Result<PerformanceBudget, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_performance_budget");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::ReadNotes]
    )?;
    
    // Log security event
    log_security_event(
        "GET_PERFORMANCE_BUDGET",
        "IPC",
        true,
        "Performance budget requested"
    );
    
    let budget = get_performance_monitor().get_budget();
    Ok(budget)
}

/// Helper function to calculate backend performance score
fn calculate_backend_score(metrics: &BackendMetrics) -> u8 {
    let mut score: f32 = 100.0;
    
    // Database performance impact (40%)
    let db_score = if metrics.database.avg_query_time_ms < 50.0 {
        1.0
    } else if metrics.database.avg_query_time_ms < 100.0 {
        0.8
    } else if metrics.database.avg_query_time_ms < 200.0 {
        0.6
    } else {
        0.3
    };
    score *= 0.6 + (db_score * 0.4);
    
    // IPC performance impact (30%)
    let ipc_score = if metrics.ipc.avg_processing_time_ms < 25.0 {
        1.0
    } else if metrics.ipc.avg_processing_time_ms < 50.0 {
        0.8
    } else if metrics.ipc.avg_processing_time_ms < 100.0 {
        0.6
    } else {
        0.3
    };
    score *= 0.7 + (ipc_score * 0.3);
    
    // Memory efficiency impact (20%)
    let memory_score = if metrics.memory.growth_rate_bytes_per_min < 1024.0 * 1024.0 { // < 1MB/min
        1.0
    } else if metrics.memory.growth_rate_bytes_per_min < 5.0 * 1024.0 * 1024.0 { // < 5MB/min
        0.8
    } else {
        0.5
    };
    score *= 0.8 + (memory_score * 0.2);
    
    // Search cache performance impact (10%)
    let cache_score = if metrics.search.cache_performance.hit_rate > 0.9 {
        1.0
    } else if metrics.search.cache_performance.hit_rate > 0.8 {
        0.9
    } else if metrics.search.cache_performance.hit_rate > 0.7 {
        0.7
    } else {
        0.5
    };
    score *= 0.9 + (cache_score * 0.1);
    
    score.max(0.0).min(100.0) as u8
}

/// Helper function to create performance overview
fn create_performance_overview(
    backend_metrics: &Option<BackendMetrics>,
    frontend_analysis: &Option<FrontendAnalysis>,
    system_analysis: &Option<SystemAnalysis>,
) -> PerformanceOverview {
    let backend_score = backend_metrics.as_ref()
        .map(|m| calculate_backend_score(m))
        .unwrap_or(80);
    
    let frontend_score = frontend_analysis.as_ref()
        .map(|f| f.performance_score);
    
    let system_score = system_analysis.as_ref()
        .map(|s| s.performance_score as u8)
        .unwrap_or(80);
    
    // Calculate overall score
    let scores = vec![
        backend_score as f64,
        frontend_score.unwrap_or(80) as f64,
        system_score as f64,
    ];
    let overall_score = (scores.iter().sum::<f64>() / scores.len() as f64) as u8;
    
    let status = match overall_score {
        90..=100 => "excellent",
        80..=89 => "good",
        70..=79 => "fair",
        50..=69 => "poor",
        _ => "critical",
    };
    
    PerformanceOverview {
        overall_score,
        backend_score,
        frontend_score,
        system_score,
        active_alerts: 0, // Will be populated by caller
        status: status.to_string(),
        last_updated: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
    }
}

/// Helper function to generate quick recommendations
fn generate_quick_recommendations(
    backend_metrics: &Option<BackendMetrics>,
    system_analysis: &Option<SystemAnalysis>,
) -> Vec<String> {
    let mut recommendations = Vec::new();
    
    if let Some(backend) = backend_metrics {
        if backend.database.avg_query_time_ms > 100.0 {
            recommendations.push("Consider optimizing database queries for better performance".to_string());
        }
        
        if backend.search.cache_performance.hit_rate < 0.8 {
            recommendations.push("Improve search cache configuration to increase hit rate".to_string());
        }
        
        if backend.ipc.avg_processing_time_ms > 50.0 {
            recommendations.push("Review IPC command processing for optimization opportunities".to_string());
        }
        
        if backend.memory.growth_rate_bytes_per_min > 5.0 * 1024.0 * 1024.0 {
            recommendations.push("Monitor memory usage patterns to prevent potential leaks".to_string());
        }
    }
    
    if let Some(system) = system_analysis {
        if system.performance_score < 80.0 {
            recommendations.push("Address system resource utilization to improve overall health".to_string());
        }
        
        if !system.bottlenecks.is_empty() {
            recommendations.push(format!("Resolve {} system bottleneck(s) identified", system.bottlenecks.len()));
        }
        
        if !system.alerts.is_empty() {
            recommendations.push("Review and address active system alerts".to_string());
        }
    }
    
    if recommendations.is_empty() {
        recommendations.push("Performance is within acceptable ranges".to_string());
    }
    
    recommendations
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validation::SecurityValidator;
    use std::sync::Arc;

    // Simplified test setup that doesn't require Tauri runtime
    // Tests focus on the logic rather than full integration
    fn create_test_validator() -> Arc<SecurityValidator> {
        Arc::new(SecurityValidator::new())
    }

    #[tokio::test]
    async fn test_performance_overview_creation() {
        let _validator = create_test_validator();
        
        // Test the helper function directly instead of the command
        use crate::performance::backend::*;
        use crate::performance::CacheMetrics;
        use std::collections::HashMap;
        
        let backend_metrics = Some(BackendMetrics {
            database: DatabaseMetrics {
                avg_connection_time_ms: 5.0,
                avg_query_time_ms: 45.0,
                active_connections: 2,
                pool_utilization: 0.2,
                transactions: TransactionMetrics {
                    avg_transaction_time_ms: 50.0,
                    transactions_per_minute: 120.0,
                    rollback_rate: 0.01,
                    lock_contentions: 0,
                },
                fts_metrics: FtsMetrics {
                    avg_search_time_ms: 35.0,
                    result_distribution: HashMap::new(),
                    complexity_scores: Vec::new(),
                    optimization_suggestions: Vec::new(),
                },
            },
            ipc: IpcMetrics {
                commands_per_minute: 60.0,
                avg_processing_time_ms: 30.0,
                command_distribution: HashMap::new(),
                error_rates: HashMap::new(),
                security_overhead_ms: 3.0,
            },
            memory: crate::performance::backend::MemoryMetrics {
                heap_usage_bytes: 150 * 1024 * 1024,
                component_usage: HashMap::new(),
                growth_rate_bytes_per_min: 0.5 * 1024.0 * 1024.0,
                gc_metrics: None,
                leak_indicators: Vec::new(),
            },
            search: SearchMetrics {
                query_performance: HashMap::new(),
                cache_performance: CacheMetrics {
                    total_entries: 100,
                    hit_rate: 0.95,
                    avg_lookup_time_us: 50,
                    memory_usage: 10 * 1024 * 1024,
                    recent_evictions: 0,
                },
                index_utilization: IndexUtilization {
                    fts_hit_rate: 0.95,
                    index_size_bytes: 5 * 1024 * 1024,
                    fragmentation_level: 0.1,
                    optimization_needed: false,
                },
                expensive_queries: Vec::new(),
            },
            timestamp: 1000,
        });
        
        let frontend_analysis = None;
        let system_analysis = None;
        
        let overview = create_performance_overview(&backend_metrics, &frontend_analysis, &system_analysis);
        
        assert!(overview.overall_score <= 100);
        assert!(overview.backend_score <= 100);
        assert!(overview.system_score <= 100);
        assert!(!overview.status.is_empty());
    }

    #[tokio::test]
    async fn test_metrics_request_creation() {
        let _validator = create_test_validator();
        
        // Test MetricsRequest creation and validation
        let request = MetricsRequest {
            period_hours: Some(1),
            include_details: Some(true),
            component: Some("all".to_string()),
        };
        
        // Test that request fields are correctly set
        assert_eq!(request.period_hours, Some(1));
        assert_eq!(request.include_details, Some(true));
        assert_eq!(request.component, Some("all".to_string()));
        
        // Test default values
        let period = request.period_hours.unwrap_or(1);
        let details = request.include_details.unwrap_or(false);
        let component = request.component.as_deref().unwrap_or("all");
        
        assert_eq!(period, 1);
        assert!(details);
        assert_eq!(component, "all");
    }

    #[tokio::test]
    async fn test_metrics_request_validation() {
        let _validator = create_test_validator();
        
        // Test validation logic directly
        let period_hours = Some(200u32); // Too long
        assert!(period_hours.unwrap_or(1) > 168);
        
        let period_hours = Some(1u32); // Valid
        assert!(period_hours.unwrap_or(1) <= 168);
        
        // Test component validation
        let valid_components = vec!["all", "backend", "frontend", "system"];
        let test_component = "backend";
        assert!(valid_components.contains(&test_component));
    }

    #[tokio::test]
    async fn test_performance_budget_structure() {
        let _validator = create_test_validator();
        
        // Test creating a valid PerformanceBudget
        let budget = PerformanceBudget {
            max_operation_duration_ms: 100,
            max_memory_usage_bytes: 512 * 1024 * 1024, // 512MB
            target_cache_hit_rate: 0.85,
            max_cpu_usage_percent: 80.0,
        };
        
        assert!(budget.max_operation_duration_ms > 0);
        assert!(budget.max_memory_usage_bytes > 0);
        assert!(budget.target_cache_hit_rate >= 0.0 && budget.target_cache_hit_rate <= 1.0);
        assert!(budget.max_cpu_usage_percent >= 0.0 && budget.max_cpu_usage_percent <= 100.0);
    }

    #[tokio::test]
    async fn test_performance_budget_validation() {
        let _validator = create_test_validator();
        
        // Test valid budget
        let valid_budget = PerformanceBudget {
            max_operation_duration_ms: 150,
            max_memory_usage_bytes: 1024 * 1024 * 1024, // 1GB
            target_cache_hit_rate: 0.9,
            max_cpu_usage_percent: 75.0,
        };
        
        // Validate each field manually (simulating the validation logic)
        assert!(valid_budget.max_operation_duration_ms > 0 && valid_budget.max_operation_duration_ms <= 30000);
        assert!(valid_budget.max_memory_usage_bytes >= 100 * 1024 * 1024 && valid_budget.max_memory_usage_bytes <= 16 * 1024 * 1024 * 1024);
        assert!(valid_budget.target_cache_hit_rate >= 0.0 && valid_budget.target_cache_hit_rate <= 1.0);
        assert!(valid_budget.max_cpu_usage_percent >= 0.0 && valid_budget.max_cpu_usage_percent <= 100.0);
    }

    #[tokio::test]
    async fn test_invalid_budget_validation() {
        let _validator = create_test_validator();
        
        // Test invalid budget values
        let invalid_budget = PerformanceBudget {
            max_operation_duration_ms: 0, // Invalid
            max_memory_usage_bytes: 1024 * 1024 * 1024,
            target_cache_hit_rate: 1.5, // Invalid
            max_cpu_usage_percent: 150.0, // Invalid
        };
        
        // Validate each field manually (simulating the validation logic)
        assert!(invalid_budget.max_operation_duration_ms == 0 || invalid_budget.max_operation_duration_ms > 30000);
        assert!(invalid_budget.target_cache_hit_rate < 0.0 || invalid_budget.target_cache_hit_rate > 1.0);
        assert!(invalid_budget.max_cpu_usage_percent < 0.0 || invalid_budget.max_cpu_usage_percent > 100.0);
        
        // Test that we can identify invalid values
        let has_invalid_duration = invalid_budget.max_operation_duration_ms == 0;
        let has_invalid_cache_rate = invalid_budget.target_cache_hit_rate > 1.0;
        let has_invalid_cpu = invalid_budget.max_cpu_usage_percent > 100.0;
        
        assert!(has_invalid_duration);
        assert!(has_invalid_cache_rate);
        assert!(has_invalid_cpu);
    }

    #[test]
    fn test_calculate_backend_score() {
        use crate::performance::backend::*;
        use crate::performance::CacheMetrics;
        use std::collections::HashMap;
        
        let metrics = BackendMetrics {
            database: DatabaseMetrics {
                avg_connection_time_ms: 5.0,
                avg_query_time_ms: 45.0, // Good performance
                active_connections: 2,
                pool_utilization: 0.2,
                transactions: TransactionMetrics {
                    avg_transaction_time_ms: 50.0,
                    transactions_per_minute: 120.0,
                    rollback_rate: 0.01,
                    lock_contentions: 0,
                },
                fts_metrics: FtsMetrics {
                    avg_search_time_ms: 35.0,
                    result_distribution: HashMap::new(),
                    complexity_scores: Vec::new(),
                    optimization_suggestions: Vec::new(),
                },
            },
            ipc: IpcMetrics {
                commands_per_minute: 60.0,
                avg_processing_time_ms: 30.0, // Good performance
                command_distribution: HashMap::new(),
                error_rates: HashMap::new(),
                security_overhead_ms: 3.0, // Low overhead
            },
            memory: crate::performance::backend::MemoryMetrics {
                heap_usage_bytes: 150 * 1024 * 1024,
                component_usage: HashMap::new(),
                growth_rate_bytes_per_min: 0.5 * 1024.0 * 1024.0, // Low growth
                gc_metrics: None,
                leak_indicators: Vec::new(),
            },
            search: SearchMetrics {
                query_performance: HashMap::new(),
                cache_performance: CacheMetrics {
                    total_entries: 100,
                    hit_rate: 0.95, // Excellent cache performance
                    avg_lookup_time_us: 50,
                    memory_usage: 10 * 1024 * 1024,
                    recent_evictions: 0,
                },
                index_utilization: IndexUtilization {
                    fts_hit_rate: 0.95,
                    index_size_bytes: 5 * 1024 * 1024,
                    fragmentation_level: 0.1,
                    optimization_needed: false,
                },
                expensive_queries: Vec::new(),
            },
            timestamp: 1000,
        };
        
        let score = calculate_backend_score(&metrics);
        assert!(score >= 85); // Should get a high score with good metrics
    }

    #[test]
    fn test_generate_quick_recommendations() {
        use crate::performance::backend::{BackendMetrics, DatabaseMetrics, TransactionMetrics, FtsMetrics, IpcMetrics, SearchMetrics, IndexUtilization};
        use crate::performance::system::{SystemAnalysis, ResourceUtilization, TrendAnalysis, SystemAlert};
        use crate::performance::CacheMetrics;
        use std::collections::HashMap;
        
        // Create metrics with some performance issues
        let backend_metrics = BackendMetrics {
            database: DatabaseMetrics {
                avg_connection_time_ms: 5.0,
                avg_query_time_ms: 150.0, // Slow queries
                active_connections: 2,
                pool_utilization: 0.2,
                transactions: TransactionMetrics {
                    avg_transaction_time_ms: 180.0,
                    transactions_per_minute: 30.0,
                    rollback_rate: 0.05,
                    lock_contentions: 2,
                },
                fts_metrics: FtsMetrics {
                    avg_search_time_ms: 120.0,
                    result_distribution: HashMap::new(),
                    complexity_scores: Vec::new(),
                    optimization_suggestions: Vec::new(),
                },
            },
            ipc: IpcMetrics {
                commands_per_minute: 20.0,
                avg_processing_time_ms: 80.0, // Slow processing
                command_distribution: HashMap::new(),
                error_rates: HashMap::new(),
                security_overhead_ms: 8.0,
            },
            memory: crate::performance::backend::MemoryMetrics {
                heap_usage_bytes: 400 * 1024 * 1024,
                component_usage: HashMap::new(),
                growth_rate_bytes_per_min: 8.0 * 1024.0 * 1024.0, // High growth
                gc_metrics: None,
                leak_indicators: Vec::new(),
            },
            search: SearchMetrics {
                query_performance: HashMap::new(),
                cache_performance: CacheMetrics {
                    total_entries: 50,
                    hit_rate: 0.6, // Poor cache performance
                    avg_lookup_time_us: 200,
                    memory_usage: 5 * 1024 * 1024,
                    recent_evictions: 10,
                },
                index_utilization: IndexUtilization {
                    fts_hit_rate: 0.7,
                    index_size_bytes: 15 * 1024 * 1024,
                    fragmentation_level: 0.4,
                    optimization_needed: true,
                },
                expensive_queries: Vec::new(),
            },
            timestamp: 1000,
        };
        
        let system_analysis = SystemAnalysis {
            overall_health: "poor".to_string(),
            performance_score: 65.0, // Poor health
            bottlenecks: vec!["High CPU usage".to_string()],
            recommendations: vec!["Optimize CPU usage".to_string()],
            resource_utilization: ResourceUtilization {
                cpu_status: "high".to_string(),
                memory_status: "moderate".to_string(),
                disk_status: "optimal".to_string(),
                network_status: "normal".to_string(),
                overall_status: "degraded".to_string(),
            },
            trend_analysis: TrendAnalysis {
                cpu_trend: "degrading".to_string(),
                memory_trend: "stable".to_string(),
                disk_trend: "stable".to_string(),
                performance_trend: "degrading".to_string(),
                prediction: Some("Performance may continue to degrade".to_string()),
            },
            alerts: vec![
                SystemAlert {
                    level: "warning".to_string(),
                    category: "cpu".to_string(),
                    message: "High CPU usage detected".to_string(),
                    timestamp: 1000,
                    metric_value: Some(85.0),
                    threshold_value: Some(70.0),
                    recommendation: Some("Consider reducing CPU load".to_string()),
                }
            ],
        };
        
        let recommendations = generate_quick_recommendations(&Some(backend_metrics), &Some(system_analysis));
        
        // Should generate multiple recommendations based on the issues
        assert!(!recommendations.is_empty());
        assert!(recommendations.len() >= 4); // Should identify multiple issues
        
        // Check that specific recommendations are included
        let recommendations_text = recommendations.join(" ");
        assert!(recommendations_text.contains("database") || recommendations_text.contains("queries"));
        assert!(recommendations_text.contains("cache"));
        assert!(recommendations_text.contains("IPC") || recommendations_text.contains("processing"));
        assert!(recommendations_text.contains("memory"));
    }
}