# Phase 1 Firebase Auth Setup

## Branch

All Phase 1 changes are being made on:

```text
feature/restaurant-platform-v2
```

The `main` branch has not been modified.

## Target manager account

The repository contains the manager reporting address:

```text
nuelgee54@gmail.com
```

The application now treats this as the only allowed manager email. The address is an allowlist identifier, not a password or secret. Manager authorization still requires a verified Firebase Auth account and the trusted `role: manager` custom claim.

## Firebase Console actions

1. Open the Firebase project configured in `.firebaserc` (`nuels-cafe`).
2. In **Authentication → Sign-in method**, enable **Email/Password**. Do not enable anonymous sign-in for the back office.
3. In **Authentication → Users**, create or confirm the user `nuelgee54@gmail.com`.
4. Complete email verification for that account.
5. Create individual Firebase Auth accounts for cashiers. Do not create a shared cashier account.
6. Create a trusted service-account/workload-identity path for server-side provisioning. Do not commit service-account JSON or private keys.

## Local environment

Copy `.env.example` to `.env.local` and fill in the Firebase Web App values from the Firebase project settings. Keep `.env.local` untracked.

```bash
cp .env.example .env.local
```

For server-side provisioning, use Application Default Credentials or the hosting platform's workload identity. For local development, set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path outside the repository, or configure the corresponding Firebase Admin environment variables in the deployment platform.

## Provision the manager role claim

After the manager account exists and is verified, run this command from a trusted environment:

```bash
npm run auth:provision-manager
```

The script looks up the exact manager email, confirms that the email is verified, assigns the `role: manager` custom claim, and creates/updates the corresponding `staffProfiles/{uid}` document. The manager must sign out and sign in again so the refreshed ID token contains the new claim.

## Phase 1 behavior

The back-office entry page now has two credentialed flows:

| Workspace | Required identity |
| --- | --- |
| Manager | Firebase email/password account for `nuelgee54@gmail.com`, verified email, `role: manager` claim |
| Cashier | Individual Firebase email/password account, verified email, `role: cashier` claim |

The application no longer performs anonymous sign-in, stores a handcrafted role session in `localStorage`, accepts the old manager/master passwords, or grants the cashier role with a button click. The manager security panel now uses Firebase Auth reauthentication before changing the password.

## Rules deployment

The committed `firestore.rules` file now denies anonymous access, blocks the legacy `credentials` collection, and allows only verified manager/cashier claims for the existing transitional operational collections. It is intentionally not the final Phase 2 field-level order/payment policy yet.

Before deploying rules to a shared Firebase project, test them against the Firebase Emulator Suite and confirm the existing application still has the required reads. Deploy only from the Phase 1 branch after review:

```bash
firebase emulators:start
firebase deploy --only firestore:rules,firestore:indexes
```

The next phase will move order creation, payment, inventory, and audit writes behind server-validated operations so the transitional staff write permissions can be narrowed further.

## Official references

- [Firebase Authentication — Email/Password authentication](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase Authentication — Control access with custom claims and security rules](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Cloud Firestore — Get started with Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
