macro_rules! impl_has_audit_fields {
    ($model:ty) => {
        impl crate::entity::common::HasAuditFields for $model {
            fn created_at(&self) -> &chrono::DateTime<chrono::Utc> {
                &self.created_at
            }

            fn updated_at(&self) -> &chrono::DateTime<chrono::Utc> {
                &self.updated_at
            }

            fn deleted_at(&self) -> Option<&chrono::DateTime<chrono::Utc>> {
                self.deleted_at.as_ref()
            }

            fn created_by(&self) -> Option<i64> {
                self.created_by
            }

            fn updated_by(&self) -> Option<i64> {
                self.updated_by
            }

            fn metadata(&self) -> &serde_json::Value {
                &self.metadata
            }
        }
    };
}

pub mod app_users;
pub mod common;
pub mod email_verification_tokens;
pub mod login_rate_limits;
pub mod password_credentials;
pub mod password_reset_tokens;
pub mod refresh_sessions;
