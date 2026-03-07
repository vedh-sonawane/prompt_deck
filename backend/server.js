const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Groq } = require('groq-sdk');
const axios = require('axios');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchPexelsImage(query) {
    try {
        if (!process.env.PEXELS_API_KEY) return 'https://images.unsplash.com/photo-1542621334-a2562622f451';
        const res = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
            headers: { Authorization: process.env.PEXELS_API_KEY }
        });
        if (res.data.photos && res.data.photos.length > 0) {
            return res.data.photos[0].src.large;
        }
    } catch (error) {
        console.error('Pexels API Error:', error.message);
    }
    return 'https://images.unsplash.com/photo-1542621334-a2562622f451'; // fallback
}

app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, tone = 'professional', slide_count = 10 } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const systemPrompt = `You are a World-Class Graphic Designer and Content Creator. Create a complete presentation spec.
Return ONLY valid JSON with this exact structure (no markdown, no prose, no backticks):

{
  "theme": {
    "bg": [r, g, b],
    "accent": [r, g, b],
    "accent2": [r, g, b],
    "title_color": [r, g, b],
    "body_color": [r, g, b],
    "title_font": "Outfit",
    "body_font": "Inter"
  },
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["bullet 1", "bullet 2"],
      "image_query": "cinematic search query for Pexels, e.g. dark modern server room",
      "layout": "title|content|section|closing|image_only"
    }
  ]
}

Rules:
- Colors MUST reflect a very premium, modern, cohesive aesthetic complementing "${prompt}".
- Use dark mode backgrounds with neon accents by default.
- Create exactly ${Math.min(slide_count, 15)} slides with highly tailored, creative content.
- Ensure only JSON parsing is necessary.`;

        console.log('Generating for prompt:', prompt);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Topic: ${prompt}\nTone: ${tone}` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const rawContent = chatCompletion.choices[0].message.content;
        console.log('Groq result received');
        const parsedResponse = JSON.parse(rawContent);

        // We can also fetch the Pexels Image on the backend parallelly for the first slide to demonstrate
        if (parsedResponse.slides && parsedResponse.slides.length > 0) {
            const img = parsedResponse.slides[0].image_query;
            if (img) {
                parsedResponse.slides[0].imageUrl = await fetchPexelsImage(img);
            }
        }

        res.json({ presentation: parsedResponse });
    } catch (error) {
        console.error('Error generating presentation:', error);
        res.status(500).json({ error: 'Failed to generate presentation', details: error.message });
    }
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
