# Trustlon Marketplace

Multi-vendor marketplace with npm workspaces for the NestJS API and Next.js storefront.
Run npm commands from this repository root (the directory containing `.git` and this README).

```text
Trustlon/
  backend/
    api/
      prisma/schema/        Prisma models and generated migrations
      src/                  NestJS API (port 4000)
      test/                 API integration tests
      .env.example
      nest-cli.json
      package.json
      tsconfig.json
      tsconfig.build.json
  frontend/
    storefront/
      src/                  Next.js storefront (port 3000)
      public/
      .env.example
      package.json
      next.config.ts
      tsconfig.json
      ...                   PostCSS and Tailwind configuration
  docs/
    modules/
    CONTRIBUTING.md
  .github/
  docker-compose.yml        Local PostgreSQL
  package.json              Workspaces: backend/* and frontend/*
  package-lock.json         Shared dependency lockfile
  .gitignore
  .editorconfig
  .prettierrc
  .nvmrc
  README.md
```

## Requirements

- Node.js 22 (see `.nvmrc`) and npm.
- Docker Desktop, or a local PostgreSQL 16 instance.

## First-time setup

Install from the repository root so both workspaces and the root tools are installed:

```sh
npm ci
```

Copy `backend/api/.env.example` to `backend/api/.env` and
`frontend/storefront/.env.example` to `frontend/storefront/.env.local`.
Keep existing environment files if already configured.
Replace `JWT_ACCESS_SECRET` and `OTP_SECRET` in the API environment with separate random values:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start PostgreSQL and apply development migrations:

```sh
npm run db:up
npm run db:migrate -- --name init_customer_auth
```

The current repository has no committed migrations. On the first setup, review and
commit the generated migration under `backend/api/prisma/schema/migrations/`.
`npm run db:deploy` applies committed migrations; it does not create the initial schema
without them. CI also requires those migrations before its API integration tests can pass.

`npm ci` generates the Prisma client through the API postinstall script. After changing
Prisma models, regenerate it with `npm run db:generate`.

## Run locally

Run each command in a separate terminal at the repository root:

```sh
npm run dev:api
npm run dev:storefront
```

Open http://localhost:3000. In development, verification codes are printed in the API terminal.
The storefront forwards `/api/v1` requests to `API_URL` (default http://localhost:4000).

## Validation

```sh
npm ls --workspaces --depth=0
npm run typecheck
npm test
npm run build

docker compose config --quiet
npm run db:up
```

The root test command runs the API unit tests; the storefront currently has no test script.
To run only one workspace, use `npm run build -w backend/api` or
`npm run build -w frontend/storefront` (the same syntax works for typecheck).

API integration tests require a separate, migrated test database. Set `DATABASE_URL_TEST`
to that database before running `npm run test:e2e`; the tests truncate authentication tables.
Apply migrations to that database first by setting `DATABASE_URL` for `npm run db:deploy`.
Do not use a database containing data you need to preserve.

Docker Compose runs PostgreSQL only; it does not build or run either application.
`npm run db:down` stops Compose services and retains the named database volume.

## Modules

| Spec section | Module | Status | Document |
|---|---|---|---|
| 1 | Customer Authentication | In progress | [Customer authentication](docs/modules/customer-auth.md) |

## Workflow

Read [CONTRIBUTING.md](docs/CONTRIBUTING.md) before your first push.
Use the shared root lockfile; do not create separate workspace lockfiles or commit local backups.
