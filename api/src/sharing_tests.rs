use crate::*;
use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicUsize, Ordering};
use tower::ServiceExt;

#[derive(Default)]
struct Objects {
    data: Mutex<HashMap<String, (Vec<u8>, String)>>,
    writes: AtomicUsize,
    fail_at: AtomicUsize,
}
async fn upload(
    State(objects): State<Arc<Objects>>,
    Query(query): Query<HashMap<String, String>>,
    bytes: Bytes,
) -> axum::response::Response {
    assert_eq!(
        query.get("ifGenerationMatch").map(String::as_str),
        Some("0")
    );
    assert!(!query.contains_key("predefinedAcl"));
    let call = objects.writes.fetch_add(1, Ordering::SeqCst) + 1;
    if call == objects.fail_at.load(Ordering::SeqCst) {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    let mut stored = objects.data.lock().unwrap();
    let name = query["name"].clone();
    if stored.contains_key(&name) {
        return StatusCode::PRECONDITION_FAILED.into_response();
    }
    let generation = call.to_string();
    stored.insert(name, (bytes.to_vec(), generation.clone()));
    Json(json!({"generation":generation})).into_response()
}
async fn object(
    State(objects): State<Arc<Objects>>,
    Path((_bucket, name)): Path<(String, String)>,
    Query(query): Query<HashMap<String, String>>,
) -> axum::response::Response {
    let stored = objects.data.lock().unwrap();
    let Some((bytes, generation)) = stored.get(&name) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if query.get("generation").is_some_and(|g| g != generation) {
        return StatusCode::NOT_FOUND.into_response();
    }
    ([("x-goog-generation", generation.as_str())], bytes.clone()).into_response()
}
async fn serve(
    app: Router,
) -> (
    String,
    tokio::sync::oneshot::Sender<()>,
    tokio::task::JoinHandle<()>,
) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let (stop, done) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                done.await.ok();
            })
            .await
            .unwrap();
    });
    (url, stop, server)
}
async fn send(
    app: &Router,
    method: &str,
    path: &str,
    token: &str,
    body: Value,
    key: Option<uuid::Uuid>,
) -> (StatusCode, Value) {
    let mut builder = axum::http::Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .header("authorization", format!("Session {token}"));
    if let Some(key) = key {
        builder = builder.header("idempotency-key", key.to_string());
    }
    let response = app
        .clone()
        .oneshot(
            builder
                .body(axum::body::Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 1_000_000)
        .await
        .unwrap();
    (
        status,
        serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| json!({"body":String::from_utf8_lossy(&bytes)})),
    )
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn australia_five_photos_require_review_and_owner_consent_before_user_sharing() {
    let url = std::env::var("CIVICLENS_TEST_DATABASE_URL").unwrap();
    let admin = PgPoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .unwrap();
    let schema = format!("media_{}", uuid::Uuid::new_v4().simple());
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
    let objects = Arc::new(Objects::default());
    let storage = Router::new()
        .route("/upload/storage/v1/b/{bucket}/o", post(upload))
        .route("/storage/v1/b/{bucket}/o/{object}", get(object))
        .with_state(objects.clone());
    let (storage_url, stop_storage, storage_server) = serve(storage).await;
    let safety = Router::new().fallback(|| async {
        Json(json!({"choices":[{"message":{"content":"{\"safe\":true}"}}]}))
    });
    let (safety_url, stop_safety, safety_server) = serve(safety).await;
    let mut config = config::Config::for_test(&url);
    config.ai_gateway_url = Some(safety_url);
    config.secrets.ai_gateway_key = Some("test-key".into());
    let mut state = Arc::new(AppState {
        pool: pool.clone(),
        config,
        http: reqwest::Client::new(),
        authorities: authority::load(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/data/authorities.json"
        ))
        .unwrap(),
        rate_limits: Mutex::new(HashMap::new()),
        photo_slots: Arc::new(tokio::sync::Semaphore::new(2)),
        report_slots: Arc::new(tokio::sync::Semaphore::new(1)),
        assist_limits: Mutex::new(HashMap::new()),
        media: Some(media::Store::for_test(&storage_url, "civiclens-test")),
    });
    let app = http::router(state.clone()).unwrap();
    let mut users = Vec::new();
    for nickname in ["SampleFox", "ReviewOwl"] {
        let id = uuid::Uuid::new_v4();
        let token = auth::opaque();
        sqlx::query("INSERT INTO users(id,identity_hash,nickname) VALUES($1,$2,$3)")
            .bind(id)
            .bind(auth::hash(&token))
            .bind(nickname)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')").bind(auth::hash(&token)).bind(id).execute(&pool).await.unwrap();
        users.push((id, token));
    }
    sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,'moderator')")
        .bind(users[1].0)
        .execute(&pool)
        .await
        .unwrap();
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new(&mut jpeg)
        .encode(&[20, 90, 60], 1, 1, image::ExtendedColorType::Rgb8)
        .unwrap();
    jpeg.extend_from_slice(b"private GPS original");
    let photo = STANDARD.encode(&jpeg);
    let body = json!({"category":"waste","description":"Private original description beside the grass.","location":{"latitude":-37.81412345,"longitude":144.96331234,"countryCode":"AU","locality":"Melbourne"},"photoBase64":photo,"additionalPhotosBase64":[photo,photo,photo,photo],"channels":["facebook"],"consent":true,"communityRulesVersion":contracts::COMMUNITY_RULES_VERSION,"locationSource":"photo","sharingMode":"manual"});
    let key = uuid::Uuid::new_v4();
    objects.fail_at.store(3, Ordering::SeqCst);
    assert_eq!(
        send(
            &app,
            "POST",
            "/v1/reports",
            &users[0].1,
            body.clone(),
            Some(key)
        )
        .await
        .0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM reports")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    objects.fail_at.store(0, Ordering::SeqCst);
    let (status, report) = send(
        &app,
        "POST",
        "/v1/reports",
        &users[0].1,
        body.clone(),
        Some(key),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    assert_eq!(report["photoCount"], 5);
    assert_eq!(report["locationSource"], "photo");
    assert_eq!(
        send(
            &app,
            "POST",
            "/v1/reports",
            &users[0].1,
            body.clone(),
            Some(key)
        )
        .await
        .1["id"],
        report["id"]
    );
    assert_eq!(
        objects.data.lock().unwrap().len(),
        5,
        "retry leaked duplicate objects"
    );
    let id = report["id"].as_str().unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM audit_events WHERE action='accept_community_rules'"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );
    assert!(!publishing::tick(&state).await.unwrap());
    assert_eq!(
        send(
            &app,
            "GET",
            &format!("/v1/moderation/reports/{id}/photos/4"),
            &users[0].1,
            json!({}),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let approval = json!({"publicDescription":"Litter is scattered beside a public path. Please arrange a clean-up.","publicLocality":"Melbourne","photoPrivacyReviewed":true,"includeParents":false});
    assert_eq!(
        send(
            &app,
            "POST",
            &format!("/v1/moderation/reports/{id}/approve"),
            &users[1].1,
            approval.clone(),
            None
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let mut approval = approval;
    approval["reviewedPhotoCount"] = json!(5);
    assert_eq!(
        send(
            &app,
            "POST",
            &format!("/v1/moderation/reports/{id}/approve"),
            &users[1].1,
            approval,
            None
        )
        .await
        .0,
        StatusCode::OK
    );

    let mut manual = body.clone();
    manual["sharingMode"] = json!("manual");
    manual["channels"] = json!(["facebook", "instagram", "whatsapp"]);
    let (manual_status, manual_report) = send(
        &app,
        "POST",
        "/v1/reports",
        &users[0].1,
        manual,
        Some(uuid::Uuid::new_v4()),
    )
    .await;
    assert_eq!(manual_status, StatusCode::OK, "{manual_report}");
    assert_eq!(manual_report["sharingMode"], "manual");
    let manual_id = manual_report["id"].as_str().unwrap();
    let manual_export = format!("/v1/reports/{manual_id}/share-package");
    let export_input = json!({"channel":"facebook","identityAcknowledged":true});
    assert_eq!(
        send(
            &app,
            "POST",
            &manual_export,
            &users[1].1,
            export_input.clone(),
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(
            &app,
            "POST",
            &manual_export,
            &users[0].1,
            export_input.clone(),
            None
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let manual_approval = json!({"publicDescription":"Litter is scattered beside a public path. Please arrange a clean-up.","publicLocality":"Melbourne","photoPrivacyReviewed":true,"reviewedPhotoCount":5,"includeParents":false});
    assert_eq!(
        send(
            &app,
            "POST",
            &format!("/v1/moderation/reports/{manual_id}/approve"),
            &users[1].1,
            manual_approval,
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM publications WHERE report_id=$1")
            .bind(uuid::Uuid::parse_str(manual_id).unwrap())
            .fetch_one(&pool)
            .await
            .unwrap(),
        0,
        "manual approval queued an automatic post"
    );
    let (status, package) = send(
        &app,
        "POST",
        &manual_export,
        &users[0].1,
        export_input.clone(),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{package}");
    assert_eq!(package["photosBase64"].as_array().unwrap().len(), 5);
    let caption = package["caption"].as_str().unwrap();
    assert!(caption.contains("Please arrange a clean-up."));
    assert!(caption.contains("SampleFox"));
    assert!(!caption.contains("Private original"));
    assert!(!caption.contains("37.81412345"));
    assert_eq!(
        send(
            &app,
            "POST",
            &format!("/v1/reports/{id}/share-package"),
            &users[0].1,
            json!({"channel":"whatsapp","identityAcknowledged":true}),
            None
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let (wa_status, wa_package) = send(
        &app,
        "POST",
        &manual_export,
        &users[0].1,
        json!({"channel":"whatsapp","identityAcknowledged":true}),
        None,
    )
    .await;
    assert_eq!(wa_status, StatusCode::OK, "{wa_package}");
    assert_eq!(wa_package["channel"], "whatsapp");
    assert_eq!(wa_package["photosBase64"].as_array().unwrap().len(), 5);
    let denied = json!({"channel":"facebook","identityAcknowledged":false});
    assert_eq!(
        send(&app, "POST", &manual_export, &users[0].1, denied, None)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        send(
            &app,
            "POST",
            &manual_export,
            &users[0].1,
            json!({"channel":"instagram","identityAcknowledged":true}),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert!(!publishing::tick(&state).await.unwrap());
    assert_eq!(
        send(&app, "POST", &manual_export, "", export_input.clone(), None)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    drop(app);
    for office in &mut Arc::get_mut(&mut state).unwrap().authorities {
        office.expires_at = "2000-01-01T00:00:00Z".into();
    }
    let app = http::router(state.clone()).unwrap();
    assert_eq!(
        send(
            &app,
            "POST",
            &manual_export,
            &users[0].1,
            export_input,
            None
        )
        .await
        .0,
        StatusCode::CONFLICT,
        "expired authority allowed a new share package"
    );
    for stop in [stop_storage, stop_safety] {
        stop.send(()).unwrap();
    }
    storage_server.await.unwrap();
    safety_server.await.unwrap();
    drop(app);
    drop(state);
    pool.close().await;
    sqlx::query(&format!("DROP SCHEMA {schema} CASCADE"))
        .execute(&admin)
        .await
        .unwrap();
    admin.close().await;
}
