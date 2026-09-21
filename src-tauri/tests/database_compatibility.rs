use cocktail_app_lib::{db, menu, models::MenuQuery, settings};
use sqlx::{sqlite::SqlitePoolOptions, Row, SqlitePool};

async fn empty() -> SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap()
}

async fn snapshot(pool: &SqlitePool) -> Vec<(String, String)> {
    sqlx::query_as("SELECT name, COALESCE(sql, '') FROM sqlite_master ORDER BY name")
        .fetch_all(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn fresh_database_only_creates_the_personal_core() {
    let pool = empty().await;
    db::initialize(&pool).await.unwrap();
    let tables: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(
        tables,
        vec![
            "agent_traces",
            "companion_settings",
            "core_migrations",
            "ingredients",
            "recipe_ingredients",
            "recipe_steps",
            "recipes",
            "user_inventory",
        ]
    );
    let columns = sqlx::query("PRAGMA table_info(recipes)")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(columns.len(), 11);
    for retired in [
        "is_favorite",
        "view_count",
        "synced_at",
        "mood",
        "occasion",
        "difficulty",
    ] {
        assert!(!columns
            .iter()
            .any(|r| r.get::<String, _>("name") == retired));
    }
    assert_eq!(
        menu::search(&pool, &MenuQuery::default())
            .await
            .unwrap()
            .len(),
        83
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM core_migrations")
            .fetch_one(&pool)
            .await
            .unwrap(),
        db::SCHEMA_VERSION
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM ingredients WHERE name_key IS NULL OR name_key=''"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        0
    );
    for index in [
        "uq_user_inventory_ingredient_id",
        "uq_recipe_ingredients_recipe_ingredient",
        "uq_recipe_steps_recipe_step_number",
        "uq_ingredients_name_key",
    ] {
        let present: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?",
        )
        .bind(index)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(present, 1, "{index} should exist");
    }
    assert!(sqlx::query("PRAGMA foreign_key_check")
        .fetch_all(&pool)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn original_and_expanded_legacy_schemas_preserve_user_data() {
    for expanded in [false, true] {
        let pool = empty().await;
        sqlx::raw_sql(include_str!("legacy_schema.sql"))
            .execute(&pool)
            .await
            .unwrap();
        if expanded {
            sqlx::raw_sql(
                "ALTER TABLE recipes ADD COLUMN flavor_sweet INTEGER DEFAULT 3;
                 ALTER TABLE recipes ADD COLUMN flavor_sour INTEGER DEFAULT 3;
                 ALTER TABLE recipes ADD COLUMN flavor_bitter INTEGER DEFAULT 3;
                 ALTER TABLE recipes ADD COLUMN flavor_strong INTEGER DEFAULT 3;
                 ALTER TABLE recipes ADD COLUMN base_spirit TEXT;
                 ALTER TABLE recipes ADD COLUMN has_ice INTEGER DEFAULT 1;
                 ALTER TABLE recipes ADD COLUMN has_sparkling INTEGER DEFAULT 0;",
            )
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::raw_sql(
            "INSERT INTO recipes (id,name_zh,category,source,story,is_favorite,created_at,updated_at) VALUES ('my-drink','我的特调','自创','custom','旧故事',1,1,1);
             INSERT INTO ingredients (id,name_zh,category,created_at,updated_at) VALUES ('my-fruit','我的水果','other',1,1);
             INSERT INTO recipe_ingredients (id,recipe_id,ingredient_id,amount,unit,is_optional,created_at) VALUES ('my-link','my-drink','my-fruit',30,'ml',0,1);
             INSERT INTO recipe_steps (id,recipe_id,step_number,instruction,created_at) VALUES ('my-step','my-drink',1,'搅拌',1);
             INSERT INTO user_inventory (id,ingredient_id,amount,unit,added_at,updated_at) VALUES ('my-stock','my-fruit',100,'ml',1,1);
             INSERT INTO drink_logs (id,recipe_id,date_str,notes,created_at) VALUES ('old-log','my-drink','2026-01-01','留作纪念',1);
             UPDATE user_profile SET username='本地用户',llm_model='personal-model',llm_base_url='https://example.com/v1' WHERE id=1;",
        ).execute(&pool).await.unwrap();
        db::initialize(&pool).await.unwrap();
        db::initialize(&pool).await.unwrap();
        let recipe = menu::get(&pool, "my-drink").await.unwrap();
        assert!(recipe.can_make);
        assert_eq!(recipe.steps, vec!["搅拌"]);
        assert_eq!(recipe.ingredients[0].amount, Some(30.0));
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT story FROM recipes WHERE id='my-drink'")
                .fetch_one(&pool)
                .await
                .unwrap(),
            "旧故事"
        );
        assert_eq!(
            sqlx::query_scalar::<_, f64>("SELECT amount FROM user_inventory WHERE id='my-stock'")
                .fetch_one(&pool)
                .await
                .unwrap(),
            100.0
        );
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT notes FROM drink_logs WHERE id='old-log'")
                .fetch_one(&pool)
                .await
                .unwrap(),
            "留作纪念"
        );
        assert_eq!(
            sqlx::query("PRAGMA table_info(recipes)")
                .fetch_all(&pool)
                .await
                .unwrap()
                .len(),
            if expanded { 40 } else { 33 }
        );
        let dir = tempfile::tempdir().unwrap();
        let profile = settings::get(&pool, dir.path()).await.unwrap();
        assert_eq!(profile.name, "本地用户");
        assert_eq!(profile.model, "personal-model");
        assert_eq!(profile.base_url, "https://example.com/v1");
        assert!(sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty());
    }
}

#[tokio::test]
async fn version_one_upgrade_preserves_settings_traces_and_historical_fts() {
    let pool = empty().await;
    sqlx::raw_sql(include_str!("legacy_schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../data/schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../data/seed.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(
        "INSERT INTO core_migrations VALUES (1,1);
         INSERT INTO companion_settings (id,name,preferences,model) VALUES (1,'新昵称','不太甜','chosen-model');
         INSERT INTO agent_traces VALUES ('old-trace',1,10,'ok','[]',NULL);",
    ).execute(&pool).await.unwrap();
    let fts_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipes_fts")
        .fetch_one(&pool)
        .await
        .unwrap();
    db::initialize(&pool).await.unwrap();
    db::initialize(&pool).await.unwrap();
    let dir = tempfile::tempdir().unwrap();
    let profile = settings::get(&pool, dir.path()).await.unwrap();
    assert_eq!(profile.name, "新昵称");
    assert_eq!(profile.preferences, "不太甜");
    assert_eq!(profile.model, "chosen-model");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM agent_traces WHERE id='old-trace'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM recipes_fts")
            .fetch_one(&pool)
            .await
            .unwrap(),
        fts_count
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'recipes_fts_%'"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM core_migrations")
            .fetch_one(&pool)
            .await
            .unwrap(),
        3
    );
}

#[tokio::test]
async fn version_two_upgrade_normalizes_duplicate_relationship_rows() {
    let pool = empty().await;
    sqlx::raw_sql(include_str!("legacy_schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../data/schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("../data/seed.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(
        "INSERT INTO core_migrations VALUES (1,1),(2,1);
         INSERT INTO companion_settings (id) VALUES (1);
         INSERT INTO recipes (id,name_zh,category,source,created_at,updated_at) VALUES
          ('constraint-drink','约束迁移特调','自创','custom',1,1),
          ('constraint-exact','去重迁移特调','自创','custom',1,1),
          ('constraint-alias','别名迁移特调','自创','custom',1,1);
         INSERT INTO ingredients (id,name_zh,category,created_at,updated_at) VALUES
          ('a-gin','Legacy GIN','spirit',1,1),
          ('z-gin',' legacy gin ','mixer',2,2),
          ('exact-ingredient','Exact Ingredient','other',1,1);
         INSERT INTO recipe_ingredients
          (id,recipe_id,ingredient_id,amount,unit,is_optional,display_order,created_at) VALUES
          ('canonical-link','constraint-drink','a-gin',30,'ml',0,2,1),
          ('duplicate-link','constraint-drink','z-gin',45,'ml',0,1,1),
          ('exact-first','constraint-exact','exact-ingredient',10,'ml',0,1,1),
          ('exact-second','constraint-exact','exact-ingredient',20,'ml',0,2,1),
          ('alias-canonical','constraint-alias','a-gin',15,'ml',0,1,1),
          ('alias-duplicate','constraint-alias','z-gin',25,'ml',0,2,1);
         INSERT INTO recipe_steps (id,recipe_id,step_number,instruction,created_at) VALUES
          ('old-first','constraint-drink',1,'保留旧行',1),
          ('new-first','constraint-drink',1,'删除重复行',2),
          ('second','constraint-drink',2,'第二步',3);
         INSERT INTO user_inventory (id,ingredient_id,amount,unit,added_at,updated_at) VALUES
          ('old-stock','a-gin',5,'ml',1,1),
          ('new-stock','z-gin',9,'ml',2,3);",
    )
    .execute(&pool)
    .await
    .unwrap();

    db::initialize(&pool).await.unwrap();
    db::initialize(&pool).await.unwrap();

    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT version FROM core_migrations ORDER BY version")
            .fetch_all(&pool)
            .await
            .unwrap(),
        vec![1, 2, 3]
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT name_key FROM ingredients WHERE id='a-gin'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        "legacy gin"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM ingredients WHERE id='z-gin'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    let stock: (String, String, f64) = sqlx::query_as(
        "SELECT ingredient_id,id,amount FROM user_inventory WHERE ingredient_id='a-gin'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(stock, ("a-gin".into(), "new-stock".into(), 9.0));
    let link: (String, String, f64) = sqlx::query_as(
        "SELECT ingredient_id,id,amount FROM recipe_ingredients WHERE recipe_id='constraint-drink'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(link, ("a-gin".into(), "duplicate-link".into(), 45.0));
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id='constraint-alias'"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id='constraint-exact'"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );
    let steps: Vec<(i32, String)> = sqlx::query_as(
        "SELECT step_number,instruction FROM recipe_steps WHERE recipe_id='constraint-drink' ORDER BY step_number",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(steps, vec![(1, "保留旧行".into()), (2, "第二步".into())]);
    assert!(sqlx::query("PRAGMA foreign_key_check")
        .fetch_all(&pool)
        .await
        .unwrap()
        .is_empty());

    assert!(sqlx::query(
        "INSERT INTO user_inventory (id,ingredient_id,added_at,updated_at) VALUES ('duplicate-stock','a-gin',1,1)"
    )
    .execute(&pool)
    .await
    .is_err());
    assert!(sqlx::query(
        "INSERT INTO recipe_ingredients (id,recipe_id,ingredient_id,amount,unit,created_at) VALUES ('duplicate-link-2','constraint-drink','a-gin',1,'ml',1)"
    )
    .execute(&pool)
    .await
    .is_err());
    assert!(sqlx::query(
        "INSERT INTO recipe_steps (id,recipe_id,step_number,instruction,created_at) VALUES ('duplicate-step','constraint-drink',1,'重复步骤',1)"
    )
    .execute(&pool)
    .await
    .is_err());
    assert!(sqlx::query(
        "INSERT INTO ingredients (id,name_zh,name_key,category,created_at,updated_at) VALUES ('duplicate-gin','Another Legacy Gin','legacy gin','spirit',1,1)"
    )
    .execute(&pool)
    .await
    .is_err());
}

#[tokio::test]
async fn future_and_incomplete_databases_are_rejected_without_writes() {
    for mutation in [
        "INSERT INTO core_migrations VALUES (99,1)",
        "ALTER TABLE recipes RENAME COLUMN name_zh TO unsupported_name",
        "DROP TABLE recipe_steps",
        "DELETE FROM core_migrations WHERE version=1",
        "DELETE FROM companion_settings",
    ] {
        let pool = empty().await;
        db::initialize(&pool).await.unwrap();
        sqlx::query(mutation).execute(&pool).await.unwrap();
        let before = snapshot(&pool).await;
        let versions: Vec<i64> =
            sqlx::query_scalar("SELECT version FROM core_migrations ORDER BY version")
                .fetch_all(&pool)
                .await
                .unwrap();
        let error = db::initialize(&pool).await.unwrap_err().to_string();
        assert!(error.contains("未执行迁移"), "{error}");
        assert_eq!(snapshot(&pool).await, before);
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT version FROM core_migrations ORDER BY version")
                .fetch_all(&pool)
                .await
                .unwrap(),
            versions
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM recipes")
                .fetch_one(&pool)
                .await
                .unwrap(),
            83
        );
    }
    let unrelated = empty().await;
    sqlx::query("CREATE TABLE personal_notes (text TEXT)")
        .execute(&unrelated)
        .await
        .unwrap();
    let before = snapshot(&unrelated).await;
    assert!(db::initialize(&unrelated).await.is_err());
    assert_eq!(snapshot(&unrelated).await, before);
}

#[tokio::test]
async fn seed_failure_rolls_back_all_schema_and_data_changes() {
    let pool = empty().await;
    sqlx::raw_sql(include_str!("legacy_schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("CREATE TRIGGER reject_seed BEFORE INSERT ON recipe_steps BEGIN SELECT RAISE(ABORT,'simulated seed failure'); END;").execute(&pool).await.unwrap();
    let before = snapshot(&pool).await;
    assert!(db::initialize(&pool).await.is_err());
    assert_eq!(snapshot(&pool).await, before);
    for table in [
        "recipes",
        "ingredients",
        "recipe_ingredients",
        "recipe_steps",
        "recipes_fts",
    ] {
        assert_eq!(
            sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_one(&pool)
                .await
                .unwrap(),
            0
        );
    }
}
