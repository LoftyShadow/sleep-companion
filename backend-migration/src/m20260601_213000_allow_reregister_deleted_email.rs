use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
alter table app_users
    drop constraint if exists app_users_email_key;

create unique index if not exists app_users_active_email_unique_idx
    on app_users(email)
    where deleted_at is null;
"#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
drop index if exists app_users_active_email_unique_idx;

alter table app_users
    add constraint app_users_email_key unique (email);
"#,
            )
            .await?;

        Ok(())
    }
}
