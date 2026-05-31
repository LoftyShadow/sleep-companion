use std::future::Future;

pub trait MailSender: Send + Sync {
    fn send_email_verification(
        &self,
        message: EmailVerificationMessage,
    ) -> impl Future<Output = Result<(), MailError>> + Send;

    fn send_password_reset(
        &self,
        message: PasswordResetMessage,
    ) -> impl Future<Output = Result<(), MailError>> + Send;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailVerificationMessage {
    pub recipient_email: String,
    pub verification_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PasswordResetMessage {
    pub recipient_email: String,
    pub reset_url: String,
}

#[derive(Debug, thiserror::Error)]
pub enum MailError {
    #[error("邮件发送失败")]
    DeliveryFailed,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NoopMailSender;

impl MailSender for NoopMailSender {
    async fn send_email_verification(
        &self,
        _message: EmailVerificationMessage,
    ) -> Result<(), MailError> {
        Ok(())
    }

    async fn send_password_reset(&self, _message: PasswordResetMessage) -> Result<(), MailError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn noop_sender_accepts_email_messages() {
        let sender = NoopMailSender;

        sender
            .send_email_verification(EmailVerificationMessage {
                recipient_email: "reader@example.com".to_string(),
                verification_url: "https://example.com/verify?token=secret".to_string(),
            })
            .await
            .unwrap();

        sender
            .send_password_reset(PasswordResetMessage {
                recipient_email: "reader@example.com".to_string(),
                reset_url: "https://example.com/reset?token=secret".to_string(),
            })
            .await
            .unwrap();
    }
}
