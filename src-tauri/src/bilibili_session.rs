use crate::bilibili_common::{non_empty, now_unix_seconds_or_zero};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const BILIBILI_SESSION_FILE_NAME: &str = "bilibili-session.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliAuthAccount {
    pub mid: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliAuthStatus {
    pub account: Option<BilibiliAuthAccount>,
    pub expires_at: Option<i64>,
    pub is_logged_in: bool,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredBilibiliSession {
    pub avatar_url: Option<String>,
    pub bili_jct: Option<String>,
    pub buvid3: Option<String>,
    pub dede_user_id: Option<String>,
    pub dede_user_id_ck_md5: Option<String>,
    pub expires_at: Option<i64>,
    pub mid: Option<String>,
    pub name: Option<String>,
    pub sess_data: String,
    pub sid: Option<String>,
    pub updated_at: i64,
}

impl StoredBilibiliSession {
    pub fn new(sess_data: String, updated_at: i64) -> Self {
        Self {
            avatar_url: None,
            bili_jct: None,
            buvid3: None,
            dede_user_id: None,
            dede_user_id_ck_md5: None,
            expires_at: None,
            mid: None,
            name: None,
            sess_data,
            sid: None,
            updated_at,
        }
    }

    pub fn is_usable_at(&self, now: i64) -> bool {
        !self.sess_data.trim().is_empty()
            && self
                .expires_at
                .map(|expires_at| expires_at > now)
                .unwrap_or(true)
    }

    pub fn is_usable_now(&self) -> bool {
        self.is_usable_at(now_unix_seconds_or_zero())
    }

    pub fn account(&self) -> Option<BilibiliAuthAccount> {
        let mid = non_empty(self.mid.clone()).or_else(|| non_empty(self.dede_user_id.clone()))?;
        let name = non_empty(self.name.clone()).unwrap_or_else(|| "B 站账号".to_string());

        Some(BilibiliAuthAccount {
            avatar_url: non_empty(self.avatar_url.clone()),
            mid,
            name,
        })
    }

    pub fn write_cookies_to(&self, cookie_store: &mut BTreeMap<String, String>) {
        if !self.sess_data.trim().is_empty() {
            cookie_store.insert("SESSDATA".to_string(), self.sess_data.clone());
        }

        if let Some(value) = non_empty(self.bili_jct.clone()) {
            cookie_store.insert("bili_jct".to_string(), value);
        }

        if let Some(value) = non_empty(self.dede_user_id.clone()) {
            cookie_store.insert("DedeUserID".to_string(), value);
        }

        if let Some(value) = non_empty(self.dede_user_id_ck_md5.clone()) {
            cookie_store.insert("DedeUserID__ckMd5".to_string(), value);
        }

        if let Some(value) = non_empty(self.sid.clone()) {
            cookie_store.insert("sid".to_string(), value);
        }

        if let Some(value) = non_empty(self.buvid3.clone()) {
            cookie_store.insert("buvid3".to_string(), value);
        }
    }

    pub fn apply_account(&mut self, account: BilibiliAuthAccount) {
        self.mid = Some(account.mid);
        self.name = Some(account.name);
        self.avatar_url = account.avatar_url;
        self.updated_at = now_unix_seconds_or_zero();
    }
}

impl BilibiliAuthStatus {
    pub fn from_session(session: Option<&StoredBilibiliSession>) -> Self {
        let Some(session) = session.filter(|session| session.is_usable_now()) else {
            return Self {
                account: None,
                expires_at: None,
                is_logged_in: false,
                updated_at: None,
            };
        };

        Self {
            account: session.account(),
            expires_at: session.expires_at,
            is_logged_in: true,
            updated_at: Some(session.updated_at),
        }
    }
}

fn bilibili_session_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(BILIBILI_SESSION_FILE_NAME))
        .map_err(|error| format!("解析 B 站登录会话目录失败：{error}"))
}

#[cfg(unix)]
fn restrict_session_file_permissions(path: &PathBuf) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions)
        .map_err(|error| format!("设置 B 站登录会话文件权限失败：{error}"))
}

#[cfg(not(unix))]
fn restrict_session_file_permissions(_path: &PathBuf) -> Result<(), String> {
    Ok(())
}

pub fn load_bilibili_session(app: &AppHandle) -> Result<Option<StoredBilibiliSession>, String> {
    let path = bilibili_session_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let session_text =
        fs::read_to_string(&path).map_err(|error| format!("读取 B 站登录会话失败：{error}"))?;
    let session = serde_json::from_str::<StoredBilibiliSession>(&session_text)
        .map_err(|error| format!("解析 B 站登录会话失败：{error}"))?;

    Ok(Some(session))
}

pub fn load_active_bilibili_session(
    app: &AppHandle,
) -> Result<Option<StoredBilibiliSession>, String> {
    Ok(load_bilibili_session(app)?.filter(StoredBilibiliSession::is_usable_now))
}

pub fn save_bilibili_session(
    app: &AppHandle,
    session: &StoredBilibiliSession,
) -> Result<(), String> {
    let path = bilibili_session_path(app)?;
    let Some(directory) = path.parent() else {
        return Err("解析 B 站登录会话目录失败".to_string());
    };

    fs::create_dir_all(directory).map_err(|error| format!("创建 B 站登录会话目录失败：{error}"))?;
    let session_text = serde_json::to_string_pretty(session)
        .map_err(|error| format!("序列化 B 站登录会话失败：{error}"))?;
    let temporary_path = path.with_extension("json.tmp");

    fs::write(&temporary_path, session_text)
        .map_err(|error| format!("写入 B 站登录会话失败：{error}"))?;
    restrict_session_file_permissions(&temporary_path)?;
    fs::rename(&temporary_path, &path)
        .map_err(|error| format!("保存 B 站登录会话失败：{error}"))?;
    restrict_session_file_permissions(&path)?;

    Ok(())
}

pub fn clear_bilibili_session(app: &AppHandle) -> Result<(), String> {
    let path = bilibili_session_path(app)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("清理 B 站登录会话失败：{error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_only_account_summary_in_auth_status() {
        let session = StoredBilibiliSession {
            avatar_url: Some("https://i0.hdslb.com/avatar.jpg".to_string()),
            bili_jct: Some("csrf-secret".to_string()),
            buvid3: Some("buvid-secret".to_string()),
            dede_user_id: Some("123456".to_string()),
            dede_user_id_ck_md5: None,
            expires_at: None,
            mid: Some("123456".to_string()),
            name: Some("测试账号".to_string()),
            sess_data: "sess-secret".to_string(),
            sid: None,
            updated_at: 1_000,
        };

        let status = BilibiliAuthStatus::from_session(Some(&session));

        assert!(status.is_logged_in);
        assert_eq!(
            status.account,
            Some(BilibiliAuthAccount {
                avatar_url: Some("https://i0.hdslb.com/avatar.jpg".to_string()),
                mid: "123456".to_string(),
                name: "测试账号".to_string(),
            })
        );
        assert!(!serde_json::to_string(&status)
            .unwrap()
            .contains("sess-secret"));
        assert!(!serde_json::to_string(&status)
            .unwrap()
            .contains("csrf-secret"));
    }

    #[test]
    fn injects_only_supported_bilibili_cookies() {
        let session = StoredBilibiliSession {
            avatar_url: None,
            bili_jct: Some("csrf".to_string()),
            buvid3: Some("buvid".to_string()),
            dede_user_id: Some("123456".to_string()),
            dede_user_id_ck_md5: Some("ck".to_string()),
            expires_at: None,
            mid: Some("123456".to_string()),
            name: None,
            sess_data: "sess".to_string(),
            sid: Some("sid-value".to_string()),
            updated_at: 1_000,
        };
        let mut cookies = BTreeMap::new();

        session.write_cookies_to(&mut cookies);

        assert_eq!(cookies.get("SESSDATA").map(String::as_str), Some("sess"));
        assert_eq!(cookies.get("bili_jct").map(String::as_str), Some("csrf"));
        assert_eq!(
            cookies.get("DedeUserID").map(String::as_str),
            Some("123456")
        );
        assert_eq!(
            cookies.get("DedeUserID__ckMd5").map(String::as_str),
            Some("ck")
        );
        assert_eq!(cookies.get("sid").map(String::as_str), Some("sid-value"));
        assert_eq!(cookies.get("buvid3").map(String::as_str), Some("buvid"));
    }

    #[test]
    fn treats_expired_session_as_logged_out() {
        let mut session = StoredBilibiliSession::new("sess".to_string(), 1_000);
        session.expires_at = Some(1);

        let status = BilibiliAuthStatus::from_session(Some(&session));

        assert!(!session.is_usable_at(2));
        assert!(!status.is_logged_in);
    }
}
