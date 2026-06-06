package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration for the executor backend.
type Config struct {
	Port                 int
	AllowedOrigins       []string
	DefaultTimeoutMs     int
	MaxResponseBodyBytes int64
	MaxRedirects         int
	MaxBulkConcurrency   int
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Port:                 getEnvInt("PORT", 8080),
		AllowedOrigins:       getEnvSlice("ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://localhost:4173"}),
		DefaultTimeoutMs:     getEnvInt("DEFAULT_TIMEOUT_MS", 15000),
		MaxResponseBodyBytes: int64(getEnvInt("MAX_RESPONSE_BODY_BYTES", 5242880)), // 5 MB
		MaxRedirects:         getEnvInt("MAX_REDIRECTS", 5),
		MaxBulkConcurrency:   getEnvInt("MAX_BULK_CONCURRENCY", 500),
	}
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvSlice(key string, fallback []string) []string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	parts := strings.Split(val, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}
