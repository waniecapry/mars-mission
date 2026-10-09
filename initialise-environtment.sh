#!/bin/bash

set -o errexit                        # Exit when a command fails.
set -o pipefail                       # The exit status of the last command that threw a non-zero exit code is returned.
set -o nounset                        # Exit when undeclared variables are used.

LARROWS="\n🏯 ⇨ ⇨ ⇨ ⇨ ⇨ ⇨ ⇨ ⇨ ⇨ ⇨ ⇨ "
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo -e "$LARROWS BEGIN npm install\n"

npm install --prefix "$SCRIPT_DIR/server"
npm install --prefix "$SCRIPT_DIR/public"

echo -e "$LARROWS BEGIN database setup\n"

while true; do
    read -r -p "MySQL username: " MYSQL_USER

    if [[ -n "${MYSQL_USER//[[:space:]]/}" ]]; then
        break
    fi

    echo "MySQL username cannot be empty." >&2
done

read -r -p "MySQL host [127.0.0.1]: " MYSQL_HOST

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"

read -r -s -p "MySQL password: " MYSQL_PASSWORD

printf '\n'

MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host="$MYSQL_HOST" --user="$MYSQL_USER" --port="${MYSQL_PORT:-3306}" < "$SCRIPT_DIR/server/setup-mySql.sql"

# setup.js inserts the Crew Leads and resources into the database created above.
printf '%s' "$MYSQL_PASSWORD" | MYSQL_USER="$MYSQL_USER" node "$SCRIPT_DIR/setup.js" "$MYSQL_HOST"

unset MYSQL_PASSWORD

echo -e "$LARROWS END initialising of mars-mission\n"