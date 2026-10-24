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
    #[serde(rename = "civiclens-ai-gateway-key")]
    pub ai_gateway_key: Option<String>,
}

pub const PRIVATE_AI_GATEWAY: &str =
    "http://civiclens-ai.agentgateway-system.svc.cluster.local:8080";

pub struct Config {
    pub secrets: Secrets,
    pub facebook_page_id: Option<String>,
    pub graph_version: String,
    pub allowed_origin: Option<String>,
    pub publishing_enabled: bool,
    pub bind: String,
    pub oidc_issuer: String,
    pub oidc_project_id: String,
    pub oidc_organization_id: String,
    pub oidc_ios_client_id: String,
    pub oidc_android_client_id: String,
    pub google_idp_id: String,
    pub facebook_idp_id: String,
    pub apple_idp_id: String,
    pub ai_gateway_url: Option<String>,
}

impl Config {
    pub fn ai_gateway(&self) -> Option<(&str, &str)> {
        let key = self
            .secrets
            .ai_gateway_key
            .as_deref()
            .filter(|k| !k.is_empty())?;
        Some((self.ai_gateway_url.as_deref()?, key))
    }

    pub fn assist_configured(&self) -> bool {
        self.ai_gateway().is_some()
    }

    pub fn provider_configured(&self, provider: &str) -> bool {
        let id = match provider {
            "google" => &self.google_idp_id,
            "apple" => &self.apple_idp_id,
            "facebook" => &self.facebook_idp_id,
            _ => return false,
        };
        !id.is_empty()
            && !self.oidc_project_id.is_empty()
            && !self.oidc_organization_id.is_empty()
            && !self.oidc_ios_client_id.is_empty()
            && !self.oidc_android_client_id.is_empty()
    }

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
                ai_gateway_key: get("CIVICLENS_AI_GATEWAY_KEY"),
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
        let ai_gateway_url = get("CIVICLENS_AI_GATEWAY_URL")
            .map(|url| ai_gateway_url(&url, production))
            .transpose()?;
        Ok(Self {
            secrets,
            facebook_page_id: get("CIVICLENS_FACEBOOK_PAGE_ID").filter(|s| !s.is_empty()),
            graph_version,
            allowed_origin: get("CIVICLENS_WEB_ORIGIN"),
            publishing_enabled: get("CIVICLENS_PUBLISHING_ENABLED").as_deref() == Some("true"),
            bind: get("CIVICLENS_BIND").unwrap_or_else(|| "127.0.0.1:8080".into()),
            oidc_issuer: "https://auth.tesserix.app".into(),
            oidc_project_id: get("CIVICLENS_OIDC_PROJECT_ID").unwrap_or_default(),
            oidc_organization_id: get("CIVICLENS_OIDC_ORGANIZATION_ID").unwrap_or_default(),
            oidc_ios_client_id: get("CIVICLENS_OIDC_IOS_CLIENT_ID").unwrap_or_default(),
            oidc_android_client_id: get("CIVICLENS_OIDC_ANDROID_CLIENT_ID").unwrap_or_default(),
            google_idp_id: get("CIVICLENS_GOOGLE_IDP_ID").unwrap_or_default(),
            facebook_idp_id: get("CIVICLENS_FACEBOOK_IDP_ID").unwrap_or_default(),
            apple_idp_id: get("CIVICLENS_APPLE_IDP_ID").unwrap_or_default(),
            ai_gateway_url,
        })
    }
}

// Only the private gateway, or loopback for a local mock; never a caller-chosen host.
fn ai_gateway_url(raw: &str, production: bool) -> Result<String, Error> {
    let invalid = || Error::Invalid("Invalid AI gateway URL.");
    if raw == PRIVATE_AI_GATEWAY {
        return Ok(raw.into());
    }
    let url = reqwest::Url::parse(raw).map_err(|_| invalid())?;
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost"));
    if production
        || url.scheme() != "http"
        || !loopback
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(invalid());
    }
    Ok(raw.trim_end_matches('/').into())
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

    #[test]
    fn ai_gateway_accepts_only_the_private_route_in_production_and_loopback_in_development() {
        let base = [
            ("DATABASE_URL", "postgres://localhost/civiclens"),
            (
                "CIVICLENS_IDENTITY_KEY",
                "local-test-identity-key-at-least-32-characters",
            ),
        ];
        let load = |extra: &[(&str, &str)]| {
            let vars: std::collections::HashMap<_, _> = base.iter().chain(extra).copied().collect();
            Config::from_source(|key| vars.get(key).map(|v| v.to_string()))
        };
        assert!(!load(&[]).unwrap().assist_configured());
        let private = "http://civiclens-ai.agentgateway-system.svc.cluster.local:8080";
        for url in [
            private,
            "http://127.0.0.1:9911",
            "http://localhost:9911/civiclens",
        ] {
            let config = load(&[
                ("CIVICLENS_AI_GATEWAY_URL", url),
                ("CIVICLENS_AI_GATEWAY_KEY", "client-key"),
            ])
            .unwrap();
            assert!(config.assist_configured(), "{url}");
        }
        assert!(!load(&[("CIVICLENS_AI_GATEWAY_URL", private)])
            .unwrap()
            .assist_configured());
        for url in [
            "https://evil.invalid",
            "http://10.0.0.8:8080",
            "http://ai-gateway.agentgateway-system.svc.cluster.local:8080/civiclens",
            "http://127.0.0.1.evil.invalid",
            "http://localhost:9911?key=x",
            "",
        ] {
            assert!(load(&[("CIVICLENS_AI_GATEWAY_URL", url)]).is_err(), "{url}");
        }
        let production = [("CIVICLENS_ENV", "production")];
        let path =
            std::env::temp_dir().join(format!("civiclens-ai-test-{}.json", uuid::Uuid::new_v4()));
        std::fs::write(&path, serde_json::json!({"civiclens-database-url":"postgres://localhost/civiclens?sslmode=verify-full","civiclens-identity-key":"local-test-identity-key-at-least-32-characters","civiclens-ai-gateway-key":"client-key"}).to_string()).unwrap();
        let file = path.to_string_lossy().to_string();
        let secrets = ("CIVICLENS_SECRETS_FILE", file.as_str());
        assert!(load(&[
            production[0],
            secrets,
            ("CIVICLENS_AI_GATEWAY_URL", "http://127.0.0.1:9911")
        ])
        .is_err());
        assert!(load(&[
            production[0],
            secrets,
            ("CIVICLENS_AI_GATEWAY_URL", private)
        ])
        .unwrap()
        .assist_configured());
        std::fs::remove_file(path).unwrap();
    }
}
