interface JsonViewerProps {
    json: string;
    className?: string;
    searchText?: string;
}

export default function JsonViewer({ json, className = '', searchText = '' }: JsonViewerProps) {
    const highlightJson = (jsonString: string): JSX.Element[] => {
        try {
            // Parse and stringify to ensure valid JSON
            const parsed = JSON.parse(jsonString);
            const formatted = JSON.stringify(parsed, null, 2);

            const lines = formatted.split('\n');
            return lines.map((line, index) => {
                // Match key-value pairs: "key": value
                const keyValueRegex = /^(\s*)"([^"]+)"\s*:\s*(.+?)(,?)$/;
                const match = line.match(keyValueRegex);

                if (match) {
                    const [, indent, key, value, comma] = match;

                    // Helper to highlight text
                    const renderTextWithHighlight = (text: string, colorClass: string) => {
                        if (!searchText) return <span className={colorClass}>{text}</span>;

                        const parts = text.split(new RegExp(`(${searchText})`, 'gi'));
                        return parts.map((part, i) =>
                            part.toLowerCase() === searchText.toLowerCase() ?
                                <span key={i} className="bg-yellow-500/50 text-white">{part}</span> :
                                <span key={i} className={colorClass}>{part}</span>
                        );
                    };

                    const renderKey = () => {
                        const content = `"${key}"`;
                        if (!searchText) return <span className="text-red-400">{content}</span>;
                        // For keys, we want to highlight inside the quotes
                        const parts = key.split(new RegExp(`(${searchText})`, 'gi'));
                        return (
                            <span className="text-red-400">
                                "{parts.map((part, i) =>
                                    part.toLowerCase() === searchText.toLowerCase() ?
                                        <span key={i} className="bg-yellow-500/50 text-white">{part}</span> :
                                        <span key={i}>{part}</span>
                                )}"
                            </span>
                        );
                    };

                    return (
                        <div key={index} className="font-mono text-sm whitespace-pre">
                            <span className="opacity-50">{indent}</span>
                            {renderKey()}
                            <span className="opacity-50">: </span>
                            {renderTextWithHighlight(value, "text-blue-400")}
                            <span className="opacity-50">{comma}</span>
                        </div>
                    );
                }

                // Just structural characters (braces, brackets)
                // Also check for simple string items in arrays
                if (!match && line.trim().startsWith('"') && line.trim().endsWith('"') || line.trim().endsWith('",')) {
                    const stringMatch = line.match(/^(\s*)(.+?)(,?)$/);
                    if (stringMatch) {
                        const [, indent, content, comma] = stringMatch;
                        const parts = content.split(new RegExp(`(${searchText})`, 'gi'));
                        return (
                            <div key={index} className="font-mono text-sm whitespace-pre">
                                <span className="opacity-50">{indent}</span>
                                <span className="text-blue-400">
                                    {parts.map((part, i) =>
                                        part.toLowerCase() === searchText.toLowerCase() ?
                                            <span key={i} className="bg-yellow-500/50 text-white">{part}</span> :
                                            <span key={i}>{part}</span>
                                    )}
                                </span>
                                <span className="opacity-50">{comma}</span>
                            </div>
                        );
                    }
                }

                return (
                    <div key={index} className="font-mono text-sm opacity-50 whitespace-pre">
                        {line}
                    </div>
                );
            });
        } catch (e) {
            // If not valid JSON, show as is with highlight
            if (!searchText) return [<div key="0" className="font-mono text-sm text-text-secondary whitespace-pre">{jsonString}</div>];

            const parts = jsonString.split(new RegExp(`(${searchText})`, 'gi'));
            return [
                <div key="0" className="font-mono text-sm text-text-secondary whitespace-pre">
                    {parts.map((part, i) =>
                        part.toLowerCase() === searchText.toLowerCase() ?
                            <span key={i} className="bg-yellow-500/50 text-white">{part}</span> :
                            <span key={i}>{part}</span>
                    )}
                </div>
            ];
        }
    };

    return (
        <div className={`${className}`}>
            {highlightJson(json)}
        </div>
    );
}
