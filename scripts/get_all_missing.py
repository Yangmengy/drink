import json
import os
import glob

image_dir = "src-tauri/assets/images/cocktails"
existing_images = set()
if os.path.exists(image_dir):
    existing_images = set(os.listdir(image_dir))

missing = []

for batch_file in glob.glob("scripts/batch_*.json"):
    with open(batch_file, "r") as f:
        data = json.load(f)
        for item in data:
            img_name = item.get("image_url")
            if img_name and img_name not in existing_images:
                missing.append({
                    "name": item.get("name_zh"),
                    "name_en": item.get("name_en"),
                    "image": img_name,
                    "story": item.get("story", "")
                })

with open("scripts/missing_images.json", "w") as f:
    json.dump(missing, f, ensure_ascii=False, indent=2)

print(f"Dumped {len(missing)} missing items to scripts/missing_images.json")
