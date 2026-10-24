use crate::{
    contracts::{
        AuthorityPreview, AuthorityPreviewInput, AuthorityPreviewReason, AuthorityPreviewStatus,
        AuthoritySuggestion, Category, Channel, Location,
    },
    error::Error,
};
use axum::{extract::State, Json};
use geo::{Contains, Geometry, Point};
use serde::{Deserialize, Serialize};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Authority {
    pub id: String,
    pub name: String,
    pub country_code: String,
    pub categories: Vec<Category>,
    pub boundary: geojson::Geometry,
    pub official_url: String,
    pub source_url: String,
    pub verified_at: String,
    pub expires_at: String,
    pub handles: Handles,
    pub parents: Vec<String>,
    #[serde(default)]
    pub topic_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Handles {
    pub facebook: Option<String>,
    pub instagram: Option<String>,
}

pub fn load(path: &str) -> Result<Vec<Authority>, Error> {
    let bytes = std::fs::read(path).map_err(|_| Error::Internal)?;
    let authorities: Vec<Authority> =
        serde_json::from_slice(&bytes).map_err(|_| Error::Internal)?;
    validate(&authorities)?;
    Ok(authorities)
}

pub fn validate(authorities: &[Authority]) -> Result<(), Error> {
    let mut ids = std::collections::HashSet::new();
    for a in authorities {
        if !ids.insert(&a.id)
            || !a.official_url.starts_with("https://")
            || !a.source_url.starts_with("https://")
            || a.name.contains(['@', '#'])
            || a.country_code.len() != 2
            || a.parents.len() > 5
            || a.topic_tags.len() > 8
            || a.topic_tags.iter().any(|tag| {
                !(2..=81).contains(&tag.len())
                    || !tag.starts_with('#')
                    || !tag[1..].bytes().all(|byte| byte.is_ascii_alphanumeric())
            })
            || OffsetDateTime::parse(&a.verified_at, &Rfc3339).is_err()
            || OffsetDateTime::parse(&a.expires_at, &Rfc3339).is_err()
            || !matches!(
                Geometry::<f64>::try_from(a.boundary.clone()),
                Ok(Geometry::Polygon(_)) | Ok(Geometry::MultiPolygon(_))
            )
        {
            return Err(Error::Invalid("Authority directory is invalid."));
        }
        for handle in [&a.handles.facebook, &a.handles.instagram]
            .into_iter()
            .flatten()
        {
            if handle.is_empty()
                || handle.len() > 100
                || !handle
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_')
            {
                return Err(Error::Invalid("Authority handle is invalid."));
            }
        }
    }
    Ok(())
}

pub fn matches(
    a: &Authority,
    location: &Location,
    category: Category,
    now: OffsetDateTime,
) -> bool {
    let fresh = OffsetDateTime::parse(&a.verified_at, &Rfc3339).is_ok_and(|d| d <= now)
        && OffsetDateTime::parse(&a.expires_at, &Rfc3339).is_ok_and(|d| d > now);
    fresh
        && a.country_code == location.country_code
        && a.categories.contains(&category)
        && Geometry::try_from(a.boundary.clone())
            .is_ok_and(|g| g.contains(&Point::new(location.longitude, location.latitude)))
}

pub fn route<'a>(
    directory: &'a [Authority],
    location: &Location,
    category: Category,
    now: OffsetDateTime,
) -> Vec<&'a Authority> {
    let found: Vec<_> = directory
        .iter()
        .filter(|a| {
            matches(a, location, category, now)
                && !directory.iter().any(|child| child.parents.contains(&a.id))
        })
        .collect();
    if found.len() == 1 {
        found
    } else {
        vec![]
    }
}

pub fn hashtags(authorities: &[&Authority], category: Category) -> Vec<String> {
    let mut tags = vec!["#CivicLens".to_owned(), "#BetterTogether".to_owned()];
    let topics = match category {
        Category::Waste => ["#Litter", "#WasteManagement"],
        Category::Pollution => ["#Pollution", "#Environment"],
        Category::Roads => ["#RoadMaintenance", "#RoadSafety"],
        Category::Water => ["#Water", "#WaterManagement"],
        Category::PublicSafety => ["#PublicSafety", "#CommunitySafety"],
    };
    tags.extend(topics.map(str::to_owned));
    for authority in authorities {
        for tag in &authority.topic_tags {
            if !tags.contains(tag) {
                tags.push(tag.clone());
            }
        }
        let name: String = authority
            .name
            .chars()
            .filter(char::is_ascii_alphanumeric)
            .take(80)
            .collect();
        if !name.is_empty() {
            let tag = format!("#{name}");
            if !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }
    tags
}

pub fn caption(
    report: &crate::contracts::Report,
    description: &str,
    locality: &str,
    authorities: &[&Authority],
    channel: Channel,
) -> String {
    let location = &report.location;
    let tags: Vec<_> = hashtags(authorities, report.category)
        .into_iter()
        .filter(|tag| {
            report
                .hashtags
                .as_ref()
                .is_none_or(|selected| selected.contains(tag))
        })
        .collect();
    let clean = |s: &str| {
        s.chars()
            .filter(|c| !c.is_control() && *c != '@' && *c != '#')
            .collect::<String>()
    };
    let offices = authorities
        .iter()
        .map(|a| {
            let handle = match channel {
                Channel::Facebook => &a.handles.facebook,
                Channel::Instagram => &a.handles.instagram,
                Channel::Whatsapp => &None,
            };
            handle
                .as_ref()
                .map_or_else(|| clean(&a.name), |h| format!("@{h}"))
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!("{}\n\n{}\n\nApproximate location: {:.2}, {:.2} ({})\n\nReported by {} via CivicLens. Community report; awaiting official verification.\nResponsible offices: {}\n\n{}",
        clean(locality), clean(description), location.latitude, location.longitude, location.country_code, report.nickname, offices, tags.join(" ")).trim_end().to_string()
}

pub fn preview_for(
    directory: &[Authority],
    input: &AuthorityPreviewInput,
    now: OffsetDateTime,
) -> Result<AuthorityPreview, Error> {
    let l = &input.location;
    if !l.latitude.is_finite()
        || !l.longitude.is_finite()
        || !(-90.0..=90.0).contains(&l.latitude)
        || !(-180.0..=180.0).contains(&l.longitude)
        || l.country_code.len() != 2
        || !l.country_code.bytes().all(|b| b.is_ascii_uppercase())
        || !(2..=120).contains(&l.locality.trim().len())
    {
        return Err(Error::Invalid(
            "Confirm a valid location before looking up authorities.",
        ));
    }
    let routed = route(directory, l, input.category, now);
    let tags = if routed.is_empty() {
        vec![]
    } else {
        hashtags(&routed, input.category)
    };
    let authorities: Vec<_> = routed
        .into_iter()
        .map(|a| AuthoritySuggestion {
            id: a.id.clone(),
            name: a.name.clone(),
            official_url: a.official_url.clone(),
            source_url: a.source_url.clone(),
            verified_at: a.verified_at.clone(),
            expires_at: a.expires_at.clone(),
            facebook: a.handles.facebook.clone(),
            instagram: a.handles.instagram.clone(),
        })
        .collect();
    let reason = if !authorities.is_empty() {
        None
    } else {
        let country: Vec<_> = directory
            .iter()
            .filter(|a| a.country_code == l.country_code)
            .collect();
        let area: Vec<_> = country
            .iter()
            .filter(|a| {
                Geometry::try_from(a.boundary.clone())
                    .is_ok_and(|g| g.contains(&Point::new(l.longitude, l.latitude)))
            })
            .collect();
        Some(if country.is_empty() {
            AuthorityPreviewReason::CountryNotCovered
        } else if area.is_empty() {
            AuthorityPreviewReason::AreaNotCovered
        } else if !area.iter().any(|a| a.categories.contains(&input.category)) {
            AuthorityPreviewReason::CategoryNotCovered
        } else {
            AuthorityPreviewReason::ReviewRequired
        })
    };
    Ok(AuthorityPreview {
        reason,
        status: if authorities.is_empty() {
            AuthorityPreviewStatus::Unverified
        } else {
            AuthorityPreviewStatus::Matched
        },
        authorities,
        hashtags: Some(tags),
    })
}

pub async fn preview(
    State(state): State<std::sync::Arc<crate::AppState>>,
    _member: crate::auth::Member,
    Json(input): Json<AuthorityPreviewInput>,
) -> Result<Json<AuthorityPreview>, Error> {
    Ok(Json(preview_for(
        &state.authorities,
        &input,
        OffsetDateTime::now_utc(),
    )?))
}

#[cfg(test)]
mod preview_tests {
    use super::*;
    use crate::contracts::{AuthorityPreviewInput, AuthorityPreviewStatus};
    use serde_json::json;

    fn input() -> AuthorityPreviewInput {
        AuthorityPreviewInput {
            category: Category::Waste,
            location: Location {
                latitude: 15.0,
                longitude: 75.0,
                country_code: "IN".into(),
                locality: "Test town".into(),
            },
        }
    }

    fn office() -> Authority {
        serde_json::from_value(json!({"id":"test", "name":"Test Municipality", "countryCode":"IN", "categories":["waste"], "boundary":{"type":"Polygon","coordinates":[[[70,10],[80,10],[80,20],[70,20],[70,10]]]}, "officialUrl":"https://authority.invalid", "sourceUrl":"https://authority.invalid/contact", "verifiedAt":"2026-01-01T00:00:00Z", "expiresAt":"2027-01-01T00:00:00Z", "handles":{"facebook":"TestMunicipality", "instagram":null}, "parents":[]})).unwrap()
    }

    #[test]
    fn preview_exposes_only_unambiguous_fresh_matches_and_verified_handles() {
        let now = OffsetDateTime::parse("2026-10-24T00:00:00Z", &Rfc3339).unwrap();
        let result = preview_for(&[office()], &input(), now).unwrap();
        assert!(matches!(result.status, AuthorityPreviewStatus::Matched));
        assert_eq!(result.authorities[0].name, "Test Municipality");
        assert_eq!(
            result.authorities[0].facebook.as_deref(),
            Some("TestMunicipality")
        );
        assert_eq!(
            result.authorities[0].source_url,
            "https://authority.invalid/contact"
        );
        assert!(result.authorities[0].instagram.is_none());
        let mut expired = office();
        expired.expires_at = "2026-01-02T00:00:00Z".into();
        let mut wrong_country = office();
        wrong_country.country_code = "AU".into();
        let mut wrong_category = office();
        wrong_category.categories = vec![Category::Roads];
        for directory in [
            vec![],
            vec![office(), office()],
            vec![expired],
            vec![wrong_country],
            vec![wrong_category],
        ] {
            let result = preview_for(&directory, &input(), now).unwrap();
            assert!(matches!(result.status, AuthorityPreviewStatus::Unverified));
            assert!(result.authorities.is_empty());
            assert_eq!(result.hashtags, Some(vec![]));
        }
        let mut outside = input();
        outside.location.longitude = 90.0;
        assert!(preview_for(&[office()], &outside, now)
            .unwrap()
            .authorities
            .is_empty());
    }

    #[test]
    fn preview_explains_coverage_without_exposing_unverified_offices() {
        let now = OffsetDateTime::parse("2026-10-24T00:00:00Z", &Rfc3339).unwrap();
        let mut outside = input();
        outside.location.longitude = 90.0;
        let mut unsupported = input();
        unsupported.category = Category::Roads;
        let mut expired = office();
        expired.expires_at = "2026-01-02T00:00:00Z".into();
        for (directory, request, reason) in [
            (vec![], input(), "country_not_covered"),
            (vec![office()], outside, "area_not_covered"),
            (vec![office()], unsupported, "category_not_covered"),
            (vec![expired], input(), "review_required"),
            (vec![office(), office()], input(), "review_required"),
        ] {
            let result =
                serde_json::to_value(preview_for(&directory, &request, now).unwrap()).unwrap();
            assert_eq!(result["reason"], reason);
            assert_eq!(result["authorities"], json!([]));
        }
        let matched =
            serde_json::to_value(preview_for(&[office()], &input(), now).unwrap()).unwrap();
        assert!(matched["reason"].is_null());
    }

    #[test]
    fn shipped_directory_routes_melbourne_waste_only_inside_the_official_boundary() {
        let directory = load(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/data/authorities.json"
        ))
        .unwrap();
        let now = OffsetDateTime::parse("2026-10-24T12:00:00Z", &Rfc3339).unwrap();
        let mut request = input();
        request.location = Location {
            latitude: -37.814,
            longitude: 144.9633,
            country_code: "AU".into(),
            locality: "Melbourne".into(),
        };
        let result = preview_for(&directory, &request, now).unwrap();
        assert_eq!(result.authorities.len(), 1);
        assert_eq!(result.authorities[0].id, "au-vic-melbourne");
        assert_eq!(
            result.authorities[0].facebook.as_deref(),
            Some("cityofmelbourne")
        );
        request.category = Category::PublicSafety;
        assert!(preview_for(&directory, &request, now)
            .unwrap()
            .authorities
            .is_empty());
        request.category = Category::Waste;
        for (latitude, longitude, country) in [
            (-37.867, 144.978, "AU"), // St Kilda is a different municipality.
            (-33.8688, 151.2093, "AU"),
            (37.7749, -122.4194, "US"),
            (12.9716, 77.5946, "IN"),
            (-37.814, 144.9633, "IN"),
        ] {
            request.location.latitude = latitude;
            request.location.longitude = longitude;
            request.location.country_code = country.into();
            assert!(preview_for(&directory, &request, now)
                .unwrap()
                .authorities
                .is_empty());
        }
        request.location.latitude = -37.814;
        request.location.longitude = 144.9633;
        request.location.country_code = "AU".into();
        let after_review = OffsetDateTime::parse("2027-02-01T00:00:00Z", &Rfc3339).unwrap();
        assert!(preview_for(&directory, &request, after_review)
            .unwrap()
            .authorities
            .is_empty());
    }

    #[test]
    fn preview_rejects_invalid_locations() {
        for latitude in [f64::NAN, f64::INFINITY, 91.0, -91.0] {
            let mut bad = input();
            bad.location.latitude = latitude;
            assert!(preview_for(&[], &bad, OffsetDateTime::UNIX_EPOCH).is_err());
        }
        for country in ["", "in", "IND"] {
            let mut bad = input();
            bad.location.country_code = country.into();
            assert!(preview_for(&[], &bad, OffsetDateTime::UNIX_EPOCH).is_err());
        }
        let mut bad = input();
        bad.location.locality = " ".into();
        assert!(preview_for(&[], &bad, OffsetDateTime::UNIX_EPOCH).is_err());
    }
}
