package renderer

import (
	"net/http/httptest"
	"strings"
	"testing"

	"portfolio-os/internal/models"
	"portfolio-os/internal/web"
)

func TestRenderer_SpiderCrawlerIntegration(t *testing.T) {
	r, err := New(web.Files)
	if err != nil {
		t.Fatalf("failed to create renderer: %v", err)
	}

	pages := []string{"home", "client", "developer"}
	dummyData := struct {
		Title     string
		Portfolio models.Portfolio
	}{
		Title: "Test Portfolio",
		Portfolio: models.Portfolio{
			Profile: models.Profile{
				Name:         "Terna Peter",
				Bio:          "Backend Systems & AI Automation Engineer",
				Location:     "Earth",
				Availability: "Available for Hire",
			},
		},
	}

	for _, page := range pages {
		rec := httptest.NewRecorder()
		err := r.Render(rec, page, dummyData)
		if err != nil {
			t.Errorf("failed to render %s page: %v", page, err)
			continue
		}

		out := rec.Body.String()
		if !strings.Contains(out, "/static/css/spider-crawler.css") {
			t.Errorf("expected %s page to include /static/css/spider-crawler.css", page)
		}
		if !strings.Contains(out, "/static/js/spider-crawler.js") {
			t.Errorf("expected %s page to include /static/js/spider-crawler.js", page)
		}
	}
}
