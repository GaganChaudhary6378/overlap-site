#!/usr/bin/env bash
# Creates its own disposable cluster; never connects to a configured project or external database.
# tests/rooms.test.sql supplies minimal auth.users/auth.uid mocks, not a Supabase Auth server.
set -euo pipefail
for command in initdb pg_ctl psql; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required PostgreSQL command missing: %s\n' "$command" >&2
    exit 1
  fi
done
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# A short path keeps PostgreSQL's Unix socket below the macOS path limit.
room_test_dir="$(mktemp -d /private/tmp/overlap-sql.XXXXXX 2>/dev/null || mktemp -d /tmp/overlap-sql.XXXXXX)"
cleanup() {
  pg_ctl -D "$room_test_dir/data" -m fast -w stop >/dev/null 2>&1 || true
  # Delete only the unique directory this invocation created, including its test-only database.
  case "$room_test_dir" in
    /private/tmp/overlap-sql.*|/tmp/overlap-sql.*) rm -rf -- "$room_test_dir" ;;
  esac
}
trap cleanup EXIT
initdb -D "$room_test_dir/data" -A trust --no-locale --encoding=UTF8 >"$room_test_dir/init.log" 2>&1 || { cat "$room_test_dir/init.log" >&2; exit 1; }
# Unix socket in a private directory; no TCP listener. A shared port number is safe across unique socket directories.
pg_ctl -D "$room_test_dir/data" -l "$room_test_dir/server.log" -o "-k $room_test_dir -p 55438 -h '' -c wal_level=logical" -w start >/dev/null || { cat "$room_test_dir/server.log" >&2; exit 1; }
psql -h "$room_test_dir" -p 55438 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1 -f "$script_dir/rooms.test.sql"
