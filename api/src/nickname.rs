use crate::error::Error;

pub fn choose(requested: Option<&str>) -> Result<String, Error> {
    let requested = requested.unwrap_or_default().trim();
    if requested.is_empty() {
        return Ok(format!(
            "kind-otter-{}",
            hex::encode(rand::random::<[u8; 6]>())
        ));
    }
    if !(3..=30).contains(&requested.len())
        || !requested.as_bytes()[0].is_ascii_alphabetic()
        || !requested
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(Error::Invalid(
            "Use 3–30 letters, numbers, underscores or dashes; start with a letter.",
        ));
    }
    Ok(requested.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn assigns_a_unique_nickname_when_blank() {
        let first = super::choose(None).unwrap();
        let second = super::choose(Some("  ")).unwrap();
        assert!(first.starts_with("kind-otter-"));
        assert_ne!(first, second);
    }
}
