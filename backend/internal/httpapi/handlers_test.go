package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"apitester-executor/internal/config"
	"apitester-executor/internal/executor"
)

func testConfig() *config.Config {
	return &config.Config{
		AllowedOrigins:       []string{"http://localhost:5173"},
		DefaultTimeoutMs:     1000,
		MaxResponseBodyBytes: 1024,
		MaxRedirects:         5,
		MaxBulkConcurrency:   10,
	}
}

func TestHandleHealth(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	recorder := httptest.NewRecorder()

	HandleHealth(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var response HealthResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.OK || response.Service != "apitester-executor" {
		t.Fatalf("unexpected health response: %#v", response)
	}
}

func TestHandleHealthRejectsUnsupportedMethod(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/health", nil)
	recorder := httptest.NewRecorder()

	HandleHealth(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", recorder.Code)
	}
}

func TestHandleSendRequestRejectsInvalidJSON(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/v1/requests/send", strings.NewReader("{"))
	recorder := httptest.NewRecorder()

	HandleSendRequest(testConfig())(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}

	var response executor.ExecutorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error == nil || response.Error.Type != "invalid_request" {
		t.Fatalf("unexpected error response: %#v", response)
	}
}

func TestHandleSendRequestExecutesRequest(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("accepted"))
	}))
	defer target.Close()

	body := `{"method":"GET","url":"` + target.URL + `"}`
	request := httptest.NewRequest(http.MethodPost, "/v1/requests/send", strings.NewReader(body))
	recorder := httptest.NewRecorder()

	HandleSendRequest(testConfig())(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var response executor.ExecutorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.OK || response.Status != http.StatusAccepted || response.Body != "accepted" {
		t.Fatalf("unexpected executor response: %#v", response)
	}
}

func TestHandleBulkRequestRejectsExcessiveConcurrency(t *testing.T) {
	body := `{"request":{"method":"GET","url":"https://example.com"},"concurrency":11}`
	request := httptest.NewRequest(http.MethodPost, "/v1/requests/bulk", strings.NewReader(body))
	recorder := httptest.NewRecorder()

	HandleBulkRequest(testConfig())(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}

	var response executor.BulkExecutorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error == nil || response.Error.Type != "invalid_request" {
		t.Fatalf("unexpected bulk error response: %#v", response)
	}
}

func TestCORSMiddleware(t *testing.T) {
	handler := CORSMiddleware(
		[]string{"http://localhost:5173"},
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	t.Run("allows configured origin", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/health", nil)
		request.Header.Set("Origin", "http://localhost:5173")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, request)

		if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
			t.Fatalf("unexpected allowed origin: %q", got)
		}
	})

	t.Run("handles preflight", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodOptions, "/health", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNoContent {
			t.Fatalf("expected status 204, got %d", recorder.Code)
		}
	})
}
