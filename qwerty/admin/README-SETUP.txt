THE DEBATING CLUB UAF — FIREBASE ADMIN SETUP

The admin dashboard is served at /admin on Vercel. For full deployment instructions, see ../DEPLOYMENT.md.

REQUIRED FIREBASE SETUP
1. Enable Authentication → Email/Password.
2. Create Firestore Database.
3. Enable Firebase Storage in the same project.
4. Add your Vercel domain to Authentication → Settings → Authorized domains.
5. Publish firestore.rules in Firestore Database → Rules.
6. Publish storage.rules in Storage → Rules.
7. Create the first admin user in Authentication → Users.
8. Copy the user's UID. In Firestore create admins/{UID} with:
   name: string
   email: string
   role: string = main
   active: boolean = true
9. Sign in at https://YOUR-DOMAIN/admin.

The first Main Admin must be created manually. Do not expose service-account keys in this repository. The Firebase Web App config in firebase-config.js is public client configuration, not an admin secret.

Roles:
- main: all dashboard sections.
- president / gs: announcements, events and gallery they created; cabinet view only.

The dashboard creates Firestore admin profiles only. Create each additional user's Authentication login first, then add their exact UID in Admin Accounts.
