use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH, Duration, Instant};
use serde::{Serialize, Deserialize};
use sysinfo::{System, ProcessesToUpdate};
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub network_io: Option<NetworkMetrics>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedSystemMetrics {
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk_io: DiskMetrics,
    pub network: Option<NetworkMetrics>,
    pub process: ProcessMetrics,
    pub platform: PlatformInfo,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub overall_usage: f32,
    pub per_core_usage: Vec<f32>,
    pub frequency: Option<u64>, // MHz
    pub temperature: Option<f32>, // Celsius
    pub load_average: Option<LoadAverage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadAverage {
    pub one_minute: f64,
    pub five_minutes: f64,
    pub fifteen_minutes: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub total: u64,       // bytes
    pub used: u64,        // bytes
    pub available: u64,   // bytes
    pub usage_percent: f64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub swap_usage_percent: f64,
    pub buffers: Option<u64>,
    pub cached: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub read_bytes: u64,
    pub write_bytes: u64,
    pub read_ops: u64,
    pub write_ops: u64,
    pub read_time: u64,   // milliseconds
    pub write_time: u64,  // milliseconds
    pub disks: Vec<DiskInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
    pub usage_percent: f64,
    pub file_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub packets_sent: u64,
    pub packets_received: u64,
    pub errors_sent: u64,
    pub errors_received: u64,
    pub interfaces: Vec<NetworkInterface>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub packets_sent: u64,
    pub packets_received: u64,
    pub errors_sent: u64,
    pub errors_received: u64,
    pub speed: Option<u64>, // Mbps
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetrics {
    pub cpu_usage: f32,
    pub memory_usage: u64,     // bytes
    pub memory_percent: f32,
    pub disk_read: u64,
    pub disk_written: u64,
    pub thread_count: u32,
    pub handle_count: Option<u32>, // Windows specific
    pub start_time: u64,           // timestamp
    pub uptime: u64,               // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os_name: String,
    pub os_version: String,
    pub architecture: String,
    pub hostname: String,
    pub cpu_cores: u32,
    pub cpu_model: Option<String>,
    pub boot_time: Option<u64>,
    pub kernel_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemThresholds {
    pub cpu_warning: f32,      // %
    pub cpu_critical: f32,     // %
    pub memory_warning: f64,   // %
    pub memory_critical: f64,  // %
    pub disk_warning: f64,     // %
    pub disk_critical: f64,    // %
    pub response_warning: u64, // ms
    pub response_critical: u64, // ms
}

impl Default for SystemThresholds {
    fn default() -> Self {
        Self {
            cpu_warning: 70.0,
            cpu_critical: 90.0,
            memory_warning: 80.0,
            memory_critical: 95.0,
            disk_warning: 85.0,
            disk_critical: 95.0,
            response_warning: 1000,   // 1 second
            response_critical: 5000,  // 5 seconds
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemAnalysis {
    pub overall_health: String,
    pub performance_score: f64,
    pub bottlenecks: Vec<String>,
    pub recommendations: Vec<String>,
    pub resource_utilization: ResourceUtilization,
    pub trend_analysis: TrendAnalysis,
    pub alerts: Vec<SystemAlert>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUtilization {
    pub cpu_status: String,      // "low", "normal", "high", "critical"
    pub memory_status: String,
    pub disk_status: String,
    pub network_status: String,
    pub overall_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    pub cpu_trend: String,       // "improving", "stable", "degrading"
    pub memory_trend: String,
    pub disk_trend: String,
    pub performance_trend: String,
    pub prediction: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemAlert {
    pub level: String,           // "info", "warning", "error", "critical"
    pub category: String,        // "cpu", "memory", "disk", "network", "process"
    pub message: String,
    pub timestamp: u64,
    pub metric_value: Option<f64>,
    pub threshold_value: Option<f64>,
    pub recommendation: Option<String>,
}

pub struct SystemMonitor {
    #[allow(dead_code)] system: Arc<Mutex<System>>,
    thresholds: Arc<Mutex<SystemThresholds>>,
    metrics_history: Arc<Mutex<Vec<DetailedSystemMetrics>>>,
    last_collection: Arc<Mutex<Option<Instant>>>,
    platform_info: Arc<Mutex<Option<PlatformInfo>>>,
}

impl SystemMonitor {
    pub fn new() -> Result<Self, AppError> {
        let mut system = System::new_all();
        system.refresh_all();
        
        Ok(Self {
            system: Arc::new(Mutex::new(system)),
            thresholds: Arc::new(Mutex::new(SystemThresholds::default())),
            metrics_history: Arc::new(Mutex::new(Vec::new())),
            last_collection: Arc::new(Mutex::new(None)),
            platform_info: Arc::new(Mutex::new(None)),
        })
    }

    /// Get current system metrics
    pub async fn get_system_metrics(&self) -> Result<SystemMetrics, AppError> {
        let detailed = self.get_detailed_metrics().await?;
        
        Ok(SystemMetrics {
            cpu_usage: detailed.cpu.overall_usage,
            memory_usage: detailed.memory.usage_percent,
            disk_usage: if detailed.disk_io.disks.is_empty() {
                0.0
            } else {
                detailed.disk_io.disks.iter()
                    .map(|disk| disk.usage_percent)
                    .fold(0.0f64, |acc, x| acc.max(x))
            },
            network_io: detailed.network,
            timestamp: detailed.timestamp,
        })
    }

    /// Get detailed system metrics
    pub async fn get_detailed_metrics(&self) -> Result<DetailedSystemMetrics, AppError> {
        // Check if we should collect new metrics (throttle to avoid excessive system calls)
        let should_collect = {
            let last_collection = self.last_collection.lock()
                .map_err(|e| AppError::Runtime { message: format!("Lock error: {}", e) })?;
            
            match *last_collection {
                Some(last) => last.elapsed() >= Duration::from_secs(1),
                None => true,
            }
        };

        if should_collect {
            let metrics = Self::collect_system_metrics(&self.platform_info).await?;
            
            // Update history
            {
                let mut history = self.metrics_history.lock()
                    .map_err(|e| AppError::Runtime { message: format!("Lock error: {}", e) })?;
                
                history.push(metrics.clone());
                
                // Keep only last 1000 entries (about 16 minutes at 1 second intervals)
                if history.len() > 1000 {
                    let len = history.len(); 
                    history.drain(0..len - 1000);
                }
            }
            
            // Update last collection time
            {
                let mut last_collection = self.last_collection.lock()
                    .map_err(|e| AppError::Runtime { message: format!("Lock error: {}", e) })?;
                *last_collection = Some(Instant::now());
            }
            
            Ok(metrics)
        } else {
            // Return most recent from history
            let history = self.metrics_history.lock()
                .map_err(|e| AppError::Runtime { message: format!("Lock error: {}", e) })?;
            
            if let Some(latest) = history.last() {
                Ok(latest.clone())
            } else {
                // Force collection if no history
                Self::collect_system_metrics(&self.platform_info).await
            }
        }
    }

    /// Get recent metrics for analysis
    pub fn get_recent_metrics(&self, minutes: u64) -> Vec<DetailedSystemMetrics> {
        let cutoff_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
            .saturating_sub(minutes * 60 * 1000);

        if let Ok(history) = self.metrics_history.lock() {
            history.iter()
                .filter(|m| m.timestamp >= cutoff_time)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Set performance thresholds
    pub fn set_thresholds(&self, thresholds: SystemThresholds) -> Result<(), AppError> {
        if let Ok(mut current_thresholds) = self.thresholds.lock() {
            *current_thresholds = thresholds;
            Ok(())
        } else {
            Err(AppError::Runtime { message: "Failed to update thresholds".to_string() })
        }
    }

    /// Get active system alerts
    pub fn get_active_alerts(&self) -> Vec<SystemAlert> {
        // Get recent metrics and generate alerts
        let recent_metrics = self.get_recent_metrics(5); // Last 5 minutes
        if let Some(latest) = recent_metrics.last() {
            if let Ok(thresholds) = self.thresholds.lock() {
                return Self::generate_alerts(latest, &thresholds);
            }
        }
        Vec::new()
    }

    /// Analyze system performance
    pub fn analyze_performance(&self) -> Result<SystemAnalysis, AppError> {
        let recent_metrics = self.get_recent_metrics(60); // Last hour
        
        if recent_metrics.is_empty() {
            return Err(AppError::Validation {
                field: "system_metrics".to_string(),
                message: "No system metrics available for analysis".to_string()
            });
        }

        let thresholds = self.thresholds.lock()
            .map_err(|e| AppError::Runtime { message: format!("Lock error: {}", e) })?;

        let latest = recent_metrics.last().unwrap();
        
        // Calculate performance score
        let cpu_score = Self::calculate_resource_score(latest.cpu.overall_usage as f64, 100.0);
        let memory_score = Self::calculate_resource_score(latest.memory.usage_percent, 100.0);
        let disk_score = if latest.disk_io.disks.is_empty() {
            100.0
        } else {
            latest.disk_io.disks.iter()
                .map(|disk| Self::calculate_resource_score(disk.usage_percent, 100.0))
                .fold(0.0f64, |acc, x| acc.min(x))
        };
        
        let performance_score = (cpu_score + memory_score + disk_score) / 3.0;
        
        // Determine resource utilization status
        let resource_utilization = ResourceUtilization {
            cpu_status: Self::get_status_from_usage(latest.cpu.overall_usage as f64, thresholds.cpu_warning as f64, thresholds.cpu_critical as f64),
            memory_status: Self::get_status_from_usage(latest.memory.usage_percent, thresholds.memory_warning, thresholds.memory_critical),
            disk_status: if latest.disk_io.disks.is_empty() {
                "normal".to_string()
            } else {
                let max_disk_usage = latest.disk_io.disks.iter()
                    .map(|disk| disk.usage_percent)
                    .fold(0.0f64, |acc, x| acc.max(x));
                Self::get_status_from_usage(max_disk_usage, thresholds.disk_warning, thresholds.disk_critical)
            },
            network_status: "normal".to_string(), // Simplified for now
            overall_status: Self::get_overall_status(performance_score),
        };

        // Generate trend analysis
        let trend_analysis = Self::analyze_trends(&recent_metrics);
        
        // Generate bottlenecks and recommendations
        let (bottlenecks, recommendations) = Self::identify_bottlenecks_and_recommendations(&latest, &thresholds);
        
        // Generate alerts
        let alerts = Self::generate_alerts(&latest, &thresholds);
        
        Ok(SystemAnalysis {
            overall_health: resource_utilization.overall_status.clone(),
            performance_score,
            bottlenecks,
            recommendations,
            resource_utilization,
            trend_analysis,
            alerts,
        })
    }

    /// Collect system metrics from the OS
    async fn collect_system_metrics(platform_info: &Arc<Mutex<Option<PlatformInfo>>>) -> Result<DetailedSystemMetrics, AppError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| AppError::Runtime { message: format!("Time error: {}", e) })?
            .as_millis() as u64;

        // Get or create platform info
        let platform = {
            let mut platform_guard = platform_info.lock()
                .map_err(|e| AppError::Runtime { message: format!("Lock error: {}", e) })?;
            
            if platform_guard.is_none() {
                *platform_guard = Some(Self::collect_platform_info()?);
            }
            
            platform_guard.as_ref().unwrap().clone()
        };

        // Collect CPU metrics
        let cpu = Self::collect_cpu_metrics().await?;
        
        // Collect memory metrics
        let memory = Self::collect_memory_metrics()?;
        
        // Collect disk I/O metrics
        let disk_io = Self::collect_disk_metrics()?;
        
        // Collect network metrics (optional)
        let network = Self::collect_network_metrics().ok();
        
        // Collect process metrics
        let process = Self::collect_process_metrics()?;

        Ok(DetailedSystemMetrics {
            cpu,
            memory,
            disk_io,
            network,
            process,
            platform,
            timestamp,
        })
    }

    /// Collect platform information
    fn collect_platform_info() -> Result<PlatformInfo, AppError> {
        // This would use platform-specific APIs to gather system information
        // For now, provide a basic implementation
        
        let os_name = std::env::consts::OS.to_string();
        let architecture = std::env::consts::ARCH.to_string();
        let hostname = hostname::get()
            .map_err(|e| AppError::Runtime { message: format!("Failed to get hostname: {}", e) })?
            .to_string_lossy()
            .to_string();
        
        Ok(PlatformInfo {
            os_name,
            os_version: "unknown".to_string(), // Would query OS version
            architecture,
            hostname,
            cpu_cores: num_cpus::get() as u32,
            cpu_model: None, // Would query CPU model
            boot_time: None, // Would query system boot time
            kernel_version: None, // Would query kernel version
        })
    }

    /// Collect CPU metrics
    async fn collect_cpu_metrics() -> Result<CpuMetrics, AppError> {
        // This is a simplified implementation
        // A real implementation would use platform-specific APIs
        
        let mut system = System::new();
        system.refresh_cpu_all();
        
        // Wait a bit for CPU usage calculation
        tokio::time::sleep(Duration::from_millis(200)).await;
        system.refresh_cpu_all();
        
        let cpus = system.cpus();
        let overall_usage = cpus.iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / cpus.len() as f32;
        let per_core_usage: Vec<f32> = cpus.iter().map(|cpu| cpu.cpu_usage()).collect();
        
        Ok(CpuMetrics {
            overall_usage,
            per_core_usage,
            frequency: cpus.first().map(|cpu| cpu.frequency()),
            temperature: None, // Would require platform-specific implementation
            load_average: None, // Would use getloadavg on Unix systems
        })
    }

    /// Collect memory metrics
    fn collect_memory_metrics() -> Result<MemoryMetrics, AppError> {
        let mut system = System::new();
        system.refresh_memory();
        
        let total = system.total_memory();
        let used = system.used_memory();
        let available = system.available_memory();
        let usage_percent = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        
        let swap_total = system.total_swap();
        let swap_used = system.used_swap();
        let swap_usage_percent = if swap_total > 0 {
            (swap_used as f64 / swap_total as f64) * 100.0
        } else {
            0.0
        };
        
        Ok(MemoryMetrics {
            total,
            used,
            available,
            usage_percent,
            swap_total,
            swap_used,
            swap_usage_percent,
            buffers: None, // Would require parsing /proc/meminfo on Linux
            cached: None,  // Would require parsing /proc/meminfo on Linux
        })
    }

    /// Collect disk metrics
    fn collect_disk_metrics() -> Result<DiskMetrics, AppError> {
        // Disk metrics collection disabled in sysinfo 0.37
        // The disk API has changed significantly
        Ok(DiskMetrics {
            read_bytes: 0,
            write_bytes: 0,
            read_ops: 0,
            write_ops: 0,
            read_time: 0,
            write_time: 0,
            disks: Vec::new(),
        })
    }

    /// Collect network metrics (optional)
    fn collect_network_metrics() -> Result<NetworkMetrics, AppError> {
        // Network metrics collection disabled in sysinfo 0.37
        // The networks API has changed significantly
        Ok(NetworkMetrics {
            bytes_sent: 0,
            bytes_received: 0,
            packets_sent: 0,
            packets_received: 0,
            errors_sent: 0,
            errors_received: 0,
            interfaces: Vec::new(),
        })
    }

    /// Collect process metrics for the current process
    fn collect_process_metrics() -> Result<ProcessMetrics, AppError> {
        let mut system = System::new();
        system.refresh_processes(ProcessesToUpdate::All, true);
        
        let pid = std::process::id();
        
        if let Some(process) = system.process(sysinfo::Pid::from(pid as usize)) {
            let start_time = process.start_time();
            let uptime = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0)
                .saturating_sub(start_time);
            
            Ok(ProcessMetrics {
                cpu_usage: process.cpu_usage(),
                memory_usage: process.memory(),
                memory_percent: if system.total_memory() > 0 {
                    (process.memory() as f32 / system.total_memory() as f32) * 100.0
                } else {
                    0.0
                },
                disk_read: process.disk_usage().read_bytes,
                disk_written: process.disk_usage().written_bytes,
                thread_count: 1, // Would use platform-specific APIs
                handle_count: None, // Windows specific
                start_time,
                uptime,
            })
        } else {
            // Return default metrics if process not found
            Ok(ProcessMetrics {
                cpu_usage: 0.0,
                memory_usage: 0,
                memory_percent: 0.0,
                disk_read: 0,
                disk_written: 0,
                thread_count: 1,
                handle_count: None,
                start_time: 0,
                uptime: 0,
            })
        }
    }

    /// Calculate resource score (0-100, higher is better)
    fn calculate_resource_score(usage: f64, max_value: f64) -> f64 {
        let usage_percent = (usage / max_value) * 100.0;
        (100.0 - usage_percent).max(0.0)
    }

    /// Get status from usage percentage
    fn get_status_from_usage(usage: f64, warning_threshold: f64, critical_threshold: f64) -> String {
        if usage >= critical_threshold {
            "critical".to_string()
        } else if usage >= warning_threshold {
            "high".to_string()
        } else if usage >= 50.0 {
            "normal".to_string()
        } else {
            "low".to_string()
        }
    }

    /// Get overall status from performance score
    fn get_overall_status(score: f64) -> String {
        if score >= 80.0 {
            "excellent".to_string()
        } else if score >= 60.0 {
            "good".to_string()
        } else if score >= 40.0 {
            "fair".to_string()
        } else if score >= 20.0 {
            "poor".to_string()
        } else {
            "critical".to_string()
        }
    }

    /// Analyze trends from historical metrics
    fn analyze_trends(metrics: &[DetailedSystemMetrics]) -> TrendAnalysis {
        if metrics.len() < 2 {
            return TrendAnalysis {
                cpu_trend: "stable".to_string(),
                memory_trend: "stable".to_string(),
                disk_trend: "stable".to_string(),
                performance_trend: "stable".to_string(),
                prediction: None,
            };
        }

        let first_half = &metrics[0..metrics.len()/2];
        let second_half = &metrics[metrics.len()/2..];

        let first_cpu_avg = first_half.iter().map(|m| m.cpu.overall_usage as f64).sum::<f64>() / first_half.len() as f64;
        let second_cpu_avg = second_half.iter().map(|m| m.cpu.overall_usage as f64).sum::<f64>() / second_half.len() as f64;

        let first_memory_avg = first_half.iter().map(|m| m.memory.usage_percent).sum::<f64>() / first_half.len() as f64;
        let second_memory_avg = second_half.iter().map(|m| m.memory.usage_percent).sum::<f64>() / second_half.len() as f64;

        let cpu_trend = Self::determine_trend(first_cpu_avg, second_cpu_avg);
        let memory_trend = Self::determine_trend(first_memory_avg, second_memory_avg);

        // Overall performance trend (lower resource usage = better performance)
        let first_perf_score = 100.0 - (first_cpu_avg + first_memory_avg) / 2.0;
        let second_perf_score = 100.0 - (second_cpu_avg + second_memory_avg) / 2.0;
        let performance_trend = if second_perf_score > first_perf_score + 5.0 {
            "improving".to_string()
        } else if second_perf_score < first_perf_score - 5.0 {
            "degrading".to_string()
        } else {
            "stable".to_string()
        };

        TrendAnalysis {
            cpu_trend,
            memory_trend,
            disk_trend: "stable".to_string(), // Simplified
            performance_trend,
            prediction: None, // Would implement predictive analytics
        }
    }

    /// Determine trend direction
    fn determine_trend(first_avg: f64, second_avg: f64) -> String {
        let change_percent = ((second_avg - first_avg) / first_avg) * 100.0;
        
        if change_percent > 10.0 {
            "degrading".to_string() // Higher usage is worse
        } else if change_percent < -10.0 {
            "improving".to_string() // Lower usage is better
        } else {
            "stable".to_string()
        }
    }

    /// Identify bottlenecks and generate recommendations
    fn identify_bottlenecks_and_recommendations(
        metrics: &DetailedSystemMetrics, 
        thresholds: &SystemThresholds
    ) -> (Vec<String>, Vec<String>) {
        let mut bottlenecks = Vec::new();
        let mut recommendations = Vec::new();

        // CPU analysis
        if metrics.cpu.overall_usage >= thresholds.cpu_critical {
            bottlenecks.push("CPU usage is critically high".to_string());
            recommendations.push("Consider closing unnecessary applications or upgrading CPU".to_string());
        } else if metrics.cpu.overall_usage >= thresholds.cpu_warning {
            bottlenecks.push("CPU usage is high".to_string());
            recommendations.push("Monitor CPU-intensive processes".to_string());
        }

        // Memory analysis
        if metrics.memory.usage_percent >= thresholds.memory_critical {
            bottlenecks.push("Memory usage is critically high".to_string());
            recommendations.push("Close memory-intensive applications or add more RAM".to_string());
        } else if metrics.memory.usage_percent >= thresholds.memory_warning {
            bottlenecks.push("Memory usage is high".to_string());
            recommendations.push("Consider restarting applications to free memory".to_string());
        }

        // Disk analysis
        let max_disk_usage = metrics.disk_io.disks.iter()
            .map(|disk| disk.usage_percent)
            .fold(0.0f64, |acc, x| acc.max(x));
        
        if max_disk_usage >= thresholds.disk_critical {
            bottlenecks.push("Disk space is critically low".to_string());
            recommendations.push("Free up disk space immediately".to_string());
        } else if max_disk_usage >= thresholds.disk_warning {
            bottlenecks.push("Disk space is getting low".to_string());
            recommendations.push("Clean up temporary files and unused data".to_string());
        }

        (bottlenecks, recommendations)
    }

    /// Generate performance alerts
    fn generate_alerts(
        metrics: &DetailedSystemMetrics, 
        thresholds: &SystemThresholds
    ) -> Vec<SystemAlert> {
        let mut alerts = Vec::new();
        let timestamp = metrics.timestamp;

        // CPU alerts
        if metrics.cpu.overall_usage >= thresholds.cpu_critical {
            alerts.push(SystemAlert {
                level: "critical".to_string(),
                category: "cpu".to_string(),
                message: format!("CPU usage is critically high at {:.1}%", metrics.cpu.overall_usage),
                timestamp,
                metric_value: Some(metrics.cpu.overall_usage as f64),
                threshold_value: Some(thresholds.cpu_critical as f64),
                recommendation: Some("Close unnecessary applications immediately".to_string()),
            });
        } else if metrics.cpu.overall_usage >= thresholds.cpu_warning {
            alerts.push(SystemAlert {
                level: "warning".to_string(),
                category: "cpu".to_string(),
                message: format!("CPU usage is high at {:.1}%", metrics.cpu.overall_usage),
                timestamp,
                metric_value: Some(metrics.cpu.overall_usage as f64),
                threshold_value: Some(thresholds.cpu_warning as f64),
                recommendation: Some("Monitor CPU-intensive processes".to_string()),
            });
        }

        // Memory alerts
        if metrics.memory.usage_percent >= thresholds.memory_critical {
            alerts.push(SystemAlert {
                level: "critical".to_string(),
                category: "memory".to_string(),
                message: format!("Memory usage is critically high at {:.1}%", metrics.memory.usage_percent),
                timestamp,
                metric_value: Some(metrics.memory.usage_percent),
                threshold_value: Some(thresholds.memory_critical),
                recommendation: Some("Close memory-intensive applications immediately".to_string()),
            });
        } else if metrics.memory.usage_percent >= thresholds.memory_warning {
            alerts.push(SystemAlert {
                level: "warning".to_string(),
                category: "memory".to_string(),
                message: format!("Memory usage is high at {:.1}%", metrics.memory.usage_percent),
                timestamp,
                metric_value: Some(metrics.memory.usage_percent),
                threshold_value: Some(thresholds.memory_warning),
                recommendation: Some("Consider restarting applications".to_string()),
            });
        }

        alerts
    }
}

/// Get the global system monitor instance
pub fn get_system_monitor() -> Result<Arc<SystemMonitor>, AppError> {
    static SYSTEM_MONITOR: std::sync::OnceLock<Arc<SystemMonitor>> = std::sync::OnceLock::new();
    
    let monitor = SYSTEM_MONITOR.get_or_init(|| {
        SystemMonitor::new().map(Arc::new).unwrap_or_else(|_| {
            // Fallback: create a basic system monitor
            Arc::new(SystemMonitor {
                system: Arc::new(Mutex::new(System::new_all())),
                thresholds: Arc::new(Mutex::new(SystemThresholds::default())),
                metrics_history: Arc::new(Mutex::new(Vec::new())),
                last_collection: Arc::new(Mutex::new(None)),
                platform_info: Arc::new(Mutex::new(None)),
            })
        })
    });
    
    Ok(monitor.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_thresholds_default() {
        let thresholds = SystemThresholds::default();
        assert_eq!(thresholds.cpu_warning, 70.0);
        assert_eq!(thresholds.cpu_critical, 90.0);
        assert_eq!(thresholds.memory_warning, 80.0);
        assert_eq!(thresholds.memory_critical, 95.0);
    }

    #[test]
    fn test_calculate_resource_score() {
        assert_eq!(SystemMonitor::calculate_resource_score(0.0, 100.0), 100.0);
        assert_eq!(SystemMonitor::calculate_resource_score(50.0, 100.0), 50.0);
        assert_eq!(SystemMonitor::calculate_resource_score(100.0, 100.0), 0.0);
    }

    #[test]
    fn test_get_status_from_usage() {
        assert_eq!(SystemMonitor::get_status_from_usage(95.0, 80.0, 90.0), "critical");
        assert_eq!(SystemMonitor::get_status_from_usage(85.0, 80.0, 90.0), "high");
        assert_eq!(SystemMonitor::get_status_from_usage(60.0, 80.0, 90.0), "normal");
        assert_eq!(SystemMonitor::get_status_from_usage(30.0, 80.0, 90.0), "low");
    }

    #[test]
    fn test_get_overall_status() {
        assert_eq!(SystemMonitor::get_overall_status(90.0), "excellent");
        assert_eq!(SystemMonitor::get_overall_status(70.0), "good");
        assert_eq!(SystemMonitor::get_overall_status(50.0), "fair");
        assert_eq!(SystemMonitor::get_overall_status(30.0), "poor");
        assert_eq!(SystemMonitor::get_overall_status(10.0), "critical");
    }

    #[test]
    fn test_determine_trend() {
        assert_eq!(SystemMonitor::determine_trend(50.0, 60.0), "degrading");
        assert_eq!(SystemMonitor::determine_trend(60.0, 50.0), "improving");
        assert_eq!(SystemMonitor::determine_trend(50.0, 52.0), "stable");
    }

    #[tokio::test]
    async fn test_system_monitor_creation() {
        let monitor = SystemMonitor::new();
        assert!(monitor.is_ok());
    }

    #[tokio::test]
    async fn test_get_system_monitor() {
        let monitor = get_system_monitor();
        assert!(monitor.is_ok());
    }
}