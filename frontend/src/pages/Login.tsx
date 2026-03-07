import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Layers, Mail, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import './Login.css';

interface LoginProps {
    onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [isSignUp, setIsSignUp] = useState(false);

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

                <form className="login-form" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
                    <div className="input-group">
                        <Mail className="input-icon" size={18} />
                        <input type="email" placeholder="Email address" required />
                    </div>
                    <div className="input-group">
                        <Lock className="input-icon" size={18} />
                        <input type="password" placeholder="Password" required />
                    </div>

                    <motion.button
                        type="submit"
                        className="primary-btn w-full"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                    </motion.button>
                </form>

                <div className="divider">
                    <span>or continue with</span>
                </div>

                <div className="google-auth-wrapper">
                    <GoogleLogin
                        onSuccess={credentialResponse => {
                            console.log(credentialResponse);
                            onLogin();
                        }}
                        onError={() => {
                            console.log('Login Failed');
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
