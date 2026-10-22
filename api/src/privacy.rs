use axum::{
    http::header,
    response::{Html, IntoResponse},
};

fn page(html: &'static str) -> impl IntoResponse {
    ([(header::CONTENT_SECURITY_POLICY, "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"),
      (header::REFERRER_POLICY, "no-referrer")], Html(html))
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
