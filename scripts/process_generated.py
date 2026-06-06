import os
import glob
import json
import shutil

artifact_dir = "/Users/yangmengying/.gemini/antigravity-ide/brain/83efbad1-e293-40db-b4ee-ccdbfb17793a"
target_dir = "src-tauri/assets/images/cocktails"

with open("scripts/missing_images.json", "r") as f:
    missing = json.load(f)

remaining = []
moved_count = 0

for item in missing:
    base_name = os.path.splitext(item['image'])[0]
    pattern = os.path.join(artifact_dir, f"{base_name}_*.png")
    matches = glob.glob(pattern)
    if matches:
        latest = sorted(matches, key=os.path.getmtime)[-1]
        dest = os.path.join(target_dir, item['image'])
        shutil.copy2(latest, dest)
        moved_count += 1
    else:
        remaining.append(item)

with open("scripts/missing_images.json", "w") as f:
    json.dump(remaining, f, ensure_ascii=False, indent=2)

print(f"Moved {moved_count} images. {len(remaining)} images remaining.")
if remaining:
    print(json.dumps(remaining[:10], ensure_ascii=False, indent=2))
