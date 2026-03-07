import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Home as HomeIcon, Layout, Presentation, Settings, HelpCircle, Search, Plus, Sparkles } from 'lucide-react';
import axios from 'axios';
import './Dashboard.css';

interface DashboardProps {
    onLogout: () => void;
}

interface SavedDeck {
    id: string;
    title: string;
    tone: string;
    slides: number;
    themeColor?: string;
    createdAt: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('Home');
    const [prompt, setPrompt] = useState('');
    const [tone, setTone] = useState('professional');
    const [slideCount, setSlideCount] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedData, setGeneratedData] = useState<any>(null);
    const [themeColor, setThemeColor] = useState('#c8b49a');
    const [recentFilter, setRecentFilter] = useState<'Recent' | 'Drafts'>('Recent');
    const generatorRef = useRef<HTMLDivElement | null>(null);
    const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = window.localStorage.getItem('promptdeck.decks');
            return raw ? JSON.parse(raw) as SavedDeck[] : [];
        } catch {
            return [];
        }
    });
    const [siteThemeColor, setSiteThemeColor] = useState<string>(() => {
        if (typeof window === 'undefined') return '#7b2cbf';
        try {
            return window.localStorage.getItem('promptdeck.siteThemeColor') || '#7b2cbf';
        } catch {
            return '#7b2cbf';
        }
    });
    const [accountName, setAccountName] = useState<string>(() => {
        if (typeof window === 'undefined') return 'You';
        try {
            return window.localStorage.getItem('promptdeck.accountName') || 'You';
        } catch {
            return 'You';
        }
    });
    const [accountEmail, setAccountEmail] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        try {
            return window.localStorage.getItem('promptdeck.accountEmail') || '';
        } catch {
            return '';
        }
    });
    const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            return window.localStorage.getItem('promptdeck.avatar') || null;
        } catch {
            return null;
        }
    });
    const [showSuccessNotice, setShowSuccessNotice] = useState(false);

    useEffect(() => {
        try {
            window.localStorage.setItem('promptdeck.decks', JSON.stringify(savedDecks));
        } catch {
            // ignore
        }
    }, [savedDecks]);

    useEffect(() => {
        try {
            window.localStorage.setItem('promptdeck.siteThemeColor', siteThemeColor);
        } catch {
            // ignore
        }
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--primary-accent', siteThemeColor);
        }
    }, [siteThemeColor]);

    useEffect(() => {
        try {
            window.localStorage.setItem('promptdeck.accountName', accountName);
        } catch {
            // ignore
        }
    }, [accountName]);

    useEffect(() => {
        try {
            window.localStorage.setItem('promptdeck.accountEmail', accountEmail);
        } catch {
            // ignore
        }
    }, [accountEmail]);

    useEffect(() => {
        try {
            if (avatarDataUrl) {
                window.localStorage.setItem('promptdeck.avatar', avatarDataUrl);
            } else {
                window.localStorage.removeItem('promptdeck.avatar');
            }
        } catch {
            // ignore
        }
    }, [avatarDataUrl]);

    const scrollToGenerator = () => {
        if (generatorRef.current) {
            generatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleNewDeckClick = () => {
        setActiveTab('Home');
        // Ensure tab state updates before scrolling
        setTimeout(scrollToGenerator, 0);
    };

    const handleUseTemplate = (template: { prompt: string; tone: string; slides: number; color?: string }) => {
        setPrompt(template.prompt);
        setTone(template.tone);
        setSlideCount(template.slides);
        if (template.color) {
            setThemeColor(template.color);
        }
        setActiveTab('Home');
        setTimeout(scrollToGenerator, 0);
    };

    const handleGenerate = async () => {
        if (!prompt) return;
        console.log('Generate button clicked with prompt:', prompt);
        setIsGenerating(true);
        setShowSuccessNotice(false);
        try {
            // Talk to the REAL Python backend on port 8001
            const res = await axios.post('http://127.0.0.1:8001/generate', {
                prompt,
                tone,
                slide_count: slideCount,
                theme_color: themeColor,
            });
            // The Python backend returns { presentation_id, title, tone, slide_count, message }
            const data = res.data;
            setGeneratedData(data);
            const newDeck: SavedDeck = {
                id: data.presentation_id,
                title: (data.title as string) || prompt,
                tone,
                slides: slideCount,
                themeColor,
                createdAt: new Date().toISOString(),
            };
            setSavedDecks((prev) => [newDeck, ...prev]);
            setShowSuccessNotice(true);
            // Gently scroll to the result panel so the user sees their deck
            setTimeout(() => {
                const resultSection = document.querySelector('.recent-list');
                if (resultSection) {
                    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
        } catch (error) {
            console.error('Error generating presentation:', error);
            alert('Generation failed. Make sure your Python backend is running on port 8001.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAvatarUpload = (file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setAvatarDataUrl(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const navItems = [
        { name: 'Home', icon: HomeIcon },
        { name: 'My Decks', icon: Presentation },
        { name: 'Templates', icon: Layout },
        { name: 'Settings', icon: Settings },
        { name: 'Support', icon: HelpCircle },
    ];

    return (
        <div className="app-container dashboard-handwriting">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="logo dashboard-logo">
                    <Layers className="logo-icon active-glow" size={28} />
                    <span className="logo-text glow-text">Promptdeck</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <div
                            key={item.name}
                            className={`sidebar-item ${activeTab === item.name ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.name)}
                        >
                            <item.icon size={20} />
                            <span>{item.name}</span>
                        </div>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    <motion.div className="credit-card glass-panel flex-col" whileHover={{ scale: 1.02 }}>
                        <span className="cc-brand">PRO</span>
                        <div className="mt-4">
                            <div className="cc-number">**** **** **** 10x</div>
                            <div className="cc-footer">
                                <span>Credits: unlimited</span>
                                <span>Active</span>
                            </div>
                        </div>
                    </motion.div>
                    <button className="secondary-btn w-full mt-4" onClick={onLogout}>Logout</button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="top-bar">
                    <h1 className="page-title">{activeTab}</h1>
                    <div className="top-actions">
                        <div className="search-bar glass-panel">
                            <Search size={18} className="text-secondary" />
                            <input type="text" placeholder="Search presentations..." />
                        </div>
                        <button className="primary-btn flex-row" onClick={handleNewDeckClick}>
                            <Plus size={18} /> New Deck
                        </button>
                        <div className="user-chip">
                            <div
                                className="user-avatar"
                                style={avatarDataUrl ? { backgroundImage: `url(${avatarDataUrl})` } : undefined}
                            >
                                {!avatarDataUrl && (accountName?.charAt(0)?.toUpperCase() || 'U')}
                            </div>
                            <span className="user-name">{accountName || 'You'}</span>
                        </div>
                    </div>
                </header>

                {activeTab === 'Home' && (
                    <>
                        <div className="dashboard-grid">
                            {/* Hero Banner */}
                            <motion.div
                                className="hero-banner glass-panel"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                <div className="hero-content">
                                    <span className="hero-badge">PROMPTDECK AI 2.0</span>
                                    <h2>Your Gateway into<br />Presentation Excellence</h2>
                                    <p>Promptdeck is an AI platform.<br />We make beautiful, premium slides for any topic.</p>
                                    <button className="hero-btn" onClick={() => setActiveTab('Support')}>
                                        What is Promptdeck?
                                    </button>
                                </div>
                                <div className="hero-graphics">
                                    {/* Abstract 3D shapes represented by CSS/SVG for demo */}
                                    <div className="shape sphere"></div>
                                    <div className="shape pyramid"></div>
                                    <div className="shape ring"></div>
                                </div>
                            </motion.div>

                            {/* Generator Input */}
                            <motion.div
                                ref={generatorRef}
                                className="generator-card glass-panel flex-col"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                            >
                                <div className="card-header space-between">
                                    <h3 className="flex-row"><Sparkles size={18} className="text-primary" /> AI Generator</h3>
                                </div>
                                <div className="generator-form">
                                    {showSuccessNotice && generatedData && (
                                        <div className="success-banner">
                                            Deck created. Scroll down to see your presentation.
                                        </div>
                                    )}
                                    <textarea
                                        placeholder="What is your presentation about? (e.g., A premium scientific keynote on quantum computing)"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={3}
                                        className="w-full mt-2"
                                    />
                                    <div className="generator-options">
                                        <div className="generator-field">
                                            <label>Presentation tone / style</label>
                                            <input
                                                type="text"
                                                className="glass-input"
                                                value={tone}
                                                onChange={(e) => setTone(e.target.value)}
                                                placeholder="e.g. humorous, professional, cinematic, scientific"
                                            />
                                        </div>
                                        <div className="generator-field">
                                            <label>Number of slides</label>
                                            <input
                                                type="number"
                                                min={3}
                                                max={60}
                                                className="glass-input"
                                                value={slideCount}
                                                onChange={(e) => {
                                                    const raw = Number(e.target.value);
                                                    if (Number.isNaN(raw)) return;
                                                    const clamped = Math.min(60, Math.max(3, raw));
                                                    setSlideCount(clamped);
                                                }}
                                            />
                                            <span className="field-hint">Between 3 and 60 slides</span>
                                        </div>
                                        <div className="generator-field">
                                            <label>Theme color (hex)</label>
                                            <div className="color-input-wrapper">
                                                <input
                                                    type="color"
                                                    className="color-swatch"
                                                    value={themeColor}
                                                    onChange={(e) => setThemeColor(e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    className="glass-input"
                                                    value={themeColor}
                                                    onChange={(e) => setThemeColor(e.target.value)}
                                                    placeholder="#c8b49a"
                                                />
                                            </div>
                                            <span className="field-hint">Exact hex, e.g. #0f172a</span>
                                        </div>
                                    </div>
                                    <motion.button
                                        className={`primary-btn generate-btn w-full mt-4 ${isGenerating ? 'generating' : ''}`}
                                        onClick={handleGenerate}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={isGenerating || !prompt}
                                    >
                                        {isGenerating ? 'Generating Magic...' : 'Generate Presentation'}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </div>

                        {/* Generated Output Preview (or recent list) */}
                        <motion.div
                            className="recent-list glass-panel mt-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <div className="card-header space-between mb-4">
                                <h3>{generatedData ? 'Generated Result' : 'Your decks'}</h3>
                                <div className="flex-row gap-2">
                                    <button
                                        className={`pill-btn ${recentFilter === 'Recent' ? 'active' : ''}`}
                                        onClick={() => setRecentFilter('Recent')}
                                    >
                                        Recent
                                    </button>
                                    <button
                                        className={`pill-btn ${recentFilter === 'Drafts' ? 'active' : ''}`}
                                        onClick={() => setRecentFilter('Drafts')}
                                    >
                                        Drafts
                                    </button>
                                </div>
                            </div>

                            {generatedData ? (
                                <div className="generated-preview">
                                    <div className="theme-preview deck-built">
                                        <Presentation size={48} className="text-primary mb-4" />
                                        <h2>{generatedData.message || 'Deck Created!'}</h2>
                                        <p className="mb-6">Your premium presentation is ready directly on Google Slides.</p>
                                        <a
                                            href={`https://docs.google.com/presentation/d/${generatedData.presentation_id}/edit`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="primary-btn flex-row"
                                            style={{ textDecoration: 'none', display: 'inline-flex' }}
                                        >
                                            Open in Google Slides <Layout size={18} className="ml-2" />
                                        </a>
                                    </div>
                                    <div className="slides-metadata">
                                        <p><Plus size={14} /> ID: {generatedData.presentation_id}</p>
                                        <p><Sparkles size={14} /> Built with real-time AI & Google Cloud API</p>
                                    </div>
                                </div>
                            ) : recentFilter === 'Recent' ? (
                                <table className="custom-table w-full">
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Theme</th>
                                            <th>Tone</th>
                                            <th>Slides</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <div className="flex-row gap-2">
                                                    <div className="icon-box ethereum"><Layers size={14} /></div>
                                                    Blockchain Future
                                                </div>
                                            </td>
                                            <td>Neon Tech</td>
                                            <td><span className="badge rounded">Professional</span></td>
                                            <td>12</td>
                                            <td>Done</td>
                                            <td>Just now</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <div className="flex-row gap-2">
                                                    <div className="icon-box xrp"><Layout size={14} /></div>
                                                    AI Marketing
                                                </div>
                                            </td>
                                            <td>Minimal Light</td>
                                            <td><span className="badge rounded">Cinematic</span></td>
                                            <td>20</td>
                                            <td>Done</td>
                                            <td>Yesterday</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <h4>No drafts yet</h4>
                                    <p>Create a deck and save it as a draft to see it here.</p>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}

                {activeTab === 'My Decks' && (
                    <section className="tab-panel glass-panel">
                        <p className="tab-description">
                            Browse decks you have generated on this device. Open them in Google Slides to continue editing.
                        </p>
                        {savedDecks.length === 0 ? (
                            <div className="empty-state">
                                <h4>No decks yet</h4>
                                <p>Generate a deck on the Home tab and it will show up here.</p>
                            </div>
                        ) : (
                            <table className="custom-table w-full">
                                <thead>
                                    <tr>
                                        <th>Project</th>
                                        <th>Tone</th>
                                        <th>Slides</th>
                                        <th>Theme</th>
                                        <th>Created</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedDecks.map((deck) => (
                                        <tr key={deck.id}>
                                            <td>
                                                <div className="flex-row gap-2">
                                                    <div className="icon-box ethereum"><Layers size={14} /></div>
                                                    {deck.title}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge rounded">{deck.tone}</span>
                                            </td>
                                            <td>{deck.slides}</td>
                                            <td>
                                                {deck.themeColor ? (
                                                    <div className="flex-row gap-2">
                                                        <span
                                                            className="dot"
                                                            style={{ backgroundColor: deck.themeColor }}
                                                        />
                                                        <span>{deck.themeColor}</span>
                                                    </div>
                                                ) : (
                                                    'Auto'
                                                )}
                                            </td>
                                            <td>{new Date(deck.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <a
                                                    href={`https://docs.google.com/presentation/d/${deck.id}/edit`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="pill-btn"
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    Open
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </section>
                )}

                {activeTab === 'Templates' && (
                    <section className="tab-panel">
                        <p className="tab-description">
                            Start from a curated AI prompt for different types of presentations.
                        </p>
                        <div className="template-grid">
                            <div className="template-card glass-panel">
                                <h3>Historic Storytelling</h3>
                                <p>Premium parchment-like style similar to your example, perfect for history topics.</p>
                                <button
                                    className="secondary-btn"
                                    onClick={() =>
                                        handleUseTemplate({
                                            prompt: 'A premium history presentation about The Pacific Scandal (1872–1873).',
                                            tone: 'historic, cinematic, premium',
                                            slides: 12,
                                            color: '#c8b49a',
                                        })
                                    }
                                >
                                    Use template
                                </button>
                            </div>
                            <div className="template-card glass-panel">
                                <h3>Scientific Keynote</h3>
                                <p>Crisp, futuristic blue/white palette for science & tech decks.</p>
                                <button
                                    className="secondary-btn"
                                    onClick={() =>
                                        handleUseTemplate({
                                            prompt: 'A premium scientific presentation on cutting-edge AI in healthcare.',
                                            tone: 'scientific, professional, premium',
                                            slides: 15,
                                            color: '#0f172a',
                                        })
                                    }
                                >
                                    Use template
                                </button>
                            </div>
                            <div className="template-card glass-panel">
                                <h3>Startup Pitch</h3>
                                <p>Bold gradients and sharp typography for investor pitches.</p>
                                <button
                                    className="secondary-btn"
                                    onClick={() =>
                                        handleUseTemplate({
                                            prompt: 'A premium startup pitch for an AI productivity SaaS.',
                                            tone: 'confident, energetic, premium',
                                            slides: 10,
                                            color: '#4f46e5',
                                        })
                                    }
                                >
                                    Use template
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'Settings' && (
                    <section className="tab-panel glass-panel">
                        <p className="tab-description">
                            Manage your account details and how the Promptdeck website looks on this device.
                        </p>
                        <div className="settings-group">
                            <div className="settings-row">
                                <span>Account name</span>
                                <input
                                    type="text"
                                    className="glass-input"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    placeholder="Your name"
                                />
                            </div>
                            <div className="settings-row">
                                <span>Email</span>
                                <input
                                    type="email"
                                    className="glass-input"
                                    value={accountEmail}
                                    onChange={(e) => setAccountEmail(e.target.value)}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div className="settings-row">
                                <span>Profile picture</span>
                                <div className="flex-row">
                                    <div
                                        className="user-avatar"
                                        style={avatarDataUrl ? { backgroundImage: `url(${avatarDataUrl})` } : undefined}
                                    >
                                        {!avatarDataUrl && (accountName?.charAt(0)?.toUpperCase() || 'U')}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                                    />
                                </div>
                            </div>
                            <div className="settings-row">
                                <span>Website theme color</span>
                                <div className="color-input-wrapper">
                                    <input
                                        type="color"
                                        className="color-swatch"
                                        value={siteThemeColor}
                                        onChange={(e) => setSiteThemeColor(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className="glass-input"
                                        value={siteThemeColor}
                                        onChange={(e) => setSiteThemeColor(e.target.value)}
                                        placeholder="#7b2cbf"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'Support' && (
                    <section className="tab-panel">
                        <p className="tab-description">
                            Promptdeck creates high-end, premium slide designs that adapt to your topic.
                            For example, a history talk gets a warm, parchment-like vibe, while a scientific deck feels clean and futuristic.
                        </p>
                        <div className="support-content">
                            <p>
                                Need help or have feedback about how the slides look? Reach out and share your topic and the style
                                you are aiming for (e.g. &quot;premium scientific&quot;, &quot;historic documentary&quot;,
                                &quot;playful classroom&quot;).
                            </p>
                            <a href="mailto:support@promptdeck.ai" className="primary-btn">
                                Contact support
                            </a>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
