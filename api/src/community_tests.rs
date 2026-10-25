use crate::*;
use axum::{http::StatusCode, Json, Router};
use serde_json::{json, Value};
use tower::ServiceExt;

struct Fixture {
    app: Router,
    pool: sqlx::PgPool,
    admin: sqlx::PgPool,
    schema: String,
    users: Vec<(uuid::Uuid, String)>,
    stop: tokio::sync::oneshot::Sender<()>,
    server: tokio::task::JoinHandle<()>,
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn official_gateway_maps_india_and_rejects_cross_region_or_unauthenticated_routes() {
    let f = Fixture::new().await;
    let path = "/v1/official-complaints/jurisdictions?countryCode=IN&limit=50";
    assert_eq!(
        f.send(None, "GET", path, Value::Null, None).await.0,
        StatusCode::UNAUTHORIZED
    );
    let (status, regions) = f.send(Some(0), "GET", path, Value::Null, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(regions["items"].as_array().unwrap().len(), 36);
    assert_eq!(regions["policeMappingVerified"], false);
    let (_, unsupported) = f
        .send(
            Some(0),
            "GET",
            "/v1/official-complaints/jurisdictions?countryCode=NZ",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(unsupported["items"], json!([]));
    assert!(unsupported["referenceSource"].is_null());
    assert_eq!(
        f.send(
            Some(0),
            "GET",
            "/v1/official-complaints/providers?countryCode=NZ&regionId=in-state-33",
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        regions["referenceSource"]["sourceSha256"],
        "9f2b37f508f4f8a1dd638db884b4535ab0ada8c03bb039b14cb22370f305b14b"
    );
    let (status, districts) = f
        .send(
            Some(0),
            "GET",
            "/v1/official-complaints/jurisdictions?countryCode=IN&regionId=in-state-33&limit=20",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(districts["items"].as_array().unwrap().len(), 20);
    let cursor = districts["nextCursor"].as_str().unwrap();
    let next_path = format!("/v1/official-complaints/jurisdictions?countryCode=IN&regionId=in-state-33&limit=20&cursor={cursor}");
    let (_, second) = f.send(Some(0), "GET", &next_path, Value::Null, None).await;
    assert_eq!(second["items"].as_array().unwrap().len(), 18);
    assert!(second["nextCursor"].is_null());
    let wrong = format!(
        "/v1/official-complaints/jurisdictions?countryCode=IN&regionId=in-state-32&cursor={cursor}"
    );
    assert_eq!(
        f.send(Some(0), "GET", &wrong, Value::Null, None).await.0,
        StatusCode::BAD_REQUEST
    );
    let route = json!({"countryCode":"IN","regionId":"in-state-33","districtId":"in-district-610","issueType":"crime","locationConfirmed":true});
    let (status, plan) = f
        .send(
            Some(0),
            "POST",
            "/v1/official-complaints/resolve",
            route.clone(),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(plan["canSubmit"], false);
    let mut forged = route.clone();
    forged["providerUrl"] = json!("https://example.invalid/submit");
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            "/v1/official-complaints/resolve",
            forged,
            None
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let oversized = json!({"countryCode":"IN","regionId":"x".repeat(5000),"districtId":"in-district-610","issueType":"crime","locationConfirmed":true});
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            "/v1/official-complaints/resolve",
            oversized,
            None
        )
        .await
        .0,
        StatusCode::PAYLOAD_TOO_LARGE
    );
    assert!(plan["providerDistrictCode"].is_null());
    assert!(plan["provider"]["photoContract"]["maxPhotos"].is_null());
    let mut wrong = route;
    wrong["regionId"] = json!("in-state-32");
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            "/v1/official-complaints/resolve",
            wrong,
            None
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        f.send(
            Some(0),
            "GET",
            "/v1/official-complaints/providers?countryCode=IN&regionId=in-state-33",
            Value::Null,
            None
        )
        .await
        .1["items"][0]["submissionSupported"],
        false
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn official_gateway_works_over_local_http_with_real_session_authentication() {
    let f = Fixture::new().await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let app = f.app.clone();
    let (stop, done) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                done.await.ok();
            })
            .await
            .unwrap();
    });
    let client = reqwest::Client::new();
    let unauthenticated = client
        .get(format!(
            "{base}/v1/official-complaints/providers?countryCode=IN"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(unauthenticated.status(), StatusCode::UNAUTHORIZED);
    let response=client.post(format!("{base}/v1/official-complaints/resolve"))
        .header("authorization",format!("Session {}",f.users[0].1))
        .json(&json!({"countryCode":"IN","regionId":"in-state-33","districtId":"in-district-610","issueType":"crime","locationConfirmed":true}))
        .send().await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let plan: Value = response.json().await.unwrap();
    assert_eq!(plan["provider"]["id"], "in-tamil-nadu-police-umang");
    assert_eq!(plan["canSubmit"], false);
    assert!(plan["providerDistrictCode"].is_null());
    stop.send(()).unwrap();
    server.await.unwrap();
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn official_requests_are_private_durable_idempotent_and_never_claim_dispatch() {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let f = Fixture::new().await;
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new(&mut jpeg)
        .encode(&[20, 90, 60], 1, 1, image::ExtendedColorType::Rgb8)
        .unwrap();
    let report_input = json!({"category":"public_safety","description":"A damaged public fixture was observed beside the path.","location":{"latitude":13.08,"longitude":80.27,"countryCode":"IN","locality":"Chennai"},"photoBase64":STANDARD.encode(jpeg),"channels":[],"complaintRequested":true,"consent":true,"communityRulesVersion":contracts::COMMUNITY_RULES_VERSION,"sharingMode":"manual"});
    let (status, report) = f
        .send(
            Some(0),
            "POST",
            "/v1/reports",
            report_input.clone(),
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    let report_id = report["id"].as_str().unwrap();
    let path = format!("/v1/reports/{report_id}/official-complaints");
    let input = json!({"routing":{"countryCode":"IN","regionId":"in-state-33","districtId":"in-district-610","issueType":"crime","locationConfirmed":true},"consent":true});
    let key = uuid::Uuid::new_v4();
    assert_eq!(
        f.send(None, "POST", &path, input.clone(), Some(key))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        f.send(Some(1), "POST", &path, input.clone(), Some(key))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    let mut refused = input.clone();
    refused["consent"] = json!(false);
    assert_eq!(
        f.send(Some(0), "POST", &path, refused, Some(key)).await.0,
        StatusCode::BAD_REQUEST
    );
    let (one, two) = tokio::join!(
        f.send(Some(0), "POST", &path, input.clone(), Some(key)),
        f.send(Some(0), "POST", &path, input.clone(), Some(key))
    );
    assert_eq!(one.0, StatusCode::OK, "{:?}", one);
    assert_eq!(two, one);
    let created = one.1;
    assert_eq!(created["status"], "blocked");
    assert_eq!(created["dispatchAttempted"], false);
    assert!(created["officialReference"].is_null());
    assert_eq!(created["resolution"]["canSubmit"], false);
    let request_id = created["id"].as_str().unwrap();
    let get = format!("/v1/official-complaints/requests/{request_id}");
    assert_eq!(
        f.send(Some(0), "GET", &get, Value::Null, None).await.1,
        created
    );
    assert_eq!(
        f.send(Some(1), "GET", &get, Value::Null, None).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(1), "GET", &path, Value::Null, None).await.0,
        StatusCode::NOT_FOUND
    );
    let mut changed = input.clone();
    changed["routing"]["districtId"] = json!("in-district-615");
    assert_eq!(
        f.send(Some(0), "POST", &path, changed, Some(key)).await.0,
        StatusCode::CONFLICT
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM official_complaint_requests")
        .fetch_one(&f.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let jobs: i64 = sqlx::query_scalar("SELECT count(*) FROM publications")
        .fetch_one(&f.pool)
        .await
        .unwrap();
    assert_eq!(jobs, 0);
    let (_, history) = f.send(Some(0), "GET", &path, Value::Null, None).await;
    assert_eq!(history["items"][0], created);
    assert_eq!(
        f.send(
            Some(0),
            "GET",
            &format!("{path}?limit=51"),
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let invalid_owner=sqlx::query("INSERT INTO official_complaint_requests(id,owner_id,report_id,submission_key,payload_hash,resolution,rules_version) SELECT $1,$2,report_id,$3,payload_hash,resolution,rules_version FROM official_complaint_requests WHERE id=$4")
        .bind(uuid::Uuid::new_v4()).bind(f.users[1].0).bind(uuid::Uuid::new_v4()).bind(uuid::Uuid::parse_str(request_id).unwrap()).execute(&f.pool).await;
    assert!(invalid_owner
        .unwrap_err()
        .as_database_error()
        .unwrap()
        .is_foreign_key_violation());
    let forged=sqlx::query("UPDATE official_complaint_requests SET resolution=jsonb_set(resolution,'{canSubmit}','true') WHERE id=$1")
        .bind(uuid::Uuid::parse_str(request_id).unwrap()).execute(&f.pool).await;
    assert_eq!(
        forged
            .unwrap_err()
            .as_database_error()
            .unwrap()
            .code()
            .as_deref(),
        Some("23514")
    );
    sqlx::query("INSERT INTO official_complaint_requests(id,owner_id,report_id,submission_key,payload_hash,resolution,rules_version) SELECT md5('official-row-'||n)::uuid,owner_id,report_id,md5('official-key-'||n)::uuid,payload_hash,resolution,rules_version FROM official_complaint_requests CROSS JOIN generate_series(1,48) n WHERE id=$1")
        .bind(uuid::Uuid::parse_str(request_id).unwrap()).execute(&f.pool).await.unwrap();
    let (last, over) = tokio::join!(
        f.send(
            Some(0),
            "POST",
            &path,
            input.clone(),
            Some(uuid::Uuid::new_v4())
        ),
        f.send(
            Some(0),
            "POST",
            &path,
            input.clone(),
            Some(uuid::Uuid::new_v4())
        )
    );
    assert!(
        (last.0 == StatusCode::OK && over.0 == StatusCode::TOO_MANY_REQUESTS)
            || (over.0 == StatusCode::OK && last.0 == StatusCode::TOO_MANY_REQUESTS)
    );
    assert_eq!(
        f.send(Some(0), "POST", &path, input.clone(), Some(key))
            .await
            .1,
        created
    );
    let (_, history) = f
        .send(
            Some(0),
            "GET",
            &format!("{path}?limit=1"),
            Value::Null,
            None,
        )
        .await;
    assert_eq!(history["items"].as_array().unwrap().len(), 1);
    let next = history["nextCursor"].as_str().unwrap();
    let (_, second) = f
        .send(
            Some(0),
            "GET",
            &format!("{path}?limit=1&cursor={next}"),
            Value::Null,
            None,
        )
        .await;
    assert_ne!(second["items"][0]["id"], history["items"][0]["id"]);
    let mut waste = report_input;
    waste["category"] = json!("waste");
    let (_, waste) = f
        .send(
            Some(0),
            "POST",
            "/v1/reports",
            waste,
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    let waste_path = format!(
        "/v1/reports/{}/official-complaints",
        waste["id"].as_str().unwrap()
    );
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            &waste_path,
            input.clone(),
            Some(uuid::Uuid::new_v4())
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        f.send(Some(0), "POST", &path, input, None).await.0,
        StatusCode::BAD_REQUEST
    );
    f.finish().await;
}

impl Fixture {
    async fn new() -> Self {
        let url = std::env::var("CIVICLENS_TEST_DATABASE_URL").unwrap();
        let admin = PgPoolOptions::new()
            .max_connections(1)
            .connect(&url)
            .await
            .unwrap();
        let schema = format!("community_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!("CREATE SCHEMA {schema}"))
            .execute(&admin)
            .await
            .unwrap();
        let options = PgConnectOptions::from_str(&url)
            .unwrap()
            .options([("search_path", format!("{schema},pg_catalog").as_str())]);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .unwrap();
        admin::migrate(
            &pool,
            std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/migrations")),
        )
        .await
        .unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let safety_url = format!("http://{}", listener.local_addr().unwrap());
        let (stop, done) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            axum::serve(
                listener,
                Router::new().fallback(|| async {
                    Json(json!({"choices":[{"message":{"content":"{\"safe\":true}"}}]}))
                }),
            )
            .with_graceful_shutdown(async {
                done.await.ok();
            })
            .await
            .unwrap();
        });
        let mut config = config::Config::for_test(&url);
        config.ai_gateway_url = Some(safety_url);
        config.secrets.ai_gateway_key = Some("test-key".into());
        let state = Arc::new(AppState {
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
            media: None,
            assist_limits: Mutex::new(HashMap::new()),
        });
        let app = http::router(state).unwrap();
        let mut users = Vec::new();
        for nickname in ["TestKea", "TestYak", "TestOwl"] {
            let id = uuid::Uuid::now_v7();
            let token = auth::opaque();
            sqlx::query("INSERT INTO users(id,identity_hash,nickname) VALUES($1,$2,$3)")
                .bind(id)
                .bind(auth::hash(&token))
                .bind(nickname)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')")
                .bind(auth::hash(&token)).bind(id).execute(&pool).await.unwrap();
            users.push((id, token));
        }
        sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,'moderator')")
            .bind(users[2].0)
            .execute(&pool)
            .await
            .unwrap();
        Self {
            app,
            pool,
            admin,
            schema,
            users,
            stop,
            server,
        }
    }

    async fn send(
        &self,
        actor: Option<usize>,
        method: &str,
        path: &str,
        body: Value,
        key: Option<uuid::Uuid>,
    ) -> (StatusCode, Value) {
        let mut builder = axum::http::Request::builder()
            .method(method)
            .uri(path)
            .header("content-type", "application/json");
        if let Some(actor) = actor {
            builder = builder.header("authorization", format!("Session {}", self.users[actor].1));
        }
        if let Some(key) = key {
            builder = builder.header("idempotency-key", key.to_string());
        }
        let response = self
            .app
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
                .unwrap_or_else(|_| json!({"raw":String::from_utf8_lossy(&bytes)})),
        )
    }

    async fn finish(self) {
        self.stop.send(()).unwrap();
        self.server.await.unwrap();
        self.pool.close().await;
        sqlx::query(&format!("DROP SCHEMA {} CASCADE", self.schema))
            .execute(&self.admin)
            .await
            .unwrap();
        self.admin.close().await;
    }
}

fn card_input(kind: &str) -> Value {
    json!({"kind":kind,"title":"Should our local park have more rubbish bins?","body":"Requesting more bins beside the path so everyone can keep this public park clean.","countryCode":"AU","locality":"Melbourne","closesAt":(time::OffsetDateTime::now_utc()+time::Duration::days(7)).format(&time::format_description::well_known::Rfc3339).unwrap(),"rulesVersion":contracts::COMMUNITY_RULES_VERSION,"consent":true})
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn community_public_links_only_expose_approved_escaped_question_text() {
    let f = Fixture::new().await;
    let mut input = card_input("poll");
    input["title"] = json!("Should <script>alert('x')</script> be shown here?");
    let (_, card) = f
        .send(
            Some(0),
            "POST",
            "/v1/community",
            input,
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    let id = card["id"].as_str().unwrap();
    let public = format!("/community/{id}");
    let share = format!("/v1/community/{id}/share-link");
    assert_eq!(
        f.send(None, "GET", &public, Value::Null, None).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(1), "POST", &share, json!({}), None).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(
            Some(2),
            "POST",
            &format!("/v1/moderation/community/{id}"),
            json!({"decision":"approve"}),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(None, "POST", &share, json!({}), None).await.0,
        StatusCode::UNAUTHORIZED
    );
    let (status, link) = f.send(Some(1), "POST", &share, json!({}), None).await;
    assert_eq!(status, StatusCode::OK, "{link}");
    assert_eq!(
        link["url"],
        format!("https://civiclns-api.tesserix.app/community/{id}")
    );
    assert!(link["iosStoreUrl"].is_null());
    assert!(link["androidStoreUrl"].is_null());
    let (status, page) = f.send(None, "GET", &public, Value::Null, None).await;
    assert_eq!(status, StatusCode::OK);
    let html = page["raw"].as_str().unwrap();
    assert!(html.contains("&lt;script&gt;"));
    assert!(!html.contains("<script>"));
    for private in [
        "TestKea",
        "myResponse",
        "watching",
        "identity_hash",
        "Your response",
    ] {
        assert!(!html.contains(private));
    }
    assert!(html.contains("Public downloads are not available yet"));
    assert!(!html.contains("href=\"https://apps.apple.com"));
    let (_, aasa) = f
        .send(
            None,
            "GET",
            "/.well-known/apple-app-site-association",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(
        aasa["applinks"]["details"][0]["appID"],
        "2CRHRRYBPL.app.tesserix.civiclens"
    );
    assert_eq!(
        f.send(
            None,
            "GET",
            "/.well-known/assetlinks.json",
            Value::Null,
            None
        )
        .await
        .1,
        json!([])
    );
    assert_eq!(
        f.send(
            Some(2),
            "POST",
            &format!("/v1/moderation/community/{id}"),
            json!({"decision":"hide"}),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(None, "GET", &public, Value::Null, None).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(0), "POST", &share, json!({}), None).await.0,
        StatusCode::NOT_FOUND
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn community_discovery_filters_and_private_watchlists_do_not_leak_open_votes() {
    let f = Fixture::new().await;
    assert_eq!(
        f.send(None, "GET", "/v1/capabilities", Value::Null, None)
            .await
            .1["communityDiscovery"],
        true
    );
    let mut input = card_input("poll");
    input["topic"] = json!("environment");
    let key = uuid::Uuid::new_v4();
    let (status, first) = f
        .send(Some(0), "POST", "/v1/community", input.clone(), Some(key))
        .await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(first["topic"], "environment");
    let first_id = first["id"].as_str().unwrap();
    assert_eq!(
        f.send(Some(0), "POST", "/v1/community", input, Some(key))
            .await
            .1["id"],
        first_id
    );
    let mut input = card_input("poll");
    input["topic"] = json!("transport");
    input["title"] = json!("Should our crossing get a safer footpath?");
    input["closesAt"] = json!((time::OffsetDateTime::now_utc() + time::Duration::days(1))
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap());
    let (_, second) = f
        .send(
            Some(0),
            "POST",
            "/v1/community",
            input,
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    let second_id = second["id"].as_str().unwrap();
    for id in [first_id, second_id] {
        assert_eq!(
            f.send(
                Some(2),
                "POST",
                &format!("/v1/moderation/community/{id}"),
                json!({"decision":"approve"}),
                None
            )
            .await
            .0,
            StatusCode::OK
        );
    }
    let (_, found) = f
        .send(
            Some(1),
            "GET",
            "/v1/community?topic=environment&state=open&q=bins&countryCode=AU",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(found["items"].as_array().unwrap().len(), 1);
    assert_eq!(found["items"][0]["id"], first_id);
    assert!(found["items"][0]["results"].is_null());
    let (_, earliest) = f
        .send(
            Some(1),
            "GET",
            "/v1/community?sort=closing_soon&limit=1",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(earliest["items"][0]["id"], second_id);
    let cursor = earliest["nextCursor"].as_str().unwrap();
    let (_, later) = f
        .send(
            Some(1),
            "GET",
            &format!("/v1/community?sort=closing_soon&limit=1&before={cursor}"),
            Value::Null,
            None,
        )
        .await;
    assert_eq!(later["items"][0]["id"], first_id);
    let watch = format!("/v1/community/{first_id}/watch");
    assert_eq!(
        f.send(None, "POST", &watch, json!({"watching":true}), None)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let (one, two) = tokio::join!(
        f.send(Some(1), "POST", &watch, json!({"watching":true}), None),
        f.send(Some(1), "POST", &watch, json!({"watching":true}), None)
    );
    assert_eq!(one.0, StatusCode::OK);
    assert_eq!(one, two);
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM community_watches")
        .fetch_one(&f.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    assert_eq!(
        f.send(
            Some(0),
            "GET",
            "/v1/community?watching=true",
            Value::Null,
            None
        )
        .await
        .1["items"],
        json!([])
    );
    let (_, saved) = f
        .send(
            Some(1),
            "GET",
            "/v1/community?watching=true",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(saved["items"][0]["id"], first_id);
    assert_eq!(saved["items"][0]["watching"], true);
    let vote =
        json!({"choice":"yes","consent":true,"rulesVersion":contracts::COMMUNITY_RULES_VERSION});
    let (_, voted) = f
        .send(
            Some(1),
            "POST",
            &format!("/v1/community/{first_id}/response"),
            vote,
            None,
        )
        .await;
    assert!(voted["results"].is_null());
    assert_eq!(
        f.send(
            Some(1),
            "GET",
            "/v1/community?participated=true",
            Value::Null,
            None
        )
        .await
        .1["items"][0]["id"],
        first_id
    );
    assert_eq!(
        f.send(
            Some(0),
            "GET",
            "/v1/community?participated=true",
            Value::Null,
            None
        )
        .await
        .1["items"],
        json!([])
    );
    assert_eq!(
        f.send(
            Some(2),
            "POST",
            &format!("/v1/moderation/community/{first_id}"),
            json!({"decision":"hide"}),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(
            Some(1),
            "GET",
            "/v1/community?watching=true",
            Value::Null,
            None
        )
        .await
        .1["items"],
        json!([])
    );
    assert_eq!(
        f.send(Some(1), "POST", &watch, json!({"watching":false}), None)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(Some(1), "POST", &watch, json!({"watching":true}), None)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(1), "GET", "/v1/community?q=%01", Value::Null, None)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn community_post_quota_is_enforced_per_account_across_api_instances() {
    let f = Fixture::new().await;
    sqlx::query("INSERT INTO community_cards(id,owner_id,submission_key,payload_hash,kind,title,body,country_code,locality,closes_at,rules_version) SELECT gen_random_uuid(),$1,gen_random_uuid(),repeat('a',64),'request','Please add public bins','Please add bins by the public park.','AU','Melbourne',now()+interval '7 days',$2 FROM generate_series(1,20)")
        .bind(f.users[0].0).bind(contracts::COMMUNITY_RULES_VERSION).execute(&f.pool).await.unwrap();
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            "/v1/community",
            card_input("request"),
            Some(uuid::Uuid::new_v4())
        )
        .await
        .0,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        f.send(
            Some(1),
            "POST",
            "/v1/community",
            card_input("request"),
            Some(uuid::Uuid::new_v4())
        )
        .await
        .0,
        StatusCode::OK
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn administrative_lookup_is_country_scoped_paginated_and_explicitly_unverified() {
    let f = Fixture::new().await;
    directory::import_bundled(
        &f.pool,
        std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/data")),
    )
    .await
    .unwrap();
    let states = "/v1/directory/units?countryCode=IN&level=state&limit=50";
    assert_eq!(
        f.send(None, "GET", states, Value::Null, None).await.0,
        StatusCode::UNAUTHORIZED
    );
    let (status, page) = f.send(Some(0), "GET", states, Value::Null, None).await;
    assert_eq!(status, StatusCode::OK, "{page}");
    assert_eq!(page["items"].as_array().unwrap().len(), 36);
    assert!(page["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|r| r["countryCode"] == "IN"
            && r["verificationStatus"] == "reference"
            && r["complaintApiStatus"] == "unknown"));
    let path = "/v1/directory/units?countryCode=NP&level=municipality&limit=1";
    let (_, first) = f.send(Some(0), "GET", path, Value::Null, None).await;
    let cursor = first["nextCursor"].as_str().unwrap();
    let (_, next) = f
        .send(
            Some(0),
            "GET",
            &format!("{path}&before={cursor}"),
            Value::Null,
            None,
        )
        .await;
    assert_ne!(first["items"][0]["id"], next["items"][0]["id"]);
    assert_eq!(
        f.send(
            Some(0),
            "GET",
            "/v1/directory/units?countryCode=NZ&parentId=in-state-1",
            Value::Null,
            None
        )
        .await
        .1["items"],
        json!([])
    );
    for bad in [
        "countryCode=ZZ",
        "countryCode=IN&level=verified_authority",
        "countryCode=IN&before=bad-cursor",
        "countryCode=IN&limit=1000",
    ] {
        assert_eq!(
            f.send(
                Some(0),
                "GET",
                &format!("/v1/directory/units?{bad}"),
                Value::Null,
                None
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(directory::load_verified(&f.pool).await.unwrap().len(), 1);
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn community_creation_is_private_idempotent_and_requires_sign_in() {
    let f = Fixture::new().await;
    assert_eq!(
        f.send(None, "GET", "/v1/capabilities", Value::Null, None)
            .await
            .1["civicParticipation"],
        true
    );
    let input = card_input("request");
    let key = uuid::Uuid::new_v4();
    assert_eq!(
        f.send(None, "POST", "/v1/community", input.clone(), Some(key))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let (status, card) = f
        .send(Some(0), "POST", "/v1/community", input.clone(), Some(key))
        .await;
    assert_eq!(status, StatusCode::OK, "{card}");
    assert_eq!(card["status"], "pending");
    assert_eq!(card["authorNickname"], "TestKea");
    assert!(card.get("authorId").is_none());
    assert_eq!(card["myResponse"], Value::Null);
    let path = format!("/v1/community/{}", card["id"].as_str().unwrap());
    assert_eq!(
        f.send(Some(1), "GET", &path, Value::Null, None).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(0), "GET", &path, Value::Null, None).await.1["id"],
        card["id"]
    );
    assert_eq!(
        f.send(Some(0), "POST", "/v1/community", input.clone(), Some(key))
            .await
            .1["id"],
        card["id"]
    );
    let mut changed = input.clone();
    changed["title"] = json!("Should our park have more recycling bins?");
    assert_eq!(
        f.send(Some(0), "POST", "/v1/community", changed, Some(key))
            .await
            .0,
        StatusCode::CONFLICT
    );
    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM community_cards")
        .fetch_one(&f.pool)
        .await
        .unwrap();
    assert_eq!(rows, 1);
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn community_moderation_controls_public_discovery() {
    let f = Fixture::new().await;
    assert_eq!(
        f.send(Some(1), "GET", "/v1/community/access", Value::Null, None)
            .await
            .1["canModerate"],
        false
    );
    assert_eq!(
        f.send(Some(2), "GET", "/v1/community/access", Value::Null, None)
            .await
            .1["canModerate"],
        true
    );
    let (_, card) = f
        .send(
            Some(0),
            "POST",
            "/v1/community",
            card_input("poll"),
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    let id = card["id"].as_str().unwrap();
    let path = format!("/v1/moderation/community/{id}");
    let (status, feed) = f
        .send(Some(1), "GET", "/v1/community?kind=poll", Value::Null, None)
        .await;
    assert_eq!(status, StatusCode::OK, "{feed}");
    assert_eq!(feed["items"], json!([]));
    assert_eq!(
        f.send(Some(0), "GET", "/v1/community?mine=true", Value::Null, None)
            .await
            .1["items"][0]["id"],
        id
    );
    assert_eq!(
        f.send(
            Some(1),
            "GET",
            "/v1/moderation/community",
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        f.send(Some(1), "POST", &path, json!({"decision":"approve"}), None)
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,'moderator')")
        .bind(f.users[0].0)
        .execute(&f.pool)
        .await
        .unwrap();
    assert_eq!(
        f.send(Some(0), "POST", &path, json!({"decision":"approve"}), None)
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    let (status, approved) = f
        .send(Some(2), "POST", &path, json!({"decision":"approve"}), None)
        .await;
    assert_eq!(status, StatusCode::OK, "{approved}");
    assert_eq!(approved["status"], "approved");
    let (_, feed) = f
        .send(Some(1), "GET", "/v1/community?kind=poll", Value::Null, None)
        .await;
    assert_eq!(feed["items"][0]["id"], id);
    assert_eq!(
        f.send(Some(2), "POST", &path, json!({"decision":"hide"}), None)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(
            Some(1),
            "GET",
            &format!("/v1/community/{id}"),
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_events WHERE action='review_community_card'",
    )
    .fetch_one(&f.pool)
    .await
    .unwrap();
    assert_eq!(count, 2);
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn poll_responses_are_account_unique_and_results_reveal_only_after_closing() {
    let f = Fixture::new().await;
    let (_, card) = f
        .send(
            Some(0),
            "POST",
            "/v1/community",
            card_input("poll"),
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    let id = card["id"].as_str().unwrap();
    let path = format!("/v1/community/{id}/response");
    let response = |choice: Value| json!({"choice":choice,"rulesVersion":contracts::COMMUNITY_RULES_VERSION,"consent":true});
    assert_eq!(
        f.send(Some(0), "POST", &path, response(json!("yes")), None)
            .await
            .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        f.send(
            Some(2),
            "POST",
            &format!("/v1/moderation/community/{id}"),
            json!({"decision":"approve"}),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(None, "POST", &path, response(json!("yes")), None)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    for (actor, choice) in [(0, "yes"), (1, "no"), (2, "dont_know")] {
        let (status, card) = f
            .send(Some(actor), "POST", &path, response(json!(choice)), None)
            .await;
        assert_eq!(status, StatusCode::OK, "{card}");
        assert_eq!(card["myResponse"], choice);
        assert_eq!(card["results"], Value::Null);
    }
    let (a, b) = tokio::join!(
        f.send(Some(0), "POST", &path, response(json!("yes")), None),
        f.send(Some(0), "POST", &path, response(json!("yes")), None)
    );
    assert_eq!((a.0, b.0), (StatusCode::OK, StatusCode::OK));
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM community_responses")
            .fetch_one(&f.pool)
            .await
            .unwrap(),
        3
    );
    assert_eq!(
        f.send(Some(0), "POST", &path, response(Value::Null), None)
            .await
            .1["myResponse"],
        Value::Null
    );
    assert_eq!(
        f.send(Some(0), "POST", &path, response(json!("yes")), None)
            .await
            .0,
        StatusCode::OK
    );
    sqlx::query("UPDATE community_cards SET created_at=now()-interval '2 days',closes_at=now()-interval '1 day' WHERE id=$1").bind(uuid::Uuid::parse_str(id).unwrap()).execute(&f.pool).await.unwrap();
    assert_eq!(
        f.send(Some(0), "POST", &path, response(json!("no")), None)
            .await
            .0,
        StatusCode::CONFLICT
    );
    let (_, closed) = f
        .send(
            Some(1),
            "GET",
            &format!("/v1/community/{id}"),
            Value::Null,
            None,
        )
        .await;
    assert_eq!(closed["closed"], true);
    assert_eq!(
        closed["results"],
        json!({"total":3,"yes":{"count":1,"percent":33.3},"no":{"count":1,"percent":33.3},"dontKnow":{"count":1,"percent":33.3}})
    );
    assert!(closed.get("voters").is_none());
    assert!(!closed.to_string().contains("TestOwl"));
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn petition_opinions_stay_private_until_independent_review_and_abuse_reports_are_deduplicated(
) {
    let f = Fixture::new().await;
    let (_, card) = f
        .send(
            Some(0),
            "POST",
            "/v1/community",
            card_input("request"),
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    let id = card["id"].as_str().unwrap();
    f.send(
        Some(2),
        "POST",
        &format!("/v1/moderation/community/{id}"),
        json!({"decision":"approve"}),
        None,
    )
    .await;
    let path = format!("/v1/community/{id}/opinions");
    let input = json!({"text":"A recycling bin near the entrance would help too.","rulesVersion":contracts::COMMUNITY_RULES_VERSION,"consent":true});
    let key = uuid::Uuid::new_v4();
    let (status, opinion) = f
        .send(Some(1), "POST", &path, input.clone(), Some(key))
        .await;
    assert_eq!(status, StatusCode::OK, "{opinion}");
    assert_eq!(opinion["status"], "pending");
    assert_eq!(
        f.send(Some(1), "POST", &path, input, Some(key)).await.1["id"],
        opinion["id"]
    );
    assert_eq!(
        f.send(Some(0), "GET", &path, Value::Null, None).await.1["items"],
        json!([])
    );
    assert_eq!(
        f.send(Some(1), "GET", &path, Value::Null, None).await.1["items"][0]["id"],
        opinion["id"]
    );
    let review = format!(
        "/v1/moderation/community/{id}/opinions/{}",
        opinion["id"].as_str().unwrap()
    );
    assert_eq!(
        f.send(
            Some(2),
            "POST",
            &review,
            json!({"decision":"approve"}),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(Some(0), "GET", &path, Value::Null, None).await.1["items"][0]["text"],
        opinion["text"]
    );
    let response =
        json!({"choice":"yes","rulesVersion":contracts::COMMUNITY_RULES_VERSION,"consent":true});
    let (_, supported) = f
        .send(
            Some(1),
            "POST",
            &format!("/v1/community/{id}/response"),
            response,
            None,
        )
        .await;
    assert_eq!(supported["results"]["yes"]["count"], 1);
    let report = format!("/v1/community/{id}/flag");
    let reason = json!({"reason":"privacy"});
    assert_eq!(
        f.send(Some(1), "POST", &report, reason.clone(), None)
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(Some(1), "POST", &report, reason, None).await.0,
        StatusCode::OK
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM community_flags")
            .fetch_one(&f.pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        f.send(
            Some(1),
            "GET",
            "/v1/moderation/community/flags",
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let (status, flags) = f
        .send(
            Some(2),
            "GET",
            "/v1/moderation/community/flags",
            Value::Null,
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{flags}");
    assert_eq!(flags["items"][0]["cardId"], id);
    assert!(flags["items"][0].get("reporterId").is_none());
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn complaint_preparation_requires_owner_independent_review_and_fresh_channel() {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let f = Fixture::new().await;
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new(&mut jpeg)
        .encode(&[20, 90, 60], 1, 1, image::ExtendedColorType::Rgb8)
        .unwrap();
    let body = json!({"category":"waste","description":"Lovely, the grass has started collecting rubbish.","location":{"latitude":-37.81412345,"longitude":144.96331234,"countryCode":"AU","locality":"Melbourne"},"photoBase64":STANDARD.encode(jpeg),"channels":[],"complaintRequested":true,"consent":true,"communityRulesVersion":contracts::COMMUNITY_RULES_VERSION,"sharingMode":"manual"});
    let (status, report) = f
        .send(
            Some(0),
            "POST",
            "/v1/reports",
            body,
            Some(uuid::Uuid::new_v4()),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    assert_eq!(report["publications"], json!([]));
    let id = report["id"].as_str().unwrap();
    let path = format!("/v1/reports/{id}/complaint-package");
    let input = json!({"channelId":"au-vic-melbourne-cleaning","consent":true});
    let key = uuid::Uuid::new_v4();
    assert_eq!(
        f.send(None, "POST", &path, input.clone(), Some(key))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        f.send(Some(1), "POST", &path, input.clone(), Some(key))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(0), "POST", &path, input.clone(), Some(key))
            .await
            .0,
        StatusCode::CONFLICT
    );
    assert_eq!(f.send(Some(2),"POST",&format!("/v1/moderation/reports/{id}/approve"),json!({"publicDescription":"Rubbish is scattered on the grass.","publicLocality":"Melbourne","photoPrivacyReviewed":true,"reviewedPhotoCount":1,"includeParents":false}),None).await.0,StatusCode::BAD_REQUEST);
    let approval = json!({"publicDescription":"Rubbish is scattered on the grass beside the path.","publicLocality":"Melbourne","photoPrivacyReviewed":true,"reviewedPhotoCount":1,"includeParents":false,"complaintDescription":"Rubbish is scattered on the grass beside the path. Please arrange a clean-up.","complaintFactualReviewed":true});
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            &format!("/v1/moderation/reports/{id}/approve"),
            approval.clone(),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        f.send(
            Some(2),
            "POST",
            &format!("/v1/moderation/reports/{id}/approve"),
            approval,
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            &path,
            json!({"channelId":"au-vic-melbourne-cleaning","consent":false}),
            Some(key)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let (status, package) = f
        .send(Some(0), "POST", &path, input.clone(), Some(key))
        .await;
    assert_eq!(status, StatusCode::OK, "{package}");
    assert_eq!(package["status"], "prepared");
    assert_eq!(package["channel"]["apiStatus"], "unknown");
    assert_eq!(
        package["channel"]["url"],
        "https://services.melbourne.vic.gov.au/report/cleanpublicspace"
    );
    assert!(package["text"]
        .as_str()
        .unwrap()
        .contains("Please arrange a clean-up."));
    assert!(!package.to_string().contains("Lovely"));
    assert!(!package.to_string().contains("-37.81412345"));
    assert_eq!(package["photosBase64"].as_array().unwrap().len(), 1);
    assert_eq!(
        f.send(Some(0), "POST", &path, input, Some(key)).await.1["id"],
        package["id"]
    );
    let hid = package["id"].as_str().unwrap();
    assert_eq!(
        f.send(
            Some(1),
            "POST",
            &format!("/v1/complaints/{hid}/handoff"),
            json!({"consent":true}),
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let handoff = f
        .send(
            Some(0),
            "POST",
            &format!("/v1/complaints/{hid}/handoff"),
            json!({"consent":true}),
            None,
        )
        .await;
    assert_eq!(handoff.0, StatusCode::OK, "{:?}", handoff.1);
    assert_eq!(handoff.1["status"], "handoff_requested");
    assert!(handoff.1.get("providerReceipt").is_none());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM publications")
            .fetch_one(&f.pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM complaint_intents")
            .fetch_one(&f.pool)
            .await
            .unwrap(),
        1
    );
    let second_id = uuid::Uuid::now_v7();
    sqlx::query("INSERT INTO reports(id,owner_id,idempotency_key,payload_hash,report,photo,approval) SELECT $2,owner_id,$3,payload_hash,jsonb_set(report,'{id}',to_jsonb($2::uuid::text)),photo,approval FROM reports WHERE id=$1")
        .bind(uuid::Uuid::parse_str(id).unwrap()).bind(second_id).bind(uuid::Uuid::new_v4()).execute(&f.pool).await.unwrap();
    let second_key = uuid::Uuid::new_v4();
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            &format!("/v1/reports/{second_id}/complaint-package"),
            json!({"channelId":"au-vic-melbourne-cleaning","consent":true}),
            Some(second_key)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            &path,
            json!({"channelId":"au-vic-melbourne-cleaning","consent":true}),
            Some(second_key)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    // Test-only administrator invalidation must stop export even for an existing key.
    sqlx::query("UPDATE complaint_channels SET expires_at=now()-interval '1 second'")
        .execute(&f.pool)
        .await
        .unwrap();
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            &path,
            json!({"channelId":"au-vic-melbourne-cleaning","consent":true}),
            Some(key)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn last_daily_card_slot_accepts_concurrent_identical_retries_once() {
    let f = Fixture::new().await;
    sqlx::query("INSERT INTO community_cards(id,owner_id,submission_key,payload_hash,kind,title,body,country_code,locality,closes_at,rules_version) SELECT gen_random_uuid(),$1,gen_random_uuid(),repeat('a',64),'request','Please add public bins','Please add bins by the public park.','AU','Melbourne',now()+interval '7 days',$2 FROM generate_series(1,19)").bind(f.users[0].0).bind(contracts::COMMUNITY_RULES_VERSION).execute(&f.pool).await.unwrap();
    let key = uuid::Uuid::new_v4();
    let input = card_input("request");
    let (a, b) = tokio::join!(
        f.send(Some(0), "POST", "/v1/community", input.clone(), Some(key)),
        f.send(Some(0), "POST", "/v1/community", input.clone(), Some(key))
    );
    assert_eq!(a.0, StatusCode::OK, "{:?}", a.1);
    assert_eq!(b.0, StatusCode::OK, "{:?}", b.1);
    assert_eq!(a.1["id"], b.1["id"]);
    assert_eq!(
        f.send(Some(0), "POST", "/v1/community", input, Some(key))
            .await
            .0,
        StatusCode::OK
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM community_cards WHERE owner_id=$1")
            .bind(f.users[0].0)
            .fetch_one(&f.pool)
            .await
            .unwrap(),
        20
    );
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn closed_poll_results_use_one_consistent_read_timestamp() {
    let f = Fixture::new().await;
    let id = uuid::Uuid::now_v7();
    sqlx::query("INSERT INTO community_cards(id,owner_id,submission_key,payload_hash,kind,title,body,country_code,locality,closes_at,rules_version,status,created_at) VALUES($1,$2,$3,repeat('a',64),'poll','QA closed poll consistency','QA only: a deterministic deadline boundary regression.','AU','Melbourne','2000-01-01',$4,'approved','1999-01-01')")
        .bind(id).bind(f.users[0].0).bind(uuid::Uuid::new_v4()).bind(contracts::COMMUNITY_RULES_VERSION).execute(&f.pool).await.unwrap();
    for (actor, choice) in [(0, "yes"), (1, "no"), (2, "dont_know")] {
        sqlx::query("INSERT INTO community_responses(card_id,user_id,choice,rules_version) VALUES($1,$2,$3,$4)").bind(id).bind(f.users[actor].0).bind(choice).bind(contracts::COMMUNITY_RULES_VERSION).execute(&f.pool).await.unwrap();
    }
    // Test-only clock changes within a single read; statement time remains stable.
    sqlx::query("CREATE SEQUENCE qa_clock_calls")
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query(&format!("CREATE FUNCTION clock_timestamp() RETURNS timestamptz LANGUAGE SQL VOLATILE AS $$ SELECT CASE WHEN nextval('{}.qa_clock_calls')<=3 THEN '1970-01-01'::timestamptz ELSE '2100-01-01'::timestamptz END $$",f.schema)).execute(&f.pool).await.unwrap();
    let (status, card) = f
        .send(
            Some(0),
            "GET",
            &format!("/v1/community/{id}"),
            json!({}),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{card}");
    assert_eq!(card["closed"], true);
    assert_eq!(card["results"]["total"], 3);
    for key in ["yes", "no", "dontKnow"] {
        assert_eq!(card["results"][key]["count"], 1);
    }
    f.finish().await;
}

#[tokio::test]
#[ignore = "requires CIVICLENS_TEST_DATABASE_URL for an isolated scratch schema"]
async fn account_profiles_are_owner_only_bounded_and_strip_photo_metadata() {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let f = Fixture::new().await;
    let path = "/v1/me/profile";
    assert_eq!(
        f.send(None, "GET", path, Value::Null, None).await.0,
        StatusCode::UNAUTHORIZED
    );
    let (status, empty) = f.send(Some(0), "GET", path, Value::Null, None).await;
    assert_eq!(status, StatusCode::OK, "{empty}");
    assert_eq!(empty["bio"], "");
    assert!(empty["photoBase64"].is_null());
    let import = "/v1/me/profile/sign-in-photo";
    assert_eq!(
        f.send(None, "POST", import, json!({}), None).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        f.send(Some(0), "POST", import, json!({}), None).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(
            Some(0),
            "POST",
            import,
            json!({"url":"http://127.0.0.1/private"}),
            None
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    sqlx::query("UPDATE users SET sign_in_photo_url='http://169.254.169.254/private' WHERE id=$1")
        .bind(f.users[0].0)
        .execute(&f.pool)
        .await
        .unwrap();
    assert_eq!(
        f.send(Some(0), "POST", import, json!({}), None).await.0,
        StatusCode::NOT_FOUND
    );

    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new(&mut jpeg)
        .encode(&[20, 90, 60], 1, 1, image::ExtendedColorType::Rgb8)
        .unwrap();
    jpeg.extend_from_slice(b"private GPS metadata");
    let body = json!({"bio":"  I care about cleaner parks.  ","photoBase64":STANDARD.encode(jpeg)});
    let (status, saved) = f.send(Some(0), "PUT", path, body, None).await;
    assert_eq!(status, StatusCode::OK, "{saved}");
    assert_eq!(saved["bio"], "I care about cleaner parks.");
    let photo = STANDARD
        .decode(saved["photoBase64"].as_str().unwrap())
        .unwrap();
    assert!(image::load_from_memory(&photo).is_ok());
    assert!(!photo.windows(20).any(|b| b == b"private GPS metadata"));
    let (_, other) = f.send(Some(1), "GET", path, Value::Null, None).await;
    assert_eq!(other["bio"], "");
    assert!(other["photoBase64"].is_null());
    assert_eq!(
        f.send(
            Some(1),
            "GET",
            &format!("/v1/users/{}/profile", f.users[0].0),
            Value::Null,
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        f.send(Some(0), "PUT", path, json!({"bio":"a".repeat(281)}), None)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        f.send(
            Some(0),
            "PUT",
            path,
            json!({"bio":"","photoBase64":"invalid"}),
            None
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        f.send(
            Some(0),
            "PUT",
            path,
            json!({"bio":"","userId":f.users[1].0}),
            None
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let (status, kept) = f
        .send(Some(0), "PUT", path, json!({"bio":"ଅ".repeat(280)}), None)
        .await;
    assert_eq!(status, StatusCode::OK, "{kept}");
    assert_eq!(kept["photoBase64"], saved["photoBase64"]);
    let (_, removed) = f
        .send(
            Some(0),
            "PUT",
            path,
            json!({"bio":"","removePhoto":true}),
            None,
        )
        .await;
    assert!(removed["photoBase64"].is_null());
    f.finish().await;
}
