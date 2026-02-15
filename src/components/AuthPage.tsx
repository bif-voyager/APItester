import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthPageProps {
    onLogin: (username: string, mode: 'user' | 'guest', password?: string, rememberMe?: boolean) => Promise<void>;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);

    // Validation Errors
    const [errors, setErrors] = useState({
        username: "",
        password: "",
        confirmPassword: "",
        general: ""
    });

    const validateUsername = (val: string) => {
        if (!val) return "Username is required";
        if (!/^[a-zA-Z0-9]+$/.test(val)) return "Username must contain only Latin letters and digits (no special characters)";
        return "";
    };

    const validatePassword = (val: string) => {
        if (!val) return "Password is required";
        if (val.length < 7) return "Password must be at least 7 characters";
        if (!/[A-Z]/.test(val)) return "Password must contain at least one uppercase letter";
        if (!/[a-z]/.test(val)) return "Password must contain at least one lowercase letter";
        if (!/[0-9]/.test(val)) return "Password must contain at least one digit";
        if (!/[\W_]/.test(val)) return "Password must contain at least one special character";
        return "";
    };

    const handleUsernameChange = (val: string) => {
        setUsername(val);
        setErrors(prev => ({ ...prev, username: validateUsername(val), general: "" }));
    };

    const handlePasswordChange = (val: string) => {
        setPassword(val);
        setErrors(prev => ({
            ...prev,
            password: validatePassword(val),
            confirmPassword: !isLogin && confirmPassword && val !== confirmPassword ? "Passwords do not match" : prev.confirmPassword,
            general: ""
        }));
    };

    const handleConfirmPasswordChange = (val: string) => {
        setConfirmPassword(val);
        setErrors(prev => ({
            ...prev,
            confirmPassword: val !== password ? "Passwords do not match" : "",
            general: ""
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final Validation check before submit
        const usernameError = validateUsername(username);
        const passwordError = validatePassword(password);
        let confirmError = "";

        if (!isLogin) {
            confirmError = password !== confirmPassword ? "Passwords do not match" : "";
        }

        if (usernameError || passwordError || confirmError) {
            setErrors({
                username: usernameError,
                password: passwordError,
                confirmPassword: confirmError,
                general: "Please fix errors before proceeding"
            });
            return;
        }

        // Logic to simulate registration/login
        // In a real app, we would check backend. Here we just strictly validate format.
        // If login, strictly speaking likely implies checking against stored, but existing logic just mocked it.
        // We will mock strictly valid inputs as success.

        try {
            setErrors(prev => ({ ...prev, general: "" }));
            setErrors(prev => ({ ...prev, general: "" }));
            await onLogin(username, 'user', password, rememberMe);
        } catch (error: any) {
            setErrors(prev => ({ ...prev, general: error.message || "An error occurred" }));
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-bg-primary text-text-primary flex-col gap-8">
            <motion.h1
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.08,
                            delayChildren: 0.2
                        }
                    }
                }}
                className="text-5xl font-bold text-accent-primary tracking-tight flex"
                style={{ fontFamily: 'Outfit, sans-serif' }}
            >
                {Array.from("API Client").map((char, index) => (
                    <motion.span
                        key={index}
                        variants={{
                            hidden: { opacity: 0, x: -20 },
                            visible: {
                                opacity: 1,
                                x: 0,
                                transition: {
                                    type: "spring",
                                    damping: 12,
                                    stiffness: 100
                                }
                            }
                        }}
                    >
                        {char === " " ? "\u00A0" : char}
                    </motion.span>
                ))}
            </motion.h1>

            <div className="w-96 overflow-hidden rounded-2xl bg-bg-secondary p-8 shadow-2xl border border-gray-700">

                {/* Header Toggle */}
                <div className="mb-6 flex justify-between relative bg-bg-primary p-1 rounded-lg">
                    {/* Active Tab Background */}
                    <motion.div
                        className="absolute top-1 bottom-1 bg-bg-tertiary rounded-md shadow-sm"
                        initial={false}
                        animate={{
                            left: isLogin ? 4 : "50%",
                            width: "48%"
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />

                    <button
                        onClick={() => {
                            setIsLogin(true);
                            setErrors({ username: "", password: "", confirmPassword: "", general: "" });
                        }}
                        className={`z-10 w-1/2 py-2 text-sm font-medium transition-colors text-center ${isLogin ? 'text-text-primary' : 'text-text-secondary'}`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => {
                            setIsLogin(false);
                            setErrors({ username: "", password: "", confirmPassword: "", general: "" });
                        }}
                        className={`z-10 w-1/2 py-2 text-sm font-medium transition-colors text-center ${!isLogin ? 'text-text-primary' : 'text-text-secondary'}`}
                    >
                        Register
                    </button>
                </div>

                {/* Form Animation */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={isLogin ? "login" : "register"}
                            initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div>
                                    <input
                                        placeholder="Username"
                                        value={username}
                                        onChange={e => handleUsernameChange(e.target.value)}
                                        className={`w-full p-3 bg-bg-primary rounded borderoutline-none text-text-primary placeholder-text-tertiary transition-colors ${errors.username ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-accent-secondary'}`}
                                    />
                                    {errors.username && (
                                        <p className="text-red-400 text-xs mt-1 ml-1">{errors.username}</p>
                                    )}
                                </div>

                                <div>
                                    <input
                                        placeholder="Password"
                                        type="password"
                                        value={password}
                                        onChange={e => handlePasswordChange(e.target.value)}
                                        className={`w-full p-3 bg-bg-primary rounded border outline-none text-text-primary placeholder-text-tertiary transition-colors ${errors.password ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-accent-secondary'}`}
                                    />
                                    {errors.password && (
                                        <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>
                                    )}
                                </div>

                                {!isLogin && (
                                    <div>
                                        <input
                                            placeholder="Confirm Password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => handleConfirmPasswordChange(e.target.value)}
                                            className={`w-full p-3 bg-bg-primary rounded border outline-none text-text-primary placeholder-text-tertiary transition-colors ${errors.confirmPassword ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-accent-secondary'}`}
                                        />
                                        {errors.confirmPassword && (
                                            <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>
                                        )}
                                    </div>
                                )}

                                {/* General Error Message */}
                                {errors.general && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded"
                                    >
                                        {errors.general}
                                    </motion.div>
                                )}

                                {isLogin && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="rememberMe"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-600 bg-bg-primary text-accent-secondary focus:ring-accent-secondary"
                                        />
                                        <label htmlFor="rememberMe" className="text-sm text-text-secondary cursor-pointer select-none">
                                            Remember me
                                        </label>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className={`py-2 rounded font-medium transition-colors ${isLogin
                                        ? 'bg-accent-secondary hover:bg-accent-secondary/80 text-white'
                                        : 'bg-green-600 hover:bg-green-500 text-white'
                                        }`}
                                >
                                    {isLogin ? "Sign In" : "Create Account"}
                                </button>
                            </form>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Guest Option */}
                <div className="mt-6 pt-4 border-t border-gray-700 text-center">
                    <button
                        type="button"
                        onClick={() => onLogin('Guest', 'guest')}
                        className="text-sm text-text-tertiary hover:text-text-primary transition-colors hover:underline"
                    >
                        Continue as Guest
                    </button>
                </div>

            </div >
        </div >
    );
}
