\# Trustlon Marketplace



Multi-vendor marketplace. One repository, frontend and backend in separate folders.



```

trustlon/

├── backend/

│   └── api/                 NestJS API, Prisma, PostgreSQL       (port 4000)

├── frontend/

│   └── storefront/          Next.js customer storefront          (port 3000)

├── docs/

│   ├── CONTRIBUTING.md      Daily Git workflow

│   └── modules/             One document per finished module

├── .github/                 CI and pull request template

└── docker-compose.yml       Local PostgreSQL

```



\## Requirements



\- Node.js 22 (see `.nvmrc`)

\- Docker Desktop, or a local PostgreSQL 16



\## First-time setup



```bash

npm install

cp backend/api/.env.example backend/api/.env

cp frontend/storefront/.env.example frontend/storefront/.env.local

npm run db:up

npm run db:migrate

```



Replace `JWT\_ACCESS\_SECRET` and `OTP\_SECRET` in `backend/api/.env` with random values:



```bash

node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

```



\## Run locally



```bash

npm run dev:api

npm run dev:storefront

```



Open http://localhost:3000. In development, verification codes are printed in the API terminal.



\## Modules



| Spec section | Module | Status | Document |

|---|---|---|---|

| 1 | Customer Authentication | In progress | \[docs/modules/customer-auth.md](docs/modules/customer-auth.md) |



\## Workflow



Read \[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) before your first push.

