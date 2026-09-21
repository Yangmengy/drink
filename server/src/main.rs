#[tokio::main]
async fn main() {
    if let Err(error) = drink_server::run().await {
        tracing::error!(%error, "drink server exited");
        std::process::exit(1);
    }
}
