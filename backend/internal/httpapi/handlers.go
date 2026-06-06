package httpapi

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"apitester-executor/internal/config"
	"apitester-executor/internal/executor"
)

// HealthResponse is returned by the health check endpoint.
type HealthResponse struct {
	OK      bool   `json:"ok"`
	Service string `json:"service"`
	Version string `json:"version"`
}

// HandleHealth handles GET /health.
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{
		OK:      true,
		Service: "apitester-executor",
		Version: "1.0.0",
	})
}

// HandleSendRequest returns a handler for POST /v1/requests/send.
func HandleSendRequest(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Limit incoming body to 1 MB
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "Failed to read request body")
			return
		}

		var req executor.ExecutorRequest
		if err := json.Unmarshal(body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", fmt.Sprintf("Invalid JSON: %v", err))
			return
		}

		// Log the request (without sensitive data)
		log.Printf("[executor] %s %s", req.Method, req.URL)

		// Execute the request
		result := executor.Execute(&req, cfg.MaxResponseBodyBytes, cfg.DefaultTimeoutMs, cfg.MaxRedirects)

		// Log the result
		if result.OK {
			log.Printf("[executor] → %d %s (%d ms, %d bytes)", result.Status, result.StatusText, result.DurationMs, result.SizeBytes)
		} else if result.Error != nil {
			log.Printf("[executor] → ERROR %s: %s (%d ms)", result.Error.Type, result.Error.Message, result.DurationMs)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

// HandleBulkRequest returns a handler for POST /v1/requests/bulk.
// It fires N concurrent copies of the same request using a worker pool
// with a shared http.Transport for connection reuse.
func HandleBulkRequest(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Limit incoming body to 1 MB
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeBulkError(w, http.StatusBadRequest, "invalid_request", "Failed to read request body")
			return
		}

		var bulkReq executor.BulkExecutorRequest
		if err := json.Unmarshal(body, &bulkReq); err != nil {
			writeBulkError(w, http.StatusBadRequest, "invalid_request", fmt.Sprintf("Invalid JSON: %v", err))
			return
		}

		// Validate concurrency
		if bulkReq.Concurrency < 1 {
			bulkReq.Concurrency = 1
		}
		if bulkReq.Concurrency > cfg.MaxBulkConcurrency {
			writeBulkError(w, http.StatusBadRequest, "invalid_request",
				fmt.Sprintf("Concurrency %d exceeds maximum %d", bulkReq.Concurrency, cfg.MaxBulkConcurrency))
			return
		}

		log.Printf("[bulk] %s %s × %d concurrent", bulkReq.Request.Method, bulkReq.Request.URL, bulkReq.Concurrency)

		// Worker pool size: limit actual simultaneous connections
		// to prevent OS socket exhaustion
		maxWorkers := 50
		if bulkReq.Concurrency < maxWorkers {
			maxWorkers = bulkReq.Concurrency
		}

		// Create a shared HTTP client with high-capacity transport
		bulkTransport := executor.NewBulkTransport(maxWorkers)
		defer bulkTransport.CloseIdleConnections()

		bulkClient := &http.Client{
			Transport: bulkTransport,
			// No global timeout — each request uses its own context timeout
		}

		// Use 3x the default timeout for bulk (requests queue up waiting for workers)
		bulkTimeoutMs := cfg.DefaultTimeoutMs * 3
		if bulkTimeoutMs < 30000 {
			bulkTimeoutMs = 30000 // minimum 30 seconds for bulk
		}

		// Execute with semaphore-based worker pool
		results := make([]executor.BulkResultItem, bulkReq.Concurrency)
		var wg sync.WaitGroup
		semaphore := make(chan struct{}, maxWorkers)

		totalStart := time.Now()

		for i := 0; i < bulkReq.Concurrency; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()

				// Acquire semaphore slot (blocks until a slot is free)
				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				// Each goroutine gets its own copy of the request
				reqCopy := bulkReq.Request
				result := executor.ExecuteWithClient(&reqCopy, bulkClient, cfg.MaxResponseBodyBytes, bulkTimeoutMs, cfg.MaxRedirects)

				item := executor.BulkResultItem{
					Index:      index,
					DurationMs: result.DurationMs,
					OK:         result.OK,
				}

				if result.OK {
					item.Status = result.Status
					item.StatusText = result.StatusText
					item.SizeBytes = result.SizeBytes
				} else if result.Error != nil {
					item.Error = result.Error.Message
				}

				// Direct index assignment is safe (each goroutine writes to its own slot)
				results[index] = item
			}(i)
		}

		wg.Wait()
		totalTime := time.Since(totalStart).Milliseconds()

		// Count successes
		successCount := 0
		for _, r := range results {
			if r.OK {
				successCount++
			}
		}

		log.Printf("[bulk] completed %d requests in %d ms (%d ok, %d failed, %d workers)",
			bulkReq.Concurrency, totalTime, successCount, bulkReq.Concurrency-successCount, maxWorkers)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(executor.BulkExecutorResponse{
			OK:            true,
			TotalRequests: bulkReq.Concurrency,
			Results:       results,
			TotalTimeMs:   totalTime,
		})
	}
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, statusCode int, errType, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(executor.ExecutorResponse{
		OK: false,
		Error: &executor.APIError{
			Type:    errType,
			Message: message,
		},
	})
}

// writeBulkError writes a JSON error response for bulk endpoints.
func writeBulkError(w http.ResponseWriter, statusCode int, errType, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(executor.BulkExecutorResponse{
		OK: false,
		Error: &executor.APIError{
			Type:    errType,
			Message: message,
		},
	})
}

