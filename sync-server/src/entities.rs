pub mod accounts {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "accounts")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub account_id: String,
    pub login_id: String,
    pub credential_hash: String,
    pub created_at: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod access_tokens {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "access_tokens")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub token: String,
    pub account_id: String,
    pub expires_at: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod refresh_tokens {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "refresh_tokens")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub token: String,
    pub account_id: String,
    pub expires_at: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod devices {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "devices")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub account_id: String,
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub app_version: String,
    pub device_fingerprint: Option<String>,
    pub updated_at: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod snapshots {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "snapshots")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub account_id: String,
    pub snapshot_version: String,
    pub base_snapshot_version: Option<String>,
    pub schema_version: String,
    pub created_at: String,
    pub created_by_device_id: String,
    pub cipher_suite: String,
    pub payload_size: i64,
    pub payload_sha256: String,
    pub host_count: i32,
    pub key_count: i32,
    pub port_forwarding_count: i32,
    pub envelope_json: String,
    pub uploaded_at: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod restore_records {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "restore_records")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub account_id: String,
    pub snapshot_version: String,
    pub restored_at: String,
    pub request_id: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod idempotency_records {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "idempotency_records")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub scope: String,
    pub request_id: String,
    pub response_json: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}

pub mod snapshot_heads {
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
  #[sea_orm(table_name = "snapshot_heads")]
  pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub account_id: String,
    pub snapshot_version: String,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
}
