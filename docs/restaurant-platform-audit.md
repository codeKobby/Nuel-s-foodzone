# Restaurant Platform Audit

## Repository and branch

- Repository: `codeKobby/Nuel-s-foodzone`
- Current stack: Next.js 15, React 18, TypeScript, Tailwind CSS, Firebase client SDK/Admin SDK, Firestore, Genkit/AI SDK, Recharts.
- Working branch created: `feature/restaurant-platform-v2`
- Main branch was not modified.

## Existing application areas

- Public pages: `/`, `/menu`, `/catering`, `/contact` links are present in the home page, though only some route files were found in the current tree.
- Back office: `/backoffice` role selector and `/backoffice/internal` shell.
- Cashier modules: POS, orders, stock, rewards, accounting, miscellaneous expenses.
- Manager modules: dashboard and admin panel.
- Firestore collections referenced: `menuItems`, `orders`, `reconciliationReports`, `miscExpenses`, `rewards`, `cashierAccounts`, and `credentials`.
- Existing reporting sends reconciliation and AI analysis email to `nuelgee54@gmail.com`.

## Security findings

1. `AuthProvider` loads a client-side `userSession` from `localStorage`, assigns roles through a local `login()` function, and bootstraps Firebase with anonymous sign-in.
2. `/backoffice` grants the cashier role with a single click and no credential or Firebase identity. The manager role is also assigned locally after a password modal succeeds.
3. `/backoffice/internal` gates modules using `session.role` in client state. This is not server-enforced authorization.
4. `firestore.rules` currently allows any authenticated user, including anonymous users, to read and write every document.
5. `src/lib/auth-tools.ts` contains hard-coded default and master passwords (`Graceland18`, `Richboy`), plain unsalted SHA-256 hashing, and client-accessible Firestore verification paths for cashier credentials.
6. The auth provider persists a hand-crafted session in localStorage rather than deriving identity and permissions from Firebase Auth tokens/custom claims.

## Operational findings

1. POS supports menu search, categories, cart actions, custom items, order placement, order editing, combined settlement, split payment/change logic, and stock listeners.
2. Order/payment writes are largely direct client Firestore writes/transactions. There is no clearly enforced server-side order-number allocation, cashier identity binding, immutable event ledger, approval workflow, or tamper-evident audit trail in the reviewed paths.
3. Existing reconciliation and accounting views provide useful starting functionality, but the current cashier workflow is vulnerable to off-system orders because access is anonymous and order creation is not tied to an authenticated staff account.
4. The manager admin view primarily handles menu CRUD and manager-password update. Gallery, announcements, website updates, cashier management, approvals, and broader finance/inventory purchasing workflows are not represented as manager-controlled CMS modules.
5. Current reporting is email-based and useful as a notification layer, but it is not a substitute for a normalized financial ledger with explicit income, collections, expenses, stock purchases, debts, and profit/loss calculations.

## Baseline verification

`npm ci` completed. `npm run typecheck` currently fails with 11 existing errors:

- PNG module declaration errors for `@/app/logo.png` in several pages/components.
- AI SDK `useChat` API mismatch in `DashboardView` (`input`, `handleInputChange`, `handleSubmit`, `isLoading`, and `api` options no longer match the installed `ai` package types).

The build was not reached because the chained command stopped at the type-check failure.

## Product direction to validate with the user

- Use Firebase Auth for a single manager email account (`nuelgee54@gmail.com`) and authenticated cashier accounts, with roles stored in custom claims and mirrored profile documents.
- Replace anonymous/client-role access with server-enforced Firestore rules and privileged server actions/API routes.
- Make each order append-only/audited, bind it to cashier identity and shift, require a generated order number, and support void/refund/discount approvals.
- Add digital receipt delivery by WhatsApp or SMS through a provider, with PDF receipt generation and email/download fallback.
- Add manager-controlled CMS collections for gallery, announcements, menu availability, pricing, and promotions.
- Add finance and inventory ledger modules for ingredients, packages, purchases, supplier/customer debt, expenses, cash/MoMo reconciliation, gross margin, and profit/loss.
- Preserve the current branch-based testing workflow and require staging verification before merging to main.

## Updated requirements and public-site findings

- The primary transparency failure is physical: a cashier can bypass the POS, take a handwritten order directly to the kitchen, collect money, and leave no digital record.
- A kitchen display tablet should become the preparation source of truth. The kitchen should receive only orders created by the authenticated POS or public ordering flow, with a visible order number, queue state, items, modifiers, timestamps, and cashier/channel.
- The public brand is Nuel's Foodzone, with two distinct offerings: Nuel's Foodzone catering services and Nuel's Foodzone Dinner, the restaurant ordering experience.
- The current public code still brands pages as "Nuel's Cafe" in multiple places and uses `picsum.photos` placeholders for the hero, menu highlight cards, catering imagery, and menu item images. Only `src/app/logo.png` is tracked as a local image asset.
- The current route tree includes `/` and `/menu`, but navigation links point to `/catering`, `/contact`, and `/checkout` without corresponding route files in the inspected tree. `/menu` currently only logs the cart and navigates to a placeholder `/checkout`; it does not complete a customer order.
- `next.config.ts` explicitly permits generic placeholder image hosts, reinforcing that authentic food photography/content assets have not yet been integrated.

## Revised product direction

- Make the kitchen display system the operational gate: no kitchen preparation without a system-created order number.
- Require customer phone capture and digital receipt delivery or an explicit manager-approved exception; support WhatsApp PDF first where configured, with SMS/QR/download fallback.
- Rebuild the public website as the Nuel's Foodzone brand site with separate Catering and Nuel's Foodzone Dinner experiences, authentic dish imagery, complete routes, live CMS content, and a real customer checkout flow.
- Keep the cashier accountable through named shifts, system-generated tickets, live kitchen acknowledgements, receipt status, and manager audit views.
