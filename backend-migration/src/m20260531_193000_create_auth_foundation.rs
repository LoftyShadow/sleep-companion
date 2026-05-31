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
create extension if not exists citext;

create table app_users (
    id bigint primary key,
    email citext not null unique,
    email_verified_at timestamptz,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by bigint,
    updated_by bigint,
    metadata jsonb not null default '{}'::jsonb
);

create table password_credentials (
    app_user_id bigint primary key,
    password_hash text not null,
    password_changed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by bigint,
    updated_by bigint,
    metadata jsonb not null default '{}'::jsonb
);

create table email_verification_tokens (
    id bigint primary key,
    app_user_id bigint not null,
    token_hash bytea not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by bigint,
    updated_by bigint,
    metadata jsonb not null default '{}'::jsonb
);

create index email_verification_tokens_app_user_id_idx
    on email_verification_tokens(app_user_id);

create table password_reset_tokens (
    id bigint primary key,
    app_user_id bigint not null,
    token_hash bytea not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by bigint,
    updated_by bigint,
    metadata jsonb not null default '{}'::jsonb
);

create index password_reset_tokens_app_user_id_idx
    on password_reset_tokens(app_user_id);

create table refresh_sessions (
    id bigint primary key,
    app_user_id bigint not null,
    token_hash bytea not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    user_agent text,
    ip_hash bytea,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by bigint,
    updated_by bigint,
    metadata jsonb not null default '{}'::jsonb,
    last_used_at timestamptz
);

create index refresh_sessions_app_user_id_idx
    on refresh_sessions(app_user_id);

create index refresh_sessions_active_user_idx
    on refresh_sessions(app_user_id)
    where revoked_at is null and deleted_at is null;

create table login_rate_limits (
    id bigint primary key,
    key_kind text not null,
    key_hash bytea not null,
    window_started_at timestamptz not null,
    attempts integer not null default 0,
    blocked_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by bigint,
    updated_by bigint,
    metadata jsonb not null default '{}'::jsonb
);

create unique index login_rate_limits_key_window_idx
    on login_rate_limits(key_kind, key_hash, window_started_at)
    where deleted_at is null;

create index login_rate_limits_blocked_until_idx
    on login_rate_limits(blocked_until)
    where blocked_until is not null and deleted_at is null;
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
drop table if exists login_rate_limits;
drop table if exists refresh_sessions;
drop table if exists password_reset_tokens;
drop table if exists email_verification_tokens;
drop table if exists password_credentials;
drop table if exists app_users;
"#,
            )
            .await?;

        Ok(())
    }
}
