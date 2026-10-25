use axum::{
    http::header,
    response::{Html, IntoResponse},
};

fn page(html: &'static str) -> impl IntoResponse {
    ([(header::CONTENT_SECURITY_POLICY, "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"),
      (header::REFERRER_POLICY, "no-referrer"), (header::CACHE_CONTROL, "no-transform")], Html(html))
}

pub async fn privacy() -> impl IntoResponse {
    page(include_str!("../public/privacy.html"))
}
pub async fn terms() -> impl IntoResponse {
    page(include_str!("../public/terms.html"))
}
pub async fn deletion() -> impl IntoResponse {
    page(include_str!("../public/account-deletion.html"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn legal_pages_preserve_contact_links_without_edge_html_transforms() {
        for response in [
            privacy().await.into_response(),
            terms().await.into_response(),
            deletion().await.into_response(),
        ] {
            assert_eq!(
                response.headers().get(header::CACHE_CONTROL),
                Some(&"no-transform".parse().unwrap())
            );
            assert!(response
                .headers()
                .contains_key(header::CONTENT_SECURITY_POLICY));
        }
    }
}
