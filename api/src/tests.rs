use super::*;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use sqlx::Row;
use tower::ServiceExt;

#[test]
fn nicknames_reject_mentions_unicode_and_short_names() {
    for name in ["@mayor", "a", "Jane Doe", "éclair", "-wrong", "#everyone"] {
        assert!(nickname::choose(Some(name)).is_err(), "accepted {name}");
    }
    assert_eq!(
        nickname::choose(Some("  RiverFox_2  ")).unwrap(),
        "RiverFox_2"
    );
}

fn office(id: &str) -> authority::Authority {
    serde_json::from_value(json!({"id":id,"name":"Test Municipality","countryCode":"IN","categories":["waste"],
        "boundary":{"type":"Polygon","coordinates":[[[70.0,10.0],[80.0,10.0],[80.0,20.0],[70.0,20.0],[70.0,10.0]]]},
        "officialUrl":"https://authority.invalid","sourceUrl":"https://authority.invalid/contact",
        "verifiedAt":"2026-01-01T00:00:00Z","expiresAt":"2099-01-01T00:00:00Z",
        "handles":{"facebook":"TestMunicipality","instagram":null},"parents":[]})).unwrap()
}

#[test]
fn authority_routing_holds_ambiguous_expired_and_wrong_country_matches() {
    let now = time::OffsetDateTime::now_utc();
    let location = contracts::Location {
        latitude: 15.0,
        longitude: 75.0,
        country_code: "IN".into(),
        locality: "Test city".into(),
    };
    let mut directory = vec![office("test")];
    assert_eq!(
        authority::route(&directory, &location, contracts::Category::Waste, now).len(),
        1
    );
    directory.push(office("other"));
    assert!(authority::route(&directory, &location, contracts::Category::Waste, now).is_empty());
    directory.pop();
    directory[0].expires_at = "2026-01-02T00:00:00Z".into();
    assert!(authority::route(&directory, &location, contracts::Category::Waste, now).is_empty());
    directory[0] = office("test");
    directory[0].country_code = "AU".into();
    assert!(authority::route(&directory, &location, contracts::Category::Waste, now).is_empty());
}

#[test]
fn public_caption_uses_reviewed_text_pseudonym_and_approximate_location() {
    let location = contracts::Location {
        latitude: 15.123456,
        longitude: 75.987654,
        country_code: "IN".into(),
        locality: "Private exact address".into(),
    };
    let office = office("test");
    let caption = authority::caption(
        "RiverFox",
        "Rubbish blocking a footpath @privateperson",
        "Test city",
        &location,
        &[&office],
        contracts::Channel::Facebook,
    );
    assert!(caption.contains("RiverFox"));
    assert!(caption.contains("15.12, 75.99"));
    assert!(caption.contains("@TestMunicipality"));
    for private in ["15.123456", "Private exact address", "@privateperson"] {
        assert!(!caption.contains(private));
    }
}

async fn send(
    app: &axum::Router,
    method: &str,
    path: &str,
    token: Option<&str>,
    body: Value,
    key: Option<uuid::Uuid>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    if let Some(key) = key {
        builder = builder.header("idempotency-key", key.to_string());
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 8_100_000).await.unwrap();
    let body = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| json!({"nonJson":String::from_utf8_lossy(&bytes)}));
    (status, body)
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for a scratch local database"]
async fn database_enforces_ownership_roles_idempotency_and_transactional_publication() {
    let url = std::env::var("CIVICLENS_TEST_DATABASE_URL").expect("scratch database URL required");
    let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
    let admin = PgPoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .unwrap();
    sqlx::query(&format!("CREATE SCHEMA {schema}"))
        .execute(&admin)
        .await
        .unwrap();
    let options = PgConnectOptions::from_str(&url)
        .unwrap()
        .statement_cache_capacity(0)
        .options([("search_path", schema.as_str())]);
    let pool = PgPoolOptions::new()
        .max_connections(3)
        .connect_with(options)
        .await
        .unwrap();
    admin::migrate(
        &pool,
        std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/migrations")),
    )
    .await
    .unwrap();
    let (signing, jwks) = identity_fixture();
    let identity_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let issuer = format!("http://{}", identity_listener.local_addr().unwrap());
    let (stop_identity, identity_done) = tokio::sync::oneshot::channel();
    let identity_server = tokio::spawn(async move {
        let routes = axum::Router::new().route(
            "/oauth/v2/keys",
            axum::routing::get(move || async move { axum::Json(jwks) }),
        );
        axum::serve(identity_listener, routes)
            .with_graceful_shutdown(async {
                identity_done.await.ok();
            })
            .await
            .unwrap();
    });
    let config = config::Config {
        secrets: config::Secrets {
            database_url: url,
            identity_key: "local-tests-only-identity-key-32-characters".into(),
            facebook_page_token: None,
        },
        facebook_page_id: None,
        graph_version: "v26.0".into(),
        allowed_origin: None,
        publishing_enabled: false,
        bind: "127.0.0.1:0".into(),
        oidc_issuer: issuer.clone(),
        oidc_project_id: "test-project".into(),
        oidc_ios_client_id: "test-ios".into(),
        oidc_android_client_id: "test-android".into(),
        google_idp_id: "test-google".into(),
        facebook_idp_id: String::new(),
    };
    let state = Arc::new(AppState {
        pool: pool.clone(),
        config,
        http: reqwest::Client::new(),
        authorities: vec![office("test")],
        rate_limits: Mutex::new(HashMap::new()),
        photo_slots: Arc::new(tokio::sync::Semaphore::new(2)),
    });
    let app = http::router(state.clone()).unwrap();
    let mut users = Vec::new();
    for name in ["RiverFox", "OtherOtter", "ReviewOwl"] {
        let id = uuid::Uuid::now_v7();
        let token = auth::opaque();
        sqlx::query("INSERT INTO users(id,identity_hash,nickname) VALUES($1,$2,$3)")
            .bind(id)
            .bind(auth::hash(name))
            .bind(name)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')").bind(auth::hash(&token)).bind(id).execute(&pool).await.unwrap();
        users.push((id, token));
    }
    let collision = sqlx::query(
        "INSERT INTO users(id,identity_hash,nickname) VALUES($1,'unique-hash','riverfox')",
    )
    .bind(uuid::Uuid::now_v7())
    .execute(&pool)
    .await;
    assert!(matches!(collision,Err(sqlx::Error::Database(e)) if e.is_unique_violation()));
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new(&mut jpeg)
        .encode(&[20, 90, 60], 1, 1, image::ExtendedColorType::Rgb8)
        .unwrap();
    let body = json!({"category":"waste","description":"Private original description, not a public caption.","location":{"latitude":15.123456,"longitude":75.123456,"countryCode":"IN","locality":"Private address"},"photoBase64":STANDARD.encode(jpeg),"channels":["facebook","instagram","whatsapp"],"consent":true});
    let key = uuid::Uuid::new_v4();
    let busy = state
        .photo_slots
        .clone()
        .acquire_many_owned(2)
        .await
        .unwrap();
    assert_eq!(
        send(
            &app,
            "POST",
            "/v1/reports",
            Some(&users[0].1),
            body.clone(),
            Some(uuid::Uuid::new_v4())
        )
        .await
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    drop(busy);
    assert_eq!(
        send(&app, "POST", "/v1/reports", None, body.clone(), Some(key))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let (status, report) = send(
        &app,
        "POST",
        "/v1/reports",
        Some(&users[0].1),
        body.clone(),
        Some(key),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    let id = report["id"].as_str().unwrap();
    assert_eq!(report["nickname"], "RiverFox");
    let (_, repeated) = send(
        &app,
        "POST",
        "/v1/reports",
        Some(&users[0].1),
        body.clone(),
        Some(key),
    )
    .await;
    assert_eq!(repeated["id"], id);
    let mut changed = body.clone();
    changed["description"] = json!("Changed report description.");
    assert_eq!(
        send(
            &app,
            "POST",
            "/v1/reports",
            Some(&users[0].1),
            changed,
            Some(key)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        send(
            &app,
            "GET",
            &format!("/v1/reports/{id}"),
            Some(&users[1].1),
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (_, other_list) = send(
        &app,
        "GET",
        "/v1/reports",
        Some(&users[1].1),
        Value::Null,
        None,
    )
    .await;
    assert_eq!(other_list["items"], json!([]));
    let approval = json!({"publicDescription":"Rubbish blocking a public footpath.","publicLocality":"Test city","photoPrivacyReviewed":true,"includeParents":false});
    let approve_path = format!("/v1/moderation/reports/{id}/approve");
    let reconcile_path = format!(
        "/v1/operations/publications/{}/reconcile",
        uuid::Uuid::now_v7()
    );
    assert_eq!(send(&app,"POST",&reconcile_path,Some(&users[1].1),json!({"action":"retry","note":"Checked the provider; no post exists.","providerId":null}),None).await.0,StatusCode::FORBIDDEN);
    assert_eq!(
        send(
            &app,
            "POST",
            &approve_path,
            Some(&users[1].1),
            approval.clone(),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    for (user, _) in [&users[0], &users[2]] {
        sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,'moderator')")
            .bind(user)
            .execute(&pool)
            .await
            .unwrap();
    }
    assert_eq!(
        send(
            &app,
            "POST",
            &approve_path,
            Some(&users[0].1),
            approval.clone(),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let (status, approved) = send(
        &app,
        "POST",
        &approve_path,
        Some(&users[2].1),
        approval.clone(),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{approved}");
    assert_eq!(approved["status"], "approved");
    assert_eq!(
        send(
            &app,
            "POST",
            &approve_path,
            Some(&users[2].1),
            approval,
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM publications")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 3);
    for _ in 0..3 {
        assert!(publishing::tick(&state).await.unwrap());
    }
    let rows = sqlx::query("SELECT status,caption FROM publications")
        .fetch_all(&pool)
        .await
        .unwrap();
    for row in rows {
        assert_eq!(row.get::<String, _>("status"), "blocked");
        assert!(!row.get::<String, _>("caption").contains("Private"));
    }
    assert!(sqlx::query("DELETE FROM audit_events")
        .execute(&pool)
        .await
        .is_err());
    assert_eq!(
        send(
            &app,
            "POST",
            "/v1/auth/logout",
            Some(&users[0].1),
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        send(&app, "GET", "/v1/me", Some(&users[0].1), Value::Null, None)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let challenge = send(
        &app,
        "POST",
        "/v1/auth/google/challenge",
        None,
        Value::Null,
        None,
    )
    .await
    .1;
    let forged =
        json!({"token":"not-a-signed-id-token","challengeId":challenge["id"],"nickname":null});
    assert_eq!(
        send(&app, "POST", "/v1/auth/google", None, forged, None)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    for nickname in [None, Some("CloudWren")] {
        let challenge = send(
            &app,
            "POST",
            "/v1/auth/google/challenge",
            None,
            Value::Null,
            None,
        )
        .await
        .1;
        let mut header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256);
        header.kid = Some("test-key".into());
        let claims = json!({"sub":format!("private-provider-subject-{nickname:?}"),"iss":issuer,"aud":"test-ios","exp":time::OffsetDateTime::now_utc().unix_timestamp()+300,"nonce":challenge["nonce"],"name":"Private Legal Name","email":"private@example.invalid"});
        let token = jsonwebtoken::encode(&header, &claims, &signing).unwrap();
        let login = json!({"token":token,"challengeId":challenge["id"],"nickname":nickname});
        let (status, session) =
            send(&app, "POST", "/v1/auth/google", None, login.clone(), None).await;
        assert_eq!(status, StatusCode::OK, "{session}");
        assert!(!session.to_string().contains("Private Legal Name"));
        assert!(!session.to_string().contains("private@example.invalid"));
        if let Some(nickname) = nickname {
            assert_eq!(session["user"]["nickname"], nickname);
        } else {
            assert!(session["user"]["nickname"]
                .as_str()
                .unwrap()
                .starts_with("kind-otter-"));
        }
        assert_eq!(
            send(&app, "POST", "/v1/auth/google", None, login, None)
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            send(
                &app,
                "GET",
                "/v1/me",
                session["token"].as_str(),
                Value::Null,
                None
            )
            .await
            .1["nickname"],
            session["user"]["nickname"]
        );
    }
    let publication_id: uuid::Uuid =
        sqlx::query_scalar("SELECT id FROM publications WHERE channel='facebook'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(admin::role(&pool, users[2].0, "untrusted-role")
        .await
        .is_err());
    admin::role(&pool, users[2].0, "operator").await.unwrap();
    admin::role(&pool, users[2].0, "operator").await.unwrap();
    let reconciliation = json!({"action":"published","note":"Verified the test provider post reference.","providerId":"test-provider-post"});
    let (status, body) = send(
        &app,
        "POST",
        &format!("/v1/operations/publications/{publication_id}/reconcile"),
        Some(&users[2].1),
        reconciliation,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["status"], "published");
    assert_eq!(
        send(&app, "GET", "/healthz", None, Value::Null, None)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        send(&app, "GET", "/readyz", None, Value::Null, None)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        send(&app, "GET", "/v1/capabilities", None, Value::Null, None)
            .await
            .1["publishing"]["instagram"],
        false
    );
    stop_identity.send(()).unwrap();
    identity_server.await.unwrap();
    pool.close().await;
    sqlx::query(&format!("DROP SCHEMA {schema} CASCADE"))
        .execute(&admin)
        .await
        .unwrap();
    admin.close().await;
}

fn identity_fixture() -> (jsonwebtoken::EncodingKey, Value) {
    use std::{
        io::Write,
        process::{Command, Stdio},
    };
    let output = Command::new("openssl")
        .args([
            "genpkey",
            "-algorithm",
            "RSA",
            "-pkeyopt",
            "rsa_keygen_bits:2048",
        ])
        .output()
        .unwrap();
    assert!(output.status.success());
    let key = jsonwebtoken::EncodingKey::from_rsa_pem(&output.stdout).unwrap();
    let mut command = Command::new("openssl")
        .args(["rsa", "-modulus", "-noout"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    command
        .stdin
        .take()
        .unwrap()
        .write_all(&output.stdout)
        .unwrap();
    let modulus = command.wait_with_output().unwrap();
    assert!(modulus.status.success());
    let modulus = String::from_utf8(modulus.stdout).unwrap();
    let bytes = hex::decode(modulus.trim().strip_prefix("Modulus=").unwrap()).unwrap();
    let n = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
    (
        key,
        json!({"keys":[{"kty":"RSA","kid":"test-key","use":"sig","alg":"RS256","n":n,"e":"AQAB"}]}),
    )
}
