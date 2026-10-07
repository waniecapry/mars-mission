## Project Design Approach
- Design the databases.
- Make test cases for possible scenarios covering the backend implementation.
- Implement the classes.
- Implement the Express part for server and REST Api.
- Session in MySQL.

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