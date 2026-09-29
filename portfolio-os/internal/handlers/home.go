package handlers

import (
	"log"
	"net/http"

	"portfolio-os/internal/renderer"
	"portfolio-os/internal/services"
)

type HomeHandler struct {
	renderer  *renderer.Renderer
	portfolio *services.PortfolioService
}

func NewHomeHandler(
	renderer *renderer.Renderer,
	portfolio *services.PortfolioService,
) *HomeHandler {
	return &HomeHandler{
		renderer:  renderer,
		portfolio: portfolio,
	}
}

func (h *HomeHandler) HandleHome(w http.ResponseWriter, r *http.Request) {
	h.render(w, "home")
}

func (h *HomeHandler) HandleClient(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/", http.StatusPermanentRedirect)
}

func (h *HomeHandler) HandleDeveloper(w http.ResponseWriter, r *http.Request) {
	h.render(w, "developer")
}

func (h *HomeHandler) render(w http.ResponseWriter, page string) {
	currentPortfolio := h.portfolio.GetPortfolio()

	data := map[string]any{
		"Title":     currentPortfolio.Profile.Name + " — Portfolio OS",
		"Portfolio": currentPortfolio,
	}

	if err := h.renderer.Render(w, page, data); err != nil {
		log.Printf("render error for template %q: %v", page, err)
		http.Error(w, "Failed to render page", http.StatusInternalServerError)
	}
}