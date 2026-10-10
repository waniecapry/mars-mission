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

Sessions use the same MySQL settings unless `SESSION_STORE_HOST`, `SESSION_STORE_PORT`, `SESSION_STORE_DATABASE`, `SESSION_STORE_USER`, or `SESSION_STORE_PASS` are provided.

## Run the application

To run the application, make sure the setup has been done first. If not, please refer to Server Setup for further in formation.

- Run ./run.sh from the mars-mission directory to run the application and go to http://127.0.0.1:{portno}

## Testing

- Backend: run `npm test` from `server`.
- Frontend browser tests: run `npm run test:e2e` from `public`. On a fresh machine, run `npx playwright install chromium` there first. Playwright starts the Vite frontend and supplies isolated API responses; the tests do not require MySQL or real accounts.

## Project Extensions (Should implement when there's more time)
- I was planning to use worker processes for the nodejs server. But seems like I may not need this now, maybe if this is a production project, i will make worker processes to handle incoming HTTP client or websocket client.
- Instead of using REST API, I was actually planing to use Socket.io broadcasting event. So that anything changes qat the backend can be sent back to the front end on the spot by emitting event from the server side.
- Improve the database design and add appropriate constraints.
- Record an audit trail for all actions beyond the resource interactions already tracked.
- Add the ability to delete passengers and resources.
- Allow inactive crew members to be replaced while keeping the crew size at three or fewer.
- Resource inventory management beyond basic provisioning and active/inactive status.

## Usage of AI Tools
- Im using Codex as my coding agent tool.
- I use Codex to implement test cases and add more edge cases to speed up development process.
- I use Codex to verify whether my implementation has cover all of the requirements given and the edge cases.
- I use codex to implement the front end code based on what have I implemented for the backend.
- I make the basic structure for vue, and ask AI to continue implementing it since the features are not that much, i do not make any tasks separation for the AI to start their work.

## Front end testing made using AI

- I use Codex to implement the testing for the front end feature using Playwright.
- This is the prompt I used to ask Codex to start implementing it:

"Add Playwright end-to-end testing to this frontend.

Inspect the app, its package manager, routes, existing tests, and CI setup first. Install and configure Playwright Test using the project's conventions. Configure it to start the local app with `webServer` and use a `baseURL`. Add a clear test command and ignore generated reports and test artifacts.

Write a small, meaningful suite for the real user journeys: page loading and navigation, the primary interaction or form, validation and feedback, and mobile behavior. Include keyboard interaction where relevant. Cover loading, empty, or error states when they can be reproduced reliably.

Test what users see and do. Prefer role and label locators with Playwright's retrying assertions. Keep tests independent, use controlled test data, and avoid fixed sleeps, fragile CSS selectors, and broad screenshots of every page. Do not call production services or use production data.

Run the suite, fix test setup issues and frontend defects it reveals, and rerun until it passes. If this project already has CI, add the Playwright suite to it. Finish by listing the scenarios covered, the command to run them, and any important gaps."