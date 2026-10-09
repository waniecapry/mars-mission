#!/bin/bash

set -o errexit                        # Exit when a command fails.
set -o pipefail                       # The exit status of the last command that threw a non-zero exit code is returned.
set -o nounset                        # Exit when undeclared variables are used.

npm run build --prefix public

npm start --prefix server