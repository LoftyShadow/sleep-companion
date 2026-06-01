use chrono::{DateTime, Utc};
use serde_json::Value;

pub trait HasAuditFields {
    fn created_at(&self) -> &DateTime<Utc>;

    fn updated_at(&self) -> &DateTime<Utc>;

    fn deleted_at(&self) -> Option<&DateTime<Utc>>;

    fn created_by(&self) -> Option<i64>;

    fn updated_by(&self) -> Option<i64>;

    fn metadata(&self) -> &Value;

    fn is_deleted(&self) -> bool {
        self.deleted_at().is_some()
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use serde_json::json;

    use super::HasAuditFields;
    use crate::entity::app_users::Model;

    #[test]
    fn is_deleted_reflects_deleted_at() {
        let mut user = Model {
            id: 1,
            email: "user@example.com".to_string(),
            email_verified_at: None,
            display_name: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            created_by: Some(10),
            updated_by: Some(11),
            metadata: json!({ "source": "test" }),
        };

        assert!(!user.is_deleted());
        assert_eq!(user.created_by(), Some(10));
        assert_eq!(user.updated_by(), Some(11));
        assert_eq!(user.metadata()["source"], "test");

        user.deleted_at = Some(Utc::now());

        assert!(user.is_deleted());
    }
}
