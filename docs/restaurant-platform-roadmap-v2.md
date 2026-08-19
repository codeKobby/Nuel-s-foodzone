# Nuel’s Foodzone Platform Roadmap — Revised After Operational Clarification

**Prepared by Manus AI — 19 August 2026**

> **Finance disclaimer:** I am an AI, not a licensed financial advisor or accountant. The financial controls and reports below are software design recommendations, not accounting, tax, or audit advice. A qualified accountant should review the final chart of accounts, profit definitions, tax treatment, and reporting before the system is relied upon for consequential decisions.

## Executive conclusion

The most important requirement is now clear: **the kitchen must never prepare a normal order that does not exist in the system**. A cashier can currently bypass the POS by writing an order on paper, taking it to the kitchen, collecting the money, and leaving no digital evidence. A more sophisticated cashier interface alone will not solve this. The kitchen workflow must be redesigned so that the **system-generated order is the only normal source of preparation instructions**.

The proposed control is a tablet-based **Kitchen Display System (KDS)**. The cashier or public customer ordering flow creates an order in the application. The order receives a unique order number and appears on the kitchen tablet with an audible/visual notification. Kitchen staff acknowledge it, move it through preparation states, and mark it ready. The cashier no longer needs to write or paste tickets on a notice board.

The public website also needs to be treated as a brand rebuild rather than a small menu enhancement. The umbrella brand should be **Nuel’s Foodzone**, with two clearly separated experiences: **Nuel’s Foodzone Catering** for events and **Nuel’s Foodzone Dinner** for the restaurant and customer ordering. The current code still uses “Nuel’s Cafe”, placeholder imagery from `picsum.photos`, and navigation links to routes that do not yet exist. The public ordering route is also incomplete: the current menu page logs the cart and navigates to a placeholder `/checkout` route.

## 1. Revised operating model

| Actor | Device | Main responsibility | What the system must enforce |
| --- | --- | --- | --- |
| Customer | Phone or browser | Browse Dinner menu, submit order, provide contact/receipt preference, receive receipt | Customer order receives an order number and enters the same kitchen queue as cashier orders |
| Cashier | POS tablet/computer | Take and settle orders, capture customer phone, monitor queue, issue/resend receipt | No completed sale without authenticated cashier, shift, order number, payment record, and receipt status |
| Kitchen staff | Dedicated tablet in kitchen | Receive, acknowledge, prepare, pause, and complete tickets | Cannot create prices, change payment values, delete orders, or bypass the order queue |
| Manager | Manager device plus optional oversight tablet | Approve exceptions, manage content/operations/finance, review audit trail | Full visibility of orders, gaps, exceptions, voids, refunds, receipts, shifts, and reconciliation |
| System service | Server-side application | Validate identity, prices, inventory, order transitions, receipts, and audit events | Browser input is treated as a request, not as the source of financial truth |

The kitchen tablet should use a dedicated **Kitchen Display role**, not the manager’s personal account. Sharing the manager’s account in the kitchen would make the audit trail ambiguous and would grant unnecessary powers to anyone near the tablet. A kitchen account should only read eligible tickets and update operational statuses.

## 2. The anti-bypass kitchen workflow

### Normal order flow

The authoritative sequence should be:

> **Draft cart → order submitted → server validation → order number issued → kitchen ping → kitchen acknowledged → preparing → ready → collected/served → receipt delivered → shift reconciliation**

When a cashier submits a cart, the server must recalculate prices from the active menu, validate availability, attach the authenticated cashier and active shift, create the order, and append an audit event. Only after the server transaction succeeds should the order be published to the kitchen queue.

The kitchen display should show order number, order channel, time received, items, modifiers, special instructions, and elapsed preparation time. It should provide a prominent audible/visual ping for new orders, a clear acknowledge button, a timer, and color-coded states. The kitchen should not need to see sensitive payment details beyond a safe status such as “payment pending” or “paid”.

### What happens to paper tickets

Normal paper tickets should be retired. If the business still needs emergency paper during a power or network outage, use an explicit **Emergency Mode** rather than allowing informal handwritten orders. Emergency Mode should:

| Emergency control | Purpose |
| --- | --- |
| Pre-allocated emergency ticket number | Prevents an unnumbered handwritten order from disappearing |
| Cashier/device identity | Records who opened the exception |
| Time and reason | Distinguishes outage from deliberate bypass |
| Mandatory later reconciliation | Requires the order to be entered when service returns |
| Manager review | Flags emergency tickets, missing receipts, and unexplained gaps |

An emergency paper ticket should therefore be a temporary exception with a visible outstanding status, not an alternative ordering channel.

### Why the tablet helps transparency

The tablet changes the kitchen’s behavior from “prepare what a person brings” to “prepare what the system has published”. It also creates several independent records: the cashier’s order event, the kitchen acknowledgement, the preparation timestamps, the completion event, and the customer receipt. A cashier who attempts to keep a sale off-system would have to bypass the kitchen workflow itself, which becomes visible as either a customer complaint, an emergency ticket, a queue gap, or a missing receipt.

The manager dashboard should show the following exception indicators in one place: order-number gaps, orders cancelled after kitchen acknowledgement, orders marked ready without payment, emergency tickets, receipts not delivered, repeated manual discounts, excessive voids, unusually long preparation times, and cashier shifts with abnormal sales-to-stock ratios.

## 3. Receipt policy

The receipt should not be treated as an optional afterthought. The business can make the customer phone number and receipt delivery part of the **final order confirmation step**.

The recommended policy is:

1. The cashier asks for the customer’s WhatsApp-capable phone number or another delivery channel before completing the order.
2. The POS validates the number format and records customer consent for receipt delivery.
3. The order is created and the PDF receipt is generated from the server-side order record.
4. The customer receives the PDF or a secure receipt link, and the cashier sees the delivery status.
5. If the customer refuses to provide a phone number, the cashier cannot silently bypass the receipt. The system offers a QR/download receipt or requires a manager-approved “customer declined contact” exception with a reason.

This approach preserves customer choice while making every exception visible. It is stronger than simply telling cashiers to ask customers for numbers because the POS records whether a receipt was delivered, downloaded, declined, or failed.

For WhatsApp, use a provider-neutral receipt service so the business can begin with a secure download link and later connect Meta Cloud API or Twilio. Meta’s current document-message API supports PDF document messages, while Twilio also supports PDF media messages; both routes require proper business setup and customer opt-in [1] [2]. Avoid permanent public PDF links. Use a signed, expiring URL or one-time download token.

The receipt delivery record should include `orderId`, channel, destination hash or masked destination, consent timestamp, provider message ID, delivery state, failure reason, and retry count. A resend action should resend the existing receipt without creating another sale.

## 4. Public website and brand architecture

The current website should be restructured as an umbrella brand rather than presenting the restaurant as “Nuel’s Cafe”. The proposed information architecture is:

| Route | Purpose |
| --- | --- |
| `/` | Nuel’s Foodzone brand home, with clear entry points to Catering and Dinner |
| `/dinner` | Nuel’s Foodzone Dinner landing page with menu highlights, hours, ordering CTA, location, and announcements |
| `/dinner/menu` | Live Dinner menu with categories, item photos, modifiers, availability, cart, and order mode |
| `/dinner/checkout` | Customer details, pickup/delivery or dine-in choice, phone/WhatsApp receipt consent, payment or payment-on-collection policy |
| `/dinner/order/[orderNumber]` | Secure order status and receipt download page |
| `/catering` | Catering services, packages, event types, gallery, enquiry form, and quote request |
| `/gallery` | Published food, restaurant, catering, and event imagery |
| `/announcements` | Published updates, offers, opening-hours notices, and seasonal messages |
| `/contact` | Phone, WhatsApp, location, opening hours, social links, and enquiry options |
| `/backoffice` | Secure staff portal, separate from the public brand experience |

### Brand content direction

The home page should explain the relationship plainly: **Nuel’s Foodzone is the brand; Nuel’s Foodzone Dinner is the restaurant experience; Nuel’s Foodzone Catering serves events and larger gatherings.** The design should use one coherent identity while giving Dinner and Catering their own visual sections and calls to action.

The current placeholder images should be removed from production. Only `src/app/logo.png` is currently tracked as a local image asset, and the public pages use generic `picsum.photos` URLs for hero, menu, dish, and catering images. The preferred visual asset sequence is:

| Priority | Asset source | Use |
| --- | --- | --- |
| 1 | Real photos supplied by the restaurant | Actual dishes, restaurant interior, kitchen, catering setup, staff, and events |
| 2 | Professionally photographed or commissioned food images | Missing menu items and hero sections |
| 3 | Carefully art-directed generated food imagery | Temporary staging or non-factual decorative sections only; it should not falsely represent a dish the restaurant does not serve |

For the first redesign, the manager should provide the restaurant logo in its best resolution, a list of signature dishes, current menu images if available, restaurant/location photos, catering photos, brand colors, and any preferred Ghanaian food presentation style. AI-generated imagery can fill gaps during development, but actual restaurant photography should replace it before public launch.

## 5. Customer ordering architecture

The public Dinner ordering system and cashier POS should use the same server-side order service. They may have different interfaces, but they must share the same order validation, pricing, inventory, kitchen queue, receipt, and status model.

| Source | Entry characteristics | Kitchen behavior |
| --- | --- | --- |
| Cashier POS | Named cashier, active shift, counter order, optional customer name/phone | Immediately published to KDS after successful order creation |
| Public Dinner website | Customer contact, order mode, pickup/delivery details, receipt consent, online or collection payment policy | Published to KDS after payment/confirmation policy is satisfied |
| Emergency Mode | Explicit outage, emergency ticket number, later reconciliation | Marked as exception and never treated as a normal invisible order |

The public checkout should not expose unnecessary staff controls. It should provide a clear order summary, expected preparation time, order number after submission, customer receipt method, and secure order status. If online payment is not ready in the first release, start with “pay on collection” or another explicitly approved method, but still create the order and publish it to the kitchen through the same controlled path.

## 6. Revised security model

Use Firebase Auth for the single manager email already identified in the repository, `nuelgee54@gmail.com`, plus individually provisioned cashier accounts. Use custom claims for role authorization and keep profile data in Firestore. Firebase documents custom claims as an access-control mechanism that can be enforced through security rules, while emphasizing that sensitive claims must be set only from a privileged server environment [3].

The kitchen tablet should have a least-privilege role. Its rules should allow reading only active kitchen tickets and updating only permitted status fields. A kitchen user must not be able to modify item prices, payment totals, customer debt, expenses, staff records, or manager content.

Replace the existing rule that allows all authenticated users to read and write all documents. Firebase’s Firestore documentation describes that broad pattern as unsuitable for production and recommends specific rules and validation for each data path [4]. Add App Check as an additional abuse-control layer after authentication and rules are working; Firebase describes App Check as complementary to Authentication and Security Rules, not a replacement [5].

## 7. Revised implementation sequence

### Phase 0 — Stabilize and prepare

Create a safe test dataset and Firebase staging environment. Fix the existing TypeScript baseline, including the PNG module declarations and AI SDK compatibility errors. Define the data migration map for current `orders`, `menuItems`, `reconciliationReports`, `miscExpenses`, `cashierAccounts`, and `credentials` records. Configure Firebase Emulator Suite and rules tests before deploying new security rules.

### Phase 1 — Build the kitchen gate first

Implement named cashier shifts, server-side order creation, unique order numbers, trusted totals, a `kitchenTickets` view or order queue, real-time tablet updates, audible/visual new-order alerts, acknowledgement, preparing, ready, and completed states. Remove normal paper tickets from the operating procedure. Add Emergency Mode only as a controlled exception.

### Phase 2 — Enforce receipt capture and audit

Add the mandatory receipt step, customer phone/consent fields, PDF generation, secure receipt download, QR fallback, delivery state tracking, and manager-visible exceptions. Add immutable audit events for order creation, edits, discounts, voids, refunds, payment events, kitchen transitions, receipt failures, and emergency tickets.

### Phase 3 — Replace the authentication boundary

Remove anonymous back-office access, localStorage role authority, hard-coded passwords, legacy password hashing, and client-side role assignment. Implement Firebase Auth identity, manager allowlist, cashier provisioning, kitchen role, server token verification, custom claims, and explicit Firestore rules.

### Phase 4 — Rebuild Nuel’s Foodzone public website

Replace “Nuel’s Cafe” copy with the correct brand hierarchy. Add the missing public routes, content structure, real food photography, responsive menu cards, Dinner ordering, checkout, order status, and catering enquiry flow. Keep public content sourced from manager-published CMS records.

### Phase 5 — Add manager CMS and operations

Add manager editing for gallery, announcements, promotions, opening hours, restaurant information, menu availability, catering content, and image uploads. Support draft, publish, unpublish, revision, and rollback states. Add manager controls for cashiers, kitchen display devices, receipt policy, and approval thresholds.

### Phase 6 — Expand financial and inventory controls

Add ingredients, recipes, packages, purchases, suppliers, stock movements, wastage, customer debt, supplier debt, approved expenses, cash sessions, MoMo/card reconciliation, cost of goods sold, gross margin, and operating result. Keep cash position, profit, customer debt, and supplier debt as distinct metrics.

### Phase 7 — Pilot before merging

Pilot the tablet workflow with one cashier and one kitchen shift. Compare system order numbers, KDS tickets, receipts, cash, digital payments, stock usage, and manual observations. Monitor the exception dashboard daily. Merge into `main` only after the kitchen confirms that no normal order is prepared without a KDS ticket and the manager can reconcile every shift.

## 8. First-release acceptance criteria

| Requirement | Acceptance test |
| --- | --- |
| Kitchen gate | A normal order cannot appear as “preparing” unless it was created by the POS or public ordering service |
| New-order alert | The kitchen tablet visibly and audibly announces a new ticket, with a manual acknowledgement control |
| Paper control | Handwritten emergency tickets have a pre-allocated number, reason, actor, and mandatory later reconciliation |
| Cashier traceability | Every order shows cashier, shift, channel, timestamps, payment status, and receipt status |
| Customer receipt | Every completed order has a delivered, downloaded, failed, or manager-approved declined receipt state |
| No duplicate sale | Resending a receipt does not create a second order or payment |
| Public brand | Production copy consistently uses Nuel’s Foodzone, Nuel’s Foodzone Dinner, and Nuel’s Foodzone Catering |
| Authentic imagery | No `picsum.photos` or generic placeholders remain on public production pages |
| Complete routes | Home, Dinner, Dinner menu, checkout, order status, Catering, Gallery, Announcements, and Contact routes work |
| Shared order service | Cashier and website orders use the same pricing, inventory, kitchen, receipt, and audit logic |
| Manager oversight | The manager can review order gaps, emergency tickets, receipt failures, voids, discounts, refunds, and shift variances |

## 9. Recommended immediate build slice

The first coding slice should not begin with decorative website work. It should implement the **minimum closed loop**:

> **Authenticated cashier → active shift → server-created order → kitchen tablet ping → kitchen acknowledgement → customer phone/receipt capture → receipt status → manager audit view**

Once this loop is reliable, the public Dinner website can safely connect to the same order service. This order protects the business first, prevents the kitchen from becoming an invisible side channel, and avoids building a beautiful public checkout that still feeds an insecure operational system.

## References

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/document-messages "Meta for Developers — WhatsApp Document Messages"

[2]: https://www.twilio.com/docs/whatsapp/guidance-whatsapp-media-messages "Twilio — Guidance on WhatsApp Media Messages"

[3]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase Authentication — Control Access with Custom Claims and Security Rules"

[4]: https://firebase.google.com/docs/firestore/security/get-started "Firebase Cloud Firestore Security Rules — Get Started"

[5]: https://firebase.google.com/docs/app-check "Firebase App Check — Protect Non-Google Services and Firebase Resources"
