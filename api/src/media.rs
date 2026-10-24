use crate::error::Error;
use google_cloud_auth::credentials::{CacheableResource, Credentials};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Reference {
    pub bucket: String,
    pub object: String,
    pub generation: String,
}

pub struct Store {
    bucket: String,
    origin: String,
    credentials: Credentials,
    http: reqwest::Client,
}

impl Store {
    pub fn new(bucket: &str, http: reqwest::Client) -> Result<Self, Error> {
        let credentials = google_cloud_auth::credentials::mds::Builder::default()
            .with_scopes(["https://www.googleapis.com/auth/devstorage.read_write"])
            .build()
            .map_err(|_| Error::Unavailable)?;
        Ok(Self {
            bucket: bucket.into(),
            origin: "https://storage.googleapis.com".into(),
            credentials,
            http,
        })
    }

    #[cfg(test)]
    pub fn for_test(origin: &str, bucket: &str) -> Self {
        let url = reqwest::Url::parse(origin).unwrap();
        assert_eq!(url.scheme(), "http");
        assert_eq!(url.host_str(), Some("127.0.0.1"));
        Self {
            bucket: bucket.into(),
            origin: origin.into(),
            credentials: google_cloud_auth::credentials::anonymous::Builder::new().build(),
            http: reqwest::Client::new(),
        }
    }

    async fn request(
        &self,
        method: reqwest::Method,
        url: reqwest::Url,
    ) -> Result<reqwest::RequestBuilder, Error> {
        let headers = self
            .credentials
            .headers(axum::http::Extensions::new())
            .await
            .map_err(|_| Error::Unavailable)?;
        let CacheableResource::New { data, .. } = headers else {
            return Err(Error::Unavailable);
        };
        Ok(self.http.request(method, url).headers(data))
    }

    fn url(&self, upload: bool, object: Option<&str>) -> Result<reqwest::Url, Error> {
        let mut url = reqwest::Url::parse(&self.origin).map_err(|_| Error::Internal)?;
        let mut parts = url.path_segments_mut().map_err(|_| Error::Internal)?;
        if upload {
            parts.push("upload");
        }
        parts.extend(["storage", "v1", "b", &self.bucket, "o"]);
        if let Some(object) = object {
            parts.push(object);
        }
        drop(parts);
        Ok(url)
    }

    pub async fn put(&self, object: &str, bytes: &[u8]) -> Result<Reference, Error> {
        let mut url = self.url(true, None)?;
        url.query_pairs_mut().extend_pairs([
            ("uploadType", "media"),
            ("name", object),
            ("ifGenerationMatch", "0"),
        ]);
        let response = self
            .request(reqwest::Method::POST, url)
            .await?
            .header(reqwest::header::CONTENT_TYPE, "image/jpeg")
            .body(bytes.to_vec())
            .send()
            .await
            .map_err(|_| Error::Unavailable)?;
        let generation = if response.status() == reqwest::StatusCode::PRECONDITION_FAILED {
            let (existing, generation) = self.read(object, None).await?;
            if existing != bytes {
                return Err(Error::Conflict(
                    "Stored photo differs from this submission. Contact support.",
                ));
            }
            generation
        } else {
            if !response.status().is_success() {
                return Err(Error::Unavailable);
            }
            let metadata: serde_json::Value =
                serde_json::from_slice(&bounded(response, 64_000).await?)
                    .map_err(|_| Error::Unavailable)?;
            metadata["generation"]
                .as_str()
                .filter(|g| g.parse::<u64>().is_ok())
                .ok_or(Error::Unavailable)?
                .into()
        };
        Ok(Reference {
            bucket: self.bucket.clone(),
            object: object.into(),
            generation,
        })
    }

    async fn read(
        &self,
        object: &str,
        generation: Option<&str>,
    ) -> Result<(Vec<u8>, String), Error> {
        let mut url = self.url(false, Some(object))?;
        url.query_pairs_mut().append_pair("alt", "media");
        if let Some(generation) = generation {
            url.query_pairs_mut().append_pair("generation", generation);
        }
        let response = self
            .request(reqwest::Method::GET, url)
            .await?
            .send()
            .await
            .map_err(|_| Error::Unavailable)?;
        if !response.status().is_success() {
            return Err(Error::Unavailable);
        }
        let actual = response
            .headers()
            .get("x-goog-generation")
            .and_then(|h| h.to_str().ok())
            .filter(|g| g.parse::<u64>().is_ok())
            .ok_or(Error::Unavailable)?
            .to_owned();
        if generation.is_some_and(|g| g != actual) {
            return Err(Error::Unavailable);
        }
        Ok((bounded(response, 6_000_000).await?, actual))
    }

    pub async fn get(&self, reference: &Reference) -> Result<Vec<u8>, Error> {
        if reference.bucket != self.bucket || reference.generation.parse::<u64>().is_err() {
            return Err(Error::Unavailable);
        }
        Ok(self
            .read(&reference.object, Some(&reference.generation))
            .await?
            .0)
    }
}

async fn bounded(mut response: reqwest::Response, max: usize) -> Result<Vec<u8>, Error> {
    if response.content_length().is_some_and(|n| n > max as u64) {
        return Err(Error::Unavailable);
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| Error::Unavailable)? {
        if bytes.len() + chunk.len() > max {
            return Err(Error::Unavailable);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Bytes,
        http::{HeaderMap, StatusCode, Uri},
        response::IntoResponse,
        Json, Router,
    };
    use std::sync::{Arc, Mutex};

    #[tokio::test]
    async fn retries_reuse_immutable_objects_and_reads_pin_the_saved_generation() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let capture = seen.clone();
        let routes = Router::new().fallback(
            move |method: axum::http::Method, uri: Uri, headers: HeaderMap, body: Bytes| {
                let capture = capture.clone();
                async move {
                    assert!(!uri.to_string().contains("predefinedAcl"));
                    assert!(!headers.contains_key("authorization"));
                    let mut requests = capture.lock().unwrap();
                    let uploaded = requests
                        .iter()
                        .any(|(m, _, _): &(String, String, Vec<u8>)| m == "POST");
                    requests.push((method.to_string(), uri.to_string(), body.to_vec()));
                    if method == "POST" {
                        assert!(uri.query().unwrap().contains("ifGenerationMatch=0"));
                        assert_eq!(body.as_ref(), b"private-jpeg");
                        if uploaded {
                            StatusCode::PRECONDITION_FAILED.into_response()
                        } else {
                            Json(serde_json::json!({"generation":"7"})).into_response()
                        }
                    } else {
                        ([("x-goog-generation", "7")], b"private-jpeg".to_vec()).into_response()
                    }
                }
            },
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let (stop, done) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            axum::serve(listener, routes)
                .with_graceful_shutdown(async {
                    done.await.ok();
                })
                .await
                .unwrap();
        });
        let store = Store::for_test(&origin, "civiclens-test");
        let reference = store
            .put("reports/owner/key/hash/0.jpg", b"private-jpeg")
            .await
            .unwrap();
        assert_eq!(reference.generation, "7");
        assert_eq!(
            store
                .put("reports/owner/key/hash/0.jpg", b"private-jpeg")
                .await
                .unwrap()
                .generation,
            "7"
        );
        assert_eq!(store.get(&reference).await.unwrap(), b"private-jpeg");
        assert!(seen
            .lock()
            .unwrap()
            .last()
            .unwrap()
            .1
            .contains("generation=7"));
        stop.send(()).unwrap();
        server.await.unwrap();
    }
}
