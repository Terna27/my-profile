package middleware

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"
)

type contextKey string

const csrfContextKey contextKey = "csrf_token"
const csrfCookieName = "csrf_token"

// GenerateRandomToken generates a cryptographically random 32-byte hex string.
func GenerateRandomToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CSRF middleware attaches a CSRF token to GET requests and verifies it on admin mutation requests.
func CSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(csrfCookieName)
		var token string

		if err == nil && cookie.Value != "" {
			token = cookie.Value
		} else {
			generated, genErr := GenerateRandomToken()
			if genErr == nil {
				token = generated
				http.SetCookie(w, &http.Cookie{
					Name:     csrfCookieName,
					Value:    token,
					Path:     "/",
					HttpOnly: false,
					SameSite: http.SameSiteStrictMode,
					Secure:   r.TLS != nil,
				})
			}
		}

		ctx := context.WithValue(r.Context(), csrfContextKey, token)
		r = r.WithContext(ctx)

		// Check mutations on admin routes (excluding login and analytics)
		if isMutatingMethod(r.Method) && strings.HasPrefix(r.URL.Path, "/admin") && r.URL.Path != "/admin/login" {
			submittedToken := r.FormValue("csrf_token")
			if submittedToken == "" {
				submittedToken = r.Header.Get("X-CSRF-Token")
			}

			if token == "" || submittedToken == "" || subtle.ConstantTimeCompare([]byte(token), []byte(submittedToken)) != 1 {
				http.Error(w, "Forbidden: Invalid or missing CSRF token", http.StatusForbidden)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// GetCSRFToken retrieves the CSRF token for the current request context or cookie.
func GetCSRFToken(r *http.Request) string {
	if val, ok := r.Context().Value(csrfContextKey).(string); ok && val != "" {
		return val
	}
	if cookie, err := r.Cookie(csrfCookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	return ""
}

func isMutatingMethod(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodDelete || method == http.MethodPatch
}
