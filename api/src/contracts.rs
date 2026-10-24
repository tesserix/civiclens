use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BrokerConfiguration {
    pub issuer: String,
    pub organization_id: String,
    pub project_id: String,
    pub ios_client_id: String,
    pub android_client_id: String,
    pub google_idp_id: String,
    pub facebook_idp_id: String,
    pub apple_idp_id: String,
}

#[derive(Serialize, Deserialize, TS)]
pub struct PublishingCapabilities {
    pub facebook: bool,
    pub instagram: bool,
    pub whatsapp: bool,
}

#[derive(Serialize, Deserialize, TS)]
pub struct Capabilities {
    pub google: bool,
    pub facebook: bool,
    pub apple: bool,
    pub auth: BrokerConfiguration,
    pub publishing: PublishingCapabilities,
    pub assist: bool,
    #[serde(rename = "authorityPreview")]
    pub authority_preview: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Category {
    Waste,
    Pollution,
    Roads,
    Water,
    PublicSafety,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Facebook,
    Instagram,
    Whatsapp,
}

impl Channel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Facebook => "facebook",
            Self::Instagram => "instagram",
            Self::Whatsapp => "whatsapp",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
    pub country_code: String,
    pub locality: String,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportInput {
    pub category: Category,
    pub description: String,
    pub location: Location,
    pub photo_base64: String,
    pub channels: Vec<Channel>,
    pub consent: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum AssistMode {
    Draft,
    Correct,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssistInput {
    pub mode: AssistMode,
    pub category: Category,
    pub language: String,
    pub text: String,
    pub photo_base64: Option<String>,
}

#[derive(Serialize, Deserialize, TS)]
pub struct AssistSuggestion {
    pub text: String,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuthorityPreviewInput {
    pub category: Category,
    pub location: Location,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum AuthorityPreviewStatus {
    Matched,
    Unverified,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AuthoritySuggestion {
    pub id: String,
    pub name: String,
    pub official_url: String,
    pub source_url: String,
    pub verified_at: String,
    pub expires_at: String,
    pub facebook: Option<String>,
    pub instagram: Option<String>,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum AuthorityPreviewReason {
    CountryNotCovered,
    AreaNotCovered,
    CategoryNotCovered,
    ReviewRequired,
}

#[derive(Deserialize, Serialize, TS)]
pub struct AuthorityPreview {
    pub status: AuthorityPreviewStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reason: Option<AuthorityPreviewReason>,
    pub authorities: Vec<AuthoritySuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub nickname: String,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub token: String,
    pub user: User,
    pub expires_at: String,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LoginInput {
    pub token: String,
    pub challenge_id: String,
    pub nickname: Option<String>,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Challenge {
    pub id: String,
    pub nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum PublicationStatus {
    Queued,
    Sending,
    Published,
    Blocked,
    Failed,
    Uncertain,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Publication {
    pub channel: Channel,
    pub status: PublicationStatus,
    pub provider_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Routing {
    pub status: String,
    pub authority_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub id: String,
    pub nickname: String,
    pub category: Category,
    pub description: String,
    pub location: Location,
    pub created_at: String,
    pub status: String,
    pub routing: Routing,
    pub publications: Vec<Publication>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Approval {
    pub public_description: String,
    pub public_locality: String,
    pub photo_privacy_reviewed: bool,
    pub include_parents: bool,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DeletionRequest {
    pub id: String,
    pub status: String,
    pub requested_at: String,
    pub due_at: String,
    pub owner: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn export_mobile_contract() {
        let definitions = [
            BrokerConfiguration::decl(),
            PublishingCapabilities::decl(),
            Capabilities::decl(),
            Category::decl(),
            Channel::decl(),
            Location::decl(),
            ReportInput::decl(),
            AssistMode::decl(),
            AssistInput::decl(),
            AssistSuggestion::decl(),
            AuthorityPreviewInput::decl(),
            AuthorityPreviewStatus::decl(),
            AuthorityPreviewReason::decl(),
            AuthoritySuggestion::decl(),
            AuthorityPreview::decl(),
            User::decl(),
            Session::decl(),
            LoginInput::decl(),
            Challenge::decl(),
            PublicationStatus::decl(),
            Publication::decl(),
            Routing::decl(),
            Report::decl(),
            Approval::decl(),
            DeletionRequest::decl(),
        ];
        let output = format!(
            "// Generated from Rust. Run cargo test export_mobile_contract.\n{}\n",
            definitions.map(|d| format!("export {d}")).join("\n")
        );
        std::fs::write(
            concat!(env!("CARGO_MANIFEST_DIR"), "/../shared/generated.ts"),
            output,
        )
        .unwrap();
    }
}
