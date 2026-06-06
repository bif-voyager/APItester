package executor

// ExecutorRequest describes an HTTP request to execute on behalf of the frontend.
type ExecutorRequest struct {
	Method          string       `json:"method"`
	URL             string       `json:"url"`
	Headers         []HeaderItem `json:"headers"`
	Params          []ParamItem  `json:"params"`
	Body            *RequestBody `json:"body"`
	TimeoutMs       int          `json:"timeoutMs"`
	FollowRedirects *bool        `json:"followRedirects"`
	MaxRedirects    int          `json:"maxRedirects"`
}

// HeaderItem represents a single HTTP header with enabled flag.
type HeaderItem struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled *bool  `json:"enabled"`
}

// IsEnabled returns true if the header is enabled (default true if nil).
func (h HeaderItem) IsEnabled() bool {
	if h.Enabled == nil {
		return true
	}
	return *h.Enabled
}

// ParamItem represents a single query parameter with enabled flag.
type ParamItem struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled *bool  `json:"enabled"`
}

// IsEnabled returns true if the param is enabled (default true if nil).
func (p ParamItem) IsEnabled() bool {
	if p.Enabled == nil {
		return true
	}
	return *p.Enabled
}

// RequestBody describes the body payload of the request.
type RequestBody struct {
	Mode    string `json:"mode"`
	Content string `json:"content"`
}

// ExecutorResponse is the normalized response returned to the frontend.
type ExecutorResponse struct {
	OK            bool              `json:"ok"`
	Status        int               `json:"status,omitempty"`
	StatusText    string            `json:"statusText,omitempty"`
	Headers       map[string]string `json:"headers,omitempty"`
	Body          string            `json:"body,omitempty"`
	ContentType   string            `json:"contentType,omitempty"`
	SizeBytes     int64             `json:"sizeBytes,omitempty"`
	DurationMs    int64             `json:"durationMs"`
	FinalURL      string            `json:"finalUrl,omitempty"`
	RedirectCount int               `json:"redirectCount"`
	Truncated     bool              `json:"truncated"`
	Error         *APIError         `json:"error,omitempty"`
}

// APIError describes a structured error returned by the executor.
type APIError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// BulkExecutorRequest wraps a single request template with a concurrency count.
// All N copies of the request are executed simultaneously.
type BulkExecutorRequest struct {
	Request     ExecutorRequest `json:"request"`
	Concurrency int            `json:"concurrency"`
}

// BulkResultItem is the result of a single request within a bulk execution.
type BulkResultItem struct {
	Index      int    `json:"index"`
	Status     int    `json:"status,omitempty"`
	StatusText string `json:"statusText,omitempty"`
	DurationMs int64  `json:"durationMs"`
	SizeBytes  int64  `json:"sizeBytes,omitempty"`
	OK         bool   `json:"ok"`
	Error      string `json:"error,omitempty"`
}

// BulkExecutorResponse is returned by the bulk execution endpoint.
type BulkExecutorResponse struct {
	OK            bool             `json:"ok"`
	TotalRequests int              `json:"totalRequests"`
	Results       []BulkResultItem `json:"results"`
	TotalTimeMs   int64            `json:"totalTimeMs"`
	Error         *APIError        `json:"error,omitempty"`
}
