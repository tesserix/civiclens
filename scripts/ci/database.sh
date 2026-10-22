#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD=local
psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE civiclens_test;' >&2
printf '%s\n' 'CIVICLENS_TEST_DATABASE_URL=postgres://postgres:local@127.0.0.1:5432/civiclens_test?sslmode=disable'
