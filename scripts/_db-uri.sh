# Devolve a URI do Postgres pronta pro pg_dump/psql em $DB_URI.
# NUNCA imprime a URI (a senha vive nela).
_le_db_uri() {
  local raw
  raw=$(grep -m1 '^DATABASE_URL=' /opt/conta-ia/.env 2>/dev/null | cut -d= -f2-) || return 1
  raw=${raw%\"}; raw=${raw#\"}; raw=${raw%\'}; raw=${raw#\'}
  raw=${raw//\\$/$}          # o .env escapa o $ pro dotenv
  DB_URI=${raw%%\?*}         # pg_dump nao aceita ?schema=public
  [ -n "$DB_URI" ] || return 1
}
