import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Home as HomeIcon, Layout, Presentation, Settings, HelpCircle, Search, Plus, Sparkles } from 'lucide-react';
import axios from 'axios';
import './Dashboard.css';

interface DashboardProps {
    onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('Home');
    const [prompt, setPrompt] = useState('');
    const [tone, setTone] = useState('professional');
    const [slideCount, setSlideCount] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedData, setGeneratedData] = useState<any>(null);

    const handleGenerate = async () => {
        if (!prompt) return;
        console.log('Generate button clicked with prompt:', prompt);
        setIsGenerating(true);
        try {
            // Talk to the REAL Python backend on port 8001
            const res = await axios.post('http://127.0.0.1:8001/generate', {
                prompt,
                tone,
                slide_count: slideCount
            });
            // The Python backend returns { presentation_id, message }
            setGeneratedData(res.data);
        } catch (error) {
            console.error('Error generating presentation:', error);
            alert('Generation failed. Make sure your Python backend is running on port 8001.');
        } finally {
            setIsGenerating(false);
        }
    };

    const navItems = [
        { name: 'Home', icon: HomeIcon },
        { name: 'My Decks', icon: Presentation },
        { name: 'Templates', icon: Layout },
        { name: 'Settings', icon: Settings },
        { name: 'Support', icon: HelpCircle },
    ];

    return (
        <div className="app-container">
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
                        <button className="primary-btn flex-row">
                            <Plus size={18} /> New Deck
                        </button>
                    </div>
                </header>

                <div className="dashboard-grid">
                    {/* Hero Banner matching "Your Gateway into Blockchain" */}
                    <motion.div
                        className="hero-banner glass-panel"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="hero-content">
                            <span className="hero-badge">PROMPTDECK AI 2.0</span>
                            <h2>Your Gateway into<br />Presentation Excellence</h2>
                            <p>Promptdeck is an AI platform.<br />We make beautiful slides accessible.</p>
                            <button className="hero-btn">What is Promptdeck?</button>
                        </div>
                        <div className="hero-graphics">
                            {/* Abstract 3D shapes represented by CSS/SVG for demo */}
                            <div className="shape sphere"></div>
                            <div className="shape pyramid"></div>
                            <div className="shape ring"></div>
                        </div>
                    </motion.div>

                    {/* Generator Input (Matching the graph card placement) */}
                    <motion.div
                        className="generator-card glass-panel flex-col"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <div className="card-header space-between">
                            <h3 className="flex-row"><Sparkles size={18} className="text-primary" /> AI Generator</h3>
                        </div>
                        <div className="generator-form">
                            <textarea
                                placeholder="What is your presentation about? (e.g., A pitch deck for a new crypto AI startup)"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                className="w-full mt-2"
                            />
                            <div className="flex-row gap-2 mt-4 space-between generator-options">
                                <div className="flex-row">
                                    <select className="glass-select" value={tone} onChange={(e) => setTone(e.target.value)}>
                                        <option value="professional">Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="humorous">Humorous</option>
                                        <option value="cinematic">Cinematic</option>
                                    </select>
                                    <select className="glass-select ml-2" value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))}>
                                        <option value={5}>5 Slides</option>
                                        <option value={10}>10 Slides</option>
                                        <option value={15}>15 Slides</option>
                                    </select>
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
                        <h3>{generatedData ? 'Generated Result' : 'List of recent presentations'}</h3>
                        <div className="flex-row gap-2">
                            <button className="pill-btn active">Recent</button>
                            <button className="pill-btn">Drafts</button>
                        </div>
                    </div>

                    {generatedData ? (
                        <div className="generated-preview">
                            <div className="theme-preview deck-built">
                                <Presentation size={48} className="text-primary mb-4" />
                                <h2>{generatedData.message || 'Deck Created!'}</h2>
                                <p className="mb-6">Your presentation is ready directly on Google Slides.</p>
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
                    ) : (
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
                    )}
                </motion.div>
            </main>
        </div>
    );
};

export default Dashboard;
