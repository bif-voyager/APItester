package main

import (
	"fmt"
	"log"
	"net/http"

	"apitester-executor/internal/config"
	"apitester-executor/internal/httpapi"
)

func main() {
	cfg := config.Load()

	handler := httpapi.NewServer(cfg)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("🚀 API Tester Executor starting on http://localhost%s", addr)
	log.Printf("   Allowed origins: %v", cfg.AllowedOrigins)
	log.Printf("   Default timeout: %d ms", cfg.DefaultTimeoutMs)
	log.Printf("   Max response body: %d bytes", cfg.MaxResponseBodyBytes)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
