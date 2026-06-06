package executor

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func boolPointer(value bool) *bool {
	return &value
}

func TestItemsAreEnabledByDefault(t *testing.T) {
	if !(HeaderItem{}).IsEnabled() {
		t.Fatal("header with nil enabled flag should be enabled")
	}
	if !(ParamItem{}).IsEnabled() {
		t.Fatal("parameter with nil enabled flag should be enabled")
	}
	if (HeaderItem{Enabled: boolPointer(false)}).IsEnabled() {
		t.Fatal("disabled header should not be enabled")
	}
	if (ParamItem{Enabled: boolPointer(false)}).IsEnabled() {
		t.Fatal("disabled parameter should not be enabled")
	}
}

func TestExecuteRejectsInvalidRequests(t *testing.T) {
	tests := []struct {
		name    string
		request ExecutorRequest
		errType string
	}{
		{
			name:    "unsupported method",
			request: ExecutorRequest{Method: "TRACE", URL: "https://example.com"},
			errType: "unsupported_method",
		},
		{
			name:    "empty URL",
			request: ExecutorRequest{Method: "GET"},
			errType: "invalid_url",
		},
		{
			name:    "unsupported scheme",
			request: ExecutorRequest{Method: "GET", URL: "ftp://example.com/file"},
			errType: "invalid_url",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := Execute(&test.request, 1024, 1000, 5)

			if response.OK {
				t.Fatal("invalid request unexpectedly succeeded")
			}
			if response.Error == nil || response.Error.Type != test.errType {
				t.Fatalf("expected error type %q, got %#v", test.errType, response.Error)
			}
		})
	}
}

func TestExecuteSendsMethodParamsHeadersAndBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if got := r.URL.Query().Get("enabled"); got != "yes" {
			t.Errorf("expected enabled query parameter, got %q", got)
		}
		if got := r.URL.Query().Get("disabled"); got != "" {
			t.Errorf("disabled query parameter was sent: %q", got)
		}
		if got := r.Header.Get("X-Test"); got != "present" {
			t.Errorf("expected X-Test header, got %q", got)
		}
		if got := r.Header.Get("X-Disabled"); got != "" {
			t.Errorf("disabled header was sent: %q", got)
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}
		if string(body) != `{"name":"Simon"}` {
			t.Errorf("unexpected request body: %s", body)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":1}`))
	}))
	defer server.Close()

	request := ExecutorRequest{
		Method: "post",
		URL:    server.URL + "/users?existing=1",
		Headers: []HeaderItem{
			{Key: "X-Test", Value: "present"},
			{Key: "X-Disabled", Value: "hidden", Enabled: boolPointer(false)},
		},
		Params: []ParamItem{
			{Key: "enabled", Value: "yes"},
			{Key: "disabled", Value: "no", Enabled: boolPointer(false)},
		},
		Body: &RequestBody{Mode: "raw", Content: `{"name":"Simon"}`},
	}

	response := Execute(&request, 1024, 1000, 5)

	if !response.OK {
		t.Fatalf("request failed: %#v", response.Error)
	}
	if response.Status != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", response.Status)
	}
	if response.Body != `{"id":1}` {
		t.Fatalf("unexpected response body: %q", response.Body)
	}
	if response.ContentType != "application/json" {
		t.Fatalf("unexpected content type: %q", response.ContentType)
	}
}

func TestExecuteUsesGETByDefault(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	response := Execute(&ExecutorRequest{URL: server.URL}, 1024, 1000, 5)

	if !response.OK || response.Status != http.StatusNoContent {
		t.Fatalf("unexpected response: %#v", response)
	}
}

func TestExecuteTruncatesLargeResponses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", 20)))
	}))
	defer server.Close()

	response := Execute(&ExecutorRequest{URL: server.URL}, 5, 1000, 5)

	if !response.OK {
		t.Fatalf("request failed: %#v", response.Error)
	}
	if !response.Truncated {
		t.Fatal("expected response to be marked as truncated")
	}
	if response.Body != "xxxxx" || response.SizeBytes != 5 {
		t.Fatalf("unexpected truncated response: body=%q size=%d", response.Body, response.SizeBytes)
	}
}

func TestExecuteCanDisableRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/start" {
			http.Redirect(w, r, "/final", http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	followRedirects := false
	response := Execute(&ExecutorRequest{
		URL:             server.URL + "/start",
		FollowRedirects: &followRedirects,
	}, 1024, 1000, 5)

	if !response.OK || response.Status != http.StatusFound {
		t.Fatalf("expected redirect response, got %#v", response)
	}
	if response.FinalURL != server.URL+"/start" {
		t.Fatalf("unexpected final URL: %q", response.FinalURL)
	}
}

func TestExecuteReportsTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	response := Execute(&ExecutorRequest{
		URL:       server.URL,
		TimeoutMs: 10,
	}, 1024, 1000, 5)

	if response.OK {
		t.Fatal("timed out request unexpectedly succeeded")
	}
	if response.Error == nil || response.Error.Type != "timeout" {
		t.Fatalf("expected timeout error, got %#v", response.Error)
	}
}
