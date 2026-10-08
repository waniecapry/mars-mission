## Project Design Approach
- Design the databases.
- Make test cases for possible scenarios covering the backend implementation.
- Implement the classes.
- Implement the Express part for server and REST Api.
- Session in MySQL.

## Server setup

From the project root, run `./initialise-environtment.sh` to install server dependencies and set up a fresh MySQL database. It prompts for the MySQL username, host, and password, runs `server/setup-mySql.sql` through the MySQL client, then calls `setup.js` to add three Crew Leads, three passengers (one per tier), and the resources. The port defaults to `3306`; set `MYSQL_PORT` in the shell to override it. The SQL script refuses to create an existing `marsMission` database. After the inserts commit, generated login details are saved in the private, Git-ignored `credentials.json` file. The seven initial resource rows correspond to the Silver, Gold, and Platinum facilities in the specification; their `type` is `0` because the specification does not define type codes.

After setup, configure `server/data.env` with `DB_NAME=marsMission` and the same host, user, and password (or credentials for a MySQL user with access to that database).

Run `npm test` and `npm start` from the `server` directory. The server reads `server/data.env` and requires `DB_HOST`, `DB_USER`, `DB_NAME`, `PORT`, and `SESSION_SECRET`. `DB_PORT` defaults to 3306, and `DB_PASSWORD` defaults to an empty string.

Sessions use the same MySQL settings unless `SESSION_STORE_HOST`, `SESSION_STORE_PORT`, `SESSION_STORE_DATABASE`, `SESSION_STORE_USER`, or `SESSION_STORE_PASS` are provided. Set `FRONT_END_ORIGIN` when the frontend runs on another origin and needs credentialed CORS requests.

## Vue API

The Vue app requests `GET /i/session` on startup. A `401` response means it should show the login screen; a successful response contains the signed-in actor and accessible resources. Use `fetch(url, { credentials: "include" })` for session requests. When Vite runs on a separate origin such as `http://localhost:5173`, set `FRONT_END_ORIGIN` to that exact origin in `server/data.env`. All `/i/` routes require a signed-in session; `/login` is public.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/login` | Sign in with `{ "email": "...", "password": "..." }`; returns actor and resources. |
| `POST` | `/i/logout` | End the current session. |
| `GET` | `/i/session` | Return actor and accessible resources for the current session. |
| `GET` | `/i/resources` | List resources accessible to the current user. |
| `GET` | `/i/passengers` | Crew only: list passengers. |
| `POST` | `/i/passengers` | Crew only: create a passenger with `name`, `email`, `password`, and numeric `tier` (1–3). |
| `PATCH` | `/i/passengers/:id/tier` | Crew only: change a passenger's tier with `{ "tier": 1 }`, `2`, or `3`. |

The backend serves a built Vue app from `client/dist`; during Vite development, open the Vite URL and call these routes at the backend origin.

## Project Extensions (Should implement when there's more time)
- I was planning to use worker processes for the nodejs server. But seems like I may not need this now, maybe if this is a production project, i will make worker processes to handle incoming HTTP client or websocket client.
- Instead of using REST API, I was actually planing to use SOcket.io broadcasting event. But maybe not now for this assesment.
- Improve the database design and add appropriate constraints.
- Record an audit trail for all actions.
- Add the ability to delete passengers and resources.
- Allow inactive crew members to be replaced while keeping the crew size at three or fewer.
- Resource inventory management.

## Usage of AI Tools
- Im using Codex as my coding agent tool.
- I use Codex to implement test cases and add more edge cases to speed up development process.
- I use Codex to verify whether my implementation has cover all of the requirements given and the edge cases.