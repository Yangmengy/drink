use std::path::PathBuf;
use std::fs;
use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
pub async fn get_image_url(image_name: String) -> Result<String, String> {
    // Return absolute path to image in the app's local data directory
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    path.push("assets");
    path.push("images");
    path.push("cocktails");
    path.push(&image_name);
    
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(format!("Image not found: {}", image_name))
    }
}

#[tauri::command]
pub async fn upload_image(base64_data: String) -> Result<String, String> {
    // Determine target directory
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    path.push("assets");
    path.push("images");
    path.push("cocktails");
    
    // Ensure directory exists
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    
    // Generate a unique file name
    let image_name = format!("custom_{}.png", uuid::Uuid::new_v4());
    path.push(&image_name);
    
    // Strip header if present (e.g., data:image/png;base64,...)
    let b64_str = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };
    
    // Decode and save
    let image_bytes = general_purpose::STANDARD
        .decode(b64_str)
        .map_err(|e| format!("Invalid base64: {}", e))?;
        
    fs::write(&path, image_bytes).map_err(|e| e.to_string())?;
    
    Ok(image_name)
}
