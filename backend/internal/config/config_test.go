package config

import "testing"

func TestLoadUsesOneThousandAsDefaultBulkConcurrency(t *testing.T) {
	t.Setenv("MAX_BULK_CONCURRENCY", "")
	t.Setenv("MAX_BULK_CONNECTIONS", "")

	cfg := Load()

	if cfg.MaxBulkConcurrency != 1000 {
		t.Fatalf("expected default bulk concurrency 1000, got %d", cfg.MaxBulkConcurrency)
	}
	if cfg.MaxBulkConnections != 64 {
		t.Fatalf("expected default bulk connections 64, got %d", cfg.MaxBulkConnections)
	}
}
