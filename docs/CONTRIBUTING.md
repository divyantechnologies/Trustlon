# Daily Git Workflow

One repository holds every part of Trustlon. Each feature lives on its own branch and in its own folders, so work started on different days merges without conflicts.

## First push (one time only)

Run these once, in the company repository, to set up `develop` and push the project base and the auth feature.

```bash
git clone <company-repo-url> trustlon
cd trustlon
# Copy the contents of this project into the folder (including hidden files such as .gitignore)

git checkout -b develop
git add .gitignore .gitattributes .editorconfig .nvmrc .prettierrc package.json docker-compose.yml README.md docs/CONTRIBUTING.md
git commit -m "chore: set up monorepo structure and workflow"
git push -u origin develop

git checkout -b feature/storefront-customer-auth
npm install
npm run db:up
npm run db:migrate -- --name init_customer_auth
git add .
git commit -m "feat(auth): customer sign-up, login and password reset"
git push -u origin feature/storefront-customer-auth
```

`npm install` creates `package-lock.json` and the migration step creates the first migration folder. Both are committed with the feature, together with the CI workflow in `.github`, which needs both.

If the company repository already has commits on `main`, run `git pull origin main` before creating `develop`.

## Branches

| Branch | Purpose | Who pushes |
|---|---|---|
| `main` | Production-ready code. Protected. | Merged from `develop` for a release |
| `develop` | Integration branch. Every finished feature lands here. | Merged from feature branches through pull requests |
| `feature/<area>-<name>` | One feature, e.g. `feature/storefront-customer-auth` | You, every day |
| `fix/<area>-<name>` | Bug fixes | You |

Branch names follow the build spec sections:

| Spec section | Branch |
|---|---|
| 1. Customer Authentication | `feature/storefront-customer-auth` |
| 2.1 Home page | `feature/storefront-home` |
| 2.4 Product detail | `feature/storefront-product-detail` |
| 4.1 Vendor registration and KYC | `feature/vendor-onboarding` |
| 5.2 Vendor management and KYC | `feature/admin-vendor-kyc` |

## Every day

### Start of the day

```bash
git checkout develop
git pull origin develop
git checkout feature/storefront-customer-auth
git merge develop
```

If your feature branch does not exist yet, create it from the latest `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/storefront-customer-auth
```

### While working

Commit small, complete steps. Use the Conventional Commits format with the module as the scope:

```bash
git add .
git commit -m "feat(auth): add OTP verification endpoint"
```

| Type | Use for |
|---|---|
| `feat` | New functionality |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Tests only |
| `docs` | Documentation only |
| `chore` | Tooling, dependencies, config |

### End of the day

Push your branch, even if the feature is not finished. This is your daily submission.

```bash
git push -u origin feature/storefront-customer-auth
```

Unfinished work stays on your feature branch. It never breaks `develop` or `main`.

## When a feature is finished

1. Merge the latest `develop` into your branch and fix any conflicts.
2. Run `npm run typecheck` and `npm test` from the repository root.
3. Push and open a pull request from your feature branch into `develop`.
4. Fill in the pull request template.
5. After approval, use **Squash and merge**. Delete the feature branch.

## Moving to the next feature

Always start the next feature from the latest `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/storefront-home
```

If the previous feature is still waiting for review and the new feature needs its code, branch from the previous feature instead:

```bash
git checkout feature/storefront-customer-auth
git checkout -b feature/storefront-home
```

After the first one is merged, run `git merge develop` on the new branch.

## Folder ownership rules

These rules keep features from editing the same files.

| Layer | Put feature code in | Shared files you may touch |
|---|---|---|
| Backend module | `backend/api/src/modules/<module>/` | `backend/api/src/app.module.ts` (one import line) |
| Database models | `backend/api/prisma/schema/<module>.prisma` | none |
| Migrations | `backend/api/prisma/schema/migrations/` (generated) | none |
| Storefront feature | `frontend/storefront/src/features/<feature>/` | `src/app/<route>/page.tsx` for its own routes |
| Storefront routes | `frontend/storefront/src/app/<route>/` | none |
| Translations | `frontend/storefront/src/lib/i18n/en.ts` and `hi.ts` (add your own top-level key) | none |
| Shared UI | `frontend/storefront/src/components/ui/` | Add new components; do not change existing props |

A feature imports another feature only through its `index.ts`, for example `import { useAuth } from '@/features/auth'`.

## Database migrations

1. Add or change models in your module's `.prisma` file.
2. Merge the latest `develop` first, so your migration is created after everyone else's.
3. Run `npm run db:migrate -- --name <short_name>` from the repository root.
4. Commit the generated folder under `backend/api/prisma/schema/migrations/`.
5. Never edit a migration that has been merged into `develop`. Create a new one.

## If the company asks you to push directly to `main`

If only one branch is allowed, keep the same daily routine but always pull before you push:

```bash
git pull --rebase origin main
git push origin main
```

Commit only code that builds. Keep unfinished screens behind a route that is not linked from the navigation.
