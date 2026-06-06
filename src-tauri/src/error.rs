use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

// Implement Serialize so it can be passed across the Tauri IPC boundary
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        struct ErrorResponse<'a> {
            #[serde(rename = "type")]
            error_type: &'a str,
            message: String,
        }

        let response = match self {
            AppError::Database(e) => ErrorResponse {
                error_type: "database_error",
                message: e.to_string(),
            },
            AppError::NotFound(m) => ErrorResponse {
                error_type: "not_found",
                message: m.to_string(),
            },
            AppError::Validation(m) => ErrorResponse {
                error_type: "validation_error",
                message: m.to_string(),
            },
            AppError::Internal(m) => ErrorResponse {
                error_type: "internal_error",
                message: m.to_string(),
            },
        };

        response.serialize(serializer)
    }
}
