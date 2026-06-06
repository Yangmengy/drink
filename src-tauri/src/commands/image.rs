use std::path::PathBuf;

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
