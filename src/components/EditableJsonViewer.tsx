import { useRef } from 'react';

interface EditableJsonViewerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function EditableJsonViewer({
    value,
    onChange,
    placeholder = '{\n  "key": "value"\n}',
    className = ''
}: EditableJsonViewerProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);

    // Sync scroll between textarea and highlight layer
    const handleScroll = () => {
        if (textareaRef.current && highlightRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop;
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    // Highlight JSON syntax
    const highlightJson = (text: string): string => {
        if (!text) return '';

        let highlighted = text
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Wrap everything in light gray by default
        highlighted = `<span style="color: #d1d5db;">${highlighted}</span>`;

        // Highlight keys in red
        highlighted = highlighted.replace(
            /"([^"]+)"\s*:/g,
            '<span style="color: #f87171;">"$1"</span>:'
        );

        // Highlight string values in blue
        highlighted = highlighted.replace(
            /:\s*"([^"]*)"/g,
            ': <span style="color: #60a5fa;">"$1"</span>'
        );

        // Highlight numbers in blue
        highlighted = highlighted.replace(
            /:\s*(-?\d+\.?\d*)/g,
            ': <span style="color: #60a5fa;">$1</span>'
        );

        // Highlight booleans in blue
        highlighted = highlighted.replace(
            /:\s*(true|false)/g,
            ': <span style="color: #60a5fa;">$1</span>'
        );

        // Highlight null in blue
        highlighted = highlighted.replace(
            /:\s*(null)/g,
            ': <span style="color: #60a5fa;">$1</span>'
        );

        return highlighted;
    };

    return (
        <div className={`relative w-full h-full ${className}`}>
            {/* Highlighted background layer */}
            <div
                ref={highlightRef}
                className="absolute inset-0 overflow-hidden pointer-events-none text-sm font-mono p-4 whitespace-pre-wrap break-words"
                style={{
                    lineHeight: '1.5',
                }}
                dangerouslySetInnerHTML={{
                    __html: highlightJson(value)
                }}
            />

            {/* Editable textarea on top */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                placeholder={placeholder}
                className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none text-sm font-mono p-4 whitespace-pre-wrap break-words text-transparent caret-white"
                style={{
                    lineHeight: '1.5',
                }}
                spellCheck={false}
            />
        </div>
    );
}
