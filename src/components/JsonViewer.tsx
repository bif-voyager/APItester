interface JsonViewerProps {
    json: string;
    className?: string;
}

export default function JsonViewer({ json, className = '' }: JsonViewerProps) {
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
                    return (
                        <div key={index} className="font-mono text-sm">
                            <span className="opacity-50">{indent}</span>
                            <span className="text-red-400">"{key}"</span>
                            <span className="opacity-50">: </span>
                            <span className="text-blue-400">{value}</span>
                            <span className="opacity-50">{comma}</span>
                        </div>
                    );
                }

                // Just structural characters (braces, brackets)
                return (
                    <div key={index} className="font-mono text-sm opacity-50">
                        {line}
                    </div>
                );
            });
        } catch (e) {
            // If not valid JSON, show as is
            return [<div key="0" className="font-mono text-sm text-text-secondary">{jsonString}</div>];
        }
    };

    return (
        <div className={`${className}`}>
            {highlightJson(json)}
        </div>
    );
}
