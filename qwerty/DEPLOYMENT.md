# The Debating Club UAF — Vercel deployment

This is a static HTML/CSS/JavaScript website with a Firebase-backed admin dashboard. No build command or framework preset is required. `npm run check` runs local project integrity checks; GitHub Actions runs them automatically on pushes and pull requests.

## 1. GitHub repository

1. Extract this ZIP. The ZIP contains the project files at its top level (there is no extra enclosing folder).
2. Upload **all extracted files, including hidden files** such as `.firebaserc` and `.gitignore`, to the root of a new GitHub repository (so `index.html`, `style.css`, `script.js`, `vercel.json`, `admin/`, and the images are at repository root).
3. Commit and push.

## 2. Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Framework Preset: **Other**.
3. Root Directory: `./`.
4. Build Command: leave empty.
5. Output Directory: set to `.` (the repository root), because `index.html` is at the root.
6. Deploy.

Routes:
- Public site: `/`
- Admin dashboard: `/admin` (also `/admin/admin.html`)

## 3. Firebase setup (required for admin and live content)

The Firebase web configuration is in `admin/firebase-config.js`. The web API key is designed to be present in browser apps; never add a service-account JSON or private key to this repository.

1. In Firebase Console, enable **Authentication → Email/Password**.
2. Create a Firestore database.
3. Enable Firebase Storage and link it to the same Firebase project.
4. Add your Vercel production domain under **Authentication → Settings → Authorized domains**.
5. Publish `admin/firestore.rules` in Firestore Database → Rules.
6. Publish `admin/storage.rules` in Storage → Rules. You can also publish both rule files from the repository root with Firebase CLI: `npx firebase-tools deploy --only firestore:rules,storage` (the project is set in `.firebaserc`).
7. In Authentication → Users, create the first admin user.
8. Copy that user's UID. In Firestore, create collection `admins`, then create a document whose ID is exactly that UID, with:
   - `name` (string): administrator display name
   - `email` (string): the same email used for Firebase Authentication
   - `role` (string): `main`
   - `active` (boolean): `true`
9. Open `https://YOUR-DOMAIN/admin` and sign in.

The initial Main Admin profile must be created manually. Do not allow public users to create or edit admin profiles.

## 4. Admin roles

- `main`: full dashboard access, cabinet management, admin profile management, and activity log.
- `president` / `gs`: can add announcements, events, and gallery items; can edit/delete only their own content. They can view cabinet data.

To add another admin, first create their Email/Password user in Firebase Authentication. Then, while signed in as Main Admin, add an Admin Profile using the exact Firebase Auth UID. The dashboard does not create Authentication users.

## 5. Public content behavior

The public website reads only published announcements/events/gallery items. Cabinet documents with status `Current` or `Alumni` are public. The static bundled content remains visible if Firebase is unavailable or its rules have not yet been published.

Do not put private phone numbers, addresses, student IDs, or other sensitive information in the public `cabinet` collection.

## 6. Security and launch checklist

- Test with separate Main Admin, President, and General Secretary accounts.
- Verify a non-main admin cannot edit another person's content or access admin profiles/activity logs.
- Verify anonymous visitors can read only published announcements/events/gallery and public cabinet records.
- Verify Storage upload and delete using an admin account. Supported image formats are JPG, PNG, GIF, WebP and AVIF; maximum upload size is 14 MiB.
- Run `npm run check` before pushing changes. GitHub Actions runs the same project checks on each push and pull request.
- Enable Firebase App Check before broad public launch and monitor Authentication/Firestore/Storage usage and billing limits.
- Test the deployed site and `/admin` on desktop and mobile.

Firebase/Vercel services are external and must be configured in their dashboards. A successful static package check does not substitute for live Firebase Rules Emulator or production deployment tests.
