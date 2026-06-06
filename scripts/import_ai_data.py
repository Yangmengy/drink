import json
import sqlite3
import uuid
import time
import os
import argparse

def get_db_path():
    # Attempt to locate the cocktail-app database in standard app data dirs
    import platform
    home = os.path.expanduser("~")
    system = platform.system()
    
    if system == "Darwin":
        return os.path.join(home, "Library", "Application Support", "cocktail-app", "cocktail.db")
    elif system == "Windows":
        return os.path.join(os.getenv("APPDATA", ""), "com.cocktail.app", "cocktail.db")
    else:
        return os.path.join(home, ".local", "share", "com.cocktail.app", "cocktail.db")

def import_data(json_file, db_path=None):
    if not db_path:
        db_path = get_db_path()
        # Fallback to local test DB if not exists
        if not os.path.exists(db_path):
            local_db = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "cocktail.db")
            if os.path.exists(local_db):
                db_path = local_db
            else:
                print(f"Warning: DB not found at {db_path}. A new one will be created.")

    print(f"Using database: {db_path}")
    
    # 确保数据库所在的目录存在
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    current_time = int(time.time())
    
    for item in data:
        recipe_id = item.get('id', str(uuid.uuid4()))
        
        # Insert recipe
        cursor.execute('''
            INSERT OR REPLACE INTO recipes (
                id, name_zh, name_en, category, description, story, method, color, 
                tags, flavor_profile, occasion, season, mood, origin, year_created, 
                creator, variations, pairing, image_url, glass_type, ice_type, 
                garnish, abv, difficulty, prep_time, source, is_iba, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            recipe_id,
            item.get('name_zh'),
            item.get('name_en'),
            item.get('category', 'classic'),
            item.get('description'),
            item.get('story'),
            item.get('method'),
            item.get('color'),
            json.dumps(item.get('tags', [])) if item.get('tags') else None,
            json.dumps(item.get('flavor_profile')) if item.get('flavor_profile') else None,
            json.dumps(item.get('occasion', [])) if item.get('occasion') else None,
            json.dumps(item.get('season', [])) if item.get('season') else None,
            json.dumps(item.get('mood', [])) if item.get('mood') else None,
            item.get('origin'),
            item.get('year_created'),
            item.get('creator'),
            json.dumps(item.get('variations', [])) if item.get('variations') else None,
            json.dumps(item.get('pairing')) if item.get('pairing') else None,
            item.get('image_url'),
            item.get('glass_type'),
            item.get('ice_type'),
            item.get('garnish'),
            item.get('abv'),
            item.get('difficulty', 3),
            item.get('prep_time', 5),
            item.get('source', 'AI Generated'),
            1 if item.get('is_iba') else 0,
            current_time,
            current_time
        ))
        
        # Insert steps
        steps = item.get('steps', [])
        for step in steps:
            step_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT OR IGNORE INTO recipe_steps (id, recipe_id, step_number, instruction, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (step_id, recipe_id, step.get('step_number'), step.get('instruction'), current_time))
            
        # Insert ingredients
        ingredients = item.get('ingredients', [])
        for idx, ing in enumerate(ingredients):
            ing_name = ing.get('name_zh')
            # Look up ingredient by name
            cursor.execute("SELECT id FROM ingredients WHERE name_zh = ?", (ing_name,))
            row = cursor.fetchone()
            if row:
                ing_id = row[0]
            else:
                ing_id = "ing-" + str(uuid.uuid4())[:12]
                cursor.execute('''
                    INSERT INTO ingredients (id, name_zh, name_en, category, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (ing_id, ing_name, ing.get('name_en'), 'mixer', current_time, current_time))
            
            link_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT OR IGNORE INTO recipe_ingredients (id, recipe_id, ingredient_id, amount, unit, is_optional, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (link_id, recipe_id, ing_id, ing.get('amount'), ing.get('unit'), 1 if ing.get('is_optional') else 0, idx + 1, current_time))
            
    conn.commit()
    conn.close()
    print(f"Successfully imported {len(data)} recipes.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import AI generated cocktails into SQLite DB")
    parser.add_argument("--input", required=True, help="Path to the JSON file")
    parser.add_argument("--db", help="Path to SQLite DB (optional)")
    args = parser.parse_args()
    
    import_data(args.input, args.db)
