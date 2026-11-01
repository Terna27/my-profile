package handlers

import (
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"portfolio-os/internal/middleware"
	"portfolio-os/internal/models"
	"portfolio-os/internal/services"
)

type AdminHandler struct {
	Renderer interface {
		Render(http.ResponseWriter, string, any) error
	}
	PortfolioService *services.PortfolioService
	StorageService   *services.StorageService
	AnalyticsService *services.AnalyticsService
}

type AdminPageData struct {
	Portfolio models.Portfolio
	CSRFToken string
	Stats     *services.AnalyticsStats
}

func NewAdminHandler(
	renderer interface {
		Render(http.ResponseWriter, string, any) error
	},
	portfolioService *services.PortfolioService,
	storageService *services.StorageService,
	analyticsService *services.AnalyticsService,
) *AdminHandler {
	return &AdminHandler{
		Renderer:         renderer,
		PortfolioService: portfolioService,
		StorageService:   storageService,
		AnalyticsService: analyticsService,
	}
}

func (h *AdminHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cookie, err := r.Cookie("admin_session")
		if err == nil && middleware.ValidateSessionCookie(cookie.Value) {
			http.Redirect(w, r, "/admin", http.StatusSeeOther)
			return
		}

		data := map[string]any{
			"CSRFToken": middleware.GetCSRFToken(r),
		}
		if err := h.Renderer.Render(w, "admin-login", data); err != nil {
			http.Error(w, "failed to render admin login", http.StatusInternalServerError)
		}
		return
	}

	password := r.FormValue("password")
	if !middleware.ValidatePassword(password) {
		http.Error(w, "invalid password", http.StatusUnauthorized)
		return
	}

	isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
	http.SetCookie(w, &http.Cookie{
		Name:     "admin_session",
		Value:    middleware.AdminSessionSecret(),
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteStrictMode,
	})

	http.Redirect(w, r, "/admin", http.StatusSeeOther)
}

func (h *AdminHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "admin_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteStrictMode,
	})

	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

func (h *AdminHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	currentPortfolio := h.PortfolioService.GetPortfolio()
	currentPortfolio.Badges = h.PortfolioService.GetAllBadges()

	var stats *services.AnalyticsStats
	if h.AnalyticsService != nil {
		stats = h.AnalyticsService.GetStats()
	}

	data := AdminPageData{
		Portfolio: currentPortfolio,
		CSRFToken: middleware.GetCSRFToken(r),
		Stats:     stats,
	}

	if err := h.Renderer.Render(w, "admin", data); err != nil {
		log.Printf("admin render error: %v", err)
		http.Error(w, "Failed to render admin page", http.StatusInternalServerError)
	}
}

// Résumé Handlers

func (h *AdminHandler) UploadResume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.StorageService == nil {
		http.Error(w, "storage service is not configured", http.StatusInternalServerError)
		return
	}

	if _, err := h.StorageService.SaveResume(r); err != nil {
		http.Error(w, "failed to save résumé: "+err.Error(), http.StatusBadRequest)
		return
	}

	http.Redirect(w, r, "/admin#resume", http.StatusSeeOther)
}

func (h *AdminHandler) DownloadResume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.StorageService == nil {
		http.Error(w, "storage service is not configured", http.StatusInternalServerError)
		return
	}

	resumePath, err := h.StorageService.GetResumePath()
	if err != nil {
		http.Error(w, "résumé not found", http.StatusNotFound)
		return
	}

	if _, err := os.Stat(resumePath); err != nil {
		http.Error(w, "résumé not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Disposition", `attachment; filename="resume.pdf"`)
	w.Header().Set("Content-Type", "application/pdf")
	http.ServeFile(w, r, resumePath)
}

// Profile Handlers

func (h *AdminHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	oldImage := currentPortfolio.Profile.ProfileImage

	profileImage := r.FormValue("profile_image")

	// Check if a new file upload was provided
	if h.StorageService != nil {
		uploadedURL, err := h.StorageService.SaveImage(r, "profile_image_file", "profile")
		if err != nil {
			http.Error(w, "failed to upload profile image: "+err.Error(), http.StatusBadRequest)
			return
		}
		if uploadedURL != "" {
			profileImage = uploadedURL
		}
	}

	profile := models.Profile{
		Name:         r.FormValue("name"),
		Title:        r.FormValue("title"),
		Bio:          r.FormValue("bio"),
		Location:     r.FormValue("location"),
		ProfileImage: profileImage,
		Availability: r.FormValue("availability"),
	}

	if err := h.PortfolioService.UpdateProfile(profile); err != nil {
		http.Error(w, "failed to update profile", http.StatusInternalServerError)
		return
	}

	// Safe replacement: if new image differs and old image was local, delete old file
	if profileImage != oldImage && oldImage != "" && h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(oldImage, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#profile", http.StatusSeeOther)
}

// Photos (Slideshow) Handlers

func (h *AdminHandler) AddPhoto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.StorageService == nil {
		http.Error(w, "storage service is not configured", http.StatusInternalServerError)
		return
	}

	imageURL, err := h.StorageService.SaveImage(r, "image", "photos")
	if err != nil {
		http.Error(w, "failed to upload photo: "+err.Error(), http.StatusBadRequest)
		return
	}

	if imageURL == "" {
		http.Error(w, "photo image file is required", http.StatusBadRequest)
		return
	}

	order, _ := strconv.Atoi(r.FormValue("display_order"))

	photo := models.Photo{
		URL:          imageURL,
		Caption:      r.FormValue("caption"),
		DisplayOrder: order,
	}

	if err := h.PortfolioService.AddPhoto(photo); err != nil {
		_ = h.StorageService.SafeDeleteFile(imageURL, nil)
		http.Error(w, "failed to save photo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#photos", http.StatusSeeOther)
}

func (h *AdminHandler) UpdatePhoto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid photo index", http.StatusBadRequest)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	if index < 0 || index >= len(currentPortfolio.Photos) {
		http.Error(w, "photo not found", http.StatusNotFound)
		return
	}

	photoToUpdate := currentPortfolio.Photos[index]
	if photoToUpdate.ID == 0 {
		http.Error(w, "cannot update bundled default photo directly; upload a new photo", http.StatusBadRequest)
		return
	}

	currentPhoto := currentPortfolio.Photos[index]
	imageURL := currentPhoto.URL
	var newImageURL string

	if h.StorageService != nil {
		uploaded, err := h.StorageService.SaveImage(r, "image", "photos")
		if err != nil {
			http.Error(w, "failed to upload replacement photo: "+err.Error(), http.StatusBadRequest)
			return
		}
		if uploaded != "" {
			newImageURL = uploaded
			imageURL = uploaded
		}
	}

	order, _ := strconv.Atoi(r.FormValue("display_order"))

	photo := models.Photo{
		URL:          imageURL,
		Caption:      r.FormValue("caption"),
		DisplayOrder: order,
	}

	if err := h.PortfolioService.UpdatePhoto(index, photo); err != nil {
		if newImageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(newImageURL, nil)
		}
		http.Error(w, "failed to update photo", http.StatusInternalServerError)
		return
	}

	// Safe replacement
	if newImageURL != "" && newImageURL != currentPhoto.URL && h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(currentPhoto.URL, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#photos", http.StatusSeeOther)
}

func (h *AdminHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid photo index", http.StatusBadRequest)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	if index < 0 || index >= len(currentPortfolio.Photos) {
		http.Error(w, "photo not found", http.StatusNotFound)
		return
	}

	photoToDelete := currentPortfolio.Photos[index]
	if photoToDelete.ID == 0 {
		http.Error(w, "cannot delete bundled default photo", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.DeletePhoto(index); err != nil {
		http.Error(w, "failed to delete photo", http.StatusInternalServerError)
		return
	}

	if h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(photoToDelete.URL, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#photos", http.StatusSeeOther)
}

// Certificate Handlers

func (h *AdminHandler) AddCertificate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var imageURL string
	if h.StorageService != nil {
		uploaded, err := h.StorageService.SaveImage(r, "image", "certificates")
		if err != nil {
			http.Error(w, "failed to upload certificate image: "+err.Error(), http.StatusBadRequest)
			return
		}
		imageURL = uploaded
	}

	certificate := models.Certificate{
		Title:           r.FormValue("title"),
		Issuer:          r.FormValue("issuer"),
		IssueDate:       r.FormValue("issue_date"),
		CredentialID:    r.FormValue("credential_id"),
		Description:     r.FormValue("description"),
		Image:           imageURL,
		VerificationURL: r.FormValue("verification_url"),
	}

	if certificate.Title == "" || certificate.Issuer == "" {
		if imageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(imageURL, nil)
		}
		http.Error(w, "title and issuer are required", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.AddCertificate(certificate); err != nil {
		if imageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(imageURL, nil)
		}
		http.Error(w, "failed to add certificate", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#certificates", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateCertificate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid certificate index", http.StatusBadRequest)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	if index < 0 || index >= len(currentPortfolio.Certificates) {
		http.Error(w, "certificate not found", http.StatusNotFound)
		return
	}

	currentCertificate := currentPortfolio.Certificates[index]
	imageURL := currentCertificate.Image
	var newImageURL string

	if h.StorageService != nil {
		uploaded, err := h.StorageService.SaveImage(r, "image", "certificates")
		if err != nil {
			http.Error(w, "failed to upload certificate image: "+err.Error(), http.StatusBadRequest)
			return
		}
		if uploaded != "" {
			newImageURL = uploaded
			imageURL = uploaded
		}
	}

	certificate := models.Certificate{
		Title:           r.FormValue("title"),
		Issuer:          r.FormValue("issuer"),
		IssueDate:       r.FormValue("issue_date"),
		CredentialID:    r.FormValue("credential_id"),
		Description:     r.FormValue("description"),
		Image:           imageURL,
		VerificationURL: r.FormValue("verification_url"),
	}

	if certificate.Title == "" || certificate.Issuer == "" {
		if newImageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(newImageURL, nil)
		}
		http.Error(w, "title and issuer are required", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.UpdateCertificate(index, certificate); err != nil {
		if newImageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(newImageURL, nil)
		}
		http.Error(w, "failed to update certificate", http.StatusInternalServerError)
		return
	}

	// Safe replacement
	if newImageURL != "" && newImageURL != currentCertificate.Image && h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(currentCertificate.Image, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#certificates", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteCertificate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid certificate index", http.StatusBadRequest)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	if index < 0 || index >= len(currentPortfolio.Certificates) {
		http.Error(w, "certificate not found", http.StatusNotFound)
		return
	}

	certificateToDelete := currentPortfolio.Certificates[index]

	if err := h.PortfolioService.DeleteCertificate(index); err != nil {
		http.Error(w, "failed to delete certificate", http.StatusInternalServerError)
		return
	}

	if h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(certificateToDelete.Image, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#certificates", http.StatusSeeOther)
}

// validateVerificationURL verifies that a non-empty URL is a valid absolute HTTP or HTTPS URL.
func validateVerificationURL(rawURL string) error {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil {
		return errors.New("verification URL must be a valid URL")
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return errors.New("verification URL must use http:// or https://")
	}
	if parsed.Host == "" {
		return errors.New("verification URL must include a host")
	}
	return nil
}

// Badge Handlers

func (h *AdminHandler) AddBadge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	issuer := strings.TrimSpace(r.FormValue("issuer"))
	dateEarned := strings.TrimSpace(r.FormValue("date_earned"))
	credentialID := strings.TrimSpace(r.FormValue("credential_id"))
	verificationURL := strings.TrimSpace(r.FormValue("verification_url"))
	description := strings.TrimSpace(r.FormValue("description"))
	displayOrder, _ := strconv.Atoi(r.FormValue("display_order"))

	isPublished := true
	if r.FormValue("is_published") == "false" || r.FormValue("is_published") == "0" {
		isPublished = false
	}

	if title == "" || issuer == "" {
		http.Error(w, "title and issuer are required", http.StatusBadRequest)
		return
	}

	if err := validateVerificationURL(verificationURL); err != nil {
		http.Error(w, "invalid verification URL: "+err.Error(), http.StatusBadRequest)
		return
	}

	if h.StorageService == nil {
		http.Error(w, "storage service is not configured", http.StatusInternalServerError)
		return
	}

	imageURL, err := h.StorageService.SaveImage(r, "image", "badges")
	if err != nil {
		http.Error(w, "failed to upload badge image: "+err.Error(), http.StatusBadRequest)
		return
	}

	if imageURL == "" {
		http.Error(w, "badge image is required", http.StatusBadRequest)
		return
	}

	badge := models.Badge{
		Title:           title,
		Issuer:          issuer,
		DateEarned:      dateEarned,
		CredentialID:    credentialID,
		VerificationURL: verificationURL,
		Description:     description,
		ImageURL:        imageURL,
		DisplayOrder:    displayOrder,
		IsPublished:     isPublished,
	}

	if err := h.PortfolioService.AddBadge(badge); err != nil {
		_ = h.StorageService.SafeDeleteFile(imageURL, nil)
		http.Error(w, "failed to add badge: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#badges", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateBadge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := r.PathValue("id")
	badgeID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		http.Error(w, "invalid badge ID", http.StatusBadRequest)
		return
	}

	existingBadge, err := h.PortfolioService.GetBadgeByID(uint(badgeID))
	if err != nil {
		http.Error(w, "badge not found", http.StatusNotFound)
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	issuer := strings.TrimSpace(r.FormValue("issuer"))
	dateEarned := strings.TrimSpace(r.FormValue("date_earned"))
	credentialID := strings.TrimSpace(r.FormValue("credential_id"))
	verificationURL := strings.TrimSpace(r.FormValue("verification_url"))
	description := strings.TrimSpace(r.FormValue("description"))
	displayOrder, _ := strconv.Atoi(r.FormValue("display_order"))

	isPublished := r.FormValue("is_published") == "true" || r.FormValue("is_published") == "on"

	if title == "" || issuer == "" {
		http.Error(w, "title and issuer are required", http.StatusBadRequest)
		return
	}

	if err := validateVerificationURL(verificationURL); err != nil {
		http.Error(w, "invalid verification URL: "+err.Error(), http.StatusBadRequest)
		return
	}

	imageURL := existingBadge.ImageURL
	var newImageURL string

	if h.StorageService != nil {
		uploaded, err := h.StorageService.SaveImage(r, "image", "badges")
		if err != nil {
			http.Error(w, "failed to upload replacement badge image: "+err.Error(), http.StatusBadRequest)
			return
		}
		if uploaded != "" {
			newImageURL = uploaded
			imageURL = uploaded
		}
	}

	badge := models.Badge{
		ID:              existingBadge.ID,
		Title:           title,
		Issuer:          issuer,
		DateEarned:      dateEarned,
		CredentialID:    credentialID,
		VerificationURL: verificationURL,
		Description:     description,
		ImageURL:        imageURL,
		DisplayOrder:    displayOrder,
		IsPublished:     isPublished,
	}

	if err := h.PortfolioService.UpdateBadge(badge); err != nil {
		if newImageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(newImageURL, nil)
		}
		http.Error(w, "failed to update badge: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if newImageURL != "" && newImageURL != existingBadge.ImageURL && h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(existingBadge.ImageURL, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#badges", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteBadge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := r.PathValue("id")
	badgeID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		http.Error(w, "invalid badge ID", http.StatusBadRequest)
		return
	}

	badgeToDelete, err := h.PortfolioService.GetBadgeByID(uint(badgeID))
	if err != nil {
		http.Error(w, "badge not found", http.StatusNotFound)
		return
	}

	if err := h.PortfolioService.DeleteBadge(uint(badgeID)); err != nil {
		http.Error(w, "failed to delete badge: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(badgeToDelete.ImageURL, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#badges", http.StatusSeeOther)
}

func (h *AdminHandler) ToggleBadgePublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := r.PathValue("id")
	badgeID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		http.Error(w, "invalid badge ID", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.ToggleBadgePublish(uint(badgeID)); err != nil {
		http.Error(w, "failed to toggle badge visibility: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#badges", http.StatusSeeOther)
}

func (h *AdminHandler) ReorderBadge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := r.PathValue("id")
	badgeID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		http.Error(w, "invalid badge ID", http.StatusBadRequest)
		return
	}

	direction := r.URL.Query().Get("direction")
	if direction == "" {
		direction = r.FormValue("direction")
	}

	if err := h.PortfolioService.ReorderBadge(uint(badgeID), direction); err != nil {
		http.Error(w, "failed to reorder badge: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#badges", http.StatusSeeOther)
}

// Project Handlers

func (h *AdminHandler) AddProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	project, ok := parseProjectForm(w, r)
	if !ok {
		return
	}

	var imageURL string
	if h.StorageService != nil {
		uploaded, err := h.StorageService.SaveImage(r, "image", "projects")
		if err != nil {
			http.Error(w, "failed to upload project image: "+err.Error(), http.StatusBadRequest)
			return
		}
		imageURL = uploaded
	}

	project.Image = imageURL

	if err := h.PortfolioService.AddProject(project); err != nil {
		if imageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(imageURL, nil)
		}
		http.Error(w, "failed to add project", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#projects", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid project index", http.StatusBadRequest)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	if index < 0 || index >= len(currentPortfolio.Projects) {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}

	project, ok := parseProjectForm(w, r)
	if !ok {
		return
	}

	currentProject := currentPortfolio.Projects[index]
	project.Image = currentProject.Image
	var newImageURL string

	if h.StorageService != nil {
		uploaded, err := h.StorageService.SaveImage(r, "image", "projects")
		if err != nil {
			http.Error(w, "failed to upload project image: "+err.Error(), http.StatusBadRequest)
			return
		}
		if uploaded != "" {
			newImageURL = uploaded
			project.Image = uploaded
		}
	}

	if err := h.PortfolioService.UpdateProject(index, project); err != nil {
		if newImageURL != "" && h.StorageService != nil {
			_ = h.StorageService.SafeDeleteFile(newImageURL, nil)
		}
		http.Error(w, "failed to update project", http.StatusInternalServerError)
		return
	}

	// Safe replacement
	if newImageURL != "" && newImageURL != currentProject.Image && h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(currentProject.Image, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#projects", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid project index", http.StatusBadRequest)
		return
	}

	currentPortfolio := h.PortfolioService.GetPortfolio()
	if index < 0 || index >= len(currentPortfolio.Projects) {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}

	projectToDelete := currentPortfolio.Projects[index]

	if err := h.PortfolioService.DeleteProject(index); err != nil {
		http.Error(w, "failed to delete project", http.StatusInternalServerError)
		return
	}

	if h.StorageService != nil {
		_ = h.StorageService.SafeDeleteFile(projectToDelete.Image, h.PortfolioService.IsImageReferenced)
	}

	http.Redirect(w, r, "/admin#projects", http.StatusSeeOther)
}

// Skills Handlers

func (h *AdminHandler) AddSkill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	skill, ok := parseSkillForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.AddSkill(skill); err != nil {
		http.Error(w, "failed to add skill", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#skills", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateSkill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid skill index", http.StatusBadRequest)
		return
	}

	skill, ok := parseSkillForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.UpdateSkill(index, skill); err != nil {
		http.Error(w, "failed to update skill", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#skills", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteSkill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid skill index", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.DeleteSkill(index); err != nil {
		http.Error(w, "failed to delete skill", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#skills", http.StatusSeeOther)
}

// Statistics Handlers

func (h *AdminHandler) AddStatistic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	statistic, ok := parseStatisticForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.AddStatistic(statistic); err != nil {
		http.Error(w, "failed to add statistic", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateStatistic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid statistic index", http.StatusBadRequest)
		return
	}

	statistic, ok := parseStatisticForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.UpdateStatistic(index, statistic); err != nil {
		http.Error(w, "failed to update statistic", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteStatistic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid statistic index", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.DeleteStatistic(index); err != nil {
		http.Error(w, "failed to delete statistic", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

// Service Handlers

func (h *AdminHandler) AddService(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	service := models.ServiceOffering{
		Title:       r.FormValue("title"),
		Description: r.FormValue("description"),
		Icon:        r.FormValue("icon"),
	}

	if service.Title == "" || service.Description == "" {
		http.Error(w, "title and description are required", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.AddService(service); err != nil {
		http.Error(w, "failed to add service", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateService(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid service index", http.StatusBadRequest)
		return
	}

	service := models.ServiceOffering{
		Title:       r.FormValue("title"),
		Description: r.FormValue("description"),
		Icon:        r.FormValue("icon"),
	}

	if service.Title == "" || service.Description == "" {
		http.Error(w, "title and description are required", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.UpdateService(index, service); err != nil {
		http.Error(w, "failed to update service", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteService(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid service index", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.DeleteService(index); err != nil {
		http.Error(w, "failed to delete service", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

// Education Handlers

func (h *AdminHandler) AddEducation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	entry, ok := parseEducationForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.AddEducation(entry); err != nil {
		http.Error(w, "failed to add education entry", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateEducation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid education index", http.StatusBadRequest)
		return
	}

	entry, ok := parseEducationForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.UpdateEducation(index, entry); err != nil {
		http.Error(w, "failed to update education entry", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteEducation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid education index", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.DeleteEducation(index); err != nil {
		http.Error(w, "failed to delete education entry", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#overview", http.StatusSeeOther)
}

// Contact Handlers

func (h *AdminHandler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	contact := models.ContactInfo{
		Email:    r.FormValue("email"),
		Phone:    r.FormValue("phone"),
		Location: r.FormValue("location"),
	}

	if err := h.PortfolioService.UpdateContact(contact); err != nil {
		http.Error(w, "failed to update contact", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#profile", http.StatusSeeOther)
}

// Social Links Handlers

func (h *AdminHandler) AddSocialLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	link, ok := parseSocialLinkForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.AddSocialLink(link); err != nil {
		http.Error(w, "failed to add social link", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#profile", http.StatusSeeOther)
}

func (h *AdminHandler) UpdateSocialLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid social link index", http.StatusBadRequest)
		return
	}

	link, ok := parseSocialLinkForm(w, r)
	if !ok {
		return
	}

	if err := h.PortfolioService.UpdateSocialLink(index, link); err != nil {
		http.Error(w, "failed to update social link", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#profile", http.StatusSeeOther)
}

func (h *AdminHandler) DeleteSocialLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		http.Error(w, "invalid social link index", http.StatusBadRequest)
		return
	}

	if err := h.PortfolioService.DeleteSocialLink(index); err != nil {
		http.Error(w, "failed to delete social link", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin#profile", http.StatusSeeOther)
}

// Helpers

func parseSkillForm(w http.ResponseWriter, r *http.Request) (models.Skill, bool) {
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		http.Error(w, "skill name is required", http.StatusBadRequest)
		return models.Skill{}, false
	}

	return models.Skill{
		Name:     name,
		Category: strings.TrimSpace(r.FormValue("category")),
	}, true
}

func parseEducationForm(w http.ResponseWriter, r *http.Request) (models.EducationEntry, bool) {
	institution := strings.TrimSpace(r.FormValue("institution"))
	degree := strings.TrimSpace(r.FormValue("degree"))

	if institution == "" || degree == "" {
		http.Error(w, "institution and degree are required", http.StatusBadRequest)
		return models.EducationEntry{}, false
	}

	startYear, ok := parseOptionalYear(w, r.FormValue("start_year"), "start year")
	if !ok {
		return models.EducationEntry{}, false
	}

	endYear, ok := parseOptionalYear(w, r.FormValue("end_year"), "end year")
	if !ok {
		return models.EducationEntry{}, false
	}

	if startYear != 0 && endYear != 0 && endYear < startYear {
		http.Error(w, "end year must not be before start year", http.StatusBadRequest)
		return models.EducationEntry{}, false
	}

	return models.EducationEntry{
		Institution: institution,
		Degree:      degree,
		Field:       r.FormValue("field"),
		StartYear:   startYear,
		EndYear:     endYear,
		Description: r.FormValue("description"),
	}, true
}

func parseOptionalYear(w http.ResponseWriter, value string, label string) (int, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, true
	}

	year, err := strconv.Atoi(value)
	if err != nil || year < 1950 || year > 2100 {
		http.Error(w, label+" must be a year between 1950 and 2100", http.StatusBadRequest)
		return 0, false
	}

	return year, true
}

func parseProjectForm(w http.ResponseWriter, r *http.Request) (models.Project, bool) {
	name := strings.TrimSpace(r.FormValue("name"))
	description := strings.TrimSpace(r.FormValue("description"))

	if name == "" || description == "" {
		http.Error(w, "name and description are required", http.StatusBadRequest)
		return models.Project{}, false
	}

	var technologies []string
	for _, tech := range strings.Split(r.FormValue("technologies"), ",") {
		tech = strings.TrimSpace(tech)
		if tech != "" {
			technologies = append(technologies, tech)
		}
	}

	return models.Project{
		Name:         name,
		Description:  description,
		URL:          strings.TrimSpace(r.FormValue("url")),
		GitHub:       strings.TrimSpace(r.FormValue("github")),
		Technologies: technologies,
	}, true
}

func parseSocialLinkForm(w http.ResponseWriter, r *http.Request) (models.SocialLink, bool) {
	platform := strings.TrimSpace(r.FormValue("platform"))
	url := strings.TrimSpace(r.FormValue("url"))

	if platform == "" || url == "" {
		http.Error(w, "platform and URL are required", http.StatusBadRequest)
		return models.SocialLink{}, false
	}

	return models.SocialLink{
		Platform: platform,
		URL:      url,
		Username: strings.TrimSpace(r.FormValue("username")),
	}, true
}

func parseStatisticForm(w http.ResponseWriter, r *http.Request) (models.Statistic, bool) {
	label := strings.TrimSpace(r.FormValue("label"))
	value := strings.TrimSpace(r.FormValue("value"))

	if label == "" || value == "" {
		http.Error(w, "statistic label and value are required", http.StatusBadRequest)
		return models.Statistic{}, false
	}

	return models.Statistic{
		Label: label,
		Value: value,
	}, true
}
