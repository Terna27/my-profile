# Homepage update

The homepage now includes the original client content: About, statistics, skills, projects, certificates, and contact details. `/client` redirects to `/`; the developer view links back to the homepage.

The hero uses the original homepage portrait plus all four supplied photos. Photos crossfade every five seconds, with skills pulled from the existing portfolio data. Photo controls support manual selection and pause/play. Rotation pauses while hovered, keyboard-focused, or in a hidden tab; reduced-motion preferences disable automatic rotation by default. The original interactive colored-particle background is retained.

The two main actions are Developer View and Download Résumé. The résumé uses the existing `/resume` endpoint and `uploads/resume/resume.pdf`; replace it through your existing admin upload as usual.

## Apply and run

Extract into a new folder, or copy the source over your existing checkout after a backup. Keep your existing `.env` and database settings. This archive intentionally excludes Git history, credentials, old executables, and temporary build files. No database migration or new dependency is required.

From `my-profile/portfolio-os`:

```bash
gofmt -w internal/handlers/home.go
go test ./...
go vet ./...
go build ./...
go run ./cmd/web
```

Open http://localhost:3000 (or your configured PORT). Embedded assets require rebuilding/restarting the app; running an old executable will show the old design.

## Verification

JavaScript syntax checks and isolated slideshow logic checks passed (automatic rotation, manual selection, wraparound, pause/resume, reduced motion, one active photo). The current environment had no Go compiler or working browser executable, so Go build/tests and browser layout verification were not run. Check desktop and mobile layouts after starting the app.

The pre-existing portfolio data includes incomplete project entries, unavailable project image paths, and a Markdown-formatted contact email. These remain unchanged; correct them in your admin dashboard to complete the presentation.

## Customization

- Rotation interval: `internal/web/static/js/home.js` (5000 milliseconds).
- Photo order and hero text: `internal/web/templates/pages/home.html`.
- Hero layout, colors, and responsive rules: `internal/web/static/css/landing.css`.
- Profile, skills, projects, and other information: existing admin dashboard.
