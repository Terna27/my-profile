package middleware

import (
	"crypto/subtle"
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

// ValidateSessionCookie securely validates the session cookie value using constant-time comparison.
func ValidateSessionCookie(cookieValue string) bool {
	validSession := AdminSessionSecret()
	if cookieValue == "" || validSession == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(cookieValue), []byte(validSession)) == 1
}

// ValidatePassword securely validates the submitted admin password using constant-time comparison.
func ValidatePassword(password string) bool {
	expectedPassword := AdminPasswordSecret()
	if password == "" || expectedPassword == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(password), []byte(expectedPassword)) == 1
}

// AdminAuth middleware verifies that the user possesses a valid admin session cookie.
func AdminAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("admin_session")

		if err != nil || !ValidateSessionCookie(cookie.Value) {
			http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
			return
		}

		next.ServeHTTP(w, r)
	})
}
