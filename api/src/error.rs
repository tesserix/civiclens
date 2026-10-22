use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid input")]
    Invalid(&'static str),
    #[error("authentication required")]
    Unauthorized,
    #[error("action forbidden")]
    Forbidden,
    #[error("object not found")]
    NotFound,
    #[error("conflict")]
    Conflict(&'static str),
    #[error("dependency unavailable")]
    Unavailable,
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("internal error")]
    Internal,
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            Self::Invalid(message) => (StatusCode::BAD_REQUEST, "INVALID_INPUT", message),
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "Please sign in again.",
            ),
            Self::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "This action requires a different role.",
            ),
            Self::NotFound => (StatusCode::NOT_FOUND, "NOT_FOUND", "Report not found."),
            Self::Conflict(message) => (StatusCode::CONFLICT, "CONFLICT", message),
            Self::Unavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "UNAVAILABLE",
                "This service is not configured or is temporarily unavailable.",
            ),
            Self::Database(_) | Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL",
                "The request could not be completed.",
            ),
        };
        (status, Json(json!({ "code": code, "message": message, "request_id": uuid::Uuid::new_v4().to_string() }))).into_response()
    }
}
