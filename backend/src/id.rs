use std::{
    sync::atomic::{AtomicI64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const CUSTOM_EPOCH_MILLIS: i64 = 1_767_225_600_000;
const WORKER_ID_BITS: i64 = 10;
const SEQUENCE_BITS: i64 = 12;
const MAX_WORKER_ID: u16 = (1 << WORKER_ID_BITS) - 1;
const MAX_SEQUENCE: i64 = (1 << SEQUENCE_BITS) - 1;

pub trait IdGenerator: Send + Sync {
    fn next_id(&self) -> i64;
}

#[derive(Debug)]
pub struct SnowflakeIdGenerator {
    worker_id: u16,
    last_timestamp: AtomicI64,
    sequence: AtomicI64,
}

impl SnowflakeIdGenerator {
    pub fn new(worker_id: u16) -> anyhow::Result<Self> {
        anyhow::ensure!(
            worker_id <= MAX_WORKER_ID,
            "worker_id 超出 Snowflake 支持范围"
        );

        Ok(Self {
            worker_id,
            last_timestamp: AtomicI64::new(0),
            sequence: AtomicI64::new(0),
        })
    }
}

impl IdGenerator for SnowflakeIdGenerator {
    fn next_id(&self) -> i64 {
        loop {
            let now = current_millis();
            let last = self.last_timestamp.load(Ordering::Acquire);

            if now < last {
                continue;
            }

            let sequence = if now == last {
                (self.sequence.fetch_add(1, Ordering::AcqRel) + 1) & MAX_SEQUENCE
            } else {
                self.sequence.store(0, Ordering::Release);
                0
            };

            if sequence == 0 && now == last {
                continue;
            }

            if self
                .last_timestamp
                .compare_exchange(last, now, Ordering::AcqRel, Ordering::Acquire)
                .is_ok()
                || now == last
            {
                return ((now - CUSTOM_EPOCH_MILLIS) << (WORKER_ID_BITS + SEQUENCE_BITS))
                    | ((self.worker_id as i64) << SEQUENCE_BITS)
                    | sequence;
            }
        }
    }
}

fn current_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(CUSTOM_EPOCH_MILLIS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_ids_are_positive_and_increasing() {
        let generator = SnowflakeIdGenerator::new(1).unwrap();

        let first = generator.next_id();
        let second = generator.next_id();

        assert!(first > 0);
        assert!(second > first);
    }
}
