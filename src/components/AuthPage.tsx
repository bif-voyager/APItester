import { useState } from "react";
import { motion } from "framer-motion";
import AlertModal from "./AlertModal";
import { supabase } from '../supabaseClient';

interface AuthPageProps {
    onLogin: (username: string, mode: 'user' | 'guest', password?: string) => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'verify';

export default function AuthPage({ onLogin }: AuthPageProps) {
    const [mode, setMode] = useState<AuthMode>('login');

    // Form States
    const [identifier, setIdentifier] = useState(""); // Email or Username for Login
    const [email, setEmail] = useState(""); // Explicit Email for Register/Forgot/Verify
    const [username, setUsername] = useState(""); // Explicit Username for Register
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otp, setOtp] = useState(""); // Verification Code
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);

    // Alert Modal State
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlertState({ isOpen: true, title, message, type });
    };

    const closeAlert = () => {
        setAlertState(prev => ({ ...prev, isOpen: false }));
        // If success verification, maybe auto switch to login?
        if (alertState.title === "Verified!" || alertState.title === "Registration Successful") {
            // logic handled in flow
        }
    };

    // Validation Errors
    type ErrorState = {
        identifier?: string;
        email?: string;
        username?: string;
        password?: string;
        confirmPassword?: string;
        otp?: string;
        general?: string;
    }
    const [errors, setErrors] = useState<ErrorState>({});

    // --- Helpers ---

    const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

    const validate = () => {
        const newErrors: ErrorState = {};
        let isValid = true;

        if (mode === 'login') {
            if (!identifier) { newErrors.identifier = "Email or Username is required"; isValid = false; }
            if (!password) { newErrors.password = "Password is required"; isValid = false; }
        }

        if (mode === 'register') {
            if (!email) { newErrors.email = "Email is required"; isValid = false; }
            else if (!isEmail(email)) { newErrors.email = "Invalid email format"; isValid = false; }

            if (!username) { newErrors.username = "Username is required"; isValid = false; }
            else if (username.length < 3) { newErrors.username = "Min 3 characters"; isValid = false; }
            else if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) { newErrors.username = "Alphanumeric, dots, hyphens, underscores only"; isValid = false; }

            if (!password) { newErrors.password = "Password is required"; isValid = false; }
            else if (password.length < 6) { newErrors.password = "Min 6 characters"; isValid = false; }

            if (password !== confirmPassword) { newErrors.confirmPassword = "Passwords do not match"; isValid = false; }
        }

        if (mode === 'forgot') {
            if (!email) { newErrors.email = "Email is required"; isValid = false; }
            else if (!isEmail(email)) { newErrors.email = "Invalid email format"; isValid = false; }
        }

        if (mode === 'verify') {
            if (!otp) { newErrors.otp = "Code is required"; isValid = false; }
            else if (otp.length < 6) { newErrors.otp = "Code too short"; isValid = false; }
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleLogin = async () => {
        try {
            let signInEmail = identifier;
            if (!isEmail(identifier)) {
                const { data, error } = await supabase.from('profiles').select('email').eq('username', identifier).single();
                if (error || !data) throw new Error("Invalid login credentials");
                signInEmail = data.email;
            }
            const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: password });
            if (error) throw error;
        } catch (error: any) {
            let msg = error.message || "An error occurred";
            if (msg.includes("Invalid login credentials")) msg = "Invalid username or password";
            setErrors(e => ({ ...e, general: msg }));
        }
    };

    const handleRegister = async () => {
        try {
            const cleanEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password: password,
                options: { data: { username: username } }
            });

            if (error) throw error;

            // If Confirm Email is disabled, we might get a session immediately.
            if (data.session) {
                showAlert("Success", "Account created and logged in!", 'success');
                // The onAuthStateChange listener in App.tsx will handle the redirect/state change
                return;
            }

            // Otherwise, we need verification
            setMode('verify');
            showAlert("Code Sent", `We've sent a verification code to ${cleanEmail}. Please enter it below.`, 'success');
        } catch (error: any) {
            // Handle rate limits gracefully
            if (error.status === 429) {
                setErrors(e => ({ ...e, general: "Too many attempts. Please wait a minute." }));
            } else {
                setErrors(e => ({ ...e, general: error.message }));
            }
        }
    };

    const handleForgot = async () => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password',
            });
            if (error) throw error;
            showAlert("Email Sent", "Password reset link sent to your email.", 'success');
            setMode('login');
        } catch (error: any) {
            setErrors(e => ({ ...e, general: error.message }));
        }
    };

    const handleVerify = async () => {
        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'signup'
            });
            if (error) throw error;

            showAlert("Verified!", "Email verified successfully. Logging you in...", 'success');
            // Auto login logic: Verify usually returns session.
            // onAuthStateChange in App.tsx should pick it up.
        } catch (error: any) {
            setErrors(e => ({ ...e, general: error.message }));
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        if (!validate()) return;

        setLoading(true);
        try {
            if (mode === 'login') await handleLogin();
            if (mode === 'register') await handleRegister();
            if (mode === 'forgot') await handleForgot();
            if (mode === 'verify') await handleVerify();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-bg-primary text-text-primary flex-col gap-8 relative">
            <AlertModal
                isOpen={alertState.isOpen}
                title={alertState.title}
                message={alertState.message}
                type={alertState.type}
                onClose={closeAlert}
            />

            <div className="flex items-center gap-4">
                <motion.svg
                    viewBox="0 0 20 20"
                    fill="#F97316"
                    className="w-[72px] h-[72px]"
                    initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        rotate: 360
                    }}
                    transition={{ duration: 1.6, ease: "easeOut" }}
                >
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </motion.svg>
                <motion.h1
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1.6, ease: "easeOut" }}
                    className="text-5xl font-bold text-accent-primary tracking-tight font-outfit"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                    API Client
                </motion.h1>
            </div>

            <motion.div
                layout
                className="w-96 overflow-hidden rounded-2xl bg-bg-secondary p-8 shadow-2xl border border-gray-700"
            >
                {/* Tabs (Hide in verify/forgot mode for cleaner UI) */}
                {(mode === 'login' || mode === 'register') && (
                    <div className="mb-6 flex justify-between relative bg-bg-primary p-1 rounded-lg">
                        <motion.div
                            className="absolute top-1 bottom-1 bg-bg-tertiary rounded-md shadow-sm"
                            initial={false}
                            animate={{ left: mode === 'login' ? 4 : "50%", width: "48%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                        <button onClick={() => { setMode('login'); setErrors({}); }} className={`z-10 w-1/2 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'text-text-primary' : 'text-text-secondary'}`}>Login</button>
                        <button onClick={() => { setMode('register'); setErrors({}); }} className={`z-10 w-1/2 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'text-text-primary' : 'text-text-secondary'}`}>Register</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                    {/* Login Mode */}
                    {mode === 'login' && (
                        <>
                            <FormInput placeholder="Email or Username" value={identifier} onChange={setIdentifier} error={errors.identifier} />
                            <FormInput placeholder="Password" type="password" value={password} onChange={setPassword} error={errors.password} />
                            <div className="flex justify-between items-center text-sm">
                                <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="rounded bg-bg-primary border-gray-600" />
                                    Remember me
                                </label>
                                <button type="button" onClick={() => setMode('forgot')} className="text-accent-primary hover:underline">Forgot Password?</button>
                            </div>
                        </>
                    )}

                    {/* Register Mode */}
                    {mode === 'register' && (
                        <>
                            <FormInput placeholder="Email" value={email} onChange={setEmail} error={errors.email} />
                            <FormInput placeholder="Username" value={username} onChange={setUsername} error={errors.username} />
                            <FormInput placeholder="Password" type="password" value={password} onChange={setPassword} error={errors.password} />
                            <FormInput placeholder="Confirm Password" type="password" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} />
                        </>
                    )}

                    {/* Forgot Mode */}
                    {mode === 'forgot' && (
                        <>
                            <h3 className="text-center text-lg font-medium mb-2">Reset Password</h3>
                            <p className="text-center text-sm text-text-tertiary mb-4">Enter your email to receive a reset link.</p>
                            <FormInput placeholder="Email" value={email} onChange={setEmail} error={errors.email} />
                            <button type="button" onClick={() => setMode('login')} className="text-sm text-text-secondary hover:text-text-primary underline mb-2 self-start">Back to Login</button>
                        </>
                    )}

                    {/* Verify Mode */}
                    {mode === 'verify' && (
                        <div className="text-center">
                            <h3 className="text-lg font-medium mb-2 text-text-primary">Check your Email</h3>
                            <p className="text-sm text-text-secondary mb-6">We sent a verification code to <span className="text-accent-primary">{email}</span>.</p>

                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Enter code"
                                    value={otp}
                                    maxLength={8}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setOtp(val);
                                    }}
                                    className="w-full text-center text-2xl tracking-widest p-3 bg-bg-primary rounded border border-accent-secondary/50 outline-none text-text-primary placeholder-text-tertiary focus:border-accent-primary transition-all"
                                />
                                {errors.otp && <p className="text-red-400 text-xs mt-1">{errors.otp}</p>}
                            </div>

                            <button type="button" onClick={() => setMode('register')} className="text-sm text-text-secondary hover:text-text-primary underline mb-2">Wrong email? Back to Register</button>
                        </div>
                    )}

                    {errors.general && (
                        <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded">
                            {errors.general}
                        </div>
                    )}

                    <button
                        disabled={loading}
                        className={`py-3 rounded md:rounded-lg font-medium transition-all transform active:scale-95 shadow-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''
                            } ${mode === 'register' ? 'bg-green-600 hover:bg-green-500 text-white' :
                                mode === 'verify' ? 'bg-blue-600 hover:bg-blue-500 text-white' :
                                    'bg-accent-secondary hover:bg-accent-secondary/80 text-white'
                            }`}
                    >
                        {loading ? 'Processing...' : (
                            mode === 'login' ? 'Sign In' :
                                mode === 'register' ? 'Create Account' :
                                    mode === 'verify' ? 'Verify Code' :
                                        'Send Reset Link'
                        )}
                    </button>

                </form>

                {mode === 'login' && (
                    <div className="mt-6 pt-4 border-t border-gray-700 text-center">
                        <button type="button" onClick={() => onLogin('Guest', 'guest')} className="text-sm text-text-tertiary hover:text-text-primary transition-colors hover:underline">
                            Continue as Guest
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

const FormInput = ({ placeholder, value, onChange, type = "text", error }: any) => (
    <div>
        <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full p-3 bg-bg-primary rounded border outline-none text-text-primary placeholder-text-tertiary transition-colors ${error ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-accent-secondary'
                }`}
        />
        {error && <p className="text-red-400 text-xs mt-1 ml-1">{error}</p>}
    </div>
);
