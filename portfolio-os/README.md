# Portfolio OS

A fast, responsive developer portfolio and content management system built with Go, PostgreSQL, HTML5 templates, CSS3, and vanilla JavaScript.

Features a unified Dark Navy & Mint aesthetic, dual Client & Developer views, a 5-photo portrait slideshow, particle background canvas, categorized skills, project showcases, compact certificates, and an administrative dashboard with local, on-disk file storage.

---

## Architecture Overview

- **Backend**: Go (standard library `net/http` router, GORM ORM)
- **Database**: PostgreSQL
- **Storage**: Local filesystem storage with configurable `UPLOAD_DIR` serving raster images (PNG, JPEG, WebP) and PDF résumés under stable URLs (`/uploads/...`)
- **Security**: CSRF token validation on all mutating admin routes, secure session cookies, magic byte/MIME type upload validation, path traversal prevention, and atomic file replacements
- **Frontend**: Dark Navy (`#070c18`, `#0b1224`, `#101a2f`) with Mint accents (`#5eead4`, `#7ce0c3`), responsive mobile navigation, reduced-motion preferences, and zero heavy client-side frameworks

---

## Local Development Setup

### 1. Prerequisites
- Go 1.22 or newer
- PostgreSQL 14+ running locally or in Docker

### 2. Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update the settings in `.env` as needed:
```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/portfolio_db?sslmode=disable
ADMIN_PASSWORD=change_this_to_a_secure_password
ADMIN_SESSION=generate_a_random_32_char_secret_string
UPLOAD_DIR=./uploads
```

### 3. Initialize Database
Ensure your PostgreSQL database exists:
```bash
createdb portfolio_db
```
The application automatically executes database migrations and populates default content from `data/portfolio.json` upon initial startup if the database is empty.

### 4. Run the Application
```bash
cd portfolio-os
go run cmd/web/main.go
```
The application will be accessible at:
- Public Portfolio: [http://localhost:3000/](http://localhost:3000/)
- Developer View: [http://localhost:3000/developer](http://localhost:3000/developer)
- Admin Login: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Admin Dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Production Deployment & Persistence (Render)

### Critical Durability Warning
> [!WARNING]
> Render web services use an **ephemeral root filesystem**. Any files written to the standard application directory (`./uploads`) will be **permanently lost** whenever the service restarts, deploys, or undergoes maintenance.
>
> To persist user-uploaded profile photos, slideshow images, project screenshots, and certificates across redeployments, you **MUST** attach a Render Persistent Disk and point `UPLOAD_DIR` to its absolute mount path.

### 1. Attaching a Persistent Disk on Render
1. Navigate to your Web Service in the [Render Dashboard](https://dashboard.render.com).
2. Go to **Disks** in the sidebar and click **Add Disk**.
3. Configure the disk:
   - **Name**: `portfolio-uploads` (or any identifier)
   - **Mount Path**: `/var/data/uploads` (absolute path)
   - **Size**: 1 GB (or as required)
4. Save and allow the service to redeploy.

### 2. Environment Variables Configuration
In the **Environment** tab of your Render Web Service, configure:
| Variable | Value / Description |
|---|---|
| `PORT` | `3000` (or leave default assigned by Render) |
| `DATABASE_URL` | Your Render PostgreSQL Internal Connection String |
| `ADMIN_PASSWORD` | Strong password for admin dashboard access |
| `ADMIN_SESSION` | 32+ character random string for signing session cookies |
| `UPLOAD_DIR` | `/var/data/uploads` (Must match the exact Disk Mount Path) |

### 3. Seeding Bundled Assets onto Persistent Disk
The application includes bundled certificates and résumé files in `portfolio-os/uploads/`.
- **Automatic Non-Overwriting Seeding**: Upon startup, `StorageService.SeedBundledAssets()` checks if the target directories (`/var/data/uploads/certificates`, `/var/data/uploads/resume`) already contain these files. If missing, it automatically copies the bundled originals to the persistent disk without overwriting any existing modifications.
- **Manual Disk Seeding (Optional)**: If you are mounting a fresh persistent disk and prefer manual seeding before launching:
  ```bash
  # Copy bundled assets preserving timestamps and without overwriting existing files
  cp -rn /path/to/repo/portfolio-os/uploads/* /var/data/uploads/
  ```

---

## Backup and Disaster Recovery

Because uploaded files and database records are tightly coupled (e.g. project screenshots referenced by filename in PostgreSQL), **always back up the PostgreSQL database and the persistent disk together**:

### 1. Database Backup
```bash
pg_dump "$DATABASE_URL" --format=custom --file="portfolio_db_$(date +%Y%m%d_%H%M%S).dump"
```

### 2. Uploaded Files Backup
```bash
# Create an archive of the persistent upload directory
tar -czvf "portfolio_uploads_$(date +%Y%m%d_%H%M%S).tar.gz" -C /var/data uploads/
```

### 3. Combined Restore Procedure
1. Stop the application service.
2. Restore the database:
   ```bash
   pg_restore --clean --if-exists -d "$DATABASE_URL" portfolio_db_YYYYMMDD_HHMMSS.dump
   ```
3. Extract the uploaded files to the `UPLOAD_DIR` mount path:
   ```bash
   tar -xzvf portfolio_uploads_YYYYMMDD_HHMMSS.tar.gz -C /var/data/
   ```
4. Restart the application service.

---

## Running Tests and Checks

Run all unit and integration tests:
```bash
cd portfolio-os
go test -v ./...
```

Run static analysis:
```bash
go vet ./...
```

Verify build:
```bash
go build -o /dev/null cmd/web/main.go
```
