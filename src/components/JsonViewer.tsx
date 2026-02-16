import { useMemo, useCallback } from 'react';

interface JsonViewerProps {
    json: string;
    className?: string;
    searchText?: string;
}

const MAX_LINES = 5000; // Safety cap

export default function JsonViewer({ json, className = '', searchText = '' }: JsonViewerProps) {
    // Format the content into lines
    const { lines, isJson } = useMemo(() => {
        try {
            const parsed = JSON.parse(json);
            const formatted = JSON.stringify(parsed, null, 2);
            return { lines: formatted.split('\n'), isJson: true };
        } catch {
            // Not JSON — check if it's minified HTML/XML (single long line with tags)
            let text = json;
            const rawLines = text.split('\n');

            // If content has very few lines but is very long, try to format it
            if (rawLines.length <= 3 && text.length > 200 && text.includes('<')) {
                // Pretty-format HTML: add newlines around tags
                text = text
                    .replace(/>\s*</g, '>\n<')
                    .replace(/^\n+/, '')
                    .replace(/\n{2,}/g, '\n');
            }

            const textLines = text.split('\n');
            return { lines: textLines, isJson: false };
        }
    }, [json]);

    const totalLines = Math.min(lines.length, MAX_LINES);
    const isTruncated = lines.length > MAX_LINES;
    const lineNumWidth = String(totalLines).length;

    // Highlight search matches in text
    const highlightText = useCallback((text: string, colorClass: string) => {
        if (!searchText) return <span className={colorClass}>{text}</span>;
        try {
            const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
            return parts.map((part, i) =>
                part.toLowerCase() === searchText.toLowerCase()
                    ? <span key={i} className="bg-yellow-500/50 text-white">{part}</span>
                    : <span key={i} className={colorClass}>{part}</span>
            );
        } catch {
            return <span className={colorClass}>{text}</span>;
        }
    }, [searchText]);

    // Render a single JSON line with syntax highlighting
    const renderJsonLine = useCallback((line: string) => {
        const kvMatch = line.match(/^(\s*)"([^"]+)"\s*:\s*(.+?)(,?)$/);
        if (kvMatch) {
            const [, indent, key, value, comma] = kvMatch;
            return (
                <>
                    <span className="opacity-50">{indent}</span>
                    <span className="text-red-400">{highlightText(`"${key}"`, 'text-red-400')}</span>
                    <span className="opacity-50">: </span>
                    {highlightText(value, 'text-blue-400')}
                    <span className="opacity-50">{comma}</span>
                </>
            );
        }

        if (line.trim().startsWith('"')) {
            const strMatch = line.match(/^(\s*)(.+?)(,?)$/);
            if (strMatch) {
                const [, indent, content, comma] = strMatch;
                return (
                    <>
                        <span className="opacity-50">{indent}</span>
                        {highlightText(content, 'text-blue-400')}
                        <span className="opacity-50">{comma}</span>
                    </>
                );
            }
        }

        return <span className="opacity-50">{line}</span>;
    }, [highlightText]);

    return (
        <div className={`${className} overflow-auto`}>
            {lines.slice(0, totalLines).map((line, i) => (
                <div key={i} className="flex font-mono text-sm leading-5 min-h-[20px]">
                    {/* Line number */}
                    <span
                        className="text-text-tertiary select-none text-right pr-4 flex-shrink-0 opacity-40"
                        style={{ width: `${(lineNumWidth + 2) * 0.6}em`, minWidth: '2.5em' }}
                    >
                        {i + 1}
                    </span>
                    {/* Content */}
                    <span className="whitespace-pre-wrap break-all flex-1 min-w-0">
                        {isJson
                            ? renderJsonLine(line)
                            : highlightText(line, 'text-text-secondary')
                        }
                    </span>
                </div>
            ))}
            {isTruncated && (
                <div className="text-center text-text-tertiary text-xs py-2 border-t border-gray-700 mt-2">
                    ⚠ Response truncated at {MAX_LINES.toLocaleString()} lines ({lines.length.toLocaleString()} total)
                </div>
            )}
        </div>
    );
}
