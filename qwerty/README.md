# The Debating Club — University of Agriculture Faisalabad

Static public website with a Firebase Authentication / Firestore / Storage admin dashboard.

- Public website: `index.html`
- Admin dashboard: `admin/admin.html` (Vercel route: `/admin`)
- Vercel config: `vercel.json`
- Firebase rules: `admin/firestore.rules`, `admin/storage.rules`
- Full deployment and Firebase setup: [`DEPLOYMENT.md`](DEPLOYMENT.md)

For Vercel, import the GitHub repository with Framework Preset **Other**, no build command, and the repository root as the output root. Firebase setup and security-rule publishing are required for live admin functionality.


## Local verification

Run `npm run check` before committing. This checks JavaScript syntax, JSON configuration, local asset references, navigation targets and required Firebase/Vercel files. GitHub Actions runs the same checks on pushes and pull requests.
