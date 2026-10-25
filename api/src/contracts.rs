use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const COMMUNITY_RULES_VERSION: &str = "2026-10-25";

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
    #[serde(
        rename = "reporterSharing",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub reporter_sharing: Option<bool>,
    #[serde(
        rename = "communityBlocking",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub community_blocking: Option<bool>,
    #[serde(
        rename = "manualShareChannels",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub manual_share_channels: Option<Vec<Channel>>,
    #[serde(
        rename = "profileEditing",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub profile_editing: Option<bool>,
    #[serde(
        rename = "communityDiscovery",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub community_discovery: Option<bool>,
    #[serde(
        rename = "officialComplaintGateway",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub official_complaint_gateway: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    #[serde(rename = "complaintPreparation")]
    pub complaint_preparation: Option<bool>,
    #[serde(
        rename = "civicParticipation",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub civic_participation: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    #[serde(rename = "manualSharing")]
    pub manual_sharing: Option<bool>,
    pub google: bool,
    pub facebook: bool,
    pub apple: bool,
    pub auth: BrokerConfiguration,
    pub publishing: PublishingCapabilities,
    pub assist: bool,
    #[serde(rename = "assistContext")]
    pub assist_context: bool,
    #[serde(rename = "hashtagSelection")]
    pub hashtag_selection: bool,
    #[serde(rename = "authorityPreview")]
    pub authority_preview: bool,
    #[serde(rename = "maxPhotos", default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub max_photos: Option<u8>,
    #[serde(
        rename = "communityRulesVersion",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub community_rules_version: Option<String>,
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
    Tiktok,
}

impl Channel {
    pub const ALL: [Self; 4] = [
        Self::Facebook,
        Self::Instagram,
        Self::Whatsapp,
        Self::Tiktok,
    ];
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Facebook => "facebook",
            Self::Instagram => "instagram",
            Self::Whatsapp => "whatsapp",
            Self::Tiktok => "tiktok",
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum LocationSource {
    Device,
    Camera,
    Photo,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum SharingMode {
    Managed,
    Manual,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShareRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub community_rules_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reporter_confirmed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub confirmed_photo_count: Option<u8>,
    pub channel: Channel,
    pub identity_acknowledged: bool,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SharePackage {
    pub report_id: String,
    pub channel: Channel,
    pub caption: String,
    pub photos_base64: Vec<String>,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reporter_confirmed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub complaint_requested: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub sharing_mode: Option<SharingMode>,
    pub category: Category,
    pub description: String,
    pub location: Location,
    pub photo_base64: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub additional_photos_base64: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub community_rules_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub location_source: Option<LocationSource>,
    pub channels: Vec<Channel>,
    pub consent: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hashtags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum AssistMode {
    Draft,
    Correct,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum AssistTone {
    Serious,
    Satirical,
    Balanced,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssistPlace {
    pub locality: String,
    pub country_code: String,
}

#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssistInput {
    pub mode: AssistMode,
    pub category: Category,
    pub language: String,
    pub text: String,
    pub photo_base64: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tone: Option<AssistTone>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub place: Option<AssistPlace>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hashtags: Option<Vec<String>>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub complaint_requested: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub sharing_mode: Option<SharingMode>,
    pub id: String,
    pub nickname: String,
    pub category: Category,
    pub description: String,
    pub location: Location,
    pub created_at: String,
    pub status: String,
    pub routing: Routing,
    pub publications: Vec<Publication>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub photo_count: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub location_source: Option<LocationSource>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub community_rules_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hashtags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Approval {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub complaint_description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub complaint_factual_reviewed: Option<bool>,
    pub public_description: String,
    pub public_locality: String,
    pub photo_privacy_reviewed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reviewed_photo_count: Option<u8>,
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
            crate::community_blocks::BlockInput::decl(),
            crate::community_blocks::BlockState::decl(),
            crate::community_blocks::BlockedUser::decl(),
            crate::community_blocks::BlockPage::decl(),
            crate::profile::AccountProfile::decl(),
            crate::profile::ProfileInput::decl(),
            crate::profile::ImportedProfilePhoto::decl(),
            BrokerConfiguration::decl(),
            PublishingCapabilities::decl(),
            Capabilities::decl(),
            Category::decl(),
            Channel::decl(),
            Location::decl(),
            ReportInput::decl(),
            SharingMode::decl(),
            ShareRequest::decl(),
            SharePackage::decl(),
            crate::complaints::ComplaintChannel::decl(),
            crate::complaints::ComplaintOptions::decl(),
            crate::complaints::ComplaintRecord::decl(),
            crate::complaints::ComplaintInput::decl(),
            crate::complaints::ComplaintPackage::decl(),
            crate::official_complaints::OfficialIssue::decl(),
            crate::official_complaints::OfficialBlocker::decl(),
            crate::official_complaints::OfficialReferenceSource::decl(),
            crate::official_complaints::OfficialJurisdiction::decl(),
            crate::official_complaints::OfficialPhotoContract::decl(),
            crate::official_complaints::OfficialProvider::decl(),
            crate::official_complaints::OfficialRouteInput::decl(),
            crate::official_complaints::OfficialResolution::decl(),
            crate::official_complaints::OfficialProviderPage::decl(),
            crate::official_complaints::OfficialJurisdictionPage::decl(),
            crate::official_complaints::OfficialRequestInput::decl(),
            crate::official_complaints::OfficialRequest::decl(),
            crate::official_complaints::OfficialRequestPage::decl(),
            LocationSource::decl(),
            AssistMode::decl(),
            AssistTone::decl(),
            AssistPlace::decl(),
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
            crate::community::CivicKind::decl(),
            crate::community::CivicTopic::decl(),
            crate::community::CivicTopicOption::decl(),
            crate::community::CivicSort::decl(),
            crate::community::CivicFeedState::decl(),
            crate::community::CivicWatchInput::decl(),
            crate::community::CivicWatchState::decl(),
            crate::community_links::CivicShareLink::decl(),
            crate::administrative::AdministrativeUnit::decl(),
            crate::administrative::AdministrativePage::decl(),
            crate::community::CivicAccess::decl(),
            crate::community::CivicCardInput::decl(),
            crate::community::CivicCard::decl(),
            crate::community::CivicCardPage::decl(),
            crate::community::CivicChoice::decl(),
            crate::community::CivicResponseInput::decl(),
            crate::community::CivicResult::decl(),
            crate::community::CivicResults::decl(),
            crate::community::CivicReviewDecision::decl(),
            crate::community::CivicReviewInput::decl(),
            crate::community::CivicOpinionInput::decl(),
            crate::community::CivicOpinion::decl(),
            crate::community::CivicOpinionPage::decl(),
            crate::community::CivicFlagReason::decl(),
            crate::community::CivicFlagInput::decl(),
        ];
        let output = format!(
            "// Generated from Rust. Run cargo test export_mobile_contract.\nexport const communityRulesVersion = \"{COMMUNITY_RULES_VERSION}\";\n{}\n",
            definitions.map(|d| format!("export {d}")).join("\n")
        );
        std::fs::write(
            concat!(env!("CARGO_MANIFEST_DIR"), "/../shared/generated.ts"),
            format!(
                "{output}\nexport const civicTopics = {} as const;\n",
                serde_json::to_string(&crate::community::topic_options()).unwrap()
            ),
        )
        .unwrap();
    }
}
