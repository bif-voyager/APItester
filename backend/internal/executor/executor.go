package executor

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// allowedMethods defines the HTTP methods the executor supports.
var allowedMethods = map[string]bool{
	"GET":     true,
	"POST":    true,
	"PUT":     true,
	"PATCH":   true,
	"DELETE":  true,
	"HEAD":    true,
	"OPTIONS": true,
}

// methodsWithBody defines methods that may carry a request body.
var methodsWithBody = map[string]bool{
	"POST":  true,
	"PUT":   true,
	"PATCH": true,
}

// NewBulkTransport creates an http.Transport optimized for high-concurrency bulk requests.
// It allows many simultaneous connections to the same host.
func NewBulkTransport(maxConns int) *http.Transport {
	return &http.Transport{
		MaxIdleConns:        maxConns,
		MaxIdleConnsPerHost: maxConns,
		MaxConnsPerHost:     maxConns,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: false},
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		DisableKeepAlives:   false,
		ForceAttemptHTTP2:   true,
	}
}

// Execute performs an HTTP request described by req and returns a normalized response.
// maxResponseBytes limits the amount of response body data read.
// defaultTimeoutMs is used when the request does not specify its own timeout.
// maxRedirects limits the number of redirects followed.
func Execute(req *ExecutorRequest, maxResponseBytes int64, defaultTimeoutMs int, maxRedirects int) *ExecutorResponse {
	return ExecuteWithClient(req, nil, maxResponseBytes, defaultTimeoutMs, maxRedirects)
}

// ExecuteWithClient performs an HTTP request using the provided client.
// If client is nil, a new client is created (single-request mode).
// For bulk mode, pass a shared client with BulkTransport for connection reuse.
func ExecuteWithClient(req *ExecutorRequest, client *http.Client, maxResponseBytes int64, defaultTimeoutMs int, maxRedirects int) *ExecutorResponse {
	start := time.Now()

	// 1. Validate method
	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		method = "GET"
	}
	if !allowedMethods[method] {
		return errorResponse("unsupported_method", fmt.Sprintf("Method %q is not supported", method), time.Since(start))
	}

	// 2. Parse and build target URL
	rawURL := strings.TrimSpace(req.URL)
	if rawURL == "" {
		return errorResponse("invalid_url", "URL is required", time.Since(start))
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return errorResponse("invalid_url", fmt.Sprintf("Invalid URL: %v", err), time.Since(start))
	}

	// Ensure scheme
	if parsedURL.Scheme == "" {
		parsedURL.Scheme = "https"
		parsedURL, err = url.Parse(parsedURL.String())
		if err != nil {
			return errorResponse("invalid_url", fmt.Sprintf("Invalid URL: %v", err), time.Since(start))
		}
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return errorResponse("invalid_url", fmt.Sprintf("Only http and https schemes are allowed, got %q", parsedURL.Scheme), time.Since(start))
	}

	if parsedURL.Host == "" {
		return errorResponse("invalid_url", "URL must have a host", time.Since(start))
	}

	// 3. Add query params
	q := parsedURL.Query()
	for _, p := range req.Params {
		if p.IsEnabled() && strings.TrimSpace(p.Key) != "" {
			q.Add(p.Key, p.Value)
		}
	}
	parsedURL.RawQuery = q.Encode()

	// 4. Build body
	var bodyReader io.Reader
	if methodsWithBody[method] && req.Body != nil && req.Body.Content != "" {
		bodyReader = strings.NewReader(req.Body.Content)
	}

	// 5. Create context with timeout
	timeoutMs := req.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = defaultTimeoutMs
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	// 6. Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, method, parsedURL.String(), bodyReader)
	if err != nil {
		return errorResponse("internal_error", fmt.Sprintf("Failed to create request: %v", err), time.Since(start))
	}

	// 7. Add headers
	for _, h := range req.Headers {
		if h.IsEnabled() && strings.TrimSpace(h.Key) != "" {
			httpReq.Header.Set(h.Key, h.Value)
		}
	}

	// 8. Configure redirect policy & create client if not provided
	followRedirects := true
	if req.FollowRedirects != nil {
		followRedirects = *req.FollowRedirects
	}

	effectiveMaxRedirects := maxRedirects
	if req.MaxRedirects > 0 {
		effectiveMaxRedirects = req.MaxRedirects
	}

	redirectCount := 0
	if client == nil {
		// Single-request mode: create a fresh client
		client = &http.Client{
			CheckRedirect: func(r *http.Request, via []*http.Request) error {
				if !followRedirects {
					return http.ErrUseLastResponse
				}
				redirectCount = len(via)
				if redirectCount >= effectiveMaxRedirects {
					return http.ErrUseLastResponse
				}
				return nil
			},
			Timeout: time.Duration(timeoutMs+1000) * time.Millisecond,
		}
	}

	// 9. Execute request
	resp, err := client.Do(httpReq)
	duration := time.Since(start)

	if err != nil {
		return classifyError(err, duration)
	}
	defer resp.Body.Close()

	// 10. Read response body with limit
	limitedReader := io.LimitReader(resp.Body, maxResponseBytes+1)
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		return errorResponse("internal_error", fmt.Sprintf("Failed to read response body: %v", err), duration)
	}

	truncated := int64(len(bodyBytes)) > maxResponseBytes
	if truncated {
		bodyBytes = bodyBytes[:maxResponseBytes]
	}

	// 11. Collect response headers
	respHeaders := make(map[string]string)
	for key, values := range resp.Header {
		respHeaders[strings.ToLower(key)] = strings.Join(values, ", ")
	}

	contentType := resp.Header.Get("Content-Type")

	// 12. Determine final URL
	finalURL := resp.Request.URL.String()

	return &ExecutorResponse{
		OK:            true,
		Status:        resp.StatusCode,
		StatusText:    http.StatusText(resp.StatusCode),
		Headers:       respHeaders,
		Body:          string(bodyBytes),
		ContentType:   contentType,
		SizeBytes:     int64(len(bodyBytes)),
		DurationMs:    duration.Milliseconds(),
		FinalURL:      finalURL,
		RedirectCount: redirectCount,
		Truncated:     truncated,
	}
}

// classifyError converts a Go error into a typed executor error response.
func classifyError(err error, duration time.Duration) *ExecutorResponse {
	msg := err.Error()

	errType := "connection_error"
	if strings.Contains(msg, "context deadline exceeded") || strings.Contains(msg, "Timeout") {
		errType = "timeout"
	} else if strings.Contains(msg, "no such host") || strings.Contains(msg, "dial tcp") {
		errType = "dns_error"
	} else if strings.Contains(msg, "tls") || strings.Contains(msg, "certificate") || strings.Contains(msg, "x509") {
		errType = "tls_error"
	} else if strings.Contains(msg, "connection refused") {
		errType = "connection_error"
	}

	return errorResponse(errType, msg, duration)
}

// errorResponse creates a standard error ExecutorResponse.
func errorResponse(errType, message string, duration time.Duration) *ExecutorResponse {
	return &ExecutorResponse{
		OK:         false,
		DurationMs: duration.Milliseconds(),
		Error: &APIError{
			Type:    errType,
			Message: message,
		},
	}
}

