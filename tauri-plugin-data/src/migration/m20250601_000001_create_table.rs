use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Hosts::Table)
                    .if_not_exists()
                    .col(pk_auto(Hosts::Id))
                    .col(string_null(Hosts::Name))
                    .col(blob(Hosts::Hostname))
                    .col(integer(Hosts::Port))
                    .col(blob(Hosts::Username))
                    .col(integer(Hosts::AuthenticationMethod))
                    .col(blob_null(Hosts::Password))
                    .col(integer_null(Hosts::KeyId))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Hosts::Table, Hosts::KeyId)
                            .to(Keys::Table, Keys::Id),
                    )
                    .col(json_null(Hosts::TerminalSettings))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Keys::Table)
                    .if_not_exists()
                    .col(pk_auto(Keys::Id))
                    .col(string(Keys::Name))
                    .col(blob(Keys::PrivateKey))
                    .col(blob(Keys::PublicKey))
                    .col(blob_null(Keys::Passphrase))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(PortForwardings::Table)
                    .if_not_exists()
                    .col(pk_auto(PortForwardings::Id))
                    .col(string(PortForwardings::Name))
                    .col(integer(PortForwardings::PortForwardingType))
                    .col(integer(PortForwardings::HostId))
                    .foreign_key(
                        ForeignKey::create()
                            .from(PortForwardings::Table, PortForwardings::HostId)
                            .to(Hosts::Table, Hosts::Id),
                    )
                    .col(blob(PortForwardings::LocalAddress))
                    .col(integer(PortForwardings::LocalPort))
                    .col(blob_null(PortForwardings::RemoteAddress))
                    .col(integer_null(PortForwardings::RemotePort))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Hosts::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Hosts {
    Table,
    Id,
    Name,
    Hostname,
    Port,
    Username,
    AuthenticationMethod,
    Password,
    KeyId,
    TerminalSettings,
}

#[derive(DeriveIden)]
enum Keys {
    Table,
    Id,
    Name,
    PrivateKey,
    PublicKey,
    Passphrase,
}

#[derive(DeriveIden)]
enum PortForwardings {
    Table,
    Id,
    Name,
    PortForwardingType,
    HostId,
    LocalAddress,
    LocalPort,
    RemoteAddress,
    RemotePort,
}
