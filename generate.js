export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, title } = req.body;
        
        // በVercel Environment Variables ላይ ያስገባኸው ሚስጥራዊ ቁልፍ እዚህ በድብቅ ይጠራል
        const apiKey = process.env.Authorization;

        if (!apiKey) {
            return res.status(500).json({ error: 'የኤፒአይ ቁልፍ (Authorization Variable) በVercel ላይ አልተገኘም!' });
        }

        // ሰርቨሩ ራሱ ወደ Apiframe.ai ጥያቄ ይልካል
        const response = await fetch('https://api.apiframe.ai/v1/music/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey 
            },
            body: JSON.stringify({
                prompt: prompt,
                make_instrumental: false,
                model: "suno-v3"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || 'ከሱኖ ኤፒአይ ጋር መገናኘት አልተቻለም' });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'የውስጥ ሰርቨር ስህተት አጋጥሟል' });
    }
}
