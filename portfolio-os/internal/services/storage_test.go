package services

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Helper to create a multipart request with given field name, filename, and content
func createMultipartRequest(t *testing.T, fieldName, filename string, content []byte) *http.Request {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(fieldName, filename)
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(content)); err != nil {
		t.Fatalf("failed to copy content: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestNewStorageService_DirectoryCreation(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	expectedSubdirs := []string{"projects", "certificates", "profile", "photos", "resume"}
	for _, sub := range expectedSubdirs {
		dirPath := filepath.Join(storage.GetUploadDir(), sub)
		info, err := os.Stat(dirPath)
		if err != nil {
			t.Errorf("expected subdirectory %s to exist, error: %v", sub, err)
		} else if !info.IsDir() {
			t.Errorf("expected %s to be a directory", dirPath)
		}
	}
}

func TestSaveImage_ValidRasterImages(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_img_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	// 1. Valid PNG
	pngData := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
	req := createMultipartRequest(t, "image", "sample.png", pngData)
	url, err := storage.SaveImage(req, "image", "projects")
	if err != nil {
		t.Fatalf("SaveImage valid PNG failed: %v", err)
	}
	if !strings.HasPrefix(url, "/uploads/projects/") || !strings.HasSuffix(url, ".png") {
		t.Errorf("unexpected public URL for PNG: %s", url)
	}

	// 2. Valid JPEG
	jpegData := []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\xff\xd9")
	req = createMultipartRequest(t, "image", "sample.jpg", jpegData)
	url, err = storage.SaveImage(req, "image", "certificates")
	if err != nil {
		t.Fatalf("SaveImage valid JPEG failed: %v", err)
	}
	if !strings.HasPrefix(url, "/uploads/certificates/") || !strings.HasSuffix(url, ".jpg") {
		t.Errorf("unexpected public URL for JPEG: %s", url)
	}

	// 3. Valid WebP
	webpData := append([]byte("RIFF\x14\x00\x00\x00WEBPVP8 "), make([]byte, 10)...)
	req = createMultipartRequest(t, "image", "sample.webp", webpData)
	url, err = storage.SaveImage(req, "image", "photos")
	if err != nil {
		t.Fatalf("SaveImage valid WebP failed: %v", err)
	}
	if !strings.HasPrefix(url, "/uploads/photos/") || !strings.HasSuffix(url, ".webp") {
		t.Errorf("unexpected public URL for WebP: %s", url)
	}
}

func TestSaveImage_RejectsDisallowedFormats(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_reject_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	cases := []struct {
		name     string
		filename string
		content  []byte
	}{
		{
			name:     "SVG upload",
			filename: "icon.svg",
			content:  []byte("<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>"),
		},
		{
			name:     "HTML upload disguised as png",
			filename: "page.png",
			content:  []byte("<!DOCTYPE html><html><body><script>alert(1)</script></body></html>"),
		},
		{
			name:     "ELF Linux executable",
			filename: "binary.png",
			content:  []byte("\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00"),
		},
		{
			name:     "Windows MZ executable",
			filename: "program.jpg",
			content:  []byte("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"),
		},
		{
			name:     "Shell script",
			filename: "script.webp",
			content:  []byte("#!/bin/bash\necho dangerous"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := createMultipartRequest(t, "image", tc.filename, tc.content)
			url, err := storage.SaveImage(req, "image", "projects")
			if err == nil {
				t.Errorf("expected error for %s, but got URL: %s", tc.name, url)
			}
		})
	}
}

func TestSaveImage_OversizedUpload(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_oversize_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	// Create 11MB dummy content starting with PNG signature
	oversized := make([]byte, 11*1024*1024)
	copy(oversized, []byte("\x89PNG\r\n\x1a\n"))

	req := createMultipartRequest(t, "image", "huge.png", oversized)
	_, err = storage.SaveImage(req, "image", "projects")
	if err == nil {
		t.Error("expected error for >10MB upload, but got nil")
	}
}

func TestSaveResume_ValidAndInvalid(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_resume_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	// 1. Valid PDF
	pdfData := []byte("%PDF-1.5\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")
	req := createMultipartRequest(t, "resume", "my_resume.pdf", pdfData)
	url, err := storage.SaveResume(req)
	if err != nil {
		t.Fatalf("SaveResume valid PDF failed: %v", err)
	}
	if url != "/uploads/resume/resume.pdf" {
		t.Errorf("unexpected public URL for resume: %s", url)
	}

	// Verify file exists
	resumePath, err := storage.GetResumePath()
	if err != nil || !strings.HasSuffix(resumePath, "resume.pdf") {
		t.Errorf("GetResumePath failed: %v, path: %s", err, resumePath)
	}

	// 2. Invalid PDF (disguised text)
	invalidReq := createMultipartRequest(t, "resume", "fake.pdf", []byte("Not a real PDF document"))
	_, err = storage.SaveResume(invalidReq)
	if err == nil {
		t.Error("expected error for fake PDF, but got nil")
	}
}

func TestStorage_PathTraversalPrevention(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_traversal_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	// Attempt deletion outside root
	err = storage.SafeDeleteFile("/uploads/../../etc/passwd", nil)
	if err == nil {
		t.Error("expected error when attempting path traversal in SafeDeleteFile")
	}
}

func TestSafeDelete_BundledAndReferencedAssets(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "storage_delete_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage, err := NewStorageService(tempDir)
	if err != nil {
		t.Fatalf("NewStorageService failed: %v", err)
	}

	// 1. Bundled asset should never be deleted
	bundledURL := "/uploads/certificates/ab15e093578b1ee595f47f22069a29a4.png"
	err = storage.SafeDeleteFile(bundledURL, func(url string) bool { return false })
	if err != nil {
		t.Errorf("SafeDeleteFile on bundled asset returned error: %v", err)
	}

	// 2. Uploaded asset that IS referenced should not be deleted
	pngData := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
	req := createMultipartRequest(t, "image", "test.png", pngData)
	uploadedURL, err := storage.SaveImage(req, "image", "projects")
	if err != nil {
		t.Fatalf("SaveImage failed: %v", err)
	}

	// Attempt deletion when referenced = true
	err = storage.SafeDeleteFile(uploadedURL, func(url string) bool { return true })
	if err != nil {
		t.Errorf("SafeDeleteFile with reference returned error: %v", err)
	}

	// Verify file is still present on disk
	rel := strings.TrimPrefix(uploadedURL, "/uploads/")
	diskPath := filepath.Join(storage.GetUploadDir(), rel)
	if _, err := os.Stat(diskPath); os.IsNotExist(err) {
		t.Error("file was deleted despite being referenced")
	}

	// Attempt deletion when referenced = false
	err = storage.SafeDeleteFile(uploadedURL, func(url string) bool { return false })
	if err != nil {
		t.Errorf("SafeDeleteFile without reference returned error: %v", err)
	}

	// Verify file was removed from disk
	if _, err := os.Stat(diskPath); !os.IsNotExist(err) {
		t.Error("file was not deleted when unreferenced")
	}
}
