use anyhow::{Context, Result};
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::config::SchedulerConfig;

pub async fn start_scheduler(config: &SchedulerConfig) -> Result<Option<JobScheduler>> {
    if !config.enabled {
        return Ok(None);
    }

    let scheduler = JobScheduler::new()
        .await
        .context("创建定时任务调度器失败")?;

    let cleanup_config = &config.jobs.cleanup_expired_tokens;
    if cleanup_config.enabled {
        let job = Job::new_async(cleanup_config.cron.as_str(), |_job_id, _lock| {
            Box::pin(async move {
                tracing::info!("定时清理任务触发，当前版本尚未实现业务清理逻辑");
            })
        })
        .context("创建过期 token 清理任务失败")?;
        scheduler
            .add(job)
            .await
            .context("注册过期 token 清理任务失败")?;
    }

    scheduler.start().await.context("启动定时任务调度器失败")?;

    Ok(Some(scheduler))
}
