package services

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Allowed image MIME types. SVG and executable/HTML are strictly rejected.
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// StorageService handles local file uploads, directory initialization, safe replacements, and deletions.
type StorageService struct {
	uploadDir string
}

// NewStorageService initializes local storage with the configured or default directory.
func NewStorageService(uploadDir string) (*StorageService, error) {
	if uploadDir == "" {
		uploadDir = os.Getenv("UPLOAD_DIR")
	}
	if uploadDir == "" {
		uploadDir = "uploads"
	}

	uploadDir = filepath.Clean(uploadDir)

	s := &StorageService{
		uploadDir: uploadDir,
	}

	if err := s.InitDirectories(); err != nil {
		return nil, fmt.Errorf("failed to initialize upload directories: %w", err)
	}

	// Safely seed bundled fallback assets if they don't exist in the target upload directory.
	s.seedBundledAssets()

	return s, nil
}

// InitDirectories safely creates all required upload subdirectories.
func (s *StorageService) InitDirectories() error {
	subdirs := []string{
		"projects",
		"certificates",
		"profile",
		"photos",
		"resume",
	}

	for _, sub := range subdirs {
		dir := filepath.Join(s.uploadDir, sub)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("could not create subdirectory %s: %w", sub, err)
		}
	}

	return nil
}

// GetUploadDir returns the configured filesystem upload root.
func (s *StorageService) GetUploadDir() string {
	return s.uploadDir
}

// seedBundledAssets safely copies bundled files from default "uploads" if uploadDir is external.
func (s *StorageService) seedBundledAssets() {
	sourceDir := "uploads"
	absSource, err1 := filepath.Abs(sourceDir)
	absTarget, err2 := filepath.Abs(s.uploadDir)
	if err1 == nil && err2 == nil && absSource == absTarget {
		return // Same directory, no seeding needed.
	}

	// Bundled certificates to preserve
	bundledFiles := []string{
		filepath.Join("certificates", "3e381fc26f004bc908a1551f435a218c.png"),
		filepath.Join("certificates", "ab15e093578b1ee595f47f22069a29a4.png"),
		filepath.Join("resume", "resume.pdf"),
	}

	for _, rel := range bundledFiles {
		src := filepath.Join(sourceDir, rel)
		dst := filepath.Join(s.uploadDir, rel)

		if _, err := os.Stat(dst); os.IsNotExist(err) {
			if srcData, err := os.ReadFile(src); err == nil {
				if err := os.MkdirAll(filepath.Dir(dst), 0755); err == nil {
					_ = os.WriteFile(dst, srcData, 0644)
					log.Printf("Seeded bundled asset to upload directory: %s", rel)
				}
			}
		}
	}
}

// SaveImage validates and saves an uploaded raster image (JPEG, PNG, WebP) up to 10MB.
// It generates a collision-resistant server-side filename and returns the public URL.
func (s *StorageService) SaveImage(r *http.Request, formField string, folder string) (string, error) {
	validFolders := map[string]bool{
		"projects":     true,
		"certificates": true,
		"profile":      true,
		"photos":       true,
	}

	if !validFolders[folder] {
		return "", errors.New("invalid upload target folder")
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		return "", errors.New("failed to parse uploaded form data")
	}

	file, header, err := r.FormFile(formField)
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return "", nil // No file was provided, keep existing reference.
		}
		return "", errors.New("failed to read uploaded image")
	}
	defer file.Close()

	if header.Size > 10<<20 {
		return "", errors.New("image is too large; maximum allowed size is 10MB")
	}

	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", errors.New("failed to inspect image contents")
	}

	sniffed := buffer[:n]

	// Reject HTML, scripts, and SVG aggressively
	sniffedLower := strings.ToLower(string(sniffed))
	if strings.Contains(sniffedLower, "<svg") ||
		strings.Contains(sniffedLower, "<?xml") ||
		strings.Contains(sniffedLower, "<html") ||
		strings.Contains(sniffedLower, "<script") ||
		strings.Contains(sniffedLower, "<!doctype") {
		return "", errors.New("unsupported image format; SVG and HTML uploads are not permitted")
	}

	// Executable signature check
	if bytes.HasPrefix(sniffed, []byte("MZ")) || bytes.HasPrefix(sniffed, []byte("\x7fELF")) {
		return "", errors.New("executable files are not permitted")
	}

	detectedMIME := http.DetectContentType(sniffed)
	ext, allowed := allowedImageTypes[detectedMIME]
	if !allowed {
		return "", fmt.Errorf("unsupported image type: %s; only JPEG, PNG, and WebP are allowed", detectedMIME)
	}

	// Check declared extension as well
	origExt := strings.ToLower(filepath.Ext(header.Filename))
	validExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".webp": true,
	}
	if origExt != "" && !validExts[origExt] {
		return "", fmt.Errorf("file extension %s does not match an allowed raster image format", origExt)
	}

	// Verify magic bytes for common formats
	switch detectedMIME {
	case "image/png":
		if !bytes.HasPrefix(sniffed, []byte("\x89PNG\r\n\x1a\n")) {
			return "", errors.New("invalid PNG file signature")
		}
	case "image/jpeg":
		if !bytes.HasPrefix(sniffed, []byte("\xff\xd8\xff")) {
			return "", errors.New("invalid JPEG file signature")
		}
	case "image/webp":
		if len(sniffed) >= 12 && (string(sniffed[:4]) != "RIFF" || string(sniffed[8:12]) != "WEBP") {
			return "", errors.New("invalid WebP file signature")
		}
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", errors.New("failed to reset image stream")
	}

	randomID, err := generateRandomHex(16)
	if err != nil {
		return "", errors.New("failed to generate unique filename")
	}

	filename := randomID + ext
	targetDir := filepath.Join(s.uploadDir, folder)
	targetPath := filepath.Join(targetDir, filename)

	// Ensure no path traversal outside uploadDir
	if err := s.validateWithinRoot(targetPath); err != nil {
		return "", errors.New("invalid target file path")
	}

	out, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return "", errors.New("failed to create destination file on disk")
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		_ = os.Remove(targetPath)
		return "", errors.New("failed to write image data to disk")
	}

	publicURL := fmt.Sprintf("/uploads/%s/%s", folder, filename)
	return publicURL, nil
}

// SaveResume validates and saves a PDF résumé to <uploadDir>/resume/resume.pdf.
func (s *StorageService) SaveResume(r *http.Request) (string, error) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		return "", errors.New("failed to parse uploaded form data")
	}

	file, header, err := r.FormFile("resume")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return "", errors.New("a résumé PDF file is required")
		}
		return "", errors.New("failed to read uploaded résumé")
	}
	defer file.Close()

	if header.Size > 10<<20 {
		return "", errors.New("résumé is too large; maximum allowed size is 10MB")
	}

	origExt := strings.ToLower(filepath.Ext(header.Filename))
	if origExt != ".pdf" {
		return "", errors.New("invalid file extension; only .pdf files are accepted for résumé")
	}

	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", errors.New("failed to inspect résumé contents")
	}

	detectedMIME := http.DetectContentType(buffer[:n])
	if detectedMIME != "application/pdf" {
		return "", fmt.Errorf("unsupported résumé type %s; PDF is required", detectedMIME)
	}

	if !bytes.HasPrefix(buffer[:n], []byte("%PDF-")) {
		return "", errors.New("invalid PDF signature; file must start with %PDF-")
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", errors.New("failed to reset résumé stream")
	}

	resumeDir := filepath.Join(s.uploadDir, "resume")
	if err := os.MkdirAll(resumeDir, 0755); err != nil {
		return "", errors.New("failed to prepare résumé storage directory")
	}

	targetPath := filepath.Join(resumeDir, "resume.pdf")
	if err := s.validateWithinRoot(targetPath); err != nil {
		return "", errors.New("invalid target file path")
	}

	// Write to temporary file in the same directory first for atomic replacement
	tempPath := filepath.Join(resumeDir, fmt.Sprintf("resume.tmp.%d", os.Getpid()))
	tempFile, err := os.OpenFile(tempPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return "", errors.New("failed to create temporary résumé file")
	}

	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		_ = os.Remove(tempPath)
		return "", errors.New("failed to save résumé data")
	}
	tempFile.Close()

	if err := os.Rename(tempPath, targetPath); err != nil {
		_ = os.Remove(tempPath)
		return "", errors.New("failed to commit updated résumé")
	}

	return "/uploads/resume/resume.pdf", nil
}

// GetResumePath returns the path to the current résumé file, checking uploadDir first, then bundled fallback.
func (s *StorageService) GetResumePath() (string, error) {
	primary := filepath.Join(s.uploadDir, "resume", "resume.pdf")
	if _, err := os.Stat(primary); err == nil {
		return primary, nil
	}

	fallback := filepath.Join("uploads", "resume", "resume.pdf")
	if _, err := os.Stat(fallback); err == nil {
		return fallback, nil
	}

	return "", errors.New("résumé file not found")
}

// SafeDeleteFile deletes an uploaded file if it is stored in uploadDir and not referenced elsewhere.
func (s *StorageService) SafeDeleteFile(publicURL string, isReferenced func(string) bool) error {
	if publicURL == "" || !strings.HasPrefix(publicURL, "/uploads/") {
		return nil // Not a local upload path, nothing to delete.
	}

	// Do not delete bundled assets
	bundled := map[string]bool{
		"/uploads/certificates/3e381fc26f004bc908a1551f435a218c.png": true,
		"/uploads/certificates/ab15e093578b1ee595f47f22069a29a4.png": true,
		"/uploads/resume/resume.pdf":                                  true,
	}
	if bundled[publicURL] {
		return nil // Protected asset
	}

	if isReferenced != nil && isReferenced(publicURL) {
		return nil // File is still referenced by another record.
	}

	relPath := strings.TrimPrefix(publicURL, "/uploads/")
	cleanRel := filepath.Clean(relPath)
	targetPath := filepath.Join(s.uploadDir, cleanRel)

	if err := s.validateWithinRoot(targetPath); err != nil {
		return errors.New("invalid file deletion path")
	}

	if err := os.Remove(targetPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove file: %w", err)
	}

	return nil
}

// validateWithinRoot verifies that targetPath does not escape uploadDir.
func (s *StorageService) validateWithinRoot(targetPath string) error {
	absRoot, err := filepath.Abs(s.uploadDir)
	if err != nil {
		return err
	}
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return err
	}

	rel, err := filepath.Rel(absRoot, absTarget)
	if err != nil || strings.HasPrefix(rel, "..") {
		return errors.New("path traversal detected")
	}

	return nil
}

// FileServerHandler creates an http.Handler that safely serves files from uploadDir.
// It disables directory listings and falls back to bundled uploads/ if missing.
func (s *StorageService) FileServerHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleaned := filepath.Clean(r.URL.Path)
		if strings.HasSuffix(r.URL.Path, "/") || cleaned == "." || cleaned == "/" {
			http.NotFound(w, r)
			return
		}

		filePath := filepath.Join(s.uploadDir, cleaned)
		if err := s.validateWithinRoot(filePath); err != nil {
			http.NotFound(w, r)
			return
		}

		info, err := os.Stat(filePath)
		if err != nil || info.IsDir() {
			// Check fallback in bundled "uploads" directory if uploadDir is different
			fallbackPath := filepath.Join("uploads", cleaned)
			fallbackInfo, fallbackErr := os.Stat(fallbackPath)
			if fallbackErr == nil && !fallbackInfo.IsDir() {
				w.Header().Set("Cache-Control", "public, max-age=86400")
				http.ServeFile(w, r, fallbackPath)
				return
			}
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.ServeFile(w, r, filePath)
	})
}

func generateRandomHex(byteCount int) (string, error) {
	b := make([]byte, byteCount)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
