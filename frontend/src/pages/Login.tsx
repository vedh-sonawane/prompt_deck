import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Layers, Mail, Lock } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './Login.css';

interface LoginProps {
    onLogin: () => void;
}

/** Decode Google JWT payload (no verification; used only for display and persistence) */
function decodeGoogleCredential(credential: string): { email?: string; name?: string; sub?: string } {
    try {
        const parts = credential.split('.');
        if (parts.length !== 3) return {};
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return {
            email: payload.email,
            name: payload.name || payload.email?.split('@')[0],
            sub: payload.sub,
        };
    } catch {
        return {};
    }
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            if (isSignUp) {
                const res = await axios.post('http://127.0.0.1:8001/auth/signup', {
                    name,
                    email,
                    password,
                });
                const user = res.data;
                window.localStorage.setItem('promptdeck.user', JSON.stringify(user));
                window.localStorage.setItem('promptdeck.accountName', user.name || '');
                window.localStorage.setItem('promptdeck.accountEmail', user.email || '');
                onLogin();
            } else {
                const res = await axios.post('http://127.0.0.1:8001/auth/login', {
                    email,
                    password,
                });
                const user = res.data;
                window.localStorage.setItem('promptdeck.user', JSON.stringify(user));
                window.localStorage.setItem('promptdeck.accountName', user.name || '');
                window.localStorage.setItem('promptdeck.accountEmail', user.email || '');
                onLogin();
            }
        } catch (err: any) {
            const status = err?.response?.status;
            const detail = err?.response?.data?.detail;
            let message: string;
            if (typeof detail === 'string') {
                message = detail;
            } else if (Array.isArray(detail) && detail.length > 0) {
                const first = detail[0];
                message = first?.msg || 'Please check your details.';
            } else if (!err?.response) {
                message = "Could not reach server. Make sure the backend is running (e.g. run \"python main.py\" in the backend folder on port 8001).";
            } else {
                message = isSignUp
                    ? "Sign up failed. Please check your details and try again."
                    : "Invalid email or password.";
            }
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container">
            <motion.div
                className="login-card glass-panel"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                <div className="login-header">
                    <div className="logo">
                        <Layers className="logo-icon" size={32} />
                        <span className="logo-text glow-text">Promptdeck</span>
                    </div>
                    <h1 className="login-title">
                        {isSignUp ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="login-subtitle">
                        {isSignUp ? 'Built 10x better than Slidesgo' : 'Log in to continue creating amazing presentations'}
                    </p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {isSignUp && (
                        <div className="input-group">
                            <Mail className="input-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Full name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="input-group">
                        <Mail className="input-icon" size={18} />
                        <input
                            type="email"
                            placeholder="Email address"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <Lock className="input-icon" size={18} />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && <p className="auth-error">{error}</p>}

                    <motion.button
                        type="submit"
                        className="primary-btn w-full"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Sign Up' : 'Sign In'}
                    </motion.button>
                </form>

                <div className="divider">
                    <span>or continue with</span>
                </div>

                <div className="google-auth-wrapper">
                    <GoogleLogin
                        onSuccess={credentialResponse => {
                            const credential = credentialResponse.credential;
                            if (credential) {
                                const payload = decodeGoogleCredential(credential);
                                const user = {
                                    id: payload.sub || 'google',
                                    name: payload.name || 'User',
                                    email: payload.email || '',
                                };
                                window.localStorage.setItem('promptdeck.user', JSON.stringify(user));
                                window.localStorage.setItem('promptdeck.accountName', user.name || '');
                                window.localStorage.setItem('promptdeck.accountEmail', user.email || '');
                            }
                            onLogin();
                        }}
                        onError={() => {
                            setError("Google sign-in failed: add Authorized JavaScript origin and Redirect URI in Google Cloud Console (see hint below).");
                        }}
                        theme="filled_black"
                        shape="rectangular"
                        text={isSignUp ? "signup_with" : "signin_with"}
                    />
                </div>

                <div className="toggle-auth">
                    <span className="toggle-text">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    </span>
                    <button
                        className="toggle-btn"
                        onClick={() => setIsSignUp(!isSignUp)}
                    >
                        {isSignUp ? 'Sign in' : 'Sign up'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
