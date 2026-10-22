use crate::error::Error;
use serde::Deserialize;

#[derive(Deserialize, Default)]
#[serde(rename_all = "kebab-case", deny_unknown_fields)]
pub struct Secrets {
    #[serde(rename = "civiclens-database-url")]
    pub database_url: String,
    #[serde(rename = "civiclens-identity-key")]
    pub identity_key: String,
    #[serde(rename = "civiclens-facebook-page-token")]
    pub facebook_page_token: Option<String>,
}

pub struct Config {
    pub secrets: Secrets,
    pub facebook_page_id: Option<String>,
    pub graph_version: String,
    pub allowed_origin: Option<String>,
    pub publishing_enabled: bool,
    pub bind: String,
    pub oidc_issuer: String,
    pub oidc_project_id: String,
    pub oidc_ios_client_id: String,
    pub oidc_android_client_id: String,
    pub google_idp_id: String,
    pub facebook_idp_id: String,
}

impl Config {
    pub fn load() -> Result<Self, Error> {
        Self::from_source(|key| std::env::var(key).ok())
    }

    fn from_source(get: impl Fn(&str) -> Option<String>) -> Result<Self, Error> {
        let production = get("CIVICLENS_ENV").as_deref() == Some("production");
        let secrets = if let Some(path) = get("CIVICLENS_SECRETS_FILE") {
            serde_json::from_slice(&std::fs::read(path).map_err(|_| Error::Internal)?)
                .map_err(|_| Error::Invalid("Invalid secret file."))?
        } else if !production {
            Secrets {
                database_url: get("DATABASE_URL")
                    .ok_or(Error::Invalid("Set DATABASE_URL for local development."))?,
                identity_key: get("CIVICLENS_IDENTITY_KEY")
                    .ok_or(Error::Invalid("Set a 32+ character identity key."))?,
                facebook_page_token: get("CIVICLENS_FACEBOOK_PAGE_TOKEN"),
            }
        } else {
            return Err(Error::Invalid(
                "Production requires an OpenBao-rendered secret file.",
            ));
        };
        if secrets.identity_key.len() < 32 {
            return Err(Error::Invalid(
                "Identity key must be at least 32 characters.",
            ));
        }
        let database_options: sqlx::postgres::PgConnectOptions = secrets
            .database_url
            .parse()
            .map_err(|_| Error::Invalid("Invalid database configuration."))?;
        if production
            && !matches!(
                database_options.get_ssl_mode(),
                sqlx::postgres::PgSslMode::VerifyFull
            )
        {
            return Err(Error::Invalid(
                "Production database requires sslmode=verify-full.",
            ));
        }
        let graph_version = get("CIVICLENS_GRAPH_VERSION").unwrap_or_else(|| "v26.0".into());
        if !graph_version.starts_with('v')
            || !graph_version[1..]
                .bytes()
                .all(|b| b.is_ascii_digit() || b == b'.')
        {
            return Err(Error::Invalid("Invalid Graph API version."));
        }
        Ok(Self {
            secrets,
            facebook_page_id: get("CIVICLENS_FACEBOOK_PAGE_ID").filter(|s| !s.is_empty()),
            graph_version,
            allowed_origin: get("CIVICLENS_WEB_ORIGIN"),
            publishing_enabled: get("CIVICLENS_PUBLISHING_ENABLED").as_deref() == Some("true"),
            bind: get("CIVICLENS_BIND").unwrap_or_else(|| "127.0.0.1:8080".into()),
            oidc_issuer: "https://auth.tesserix.app".into(),
            oidc_project_id: get("CIVICLENS_OIDC_PROJECT_ID").unwrap_or_default(),
            oidc_ios_client_id: get("CIVICLENS_OIDC_IOS_CLIENT_ID").unwrap_or_default(),
            oidc_android_client_id: get("CIVICLENS_OIDC_ANDROID_CLIENT_ID").unwrap_or_default(),
            google_idp_id: get("CIVICLENS_GOOGLE_IDP_ID").unwrap_or_default(),
            facebook_idp_id: get("CIVICLENS_FACEBOOK_IDP_ID").unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn configuration_fails_closed_and_production_requires_verified_tls_and_openbao() {
        let mut vars = std::collections::HashMap::new();
        assert!(Config::from_source(|key| vars.get(key).cloned()).is_err());
        vars.insert("DATABASE_URL", "postgres://localhost/civiclens".to_string());
        assert!(Config::from_source(|key| vars.get(key).cloned()).is_err());
        vars.insert("CIVICLENS_IDENTITY_KEY", "too-short".to_string());
        assert!(Config::from_source(|key| vars.get(key).cloned()).is_err());
        vars.insert(
            "CIVICLENS_IDENTITY_KEY",
            "local-test-identity-key-at-least-32-characters".to_string(),
        );
        let config = Config::from_source(|key| vars.get(key).cloned()).unwrap();
        assert!(!config.publishing_enabled);
        assert_eq!(config.bind, "127.0.0.1:8080");
        vars.insert("CIVICLENS_GRAPH_VERSION", "../../invalid".to_string());
        assert!(Config::from_source(|key| vars.get(key).cloned()).is_err());
        vars.remove("CIVICLENS_GRAPH_VERSION");
        vars.insert("CIVICLENS_ENV", "production".to_string());
        assert!(Config::from_source(|key| vars.get(key).cloned()).is_err());
        let path = std::env::temp_dir().join(format!(
            "civiclens-config-test-{}.json",
            uuid::Uuid::new_v4()
        ));
        vars.insert("CIVICLENS_SECRETS_FILE", path.to_string_lossy().to_string());
        let mut secret = serde_json::json!({"civiclens-database-url":"postgres://localhost/civiclens?sslmode=disable","civiclens-identity-key":"local-test-identity-key-at-least-32-characters"});
        std::fs::write(&path, secret.to_string()).unwrap();
        assert!(Config::from_source(|key| vars.get(key).cloned()).is_err());
        secret["civiclens-database-url"] =
            serde_json::json!("postgres://localhost/civiclens?sslmode=verify-full");
        std::fs::write(&path, secret.to_string()).unwrap();
        assert_eq!(
            Config::from_source(|key| vars.get(key).cloned())
                .unwrap()
                .oidc_issuer,
            "https://auth.tesserix.app"
        );
        std::fs::remove_file(path).unwrap();
    }
}
