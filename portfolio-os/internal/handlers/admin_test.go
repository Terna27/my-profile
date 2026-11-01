package handlers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"portfolio-os/internal/middleware"
	"portfolio-os/internal/models"
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

var samplePNGData = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

func createMultipartFormRequest(t *testing.T, method, targetURL string, fields map[string]string, fileField, filename string, fileContent []byte) *http.Request {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	for k, v := range fields {
		_ = writer.WriteField(k, v)
	}

	if fileField != "" && len(fileContent) > 0 {
		part, err := writer.CreateFormFile(fileField, filename)
		if err != nil {
			t.Fatalf("failed to create form file: %v", err)
		}
		if _, err := io.Copy(part, bytes.NewReader(fileContent)); err != nil {
			t.Fatalf("failed to copy file content: %v", err)
		}
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(method, targetURL, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func cleanBadges(s *services.PortfolioService) {
	for _, b := range s.GetAllBadges() {
		_ = s.DeleteBadge(b.ID)
	}
}

func TestBadge_AdminAuthAndCSRF(t *testing.T) {
	portfolioService, storage, cleanup := setupTestServices(t)
	defer cleanup()
	cleanBadges(portfolioService)

	adminHandler := NewAdminHandler(&mockRenderer{}, portfolioService, storage, nil)
	mux := http.NewServeMux()
	mux.Handle("POST /admin/badges", middleware.AdminAuth(http.HandlerFunc(adminHandler.AddBadge)))
	handler := middleware.CSRF(mux)

	// 1. Unauthenticated request without CSRF -> blocked with 403 Forbidden
	req := createMultipartFormRequest(t, http.MethodPost, "/admin/badges", map[string]string{
		"title":  "Security Specialist",
		"issuer": "Cisco",
	}, "image", "badge.png", samplePNGData)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for missing CSRF on badge creation, got %d", rec.Code)
	}

	// 2. Unauthenticated request WITH CSRF -> redirects to /admin/login
	csrfToken := "valid-test-csrf-token"
	reqAuth := createMultipartFormRequest(t, http.MethodPost, "/admin/badges", map[string]string{
		"title":      "Security Specialist",
		"issuer":     "Cisco",
		"csrf_token": csrfToken,
	}, "image", "badge.png", samplePNGData)
	reqAuth.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfToken})
	recAuth := httptest.NewRecorder()
	handler.ServeHTTP(recAuth, reqAuth)

	if recAuth.Code != http.StatusSeeOther {
		t.Errorf("expected 303 See Other redirect for unauthenticated session, got %d", recAuth.Code)
	}
	if loc := recAuth.Header().Get("Location"); loc != "/admin/login" {
		t.Errorf("expected redirect to /admin/login, got %s", loc)
	}
}

func TestBadge_CreationAndValidation(t *testing.T) {
	portfolioService, storage, cleanup := setupTestServices(t)
	defer cleanup()
	cleanBadges(portfolioService)

	adminHandler := NewAdminHandler(&mockRenderer{}, portfolioService, storage, nil)
	mux := http.NewServeMux()
	mux.Handle("POST /admin/badges", middleware.AdminAuth(http.HandlerFunc(adminHandler.AddBadge)))
	handler := middleware.CSRF(mux)

	csrfToken := "csrf-token-12345"

	makeAuthReq := func(fields map[string]string, fileField, filename string, content []byte) (*http.Request, *httptest.ResponseRecorder) {
		fields["csrf_token"] = csrfToken
		req := createMultipartFormRequest(t, http.MethodPost, "/admin/badges", fields, fileField, filename, content)
		req.AddCookie(&http.Cookie{Name: "admin_session", Value: middleware.AdminSessionSecret()})
		req.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfToken})
		rec := httptest.NewRecorder()
		return req, rec
	}

	// 1. Missing title
	req, rec := makeAuthReq(map[string]string{"issuer": "AWS"}, "image", "badge.png", samplePNGData)
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for missing title, got %d", rec.Code)
	}

	// 2. Missing issuer
	req, rec = makeAuthReq(map[string]string{"title": "Cloud Architect"}, "image", "badge.png", samplePNGData)
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for missing issuer, got %d", rec.Code)
	}

	// 3. Missing image file
	req, rec = makeAuthReq(map[string]string{"title": "Cloud Architect", "issuer": "AWS"}, "", "", nil)
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for missing image, got %d", rec.Code)
	}

	// 4. Invalid image format (SVG)
	req, rec = makeAuthReq(map[string]string{"title": "Cloud Architect", "issuer": "AWS"}, "image", "badge.svg", []byte("<svg>malicious</svg>"))
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for SVG image upload, got %d", rec.Code)
	}

	// 5. Invalid verification URL (javascript:)
	req, rec = makeAuthReq(map[string]string{
		"title":            "Cloud Architect",
		"issuer":           "AWS",
		"verification_url": "javascript:alert(1)",
	}, "image", "badge.png", samplePNGData)
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for javascript: URL, got %d", rec.Code)
	}

	// 6. Invalid verification URL (ftp:)
	req, rec = makeAuthReq(map[string]string{
		"title":            "Cloud Architect",
		"issuer":           "AWS",
		"verification_url": "ftp://example.com/badge",
	}, "image", "badge.png", samplePNGData)
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for ftp: URL, got %d", rec.Code)
	}

	// 7. Successful creation with valid HTTPS verification URL
	req, rec = makeAuthReq(map[string]string{
		"title":            "AWS Certified Solutions Architect",
		"issuer":           "Amazon Web Services",
		"date_earned":      "Oct 2026",
		"credential_id":    "AWS-123456",
		"verification_url": "https://www.credly.com/badges/sample-badge",
		"description":      "Demonstrates expertise in distributed cloud architectures.",
		"display_order":    "10",
		"is_published":     "true",
	}, "image", "badge.png", samplePNGData)
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 See Other redirect on valid badge creation, got %d; body: %s", rec.Code, rec.Body.String())
	}

	// Verify database record
	badges := portfolioService.GetAllBadges()
	if len(badges) == 0 {
		t.Fatalf("expected badge in database, got 0")
	}

	created := badges[0]
	if created.Title != "AWS Certified Solutions Architect" {
		t.Errorf("expected title 'AWS Certified Solutions Architect', got '%s'", created.Title)
	}
	if created.Issuer != "Amazon Web Services" {
		t.Errorf("expected issuer 'Amazon Web Services', got '%s'", created.Issuer)
	}
	if !strings.HasPrefix(created.ImageURL, "/uploads/badges/") || !strings.HasSuffix(created.ImageURL, ".png") {
		t.Errorf("expected image URL in /uploads/badges/*.png, got '%s'", created.ImageURL)
	}
	if !created.IsPublished {
		t.Errorf("expected badge to be published")
	}
}

func TestBadge_EditingOrderingVisibilityAndDeletion(t *testing.T) {
	portfolioService, storage, cleanup := setupTestServices(t)
	defer cleanup()
	cleanBadges(portfolioService)

	adminHandler := NewAdminHandler(&mockRenderer{}, portfolioService, storage, nil)
	mux := http.NewServeMux()
	mux.Handle("POST /admin/badges", middleware.AdminAuth(http.HandlerFunc(adminHandler.AddBadge)))
	mux.Handle("POST /admin/badges/{id}", middleware.AdminAuth(http.HandlerFunc(adminHandler.UpdateBadge)))
	mux.Handle("POST /admin/badges/{id}/delete", middleware.AdminAuth(http.HandlerFunc(adminHandler.DeleteBadge)))
	mux.Handle("POST /admin/badges/{id}/publish", middleware.AdminAuth(http.HandlerFunc(adminHandler.ToggleBadgePublish)))
	mux.Handle("POST /admin/badges/{id}/reorder", middleware.AdminAuth(http.HandlerFunc(adminHandler.ReorderBadge)))
	handler := middleware.CSRF(mux)

	csrfToken := "csrf-token-ops"

	// Create Badge 1
	b1 := models.Badge{
		Title:        "Badge Alpha",
		Issuer:       "Org A",
		ImageURL:     "/uploads/badges/alpha.png",
		DisplayOrder: 10,
		IsPublished:  true,
	}
	if err := portfolioService.AddBadge(b1); err != nil {
		t.Fatalf("failed to seed badge 1: %v", err)
	}

	// Create Badge 2
	b2 := models.Badge{
		Title:        "Badge Beta",
		Issuer:       "Org B",
		ImageURL:     "/uploads/badges/beta.png",
		DisplayOrder: 20,
		IsPublished:  true,
	}
	if err := portfolioService.AddBadge(b2); err != nil {
		t.Fatalf("failed to seed badge 2: %v", err)
	}

	badges := portfolioService.GetAllBadges()
	if len(badges) != 2 {
		t.Fatalf("expected 2 badges, got %d", len(badges))
	}
	id1 := badges[0].ID
	id2 := badges[1].ID

	// 1. Edit Badge 1
	updateURL := fmt.Sprintf("/admin/badges/%d", id1)
	reqUpdate := createMultipartFormRequest(t, http.MethodPost, updateURL, map[string]string{
		"csrf_token":    csrfToken,
		"title":         "Badge Alpha Updated",
		"issuer":        "Org A Prime",
		"display_order": "15",
		"is_published":  "true",
	}, "", "", nil)
	reqUpdate.AddCookie(&http.Cookie{Name: "admin_session", Value: middleware.AdminSessionSecret()})
	reqUpdate.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfToken})
	recUpdate := httptest.NewRecorder()
	handler.ServeHTTP(recUpdate, reqUpdate)

	if recUpdate.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect on update, got %d", recUpdate.Code)
	}

	updated, err := portfolioService.GetBadgeByID(id1)
	if err != nil || updated.Title != "Badge Alpha Updated" {
		t.Errorf("badge title was not updated: %v", updated)
	}

	// 2. Toggle Visibility (Hide)
	publishURL := fmt.Sprintf("/admin/badges/%d/publish", id1)
	reqToggle := httptest.NewRequest(http.MethodPost, publishURL, strings.NewReader("csrf_token="+csrfToken))
	reqToggle.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqToggle.AddCookie(&http.Cookie{Name: "admin_session", Value: middleware.AdminSessionSecret()})
	reqToggle.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfToken})
	recToggle := httptest.NewRecorder()
	handler.ServeHTTP(recToggle, reqToggle)

	if recToggle.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect on toggle publish, got %d", recToggle.Code)
	}

	toggled, err := portfolioService.GetBadgeByID(id1)
	if err != nil || toggled.IsPublished {
		t.Errorf("expected badge to be hidden after toggle, got is_published=%v", toggled.IsPublished)
	}

	// 3. Reorder Badge
	reorderURL := fmt.Sprintf("/admin/badges/%d/reorder?direction=down", id1)
	reqReorder := httptest.NewRequest(http.MethodPost, reorderURL, strings.NewReader("csrf_token="+csrfToken))
	reqReorder.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqReorder.AddCookie(&http.Cookie{Name: "admin_session", Value: middleware.AdminSessionSecret()})
	reqReorder.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfToken})
	recReorder := httptest.NewRecorder()
	handler.ServeHTTP(recReorder, reqReorder)

	if recReorder.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect on reorder, got %d", recReorder.Code)
	}

	// 4. Delete Badge
	deleteURL := fmt.Sprintf("/admin/badges/%d/delete", id2)
	reqDelete := httptest.NewRequest(http.MethodPost, deleteURL, strings.NewReader("csrf_token="+csrfToken))
	reqDelete.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqDelete.AddCookie(&http.Cookie{Name: "admin_session", Value: middleware.AdminSessionSecret()})
	reqDelete.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfToken})
	recDelete := httptest.NewRecorder()
	handler.ServeHTTP(recDelete, reqDelete)

	if recDelete.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect on delete, got %d", recDelete.Code)
	}

	if _, err := portfolioService.GetBadgeByID(id2); err == nil {
		t.Error("expected badge 2 to be deleted from database")
	}
}

func TestBadge_HiddenBadgesAbsentFromPublic(t *testing.T) {
	portfolioService, _, cleanup := setupTestServices(t)
	defer cleanup()

	// Clear out any existing badges from other tests
	for _, b := range portfolioService.GetAllBadges() {
		_ = portfolioService.DeleteBadge(b.ID)
	}

	// 1. When no badges exist, GetPortfolio().Badges must be empty
	portfolioEmpty := portfolioService.GetPortfolio()
	if len(portfolioEmpty.Badges) != 0 {
		t.Errorf("expected 0 badges in fresh portfolio, got %d", len(portfolioEmpty.Badges))
	}

	// 2. Add 1 published badge and 1 hidden badge
	bPub := models.Badge{
		Title:        "Published Badge",
		Issuer:       "Open Source",
		ImageURL:     "/uploads/badges/pub.png",
		DisplayOrder: 1,
		IsPublished:  true,
	}
	bHidden := models.Badge{
		Title:        "Secret Badge",
		Issuer:       "Internal",
		ImageURL:     "/uploads/badges/secret.png",
		DisplayOrder: 2,
		IsPublished:  false,
	}
	_ = portfolioService.AddBadge(bPub)
	_ = portfolioService.AddBadge(bHidden)

	// Public portfolio should ONLY contain the published badge
	publicPortfolio := portfolioService.GetPortfolio()
	if len(publicPortfolio.Badges) != 1 {
		t.Fatalf("expected exactly 1 published badge on public portfolio, got %d", len(publicPortfolio.Badges))
	}
	if publicPortfolio.Badges[0].Title != "Published Badge" {
		t.Errorf("expected 'Published Badge', got '%s'", publicPortfolio.Badges[0].Title)
	}

	// 3. Hide the published badge
	_ = portfolioService.ToggleBadgePublish(publicPortfolio.Badges[0].ID)

	// Now public portfolio must have 0 badges
	publicAfterHide := portfolioService.GetPortfolio()
	if len(publicAfterHide.Badges) != 0 {
		t.Errorf("expected 0 badges after hiding, got %d", len(publicAfterHide.Badges))
	}
}

func TestAdmin_SessionInvalidation(t *testing.T) {
	initialSecret := "initial-admin-session-secret-11111"
	rotatedSecret := "new-rotated-admin-session-secret-22222"

	os.Setenv("ADMIN_SESSION", initialSecret)
	defer os.Setenv("ADMIN_SESSION", "")

	// 1. ValidateSessionCookie with initial secret matches
	if !middleware.ValidateSessionCookie(initialSecret) {
		t.Fatal("expected initial session cookie to be valid")
	}

	// 2. An unrotated cookie fails when compared to rotated secret
	if middleware.ValidateSessionCookie(rotatedSecret) {
		t.Fatal("rotated secret should not match initial session secret")
	}

	// 3. AdminAuth with valid session cookie succeeds
	called := false
	testHandler := middleware.AdminAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: initialSecret})
	rec := httptest.NewRecorder()
	testHandler.ServeHTTP(rec, req)

	if !called || rec.Code != http.StatusOK {
		t.Errorf("expected authenticated request to pass AdminAuth, code: %d", rec.Code)
	}

	// 4. Invalidate session by rotating ADMIN_SESSION in environment
	os.Setenv("ADMIN_SESSION", rotatedSecret)

	// Now the request carrying the old cookie MUST be rejected and redirected to /admin/login
	calledAfterRotate := false
	reqOldCookie := httptest.NewRequest(http.MethodGet, "/admin", nil)
	reqOldCookie.AddCookie(&http.Cookie{Name: "admin_session", Value: initialSecret})
	recOldCookie := httptest.NewRecorder()
	testHandler.ServeHTTP(recOldCookie, reqOldCookie)

	if calledAfterRotate {
		t.Error("old session cookie was accepted after secret rotation!")
	}
	if recOldCookie.Code != http.StatusSeeOther {
		t.Errorf("expected 303 See Other redirect for invalidated session cookie, got %d", recOldCookie.Code)
	}
	if loc := recOldCookie.Header().Get("Location"); loc != "/admin/login" {
		t.Errorf("expected redirect to /admin/login, got %s", loc)
	}

	// 5. Request carrying the new rotated secret succeeds
	calledNewCookie := false
	reqNewCookie := httptest.NewRequest(http.MethodGet, "/admin", nil)
	reqNewCookie.AddCookie(&http.Cookie{Name: "admin_session", Value: rotatedSecret})
	recNewCookie := httptest.NewRecorder()
	middleware.AdminAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calledNewCookie = true
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(recNewCookie, reqNewCookie)

	if !calledNewCookie || recNewCookie.Code != http.StatusOK {
		t.Errorf("expected new session cookie to be accepted, code: %d", recNewCookie.Code)
	}
}
