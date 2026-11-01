package main

import (
	"io/fs"
	"log"
	"net/http"
	"os"

	"portfolio-os/internal/handlers"
	"portfolio-os/internal/middleware"
	"portfolio-os/internal/models"
	"portfolio-os/internal/renderer"
	"portfolio-os/internal/services"
	"portfolio-os/internal/web"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// 1. Static Assets & File Servers
	staticFS, err := fs.Sub(web.Files, "static")
	if err != nil {
		log.Fatal(err)
	}

	staticHandler := http.FileServer(http.FS(staticFS))

	storageService, err := services.NewStorageService(os.Getenv("UPLOAD_DIR"))
	if err != nil {
		log.Fatalf("Failed to initialize storage service: %v", err)
	}

	// 2. Database
	db, err := services.NewDatabase()
	if err != nil {
		log.Fatal(err)
	}

	if err := services.MigrateDatabase(db); err != nil {
		log.Fatal(err)
	}

	// Seed portfolio data if database is fresh
	var profileCount int64
	db.Model(&models.Profile{}).Count(&profileCount)
	if profileCount == 0 {
		log.Println("Database is empty, seeding from data/portfolio.json...")
		if err := services.MigratePortfolioData(db, "data/portfolio.json"); err != nil {
			log.Printf("Warning: failed to seed portfolio data: %v", err)
		} else {
			log.Println("Successfully seeded portfolio data")
		}
	}

	if err := services.VerifyPortfolioData(db); err != nil {
		log.Printf("Database verification notice: %v", err)
	}

	// 3. Renderer
	pageRenderer, err := renderer.New(web.Files)
	if err != nil {
		log.Fatal(err)
	}
	portfolioService := services.NewPortfolioService(db)

	analyticsService, err := services.NewAnalyticsService()
	if err != nil {
		log.Fatal(err)
	}

	// 5. Handlers
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService)

	adminHandler := handlers.NewAdminHandler(
		pageRenderer,
		portfolioService,
		storageService,
		analyticsService,
	)

	homeHandler := handlers.NewHomeHandler(
		pageRenderer,
		portfolioService,
	)

	// 6. Mux Routes
	mux := http.NewServeMux()

	// Static & Upload File Handlers
	mux.Handle(
		"GET /static/",
		http.StripPrefix("/static/", staticHandler),
	)

	// Route /images/ requests to static images (e.g. /images/mypage.png)
	mux.Handle(
		"GET /images/",
		http.StripPrefix("/images/", http.FileServer(http.FS(func() fs.FS {
			sub, _ := fs.Sub(staticFS, "images")
			return sub
		}()))),
	)

	// Local Uploads Handler
	mux.Handle(
		"GET /uploads/",
		http.StripPrefix("/uploads/", storageService.FileServerHandler()),
	)

	// Page Views
	mux.HandleFunc("GET /{$}", homeHandler.HandleHome)
	mux.HandleFunc("GET /client", homeHandler.HandleClient)
	mux.HandleFunc("GET /developer", homeHandler.HandleDeveloper)

	// Auth Endpoints
	mux.HandleFunc("GET /admin/login", adminHandler.Login)
	mux.HandleFunc("POST /admin/login", adminHandler.Login)
	mux.HandleFunc("GET /admin/logout", adminHandler.Logout)

	// Analytics Endpoints
	mux.HandleFunc(
		"POST /api/visits",
		analyticsHandler.StartVisit,
	)

	mux.HandleFunc(
		"PATCH /api/visits/{id}",
		analyticsHandler.UpdateDuration,
	)

	mux.Handle(
		"GET /api/admin/analytics",
		middleware.AdminAuth(
			http.HandlerFunc(analyticsHandler.GetStats),
		),
	)

	// Admin Dashboard
	mux.Handle(
		"GET /admin",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.Dashboard),
		),
	)

	// Profile
	mux.Handle(
		"POST /admin/profile",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateProfile),
		),
	)

	// Photos (Slideshow)
	mux.Handle(
		"POST /admin/photos",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddPhoto),
		),
	)

	mux.Handle(
		"POST /admin/photos/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdatePhoto),
		),
	)

	mux.Handle(
		"POST /admin/photos/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeletePhoto),
		),
	)

	// Certificates
	mux.Handle(
		"POST /admin/certificates",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddCertificate),
		),
	)

	mux.Handle(
		"POST /admin/certificates/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateCertificate),
		),
	)

	mux.Handle(
		"POST /admin/certificates/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteCertificate),
		),
	)

	// Skills
	mux.Handle(
		"POST /admin/skills",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddSkill),
		),
	)

	mux.Handle(
		"POST /admin/skills/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateSkill),
		),
	)

	mux.Handle(
		"POST /admin/skills/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteSkill),
		),
	)

	// Statistics
	mux.Handle(
		"POST /admin/statistics",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddStatistic),
		),
	)

	mux.Handle(
		"POST /admin/statistics/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateStatistic),
		),
	)

	mux.Handle(
		"POST /admin/statistics/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteStatistic),
		),
	)

	// Services
	mux.Handle(
		"POST /admin/services",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddService),
		),
	)

	mux.Handle(
		"POST /admin/services/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateService),
		),
	)

	mux.Handle(
		"POST /admin/services/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteService),
		),
	)

	// Education
	mux.Handle(
		"POST /admin/education",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddEducation),
		),
	)

	mux.Handle(
		"POST /admin/education/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateEducation),
		),
	)

	mux.Handle(
		"POST /admin/education/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteEducation),
		),
	)

	// Projects
	mux.Handle(
		"POST /admin/projects",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddProject),
		),
	)

	mux.Handle(
		"POST /admin/projects/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateProject),
		),
	)

	mux.Handle(
		"POST /admin/projects/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteProject),
		),
	)

	// Contact
	mux.Handle(
		"POST /admin/contact",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateContact),
		),
	)

	// Social Links
	mux.Handle(
		"POST /admin/social-links",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.AddSocialLink),
		),
	)

	mux.Handle(
		"POST /admin/social-links/{index}",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UpdateSocialLink),
		),
	)

	mux.Handle(
		"POST /admin/social-links/{index}/delete",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.DeleteSocialLink),
		),
	)

	// Resume
	mux.Handle(
		"POST /admin/resume",
		middleware.AdminAuth(
			http.HandlerFunc(adminHandler.UploadResume),
		),
	)

	mux.Handle(
		"GET /resume",
		http.HandlerFunc(adminHandler.DownloadResume),
	)
	mux.Handle(
		"HEAD /resume",
		http.HandlerFunc(adminHandler.DownloadResume),
	)

	// 7. Start Server with CSRF protection enabled
	handler := middleware.CSRF(mux)

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe("0.0.0.0:"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
