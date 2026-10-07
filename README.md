## Project Design Approach
- Design the databases.
- Make test cases for possible scenarios covering the backend implementation.
- Implement the classes.
- Implement the Express part for server and REST Api.
- Session in MySQL.

## Server setup

Run `npm install`, `npm test`, and `npm start` from the `server` directory. The server reads `server/data.env` and requires `DB_HOST`, `DB_USER`, `DB_NAME`, `PORT`, and `SESSION_SECRET`. `DB_PORT` defaults to 3306, and `DB_PASSWORD` defaults to an empty string.

Sessions use the same MySQL settings unless `SESSION_STORE_HOST`, `SESSION_STORE_PORT`, `SESSION_STORE_DATABASE`, `SESSION_STORE_USER`, or `SESSION_STORE_PASS` are provided. Set `FRONT_END_ORIGIN` when the frontend runs on another origin and needs credentialed CORS requests.

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