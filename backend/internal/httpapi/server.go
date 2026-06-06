package httpapi

import (
	"net/http"

	"apitester-executor/internal/config"
)

// NewServer creates a configured HTTP handler with all routes and middleware.
func NewServer(cfg *config.Config) http.Handler {
	mux := http.NewServeMux()

	// Routes
	mux.HandleFunc("/health", HandleHealth)
	mux.HandleFunc("/v1/requests/send", HandleSendRequest(cfg))
	mux.HandleFunc("/v1/requests/bulk", HandleBulkRequest(cfg))

	// Wrap with CORS middleware
	handler := CORSMiddleware(cfg.AllowedOrigins, mux)

	return handler
}
