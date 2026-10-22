use crate::{
    contracts::{Category, Channel, Location},
    error::Error,
};
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
    let mut ids = std::collections::HashSet::new();
    for a in &authorities {
        if !ids.insert(&a.id)
            || !a.official_url.starts_with("https://")
            || !a.source_url.starts_with("https://")
            || a.name.contains(['@', '#'])
            || a.country_code.len() != 2
            || a.parents.len() > 5
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
    Ok(authorities)
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

pub fn caption(
    nickname: &str,
    description: &str,
    locality: &str,
    location: &Location,
    authorities: &[&Authority],
    channel: Channel,
) -> String {
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
    format!("{}\n\n{}\n\nApproximate location: {:.2}, {:.2} ({})\n\nReported by {} via CivicLens. Community report; awaiting official verification.\nResponsible offices: {}\n\n#CivicLens #BetterTogether",
        clean(locality), clean(description), location.latitude, location.longitude, location.country_code, nickname, offices)
}
