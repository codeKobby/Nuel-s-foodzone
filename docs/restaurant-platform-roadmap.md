# Nuel's Foodzone Restaurant Platform Roadmap

**Prepared by Manus AI — 19 August 2026**

> **Finance disclaimer:** I am an AI, not a licensed financial advisor or accountant. The financial controls and reports below are software design recommendations, not accounting, tax, or audit advice. A qualified accountant should review the final chart of accounts, profit definitions, tax treatment, and reporting before the system is relied upon for statutory or consequential decisions.

## 1. Executive recommendation

The repository already contains a useful restaurant operations foundation: a Next.js/Firebase application with a public menu, a cashier POS, order management, stock monitoring, rewards, reconciliation, expenses, a manager dashboard, and menu administration. The main problem is not a lack of screens; it is that the most important business actions are currently trusted to the browser.

The current back-office entry page lets a cashier enter with one click, assigns the role in client state, and relies on anonymous Firebase sign-in. The manager flow similarly assigns a local role after a password modal. Firestore then allows any authenticated user—including an anonymous user—to read and write every document. The result is a system that can calculate totals but cannot reliably prove **who created an order, who changed it, who collected money, who voided it, or whether an order was deliberately kept off-system**.

I recommend a **Firebase-first operational rebuild on the existing Next.js application**, delivered incrementally on the isolated branch already created: `feature/restaurant-platform-v2`. This preserves the existing investment while moving identity, authorization, order creation, payments, receipts, website content, and accounting records behind verified server-side controls.

The exact manager email found in the code is **`nuelgee54@gmail.com`**, currently used by the reconciliation and AI report actions. It should become the single manager-owner Firebase Auth account, with no hard-coded password or bypass password remaining in source code.

## 2. Verified repository assessment

| Area | What exists now | Main issue to address |
| --- | --- | --- |
| Public website | Home and menu presentation with restaurant branding and menu highlights | Content is mostly code-driven; gallery, announcements, and updates are not manager-editable |
| Cashier POS | Menu search, categories, cart, custom items, order placement, editing, combined payment, change handling | Order writes are client-driven and not reliably bound to a verified cashier, shift, or immutable audit trail |
| Orders | Pending, unpaid, completed states; payment status and settlement logic | No sufficiently strong server-side workflow to prevent silent edits, unapproved voids, or off-system sales |
| Authentication | Firebase anonymous bootstrap plus `localStorage` session roles; legacy password helpers | Client-side role assignment, embedded credentials, SHA-256 password hashing, and anonymous database access are not an acceptable production boundary |
| Firestore rules | `allow read, write: if request.auth != null` for all documents | Any signed-in or anonymous user can access and modify the entire database |
| Manager portal | Dashboard and admin/menu management | No CMS for gallery/announcements, cashier administration, approvals, purchasing, supplier debt, or full financial ledger |
| Finance | Reconciliation, expenses, financial summary, and email reports | Useful operational views exist, but there is not yet a normalized ledger for ingredients, packages, stock cost, debts, profit, and loss |
| Reporting | Email reconciliation and AI analysis to `nuelgee54@gmail.com` | Email is a notification layer, not a tamper-resistant source of financial truth |
| Build health | Dependencies install successfully | `npm run typecheck` currently fails with 11 existing errors: PNG module declarations and an outdated AI SDK `useChat` API shape |

A fuller audit is attached separately in `restaurant-platform-audit.md`.

## 3. Target product shape

The finished system should be organized into four connected surfaces:

| Surface | Primary users | Purpose |
| --- | --- | --- |
| Public restaurant website | Customers and visitors | View live menu, gallery, announcements, promotions, contact information, and optional online ordering |
| Cashier workspace | Authenticated cashier | Open a shift, take every order, collect payment, issue a receipt, manage an order queue, and close the drawer |
| Manager portal | The single manager-owner account | Manage content, menu, staff, pricing, approvals, inventory, suppliers, debt, expenses, reports, and profit/loss |
| Secure service layer | Application and integrations | Verify Firebase tokens, enforce roles, create orders atomically, generate receipts, send messages, and write audit events |

The essential design principle is that the browser may **request** an operation, but it must not be trusted to decide whether the operation is allowed or what the final financial values are.

## 4. Authentication and authorization plan

### Manager account

Use Firebase Auth email/password sign-in for exactly one allowed manager email: `nuelgee54@gmail.com`. The address should be stored as a deployment environment variable such as `MANAGER_EMAIL`, not repeated throughout the code. The manager account should be created or linked once through a controlled bootstrap script, require email verification, use a strong password reset flow, and support optional second-factor protection if the Firebase project and operating environment support it.

The current hard-coded values `Graceland18` and `Richboy` must be removed. The legacy `credentials` collection, local password checks, and plain SHA-256 password storage should be retired rather than migrated as an authentication authority.

### Cashier accounts

Each cashier should have an individual Firebase Auth account, preferably provisioned by the manager. The cashier signs in with an account-specific credential, not a shared “cashier” button. A cashier profile document can contain display name, status, assigned permissions, phone, and employment metadata; the password itself must remain managed by Firebase Auth.

For a small team, the first release can use manager-created email/password accounts. If staff do not have convenient email addresses, the next option is phone OTP authentication or manager-issued invite links. A shared PIN may be added later only as a fast re-authentication mechanism **after** the cashier has already established a named authenticated session; it should not be the primary identity.

### Role enforcement

Use Firebase Admin SDK custom claims for small authorization attributes such as `role: manager` or `role: cashier`, and keep profile details in Firestore. Firebase documents custom claims as an RBAC mechanism enforced through security rules, while also cautioning that claims should be limited to access-control data and kept under 1000 bytes [1]. The client may use claims to render the correct UI, but every sensitive API route and Firestore rule must validate the Firebase ID token and role server-side [1] [2].

A practical role model is:

| Role | Allowed actions |
| --- | --- |
| Manager | Full reporting, staff administration, content publishing, menu/pricing, inventory adjustments, supplier/debt records, expense approval, void/refund approval, reconciliation approval, configuration |
| Cashier | Open/close own shift, create orders, collect payments, issue/resend receipts, view operational order queue, record permitted expenses, manage assigned stock counts, request void/refund/discount approval |
| Optional supervisor | A future delegated role for shift leads; not required for the first secure release |

### Firestore and API security

Replace the current catch-all rules with explicit collection-level rules. Public users should read only published website content and available menu data. Cashiers should read the operational data needed for their active shift and create orders through a controlled server endpoint. Financial records, audit events, staff records, and manager-only content should be protected by manager claims or manager-only server actions.

Firebase’s documentation explicitly describes the current “authenticated users can read/write everything” rule pattern as not recommended for production, and recommends rules that match identity, claims, and document-level conditions [2] [3]. This repository is currently using that broad pattern, so tightening rules is a critical first milestone, not a later enhancement.

Add Firebase App Check as defense in depth after the authenticated flow works. App Check helps reject requests from unauthorized or tampered clients, but Firebase describes it as complementary to Authentication and Security Rules rather than a replacement for either [4].

## 5. Cashier accountability and order integrity

The ordering system should be redesigned around an auditable event flow rather than mutable documents alone.

### Required order lifecycle

1. A cashier must open a named shift before taking orders.
2. Every new order is created through a server-validated operation that records the authenticated cashier UID, cashier name snapshot, shift ID, server timestamp, unique human-readable order number, channel, items, prices, discounts, tax configuration if applicable, and calculated total.
3. The server recalculates the total from trusted menu/pricing records. The browser cannot submit an authoritative total.
4. Payment events are recorded separately from the order. Each payment includes method, amount, reference where applicable, collector UID, timestamp, and shift ID.
5. Edits after order creation create an order revision or event. They do not silently overwrite history.
6. Voids, refunds, price overrides, manual discounts, deleted items, and post-payment changes require a reason and manager approval, with thresholds configurable by the manager.
7. A completed order becomes financially immutable except through a compensating refund or adjustment event.
8. The end-of-shift workflow compares expected cash/MoMo/card totals with the cashier’s declared count and requires a discrepancy note for any variance.

### Anti-off-system controls

The strongest practical controls are operational and technical together. The system should generate a sequential order number for each shift, show the active shift and cashier prominently, require order completion through the POS, and provide a manager screen showing voids, abandoned carts, unusual discounts, edits, unpaid orders, missing receipt deliveries, and large discrepancies.

A cashier should be able to start a draft order, but only a server-created order number should count as a sale. Managers should be able to compare the daily order-number sequence with completed, voided, unpaid, and cancelled records. Gaps must have an explicit reason. This does not make misconduct impossible, but it makes missing orders visible and reviewable.

Add a tamper-evident `auditEvents` collection or append-only subcollection. Every sensitive action should record actor UID, role, shift ID, entity type, entity ID, before/after summary, reason, server timestamp, request ID, and approval relationship. Audit events should be write-only through trusted server code and readable by managers.

### Speed improvements for the cashier

The POS should be optimized for the physical counter rather than for general-purpose administration. The first screen should open directly into the active shift and menu. Add large touch-friendly category tiles, favorites, recent items, keyboard shortcuts, persistent search focus, one-tap quantity controls, a compact cart summary, and a fast “repeat last order” action. Keep the payment flow on one screen wherever possible.

Use optimistic UI only for non-financial interactions such as adding items to the cart. Final order creation, payment capture, discounts, and stock decrements should be atomic server operations. If connectivity is unreliable, add a clearly marked offline queue only after reconciliation rules are designed; silently caching unsent sales would create a new transparency risk.

## 6. Digital receipt strategy without a physical printer

The best first version is a **digital receipt center** that always generates a downloadable PDF and then attempts delivery through the customer’s chosen channel.

| Delivery method | Recommendation | Reason |
| --- | --- | --- |
| WhatsApp PDF | Preferred when the customer opts in and the business has a WhatsApp Business Platform sender | Meta’s current document-message API supports PDF documents up to 100 MB, preferably using an uploaded media ID rather than a hosted link [5] |
| SMS secure link | Strong fallback for customers without WhatsApp or when WhatsApp delivery fails | A short-lived signed link avoids large MMS complexity and lets the customer download the PDF securely |
| Email PDF/link | Useful for customers who prefer email and for manager records | Existing email infrastructure can be reused, but the customer must provide consent and the address |
| QR code on cashier screen | Excellent immediate fallback | The customer scans a one-time or expiring receipt link without requiring a printer or staff to type an email |
| Customer self-download | Always available from the order confirmation screen | Ensures the receipt is not lost if messaging fails |

Direct Meta Cloud API is the leanest long-term WhatsApp route but requires Meta Business setup, a WhatsApp Business Account, a sender, token management, message templates for business-initiated notifications, and opt-in. A managed provider such as Twilio reduces some integration work and supports PDF media messages, but adds recurring provider costs and its own onboarding requirements [6] [7]. WhatsApp documentation and Twilio both require respect for user opt-in; Twilio warns that sending without opt-in can lead to blocking or suspension [7].

Receipt delivery should be asynchronous. The order is completed first, the PDF is generated and stored privately, a delivery job sends the message, and the receipt record tracks `queued`, `sent`, `delivered`, `failed`, and `customer_downloaded`. Do not expose permanent public PDF URLs. Use a signed, expiring URL or one-time token. The cashier should see the delivery status and have a safe “resend receipt” action that does not duplicate the sale.

The PDF should show restaurant name, order number, date/time, cashier, items, quantities, prices, discounts, amount paid, balance/change, payment method, and a support contact. It should not expose unnecessary customer information.

## 7. Manager-controlled website updates

Create a small CMS inside the manager portal. Public pages should read only documents marked `published: true`, while managers can create drafts and publish or unpublish them.

| CMS collection | Examples of fields | Public destination |
| --- | --- | --- |
| `siteSettings` | Restaurant name, contact numbers, location, opening hours, social links, service notices | Header, footer, contact page |
| `galleryItems` | Image, caption, category, sort order, active flag, publish status | Gallery section/page |
| `announcements` | Title, body, image, start/end date, priority, publish status | Home page banner and announcements page |
| `promotions` | Offer text, eligible items, start/end dates, redemption rules | Home page and POS prompts |
| `pages` | About, catering, delivery, policies, rich content | Public informational pages |
| `menuItems` | Name, price, category, availability, modifiers, stock behavior, cost metadata | Menu page and POS |

Image uploads should use Firebase Storage with manager-only write rules, file-size/type validation, image resizing, and a deletion/retention policy. Publishing should be an explicit action that writes `publishedAt`, `publishedBy`, and an audit event. For safety, keep the previous published version or a revision record so a manager can roll back an accidental change.

## 8. Inventory, packages, ingredients, debt, profit, and loss

The existing stock monitor appears oriented toward menu items and drinks. To manage the restaurant’s finances properly, separate **sales**, **cash movement**, **stock movement**, and **profit calculation**.

### Recommended finance and inventory model

| Domain | Proposed collections or records | Key controls |
| --- | --- | --- |
| Ingredients | `ingredients`, units, reorder levels, preferred supplier, current average cost | Manager-controlled master data; cashier count permissions limited |
| Recipes | `recipes` and `recipeLines` mapping menu items to ingredients | Version recipes when costs or portions change |
| Packages and stock | `stockItems`, `stockMovements`, package conversions, wastage, transfers | Every adjustment requires reason and actor |
| Purchases | `purchaseOrders`, `goodsReceipts`, `supplierInvoices` | Record ordered, received, paid, and outstanding values separately |
| Suppliers | `suppliers`, contacts, balances, payment history | Supplier debt aging and due-date reminders |
| Expenses | Existing `miscExpenses` expanded with category, vendor, payment method, receipt image, approval status | Manager approval for configurable thresholds |
| Customer debt | `customerAccounts`, `debtEntries`, `collections` | Credit limits, due dates, payment history, no silent balance edits |
| Cash control | `cashSessions`, `cashMovements`, `reconciliations` | Opening float, sales, collections, expenses, refunds, counted cash, variance |
| Profit/loss | Derived report from sales, COGS, expenses, and approved adjustments | Lock period snapshots after manager review |
| Audit | `auditEvents`, approvals, reasons, actor, timestamp | Manager-only read; server-only write |

### Profit calculation

The first implementation should distinguish the following metrics rather than using one ambiguous “profit” number:

- **Gross sales:** order totals before discounts and refunds.
- **Net sales:** gross sales minus discounts, refunds, and approved voids.
- **Cost of goods sold:** recipe-based ingredient/package cost for items sold, using a documented costing method such as weighted average cost.
- **Gross profit:** net sales minus cost of goods sold.
- **Operating expenses:** wages, rent, utilities, transport, supplies, fees, and other approved expenses.
- **Net operating result:** gross profit minus operating expenses.
- **Cash position:** physical cash and digital balances reconciled separately; this is not the same as profit.
- **Accounts receivable/payable:** customer debt and supplier debt tracked separately from cash collected or paid.

These calculations should be labeled clearly in the UI. The software should not claim to replace a formal accounting system or statutory filing process.

### Manager dashboard

The manager dashboard should answer practical questions quickly: What sold today? What was collected today? What remains unpaid? Which cashier handled each shift? What was expected versus counted? Which items are profitable? Which ingredients are running low? What supplier debts are due? Which expenses need approval? What were the top discrepancies? What is the trend in net sales, gross margin, and operating result?

The AI analyst can remain as an optional interpretation layer, but it should read from approved, structured reports and must not write financial records directly. Any AI-generated recommendation should show the underlying date range and figures used.

## 9. Implementation options

| Approach | Tradeoffs | Cost | Setup Complexity |
| --- | --- | --- | --- |
| **A. Firebase-first integrated rebuild — recommended** | Keeps the existing Next.js/Firebase investment, delivers secure Auth, server actions, rules, audit trail, CMS, receipts, and finance modules in one application. Requires careful migration from direct client writes and disciplined Firestore schema design. | Lowest incremental infrastructure cost; messaging providers, storage, email, and WhatsApp/SMS usage are usage-based | Medium; requires Firebase Auth/Admin setup, rules migration, server endpoints, provider onboarding, and data migration |
| **B. Lightweight hardening first** | Secure Auth, cashier accounts, order-server endpoint, shift controls, audit events, and reconciliation first; defer CMS, recipe costing, supplier debt, and WhatsApp automation. Fastest route to reducing off-system sales risk, but leaves management gaps temporarily. | Lowest short-term cost and fastest delivery | Low to medium |
| **C. Separate operational POS and accounting platform** | Use this repository for website/POS while integrating a mature third-party accounting or inventory product. Could provide deeper accounting features sooner, but introduces synchronization, duplicate data entry, vendor dependence, and more recurring costs. | Highest recurring cost and integration cost | High |

I recommend starting with **B as the first release slice inside A’s architecture**, then continuing into the full Firebase-first platform. This addresses the most damaging control weakness first without creating a throwaway implementation.

## 10. Phased delivery plan

### Phase 0 — Safety baseline and environment setup

Freeze a test dataset, document the current Firestore collections, confirm Firebase project/environment separation, and add the missing TypeScript declarations and AI SDK compatibility fixes so the branch has a clean baseline. Add Firebase Emulator Suite configuration and automated rule tests before changing production rules.

### Phase 1 — Identity and security foundation

Implement the single manager email allowlist, remove anonymous sign-in from back-office access, create manager-provisioned cashier accounts, derive the session from Firebase Auth, add custom claims/profile synchronization, and replace the permissive Firestore rules. Add route guards and server token verification. Keep a temporary migration flag only if necessary, with an explicit removal date.

### Phase 2 — Shift-controlled, auditable POS

Add shift open/close, server-side order creation, trusted price calculation, sequential order numbers, payment events, approval workflows, audit events, and discrepancy reporting. Bind every sale and cash movement to a named cashier and shift. This is the primary anti-off-system milestone.

### Phase 3 — Receipt center

Generate PDFs, store them privately, show immediate download/QR options, then integrate either Meta WhatsApp Cloud API or Twilio after the business account and opt-in process are confirmed. Add delivery status, retry/resend, SMS secure-link fallback, and customer consent fields.

### Phase 4 — Manager CMS and staff controls

Add gallery, announcements, promotions, site settings, public content rendering, image uploads, drafts, publishing, revision history, cashier status management, and permission/approval configuration.

### Phase 5 — Inventory and finance controls

Add ingredient and package masters, recipes, purchases, supplier balances, stock movements, wastage, customer debt, expense approvals, cash/MoMo reconciliation, gross margin, and profit/loss reports. Migrate or map existing `miscExpenses`, `reconciliationReports`, and relevant order fields rather than discarding historical records.

### Phase 6 — Testing, pilot, and release

Use the feature branch for staged testing with representative cashier and manager accounts. Run rule tests, unit tests for money calculations, integration tests for order/payment atomicity, receipt delivery tests, permission tests, and user acceptance testing at the counter. Pilot with one cashier shift and compare the system’s order sequence, cash, digital collections, expenses, and stock movements against manual records before merging to main.

## 11. Acceptance criteria for the first secure release

| Control | Acceptance test |
| --- | --- |
| Manager allowlist | An unapproved email cannot access manager routes even if it has a valid Firebase account |
| Cashier identity | Two cashiers create orders and the manager can distinguish every order by UID, name, and shift |
| No anonymous back office | Anonymous Firebase users cannot read or write operational collections |
| Server totals | Altering the browser-submitted total does not change the stored authoritative total |
| Order sequence | Every completed/voided order has a unique order number; gaps require a recorded reason |
| Payment integrity | Payment records cannot be edited by a cashier after settlement; refunds create compensating events |
| Approval controls | A cashier cannot self-approve a restricted void, discount, or refund |
| Reconciliation | Cash, MoMo/card, expenses, refunds, and collections reconcile to the shift report |
| Auditability | Every sensitive action has actor, timestamp, entity, reason, and before/after summary |
| Receipts | A customer can download a PDF immediately and see WhatsApp/SMS/email delivery status when enabled |
| CMS | A manager can draft, publish, unpublish, and roll back a gallery item or announcement |
| Finance | The manager can distinguish sales, cash position, COGS, expenses, supplier debt, customer debt, and operating result |

## 12. Decisions to confirm before implementation

1. Should cashiers authenticate with individual email/password accounts, phone OTP, or manager-issued invite accounts? My recommendation is individual Firebase accounts first, with a fast re-authentication PIN only as an optional convenience.
2. Should the first receipt channel be direct Meta WhatsApp Cloud API or Twilio? My recommendation is to design a provider-neutral receipt service, start with PDF download plus QR/SMS fallback, and connect WhatsApp once the business sender and opt-in process are available.
3. Does the business want the public website to accept customer online orders, or should the first release focus on in-store cashier orders? My recommendation is to secure the in-store flow first, then reuse the same order service for public ordering.
4. What are the actual payment methods in use today—cash, Mobile Money providers, cards, bank transfer, or pay-later credit—and which ones provide transaction references that should be mandatory?
5. Which Ghanaian currency, tax, receipt, and accounting conventions should the accountant approve for the final reports?

## References

[1]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase Authentication — Control Access with Custom Claims and Security Rules"

[2]: https://firebase.google.com/docs/rules/rules-and-auth "Firebase Security Rules — Rules and Auth"

[3]: https://firebase.google.com/docs/firestore/security/get-started "Firebase Cloud Firestore Security Rules — Get Started"

[4]: https://firebase.google.com/docs/app-check "Firebase App Check — Protect Non-Google Services and Firebase Resources"

[5]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/document-messages "Meta for Developers — WhatsApp Document Messages"

[6]: https://www.twilio.com/docs/whatsapp/guidance-whatsapp-media-messages "Twilio — Guidance on WhatsApp Media Messages"

[7]: https://www.twilio.com/docs/whatsapp/api "Twilio — Overview of the WhatsApp Business Platform"
