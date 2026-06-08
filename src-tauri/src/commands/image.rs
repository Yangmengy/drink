use std::path::PathBuf;
use std::fs;
use base64::{Engine as _, engine::general_purpose};

/// 获取 Android 兼容的基础路径（与数据库使用相同逻辑）
fn get_base_path() -> PathBuf {
    if cfg!(target_os = "android") {
        // Android: 使用内部缓存目录，不需要额外权限
        std::env::var("HOME")
            .or_else(|_| std::env::var("TMPDIR"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/data/local/tmp"))
    } else {
        // 桌面平台
        dirs::data_dir().unwrap_or_else(|| PathBuf::from("."))
    }
}

#[tauri::command]
pub async fn get_image_url(image_name: String) -> Result<String, String> {
    // 简化路径：cocktail-app/images/ 而不是 cocktail-app/assets/images/cocktails/
    let mut path = get_base_path();
    path.push("cocktail-app");
    path.push("images");
    path.push(&image_name);
    
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(format!("Image not found: {}", image_name))
    }
}

#[tauri::command]
pub async fn upload_image(base64_data: String) -> Result<String, String> {
    // 简化路径：只使用 cocktail-app/images/
    let mut path = get_base_path();
    path.push("cocktail-app");
    
    // 先确保 cocktail-app 目录存在
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| {
            format!("Failed to create app directory: {}", e)
        })?;
    }
    
    path.push("images");
    
    // 确保 images 目录存在
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| {
            format!("Failed to create images directory: {}", e)
        })?;
    }
    
    // 生成唯一文件名
    let image_name = format!("custom_{}.png", uuid::Uuid::new_v4());
    path.push(&image_name);
    
    // 处理 base64 数据
    let b64_str = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };
    
    // 解码
    let image_bytes = general_purpose::STANDARD
        .decode(b64_str)
        .map_err(|e| format!("Invalid base64: {}", e))?;
    
    // 写入文件
    fs::write(&path, image_bytes).map_err(|e| {
        format!("Failed to write image file: {}", e)
    })?;
    
    Ok(image_name)
}
