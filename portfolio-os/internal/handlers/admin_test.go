package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"portfolio-os/internal/middleware"
	"portfolio-os/internal/services"
)

// Mock renderer
type mockRenderer struct{}

func (m *mockRenderer) Render(w http.ResponseWriter, name string, data any) error {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("rendered " + name))
	return nil
}

func setupTestServices(t *testing.T) (*services.PortfolioService, *services.StorageService, func()) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "admin_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	storage, err := services.NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage service: %v", err)
	}

	// In-memory or temporary database for testing
	// We can use the running postgres test instance or test with mock/pg
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://recoding@127.0.0.1:5432/portfolio_db?sslmode=disable"
		os.Setenv("DATABASE_URL", dbURL)
	}

	db, err := services.NewDatabase()
	if err != nil {
		t.Skipf("skipping test requiring database: %v", err)
	}

	_ = services.MigrateDatabase(db)
	portfolioService := services.NewPortfolioService(db)

	cleanup := func() {
		os.RemoveAll(tempDir)
	}

	return portfolioService, storage, cleanup
}

func TestAdminAuth_UnauthorizedAccess(t *testing.T) {
	portfolioService, storage, cleanup := setupTestServices(t)
	defer cleanup()

	adminHandler := NewAdminHandler(&mockRenderer{}, portfolioService, storage, nil)
	mux := http.NewServeMux()
	mux.Handle("GET /admin", middleware.AdminAuth(http.HandlerFunc(adminHandler.Dashboard)))
	mux.Handle("POST /admin/projects", middleware.AdminAuth(http.HandlerFunc(adminHandler.AddProject)))

	handler := middleware.CSRF(mux)

	// 1. Unauthenticated GET /admin should redirect to /admin/login
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Errorf("expected 303 See Other redirect, got %d", rec.Code)
	}
	location := rec.Header().Get("Location")
	if location != "/admin/login" {
		t.Errorf("expected redirect to /admin/login, got %s", location)
	}

	// 2. Unauthenticated POST /admin/projects without CSRF is blocked with 403 Forbidden
	postReq := httptest.NewRequest(http.MethodPost, "/admin/projects", strings.NewReader("name=Test"))
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postRec := httptest.NewRecorder()
	handler.ServeHTTP(postRec, postReq)

	if postRec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for unauthenticated POST without CSRF, got %d", postRec.Code)
	}

	// 3. Unauthenticated POST /admin/projects WITH CSRF token redirects to /admin/login
	csrfToken := "valid-token-for-test"
	postReqWithCSRF := httptest.NewRequest(http.MethodPost, "/admin/projects", strings.NewReader("name=Test&csrf_token="+csrfToken))
	postReqWithCSRF.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postReqWithCSRF.AddCookie(&http.Cookie{
		Name:  "csrf_token",
		Value: csrfToken,
	})
	postRecWithCSRF := httptest.NewRecorder()
	handler.ServeHTTP(postRecWithCSRF, postReqWithCSRF)

	if postRecWithCSRF.Code != http.StatusSeeOther {
		t.Errorf("expected 303 See Other redirect for unauthenticated session, got %d", postRecWithCSRF.Code)
	}
}

func TestAdmin_CSRFProtection(t *testing.T) {
	portfolioService, storage, cleanup := setupTestServices(t)
	defer cleanup()

	adminHandler := NewAdminHandler(&mockRenderer{}, portfolioService, storage, nil)
	mux := http.NewServeMux()
	mux.Handle("POST /admin/skills", middleware.AdminAuth(http.HandlerFunc(adminHandler.AddSkill)))

	handler := middleware.CSRF(mux)

	// Authenticated request with valid admin_session but MISSING csrf_token
	formData := url.Values{}
	formData.Set("name", "Docker")
	formData.Set("category", "DevOps")

	req := httptest.NewRequest(http.MethodPost, "/admin/skills", strings.NewReader(formData.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.AddCookie(&http.Cookie{
		Name:  "admin_session",
		Value: middleware.AdminSessionSecret(),
	})
	// Attach cookie with one token but don't provide matching form token
	req.AddCookie(&http.Cookie{
		Name:  "csrf_token",
		Value: "valid-server-csrf-token-1234567890",
	})

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for missing CSRF token, got %d", rec.Code)
	}

	// Request with mismatched csrf_token
	formData.Set("csrf_token", "tampered-token")
	reqMismatched := httptest.NewRequest(http.MethodPost, "/admin/skills", strings.NewReader(formData.Encode()))
	reqMismatched.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqMismatched.AddCookie(&http.Cookie{
		Name:  "admin_session",
		Value: middleware.AdminSessionSecret(),
	})
	reqMismatched.AddCookie(&http.Cookie{
		Name:  "csrf_token",
		Value: "valid-server-csrf-token-1234567890",
	})

	recMismatched := httptest.NewRecorder()
	handler.ServeHTTP(recMismatched, reqMismatched)

	if recMismatched.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for mismatched CSRF token, got %d", recMismatched.Code)
	}

	// Request with valid matching csrf_token
	formData.Set("csrf_token", "valid-server-csrf-token-1234567890")
	reqValid := httptest.NewRequest(http.MethodPost, "/admin/skills", strings.NewReader(formData.Encode()))
	reqValid.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqValid.AddCookie(&http.Cookie{
		Name:  "admin_session",
		Value: middleware.AdminSessionSecret(),
	})
	reqValid.AddCookie(&http.Cookie{
		Name:  "csrf_token",
		Value: "valid-server-csrf-token-1234567890",
	})

	recValid := httptest.NewRecorder()
	handler.ServeHTTP(recValid, reqValid)

	if recValid.Code != http.StatusSeeOther {
		t.Errorf("expected 303 See Other redirect for valid CSRF mutation, got %d", recValid.Code)
	}
}

func TestAdmin_ReplacementFailureHandling(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "admin_replace_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := services.NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	// Seed one dummy file
	testFile := filepath.Join(tempDir, "projects", "initial.png")
	if err := os.WriteFile(testFile, []byte("original content"), 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	// Verify SafeDeleteFile preserves referenced files
	referencedCheck := func(url string) bool {
		return url == "/uploads/projects/initial.png"
	}

	err = storage.SafeDeleteFile("/uploads/projects/initial.png", referencedCheck)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Error("file was deleted despite being referenced")
	}

	// Now when unreferenced, safe delete should remove it
	err = storage.SafeDeleteFile("/uploads/projects/initial.png", func(url string) bool { return false })
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Error("file was not deleted when unreferenced")
	}
}
