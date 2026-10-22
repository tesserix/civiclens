#!/usr/bin/env bash
set -euo pipefail

: "${API_IMAGE:?set API_IMAGE to the built release image}"
pg_image='postgres@sha256:a85daf0dbd5e79586e850e3fe4b21b796799828ad015ce2166aeb98cc24da61c'
smoke_dir=$(mktemp -d)
smoke_name="civiclens-smoke-$$"
cleanup() {
  local result=$?
  if ((result != 0)); then
    docker logs --tail 80 "$smoke_name-api" 2>&1 || true
    docker logs --tail 30 "$smoke_name-db" 2>&1 || true
  fi
  docker rm -f "$smoke_name-api" "$smoke_name-db" >/dev/null 2>&1 || true
  docker network rm "$smoke_name" >/dev/null 2>&1 || true
  rm -rf "$smoke_dir"
}
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$smoke_dir/ca.key" -out "$smoke_dir/ca.crt" \
  -subj '/CN=CivicLens smoke CA' >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout "$smoke_dir/server.key" \
  -out "$smoke_dir/server.csr" -subj '/CN=database' >/dev/null 2>&1
printf 'subjectAltName=DNS:database\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > "$smoke_dir/server.ext"
openssl x509 -req -in "$smoke_dir/server.csr" -CA "$smoke_dir/ca.crt" \
  -CAkey "$smoke_dir/ca.key" -CAcreateserial -days 1 \
  -extfile "$smoke_dir/server.ext" -out "$smoke_dir/server.crt" >/dev/null 2>&1
docker network create "$smoke_name" >/dev/null
docker create --name "$smoke_name-db" --network "$smoke_name" --network-alias database \
  -e POSTGRES_PASSWORD=isolated-ci-only "$pg_image" bash -c \
  'chown postgres:postgres /tmp/server.key; chmod 600 /tmp/server.key; exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key' >/dev/null
docker cp "$smoke_dir/server.crt" "$smoke_name-db:/tmp/server.crt"
docker cp "$smoke_dir/server.key" "$smoke_name-db:/tmp/server.key"
docker start "$smoke_name-db" >/dev/null
for ((attempt=0; attempt<30; attempt++)); do
  if docker exec "$smoke_name-db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$smoke_name-db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE civiclens_runtime LOGIN PASSWORD 'isolated-ci-only' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE civiclens_migrator LOGIN PASSWORD 'isolated-ci-only' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE civiclens_db OWNER civiclens_migrator;
SQL

secrets() {
  printf '{"civiclens-database-url":"postgres://%s:isolated-ci-only@database:5432/civiclens_db?sslmode=verify-full","civiclens-identity-key":"isolated-ci-only-identity-key-32-characters"}' "$1" \
    > "$smoke_dir/secrets.json"
}
api_args=(-e CIVICLENS_ENV=production -e CIVICLENS_SECRETS_FILE=/tmp/secrets.json -e PGSSLROOTCERT=/tmp/ca.crt)
# Copy the public CA and the throwaway secret into each container; never mount the server's private key.
start_api() {
  docker cp "$smoke_dir/ca.crt" "$smoke_name-api:/tmp/ca.crt"
  docker cp "$smoke_dir/secrets.json" "$smoke_name-api:/tmp/secrets.json"
  docker start "$@" "$smoke_name-api"
}

secrets civiclens_migrator
docker create --name "$smoke_name-api" --network "$smoke_name"\
  "${api_args[@]}" "$API_IMAGE" migrate >/dev/null
start_api -a
test "$(docker inspect -f '{{.State.ExitCode}}' "$smoke_name-api")" = 0
docker rm "$smoke_name-api" >/dev/null

secrets civiclens_runtime
docker create --name "$smoke_name-api" --network "$smoke_name" \
  "${api_args[@]}" -e CIVICLENS_OIDC_PROJECT_ID=smoke-project \
  -e CIVICLENS_OIDC_ORGANIZATION_ID=smoke-org -e CIVICLENS_OIDC_IOS_CLIENT_ID=smoke-ios \
  -e CIVICLENS_OIDC_ANDROID_CLIENT_ID=smoke-android -e CIVICLENS_GOOGLE_IDP_ID=smoke-google \
  "$API_IMAGE" >/dev/null
start_api >/dev/null

# Probe from the database container so this also runs inside Cloud Build.
docker exec -i "$smoke_name-db" bash -s -- "$smoke_name-api" <<'SH'
set -euo pipefail
host=$1
session="Session $(printf 'a%.0s' {1..64})"
probe() {
  local path=$1 expected=$2 header='' response
  if [[ -n ${3:-} ]]; then header="Authorization: $3"$'\r\n'; fi
  exec 3<>"/dev/tcp/$host/8080"
  printf 'GET %s HTTP/1.1\r\nHost: %s\r\n%sConnection: close\r\n\r\n' "$path" "$host" "$header" >&3
  IFS= read -r response <&3
  exec 3<&- 3>&-
  [[ "$response" == "HTTP/1.1 $expected "* ]]
}
for ((attempt=0; attempt<30; attempt++)); do
  if (probe /readyz 200) 2>/dev/null; then break; fi
  sleep 1
done
probe /healthz 200
probe /readyz 200
probe /v1/capabilities 200
probe /v1/privacy 200
probe /v1/me 401
probe /v1/me 401 "$session"
probe /v1/reports 401 "$session"
probe /v1/me/deletion-request 401 "$session"
SH
echo 'PASS: release container, TLS database, migrations, runtime grants and protected routes'
