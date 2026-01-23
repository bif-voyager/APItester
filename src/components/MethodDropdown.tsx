import { useState, useRef, useEffect } from 'react';

interface MethodDropdownProps {
    value: string;
    onChange: (method: string) => void;
}

const methods = [
    { value: 'GET', color: 'text-green-500' },
    { value: 'POST', color: 'text-orange-400' },
    { value: 'PUT', color: 'text-blue-500' },
    { value: 'DELETE', color: 'text-red-500' },
    { value: 'PATCH', color: 'text-purple-500' },
];

export default function MethodDropdown({ value, onChange }: MethodDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentMethod = methods.find(m => m.value === value) || methods[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`px-3 py-2 bg-bg-tertiary border border-gray-600 rounded focus:outline-none focus:border-accent-secondary text-sm font-bold ${currentMethod.color} flex items-center gap-2 min-w-[100px]`}
            >
                {currentMethod.value}
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-bg-secondary border border-gray-600 rounded shadow-lg z-10 overflow-hidden">
                    {methods.map((method) => (
                        <button
                            key={method.value}
                            type="button"
                            onClick={() => {
                                onChange(method.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 ${method.color} font-bold text-sm hover:bg-bg-tertiary transition-colors ${value === method.value ? 'bg-bg-tertiary' : ''
                                }`}
                        >
                            {method.value}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
