use crate::error::Error;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn migrate(pool: &PgPool, path: &std::path::Path) -> Result<(), Error> {
    let migrator = sqlx::migrate::Migrator::new(path)
        .await
        .map_err(|_| Error::Internal)?;
    migrator.run(pool).await.map_err(|_| Error::Internal)?;
    Ok(())
}

pub async fn role(pool: &PgPool, user: Uuid, role: &str) -> Result<(), Error> {
    if !["moderator", "operator"].contains(&role) {
        return Err(Error::Invalid("Choose moderator or operator."));
    }
    let mut tx = pool.begin().await?;
    let result =
        sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING")
            .bind(user)
            .bind(role)
            .execute(&mut *tx)
            .await?;
    if result.rows_affected() > 0 {
        sqlx::query("INSERT INTO audit_events(action,details) VALUES('grant_role',jsonb_build_object('target_user_id',$1::text,'role',$2::text,'database_principal',current_user))")
            .bind(user.to_string()).bind(role).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}
