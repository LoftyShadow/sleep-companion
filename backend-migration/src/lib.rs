pub use sea_orm_migration::prelude::*;

mod m20260531_193000_create_auth_foundation;
mod m20260601_213000_allow_reregister_deleted_email;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260531_193000_create_auth_foundation::Migration),
            Box::new(m20260601_213000_allow_reregister_deleted_email::Migration),
        ]
    }
}
