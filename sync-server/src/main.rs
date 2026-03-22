mod api;
mod entities;
mod migration;
mod storage;
mod types;

use std::env;

use actix_cors::Cors;
use actix_web::{App, HttpServer, middleware::Logger, web::Data};

use crate::{
  api::{AppState, configure_app, json_config},
  storage::DataManager,
};

#[cfg(test)]
mod tests;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
  env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

  let port = env::var("PORT")
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(8787);
  let data_manager = DataManager::init()
    .await
    .map_err(std::io::Error::other)?;
  let state = Data::new(AppState { data_manager });

  HttpServer::new(move || {
    App::new()
      .app_data(state.clone())
      .app_data(json_config())
      .wrap(Logger::default())
      .wrap(Cors::permissive())
      .configure(configure_app)
  })
  .bind(("127.0.0.1", port))?
  .run()
  .await
}
