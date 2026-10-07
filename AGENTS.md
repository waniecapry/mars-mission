# AGENTS.md

## Project Guidelines

- Inspect the existing implementation before making changes.
- Follow the current project architecture, naming conventions, and coding style.
- Do not redesign or refactor working code unless explicitly requested.
- Do not implement features listed under "Project Extensions" unless explicitly requested.
- Do not invent new APIs, classes, methods, database fields, or business rules.

## Testing

- Tests must reflect the current implementation.
- Prefer Node.js built-in `assert` unless the project already uses another testing framework.
- Cover both successful and failure scenarios.
- Include boundary cases and validation cases where relevant.
- Keep tests independent where possible.
- Clean up test data if tests modify the database.
- Do not change production logic just to make a test pass.
- If a test reveals a likely production bug, report it instead of silently fixing it.

## Database

- The project uses MySQL.
- Respect the existing schema and relationships.
- Do not modify database structure unless explicitly requested.
- Be careful not to delete or overwrite unrelated data during testing.

## Backend

- Backend is Node.js / Express.
- Follow existing REST API conventions.
- Use the existing classes and service/database abstractions instead of bypassing them.

## Scope

The current assessment implementation is the priority.

Items described in README under "Project Extensions" are future ideas and should NOT be implemented unless explicitly requested.

Examples include:
- Node.js worker processes
- Socket.IO broadcasting
- audit trails
- passenger/resource deletion
- inactive crew replacement
- resource inventory management