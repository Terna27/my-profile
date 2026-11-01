package middleware

import (
	"net/http"
	"os"
)

// AdminSessionSecret returns the configured session token or a safe local development fallback.
func AdminSessionSecret() string {
	val := os.Getenv("ADMIN_SESSION")
	if val != "" {
		return val
	}
	return "dev-admin-session-secret"
}

// AdminPasswordSecret returns the configured admin password or a safe local development fallback.
func AdminPasswordSecret() string {
	val := os.Getenv("ADMIN_PASSWORD")
	if val != "" {
		return val
	}
	return "admin123"
}

// AdminAuth middleware verifies that the user possesses a valid admin session cookie.
func AdminAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("admin_session")
		validSession := AdminSessionSecret()

		if err != nil || cookie.Value == "" || cookie.Value != validSession {
			http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
			return
		}

		next.ServeHTTP(w, r)
	})
}
