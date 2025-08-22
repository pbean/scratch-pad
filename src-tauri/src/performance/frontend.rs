/// Frontend Performance Monitoring Integration
///
/// Provides backend endpoints for frontend performance monitoring,
/// enabling comprehensive full-stack performance analysis.
///
/// Week 3 Day 9 Implementation: Frontend Performance Integration
use super::get_performance_monitor;
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

/// Frontend performance metrics from the browser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendMetrics {
    /// Component render performance metrics
    pub render_metrics: Vec<RenderMetric>,
    /// Memory usage from browser APIs
    pub browser_memory: Option<BrowserMemoryInfo>,
    /// Navigation timing metrics
    pub navigation_timing: Option<NavigationTimingInfo>,
    /// Store operation performance
    pub store_metrics: Vec<StoreOperationMetric>,
    /// Search UI performance
    pub search_ui_metrics: SearchUiMetrics,
    /// Error metrics
    pub error_metrics: ErrorMetrics,
    /// Timestamp when metrics were collected
    pub timestamp: u64,
}

/// React component render performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderMetric {
    /// Component name
    pub component_name: String,
    /// Render time in milliseconds
    pub render_time_ms: f64,
    /// Number of re-renders
    pub render_count: u32,
    /// Props change frequency
    pub props_changes: u32,
    /// State change frequency
    pub state_changes: u32,
    /// Whether component is memoized
    pub is_memoized: bool,
    /// Timestamp of the render
    pub timestamp: u64,
}

/// Browser memory information from performance.memory API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserMemoryInfo {
    /// Used JS heap size in bytes
    pub used_js_heap_size: u64,
    /// Total JS heap size in bytes
    pub total_js_heap_size: u64,
    /// JS heap size limit in bytes
    pub js_heap_size_limit: u64,
    /// Usage percentage
    pub usage_percent: f64,
    /// Timestamp when measured
    pub timestamp: u64,
}

/// Navigation timing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationTimingInfo {
    /// Time to DOM content loaded
    pub dom_content_loaded_ms: f64,
    /// Total load completion time
    pub load_complete_ms: f64,
    /// First paint time
    pub first_paint_ms: Option<f64>,
    /// First contentful paint time
    pub first_contentful_paint_ms: Option<f64>,
    /// Largest contentful paint time
    pub largest_contentful_paint_ms: Option<f64>,
    /// Cumulative layout shift score
    pub cumulative_layout_shift: Option<f64>,
}

/// Store operation performance metric
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreOperationMetric {
    /// Store action name
    pub action_name: String,
    /// Execution time in milliseconds
    pub execution_time_ms: f64,
    /// Number of subscriptions notified
    pub subscriptions_notified: u32,
    /// Data size processed (bytes)
    pub data_size_bytes: Option<u64>,
    /// Whether operation caused re-renders
    pub caused_rerenders: bool,
    /// Timestamp of operation
    pub timestamp: u64,
}

/// Search UI performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchUiMetrics {
    /// Search input responsiveness
    pub input_lag_ms: f64,
    /// Results rendering time
    pub results_render_ms: f64,
    /// Virtual scrolling performance
    pub virtual_scroll_metrics: VirtualScrollMetrics,
    /// Highlighting performance
    pub highlighting_ms: f64,
    /// Autocomplete response time
    pub autocomplete_ms: f64,
    /// Filter application time
    pub filter_application_ms: f64,
}

/// Virtual scrolling performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualScrollMetrics {
    /// Items rendered per frame
    pub items_per_frame: u32,
    /// Scroll responsiveness (FPS)
    pub scroll_fps: f64,
    /// Memory usage for visible items
    pub visible_items_memory_kb: u32,
    /// Time to render new items on scroll
    pub item_render_time_ms: f64,
}

/// Error metrics from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorMetrics {
    /// JavaScript errors count
    pub js_errors: u32,
    /// React error boundary activations
    pub react_errors: u32,
    /// Network/IPC errors
    pub network_errors: u32,
    /// Performance budget violations
    pub budget_violations: u32,
    /// Error details
    pub error_samples: Vec<ErrorSample>,
}

/// Sample error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorSample {
    /// Error type
    pub error_type: String,
    /// Error message
    pub message: String,
    /// Component stack (for React errors)
    pub component_stack: Option<String>,
    /// Performance impact
    pub performance_impact: String,
    /// Timestamp when error occurred
    pub timestamp: u64,
}

/// Frontend performance analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendAnalysis {
    /// Overall performance score (0-100)
    pub performance_score: u8,
    /// Component performance analysis
    pub component_analysis: Vec<ComponentAnalysis>,
    /// Memory analysis
    pub memory_analysis: MemoryAnalysis,
    /// Optimization recommendations
    pub recommendations: Vec<FrontendOptimization>,
    /// Performance trends
    pub trends: PerformanceTrends,
    /// Analysis timestamp
    pub timestamp: u64,
}

/// Component-specific performance analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentAnalysis {
    /// Component name
    pub component_name: String,
    /// Performance rating (0-100)
    pub performance_rating: u8,
    /// Average render time
    pub avg_render_time_ms: f64,
    /// Render frequency (renders per minute)
    pub render_frequency: f64,
    /// Optimization opportunities
    pub optimizations: Vec<String>,
    /// Is component optimized?
    pub is_optimized: bool,
}

/// Memory usage analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryAnalysis {
    /// Current memory status
    pub status: String, // "good", "warning", "critical"
    /// Memory growth rate (MB per minute)
    pub growth_rate_mb_per_min: f64,
    /// Potential memory leaks
    pub potential_leaks: Vec<String>,
    /// Memory optimization suggestions
    pub optimizations: Vec<String>,
}

/// Frontend optimization recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendOptimization {
    /// Optimization type
    pub optimization_type: String,
    /// Target component or area
    pub target: String,
    /// Priority level
    pub priority: String, // "low", "medium", "high", "critical"
    /// Description
    pub description: String,
    /// Expected improvement
    pub expected_improvement: String,
    /// Implementation effort
    pub effort: String, // "low", "medium", "high"
    /// Code example or guidance
    pub implementation_hint: Option<String>,
}

/// Performance trends analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTrends {
    /// Render performance trend
    pub render_trend: String, // "improving", "stable", "degrading"
    /// Memory trend
    pub memory_trend: String,
    /// Error trend
    pub error_trend: String,
    /// Search performance trend
    pub search_trend: String,
    /// Overall trend assessment
    pub overall_trend: String,
}

/// Frontend performance monitor for backend integration
pub struct FrontendPerformanceMonitor {
    /// Collected frontend metrics
    metrics_history: Arc<Mutex<Vec<FrontendMetrics>>>,
    /// Performance analysis cache
    analysis_cache: Arc<Mutex<Option<FrontendAnalysis>>>,
    /// Maximum history size
    max_history_size: usize,
}

impl FrontendPerformanceMonitor {
    /// Create new frontend performance monitor
    pub fn new() -> Self {
        Self {
            metrics_history: Arc::new(Mutex::new(Vec::new())),
            analysis_cache: Arc::new(Mutex::new(None)),
            max_history_size: 500, // Keep last 500 metric snapshots
        }
    }

    /// Record frontend metrics from the browser
    pub fn record_frontend_metrics(&self, metrics: FrontendMetrics) -> Result<(), AppError> {
        // Store metrics
        if let Ok(mut history) = self.metrics_history.lock() {
            history.push(metrics.clone());

            // Maintain circular buffer
            while history.len() > self.max_history_size {
                history.remove(0);
            }
        }

        // Record render metrics in global monitor
        for render_metric in &metrics.render_metrics {
            let tracker = get_performance_monitor().start_operation(
                format!(
                    "render_{}_{}",
                    render_metric.component_name,
                    uuid::Uuid::new_v4()
                ),
                format!("frontend_render_{}", render_metric.component_name),
            );
            tracker.complete_success();
        }

        // Record store operations in global monitor
        for store_metric in &metrics.store_metrics {
            let tracker = get_performance_monitor().start_operation(
                format!(
                    "store_{}_{}",
                    store_metric.action_name,
                    uuid::Uuid::new_v4()
                ),
                format!("frontend_store_{}", store_metric.action_name),
            );
            tracker.complete_success();
        }

        // Invalidate analysis cache for fresh analysis
        if let Ok(mut cache) = self.analysis_cache.lock() {
            *cache = None;
        }

        Ok(())
    }

    /// Get recent frontend metrics
    pub fn get_recent_metrics(&self, limit: usize) -> Vec<FrontendMetrics> {
        if let Ok(history) = self.metrics_history.lock() {
            history.iter().rev().take(limit).cloned().collect()
        } else {
            Vec::new()
        }
    }

    /// Analyze frontend performance
    pub fn analyze_performance(&self) -> Result<FrontendAnalysis, AppError> {
        // Check cache first
        if let Ok(cache) = self.analysis_cache.lock() {
            if let Some(cached_analysis) = cache.as_ref() {
                // Return cached analysis if it's recent (less than 5 minutes old)
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;

                if now - cached_analysis.timestamp < 300_000 {
                    // 5 minutes
                    return Ok(cached_analysis.clone());
                }
            }
        }

        // Perform fresh analysis
        let recent_metrics = self.get_recent_metrics(50); // Analyze last 50 snapshots

        if recent_metrics.is_empty() {
            return Err(AppError::Validation {
                field: "frontend_metrics".to_string(),
                message: "No frontend metrics available for analysis".to_string(),
            });
        }

        let analysis = self.perform_analysis(&recent_metrics)?;

        // Cache the analysis
        if let Ok(mut cache) = self.analysis_cache.lock() {
            *cache = Some(analysis.clone());
        }

        Ok(analysis)
    }

    /// Perform detailed performance analysis
    fn perform_analysis(&self, metrics: &[FrontendMetrics]) -> Result<FrontendAnalysis, AppError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // Analyze component performance
        let component_analysis = self.analyze_components(metrics);

        // Analyze memory usage
        let memory_analysis = self.analyze_memory(metrics);

        // Generate recommendations
        let recommendations =
            self.generate_recommendations(metrics, &component_analysis, &memory_analysis);

        // Analyze trends
        let trends = self.analyze_trends(metrics);

        // Calculate overall performance score
        let performance_score =
            self.calculate_performance_score(&component_analysis, &memory_analysis, &trends);

        Ok(FrontendAnalysis {
            performance_score,
            component_analysis,
            memory_analysis,
            recommendations,
            trends,
            timestamp,
        })
    }

    /// Analyze component render performance
    fn analyze_components(&self, metrics: &[FrontendMetrics]) -> Vec<ComponentAnalysis> {
        let mut component_stats: HashMap<String, Vec<&RenderMetric>> = HashMap::new();

        // Group render metrics by component
        for metric in metrics {
            for render_metric in &metric.render_metrics {
                component_stats
                    .entry(render_metric.component_name.clone())
                    .or_insert_with(Vec::new)
                    .push(render_metric);
            }
        }

        // Analyze each component
        component_stats
            .into_iter()
            .map(|(component_name, renders)| {
                let avg_render_time =
                    renders.iter().map(|r| r.render_time_ms).sum::<f64>() / renders.len() as f64;

                let total_renders = renders.iter().map(|r| r.render_count).sum::<u32>();
                let time_span_minutes = if renders.len() > 1 {
                    let first = renders[0].timestamp;
                    let last = renders[renders.len() - 1].timestamp;
                    (last - first) as f64 / 60000.0 // Convert to minutes
                } else {
                    1.0
                };
                let render_frequency = total_renders as f64 / time_span_minutes;

                // Performance rating based on render time and frequency
                let performance_rating = if avg_render_time < 16.0 && render_frequency < 30.0 {
                    90 + (10.0 - avg_render_time.min(10.0)) as u8
                } else if avg_render_time < 50.0 {
                    60 + ((50.0 - avg_render_time) / 50.0 * 30.0) as u8
                } else {
                    30
                };

                // Generate optimization suggestions
                let mut optimizations = Vec::new();
                if avg_render_time > 16.0 {
                    optimizations
                        .push("Consider memoization with React.memo or useMemo".to_string());
                }
                if render_frequency > 60.0 {
                    optimizations.push(
                        "High render frequency detected - check for unnecessary re-renders"
                            .to_string(),
                    );
                }
                if renders.iter().any(|r| r.props_changes > r.render_count) {
                    optimizations.push(
                        "Props changing more than renders - optimize prop passing".to_string(),
                    );
                }

                let is_optimized = renders.iter().any(|r| r.is_memoized) && performance_rating > 80;

                ComponentAnalysis {
                    component_name,
                    performance_rating,
                    avg_render_time_ms: avg_render_time,
                    render_frequency,
                    optimizations,
                    is_optimized,
                }
            })
            .collect()
    }

    /// Analyze memory usage patterns
    fn analyze_memory(&self, metrics: &[FrontendMetrics]) -> MemoryAnalysis {
        let memory_samples: Vec<&BrowserMemoryInfo> = metrics
            .iter()
            .filter_map(|m| m.browser_memory.as_ref())
            .collect();

        if memory_samples.is_empty() {
            return MemoryAnalysis {
                status: "unknown".to_string(),
                growth_rate_mb_per_min: 0.0,
                potential_leaks: Vec::new(),
                optimizations: vec!["Enable browser memory monitoring".to_string()],
            };
        }

        // Calculate memory growth rate
        let growth_rate_mb_per_min = if memory_samples.len() > 1 {
            let first = memory_samples[0];
            let last = memory_samples[memory_samples.len() - 1];
            let time_diff_minutes = (last.timestamp - first.timestamp) as f64 / 60000.0;
            if time_diff_minutes > 0.0 {
                let memory_diff_mb = (last.used_js_heap_size as f64
                    - first.used_js_heap_size as f64)
                    / (1024.0 * 1024.0);
                memory_diff_mb / time_diff_minutes
            } else {
                0.0
            }
        } else {
            0.0
        };

        // Determine status
        let latest_memory = memory_samples[memory_samples.len() - 1];
        let status = if latest_memory.usage_percent > 90.0 {
            "critical"
        } else if latest_memory.usage_percent > 75.0 || growth_rate_mb_per_min > 5.0 {
            "warning"
        } else {
            "good"
        };

        // Detect potential leaks
        let mut potential_leaks = Vec::new();
        if growth_rate_mb_per_min > 2.0 {
            potential_leaks
                .push("Steady memory growth detected - possible memory leak".to_string());
        }
        if memory_samples.iter().any(|m| m.usage_percent > 85.0) {
            potential_leaks.push("High memory usage spikes detected".to_string());
        }

        // Generate optimizations
        let mut optimizations = Vec::new();
        if latest_memory.usage_percent > 60.0 {
            optimizations
                .push("Consider implementing virtual scrolling for large lists".to_string());
        }
        if growth_rate_mb_per_min > 1.0 {
            optimizations.push("Review component cleanup and event listener removal".to_string());
        }
        optimizations.push("Monitor for unused state and redundant data caching".to_string());

        MemoryAnalysis {
            status: status.to_string(),
            growth_rate_mb_per_min,
            potential_leaks,
            optimizations,
        }
    }

    /// Generate optimization recommendations
    fn generate_recommendations(
        &self,
        _metrics: &[FrontendMetrics],
        components: &[ComponentAnalysis],
        memory: &MemoryAnalysis,
    ) -> Vec<FrontendOptimization> {
        let mut recommendations = Vec::new();

        // Component optimizations
        for component in components {
            if component.performance_rating < 70 {
                recommendations.push(FrontendOptimization {
                    optimization_type: "component_optimization".to_string(),
                    target: component.component_name.clone(),
                    priority: if component.performance_rating < 50 {
                        "high"
                    } else {
                        "medium"
                    }
                    .to_string(),
                    description: format!(
                        "Optimize {} component performance",
                        component.component_name
                    ),
                    expected_improvement: "15-30% render time reduction".to_string(),
                    effort: "medium".to_string(),
                    implementation_hint: Some(
                        "Consider React.memo() or useMemo() for expensive computations".to_string(),
                    ),
                });
            }
        }

        // Memory optimizations
        if memory.status == "warning" || memory.status == "critical" {
            recommendations.push(FrontendOptimization {
                optimization_type: "memory_optimization".to_string(),
                target: "application".to_string(),
                priority: if memory.status == "critical" {
                    "critical"
                } else {
                    "high"
                }
                .to_string(),
                description: "Reduce overall memory usage".to_string(),
                expected_improvement: "20-40% memory reduction".to_string(),
                effort: "medium".to_string(),
                implementation_hint: Some(
                    "Implement virtual scrolling and optimize data structures".to_string(),
                ),
            });
        }

        // Search performance optimizations
        recommendations.push(FrontendOptimization {
            optimization_type: "search_optimization".to_string(),
            target: "search_components".to_string(),
            priority: "medium".to_string(),
            description: "Optimize search UI responsiveness".to_string(),
            expected_improvement: "Faster search result rendering".to_string(),
            effort: "low".to_string(),
            implementation_hint: Some(
                "Debounce search input and implement result caching".to_string(),
            ),
        });

        recommendations
    }

    /// Analyze performance trends
    fn analyze_trends(&self, metrics: &[FrontendMetrics]) -> PerformanceTrends {
        if metrics.len() < 3 {
            return PerformanceTrends {
                render_trend: "insufficient_data".to_string(),
                memory_trend: "insufficient_data".to_string(),
                error_trend: "insufficient_data".to_string(),
                search_trend: "insufficient_data".to_string(),
                overall_trend: "insufficient_data".to_string(),
            };
        }

        // Analyze render performance trend
        let render_times: Vec<f64> = metrics
            .iter()
            .flat_map(|m| m.render_metrics.iter().map(|r| r.render_time_ms))
            .collect();
        let render_trend = self.calculate_trend(&render_times);

        // Analyze memory trend
        let memory_usage: Vec<f64> = metrics
            .iter()
            .filter_map(|m| m.browser_memory.as_ref().map(|mem| mem.usage_percent))
            .collect();
        let memory_trend = self.calculate_trend(&memory_usage);

        // Analyze error trend
        let error_counts: Vec<f64> = metrics
            .iter()
            .map(|m| {
                (m.error_metrics.js_errors
                    + m.error_metrics.react_errors
                    + m.error_metrics.network_errors) as f64
            })
            .collect();
        let error_trend = self.calculate_trend(&error_counts);

        // Determine overall trend
        let overall_trend = match (&render_trend[..], &memory_trend[..], &error_trend[..]) {
            ("improving", "improving", _) | ("improving", "stable", "improving") => "improving",
            ("degrading", _, _) | (_, "degrading", _) | (_, _, "degrading") => "degrading",
            _ => "stable",
        };

        PerformanceTrends {
            render_trend,
            memory_trend,
            error_trend,
            search_trend: "stable".to_string(), // Would analyze search-specific metrics
            overall_trend: overall_trend.to_string(),
        }
    }

    /// Calculate trend from a series of values
    fn calculate_trend(&self, values: &[f64]) -> String {
        if values.len() < 3 {
            return "insufficient_data".to_string();
        }

        let mid_point = values.len() / 2;
        let first_half_avg = values[..mid_point].iter().sum::<f64>() / mid_point as f64;
        let second_half_avg =
            values[mid_point..].iter().sum::<f64>() / (values.len() - mid_point) as f64;

        let change_percent = (second_half_avg - first_half_avg) / first_half_avg * 100.0;

        if change_percent > 10.0 {
            "degrading".to_string()
        } else if change_percent < -10.0 {
            "improving".to_string()
        } else {
            "stable".to_string()
        }
    }

    /// Calculate overall performance score
    fn calculate_performance_score(
        &self,
        components: &[ComponentAnalysis],
        memory: &MemoryAnalysis,
        trends: &PerformanceTrends,
    ) -> u8 {
        let mut score = 100.0;

        // Component performance impact (50%)
        if !components.is_empty() {
            let avg_component_rating = components
                .iter()
                .map(|c| c.performance_rating as f64)
                .sum::<f64>()
                / components.len() as f64;
            score *= 0.5 + (avg_component_rating / 100.0 * 0.5);
        }

        // Memory impact (30%)
        let memory_score = match memory.status.as_str() {
            "good" => 1.0,
            "warning" => 0.7,
            "critical" => 0.3,
            _ => 0.8,
        };
        score *= 0.7 + (memory_score * 0.3);

        // Trend impact (20%)
        let trend_multiplier = match trends.overall_trend.as_str() {
            "improving" => 1.0,
            "stable" => 0.9,
            "degrading" => 0.7,
            _ => 0.8,
        };
        score *= 0.8 + (trend_multiplier * 0.2);

        score.max(0.0).min(100.0) as u8
    }
}

/// Global frontend performance monitor instance
static FRONTEND_MONITOR: std::sync::OnceLock<FrontendPerformanceMonitor> =
    std::sync::OnceLock::new();

/// Get the global frontend performance monitor
pub fn get_frontend_monitor() -> &'static FrontendPerformanceMonitor {
    FRONTEND_MONITOR.get_or_init(|| FrontendPerformanceMonitor::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frontend_monitor_creation() {
        let monitor = FrontendPerformanceMonitor::new();
        assert_eq!(monitor.get_recent_metrics(10).len(), 0);
    }

    #[test]
    fn test_frontend_metrics_recording() {
        let monitor = FrontendPerformanceMonitor::new();

        let metrics = FrontendMetrics {
            render_metrics: vec![RenderMetric {
                component_name: "TestComponent".to_string(),
                render_time_ms: 15.5,
                render_count: 1,
                props_changes: 0,
                state_changes: 1,
                is_memoized: false,
                timestamp: 1000,
            }],
            browser_memory: Some(BrowserMemoryInfo {
                used_js_heap_size: 50 * 1024 * 1024,
                total_js_heap_size: 100 * 1024 * 1024,
                js_heap_size_limit: 200 * 1024 * 1024,
                usage_percent: 50.0,
                timestamp: 1000,
            }),
            navigation_timing: None,
            store_metrics: Vec::new(),
            search_ui_metrics: SearchUiMetrics {
                input_lag_ms: 5.0,
                results_render_ms: 25.0,
                virtual_scroll_metrics: VirtualScrollMetrics {
                    items_per_frame: 10,
                    scroll_fps: 60.0,
                    visible_items_memory_kb: 500,
                    item_render_time_ms: 2.5,
                },
                highlighting_ms: 3.0,
                autocomplete_ms: 12.0,
                filter_application_ms: 8.0,
            },
            error_metrics: ErrorMetrics {
                js_errors: 0,
                react_errors: 0,
                network_errors: 0,
                budget_violations: 0,
                error_samples: Vec::new(),
            },
            timestamp: 1000,
        };

        assert!(monitor.record_frontend_metrics(metrics).is_ok());
        assert_eq!(monitor.get_recent_metrics(1).len(), 1);
    }

    #[test]
    fn test_component_analysis() {
        let monitor = FrontendPerformanceMonitor::new();

        // Create metrics with some render data
        let metrics = vec![FrontendMetrics {
            render_metrics: vec![RenderMetric {
                component_name: "SlowComponent".to_string(),
                render_time_ms: 45.0, // Slow render
                render_count: 5,
                props_changes: 3,
                state_changes: 2,
                is_memoized: false,
                timestamp: 1000,
            }],
            browser_memory: None,
            navigation_timing: None,
            store_metrics: Vec::new(),
            search_ui_metrics: SearchUiMetrics {
                input_lag_ms: 0.0,
                results_render_ms: 0.0,
                virtual_scroll_metrics: VirtualScrollMetrics {
                    items_per_frame: 0,
                    scroll_fps: 0.0,
                    visible_items_memory_kb: 0,
                    item_render_time_ms: 0.0,
                },
                highlighting_ms: 0.0,
                autocomplete_ms: 0.0,
                filter_application_ms: 0.0,
            },
            error_metrics: ErrorMetrics {
                js_errors: 0,
                react_errors: 0,
                network_errors: 0,
                budget_violations: 0,
                error_samples: Vec::new(),
            },
            timestamp: 1000,
        }];

        let component_analysis = monitor.analyze_components(&metrics);
        assert_eq!(component_analysis.len(), 1);
        assert_eq!(component_analysis[0].component_name, "SlowComponent");
        assert!(component_analysis[0].performance_rating < 80); // Should be rated as needing optimization
    }

    #[test]
    fn test_memory_analysis() {
        let monitor = FrontendPerformanceMonitor::new();

        let metrics = vec![FrontendMetrics {
            render_metrics: Vec::new(),
            browser_memory: Some(BrowserMemoryInfo {
                used_js_heap_size: 80 * 1024 * 1024, // 80MB
                total_js_heap_size: 100 * 1024 * 1024,
                js_heap_size_limit: 200 * 1024 * 1024,
                usage_percent: 80.0, // High usage
                timestamp: 1000,
            }),
            navigation_timing: None,
            store_metrics: Vec::new(),
            search_ui_metrics: SearchUiMetrics {
                input_lag_ms: 0.0,
                results_render_ms: 0.0,
                virtual_scroll_metrics: VirtualScrollMetrics {
                    items_per_frame: 0,
                    scroll_fps: 0.0,
                    visible_items_memory_kb: 0,
                    item_render_time_ms: 0.0,
                },
                highlighting_ms: 0.0,
                autocomplete_ms: 0.0,
                filter_application_ms: 0.0,
            },
            error_metrics: ErrorMetrics {
                js_errors: 0,
                react_errors: 0,
                network_errors: 0,
                budget_violations: 0,
                error_samples: Vec::new(),
            },
            timestamp: 1000,
        }];

        let memory_analysis = monitor.analyze_memory(&metrics);
        assert_eq!(memory_analysis.status, "warning"); // Should flag high usage
    }
}
