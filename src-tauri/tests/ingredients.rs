use cocktail_app_lib::{db, menu, models::*};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    db::initialize(&pool).await.unwrap();
    pool
}

fn input(name: &str, category: &str, owned: bool) -> NewIngredientInput {
    NewIngredientInput {
        name: name.into(),
        category: category.into(),
        owned,
    }
}

fn recipe(ingredient: &str) -> RecipeInput {
    RecipeInput {
        id: None,
        name: "原料联动测试特调".into(),
        description: "用于验证添加原料与菜单召回".into(),
        method: "直调".into(),
        flavor: Flavor::default(),
        ingredients: vec![IngredientInput {
            name: ingredient.into(),
            amount: 30.0,
            unit: "ml".into(),
            optional: false,
        }],
        steps: vec!["加冰搅拌".into()],
    }
}

async fn counts(pool: &SqlitePool) -> (i64, i64) {
    sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM ingredients), (SELECT COUNT(*) FROM user_inventory)",
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn add_ingredient_accepts_categories_and_defaults_to_owned() {
    let pool = database().await;
    for category in [
        "spirits", "liqueur", "juice", "syrup", "herb", "mixer", "dairy", "fruit", "other",
    ] {
        let value = serde_json::json!({
            "name": format!("  测试原料-{category}  "),
            "category": category,
        });
        let request: NewIngredientInput = serde_json::from_value(value).unwrap();
        assert!(request.owned);
        let result = menu::add_ingredient(&pool, &request).await.unwrap();
        assert!(result.created);
        assert!(result.ingredient.owned);
        assert_eq!(result.ingredient.name, format!("测试原料-{category}"));
        assert_eq!(result.ingredient.category, category);
        assert!(menu::inventory(&pool)
            .await
            .unwrap()
            .iter()
            .any(|ingredient| ingredient.id == result.ingredient.id && ingredient.owned));
    }
    let result = menu::add_ingredient(&pool, &input(&"原".repeat(80), "other", false))
        .await
        .unwrap();
    assert_eq!(result.ingredient.name.chars().count(), 80);
    assert!(!result.ingredient.owned);
}

#[tokio::test]
async fn invalid_ingredient_input_does_not_write_to_either_table() {
    let pool = database().await;
    let before = counts(&pool).await;
    for request in [
        input("", "other", true),
        input(" \t\n\u{3000}", "other", true),
        input(&"原".repeat(81), "other", true),
        input("测试原料", "", true),
        input("测试原料", "invalid-category", true),
        input("测试原料", "Spirit", true),
    ] {
        assert!(menu::add_ingredient(&pool, &request).await.is_err());
        assert_eq!(counts(&pool).await, before);
    }
}

#[tokio::test]
async fn normalized_duplicates_reuse_the_id_category_and_owned_state() {
    let pool = database().await;
    let before = counts(&pool).await;
    let first = menu::add_ingredient(&pool, &input("\t Crème Bitter \u{3000}", "liqueur", false))
        .await
        .unwrap();
    assert!(first.created);
    assert!(!first.ingredient.owned);
    assert_eq!(first.ingredient.name, "Crème Bitter");
    for owned in [true, false, true] {
        let repeated = menu::add_ingredient(&pool, &input(" crÈME bITTER \n", "other", owned))
            .await
            .unwrap();
        assert!(!repeated.created);
        assert_eq!(repeated.ingredient.id, first.ingredient.id);
        assert_eq!(repeated.ingredient.category, "liqueur");
        assert!(repeated.ingredient.owned);
    }
    assert_eq!(counts(&pool).await, (before.0 + 1, before.1 + 1));
}

#[tokio::test]
async fn adding_a_legacy_ingredient_preserves_existing_inventory_fields() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("legacy_schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql(
        "INSERT INTO ingredients (id,name_zh,category,created_at,updated_at) VALUES ('old-gin',' Legacy GIN ','spirit',1,1);
         INSERT INTO user_inventory (id,ingredient_id,amount,unit,added_at,updated_at) VALUES ('old-stock','old-gin',23,'ml',1,1);",
    )
    .execute(&pool)
    .await
    .unwrap();
    db::initialize(&pool).await.unwrap();
    for owned in [false, true] {
        let result = menu::add_ingredient(&pool, &input("legacy gin", "mixer", owned))
            .await
            .unwrap();
        assert!(!result.created);
        assert_eq!(result.ingredient.id, "old-gin");
        assert_eq!(result.ingredient.category, "spirit");
        assert!(result.ingredient.owned);
    }
    let stocks: Vec<(String, f64, String, i64, i64)> = sqlx::query_as(
        "SELECT id,amount,unit,added_at,updated_at FROM user_inventory WHERE ingredient_id='old-gin'",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(stocks, vec![("old-stock".into(), 23.0, "ml".into(), 1, 1)]);
}

#[tokio::test]
async fn added_ingredients_and_ownership_survive_database_reopen() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("cocktail.db");
    let pool = db::open(&path).await.unwrap();
    let added = menu::add_ingredient(&pool, &input("本地持久糖浆", "syrup", true))
        .await
        .unwrap();
    let expected = counts(&pool).await;
    pool.close().await;
    let reopened = db::open(&path).await.unwrap();
    let ingredient = menu::inventory(&reopened)
        .await
        .unwrap()
        .into_iter()
        .find(|ingredient| ingredient.id == added.ingredient.id)
        .unwrap();
    assert_eq!(ingredient.name, "本地持久糖浆");
    assert_eq!(ingredient.category, "syrup");
    assert!(ingredient.owned);
    assert_eq!(counts(&reopened).await, expected);
}

#[tokio::test]
async fn custom_recipes_reuse_new_ingredients_and_reflect_stock_in_menu_search() {
    let pool = database().await;
    let added = menu::add_ingredient(&pool, &input("Bergamot Juice", "juice", false))
        .await
        .unwrap();
    let count_after_add = counts(&pool).await.0;
    let id = menu::save_custom(&pool, &recipe("  BERGAMOT JUICE\t"))
        .await
        .unwrap();
    let missing = menu::get(&pool, &id).await.unwrap();
    assert!(!missing.can_make);
    assert_eq!(missing.missing, vec!["Bergamot Juice"]);
    assert_eq!(missing.ingredients[0].id, added.ingredient.id);
    assert_eq!(counts(&pool).await.0, count_after_add);

    let stocked = menu::add_ingredient(&pool, &input("bergamot juice", "other", true))
        .await
        .unwrap();
    assert!(!stocked.created);
    assert_eq!(stocked.ingredient.category, "juice");
    let recalled = menu::search(
        &pool,
        &MenuQuery {
            query: "bergamot".into(),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    assert_eq!(recalled.len(), 1);
    assert_eq!(recalled[0].id, id);
    assert!(recalled[0].can_make);
    assert!(recalled[0].missing.is_empty());

    menu::set_inventory(&pool, &added.ingredient.id, false)
        .await
        .unwrap();
    assert!(!menu::get(&pool, &id).await.unwrap().can_make);
}

#[tokio::test]
async fn adding_an_ingredient_first_created_by_a_recipe_reuses_it() {
    let pool = database().await;
    let id = menu::save_custom(&pool, &recipe("My Berry Juice"))
        .await
        .unwrap();
    let before = menu::get(&pool, &id).await.unwrap();
    assert!(!before.can_make);
    let result = menu::add_ingredient(&pool, &input("my berry juice", "juice", true))
        .await
        .unwrap();
    assert!(!result.created);
    assert_eq!(result.ingredient.id, before.ingredients[0].id);
    assert_eq!(result.ingredient.category, "other");
    assert!(menu::get(&pool, &id).await.unwrap().can_make);
}

#[tokio::test]
async fn ownership_write_failure_rolls_back_new_ingredient() {
    let pool = database().await;
    let before = counts(&pool).await;
    sqlx::query("CREATE TRIGGER reject_test_stock BEFORE INSERT ON user_inventory BEGIN SELECT RAISE(ABORT, 'test stock write failure'); END")
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        menu::add_ingredient(&pool, &input("原子写入测试", "other", true))
            .await
            .is_err()
    );
    assert_eq!(counts(&pool).await, before);
    sqlx::query("DROP TRIGGER reject_test_stock")
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        menu::add_ingredient(&pool, &input("原子写入测试", "other", true))
            .await
            .unwrap()
            .created
    );
}

#[tokio::test]
async fn concurrent_additions_and_recipe_creation_do_not_duplicate_ingredients() {
    let directory = tempfile::tempdir().unwrap();
    let pool = db::open(&directory.path().join("cocktail.db"))
        .await
        .unwrap();
    let before = counts(&pool).await;
    let mut tasks = tokio::task::JoinSet::new();
    for index in 0..12 {
        let pool = pool.clone();
        tasks.spawn(async move {
            menu::add_ingredient(
                &pool,
                &input(
                    if index % 2 == 0 {
                        "Concurrent Mixer"
                    } else {
                        "  concurrent MIXER  "
                    },
                    "mixer",
                    index % 2 == 0,
                ),
            )
            .await
            .unwrap()
        });
    }
    let mut created = 0;
    let mut ids = std::collections::HashSet::new();
    while let Some(result) = tasks.join_next().await {
        let result = result.unwrap();
        created += usize::from(result.created);
        ids.insert(result.ingredient.id);
    }
    assert_eq!(created, 1);
    assert_eq!(ids.len(), 1);
    assert_eq!(counts(&pool).await, (before.0 + 1, before.1 + 1));

    let new_ingredient = input("Parallel Syrup", "syrup", true);
    let new_recipe = recipe(" parallel SYRUP ");
    let (added, saved) = tokio::join!(
        menu::add_ingredient(&pool, &new_ingredient),
        menu::save_custom(&pool, &new_recipe),
    );
    let added = added.unwrap();
    let saved = menu::get(&pool, &saved.unwrap()).await.unwrap();
    assert_eq!(saved.ingredients[0].id, added.ingredient.id);
    assert!(saved.can_make);
    assert_eq!(counts(&pool).await, (before.0 + 2, before.1 + 2));
}
