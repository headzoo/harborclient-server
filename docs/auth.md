# Authentication

HarborClient Server protects API routes with database-backed bearer tokens. Operators create tokens via the CLI; HarborClient desktop clients send them in the `Authorization` header.

## Prerequisites

Configure your database in `server.yaml`, then apply schema migrations:

```bash
harborclient-server migrate
```

For Postgres and MySQL this creates the `api_tokens` table. Firestore uses a schemaless `apiTokens` collection and requires no migration work.

## Create a token

```bash
harborclient-server token create --name "Alice laptop"
```

The command prints a one-time secret prefixed with `hbk_`. Store it immediately — the server only persists a sha256 hash.

Example output:

```text
Created API token "Alice laptop" (550e8400-e29b-41d4-a716-446655440000).
Token prefix: hbk_AbCd1234

Store this token now; it will not be shown again:
hbk_...
```

## List tokens

```bash
harborclient-server token list
```

Listing shows id, name, prefix, created time, last used time, and revocation time. Secrets are never displayed.

## Revoke a token

```bash
harborclient-server token revoke <token-id>
```

Revocation is soft (sets `revoked_at`) so audit history is preserved. Revoked tokens immediately fail authentication.

## Using tokens from HarborClient

In HarborClient, configure request or collection authorization as **Bearer Token** and paste the secret from `token create`.

The server validates:

```http
Authorization: Bearer hbk_...
```

Protected routes return `401 Unauthorized` with `WWW-Authenticate: Bearer` when the header is missing, malformed, or the token is unknown or revoked.

`GET /health` remains public for load balancers and connectivity checks.
