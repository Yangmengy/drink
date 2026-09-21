# Drink server

这是 Drink 的第一阶段服务端：Axum + SQLx PostgreSQL，提供账号认证、原料库存、内置酒单读取和私人自创配方 API。模型 Key 仍由客户端请求时携带，服务端不保存。

## API

| Method | Path | Auth | Function |
|---|---|---|---|
| GET | `/health` | no | process check |
| GET | `/ready` | no | process and PostgreSQL check |
| POST | `/auth/register` | no | body: `{"email":"...","password":"..."}` |
| POST | `/auth/login` | no | body: `{"email":"...","password":"..."}` |
| GET | `/auth/me` | yes | current account |
| GET | `/ingredients` | yes | visible ingredients and inventory state |
| POST | `/ingredients` | yes | create or reuse an ingredient |
| PATCH | `/ingredients/{id}/owned` | yes | body: `{"owned":true}` |
| GET | `/recipes` | yes | query: `query`, `maxSweet`, `minSour`, `maxStrong` |
| GET | `/recipes/{id}` | yes | one recipe with inventory state |
| POST | `/recipes` | yes | create or update a custom recipe |
| DELETE | `/recipes/{id}` | yes | delete own custom recipe |
| POST | `/recommendations/local` | yes | deterministic local menu query without any model API |

Protected APIs require `Authorization: Bearer <token>`. `user_id` comes only from the JWT and is never accepted from request JSON. Builtin menu rows use `user_id IS NULL`; inventory and custom recipes belong to the JWT account.

Errors use `{"message":"..."}`. Passwords use Argon2id. JWT is HS256 and defaults to 7-day expiry.

## Local run

```bash
export DATABASE_URL='postgres://drink:drink@127.0.0.1:5432/drink'
export HOST='127.0.0.1'
export PORT='8080'
export JWT_SECRET='at-least-32-characters-long-secret'

cargo run --manifest-path server/Cargo.toml
```

Optional CORS origins can be supplied as a comma-separated list:

```bash
export CORS_ORIGINS='http://localhost:5173,https://drink.example.com'
```

SQLx migrations run during startup. `20260920000001_initial_schema.sql` creates the multi-user schema; `20260920000002_bundled_menu.sql` imports the desktop canonical menu as shared builtin data.

## Tests

```bash
cargo fmt --manifest-path server/Cargo.toml --check
cargo clippy --manifest-path server/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path server/Cargo.toml
```

Unit tests always run. The HTTP integration test runs against PostgreSQL when `DATABASE_URL` is set; without it, that test prints a skip notice and succeeds.

Example integration database:

```bash
DATABASE_URL='postgres://postgres:password@127.0.0.1:5432/drink' \
  cargo test --manifest-path server/Cargo.toml
```

## Deployment

Docker Compose, PostgreSQL, environment files, SSH-tunnel validation, and upgrade commands are documented in [docs/server-deployment.md](../docs/server-deployment.md). Alibaba Cloud Linux prerequisites and security-group guidance are in [docs/server-deployment-alibaba-cloud.md](../docs/server-deployment-alibaba-cloud.md).
