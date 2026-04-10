const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { messages, system } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al contactar con la IA' });
  }
});

router.post('/ticket', authMiddleware, async (req, res) => {
  try {
    const { imageData } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData } },
            { type: 'text', text: 'Analiza este ticket de compra. Lista los productos. Responde SOLO con JSON: {"productos":["item1","item2"],"resumen":"breve"} Sin texto extra.' }
          ]
        }]
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Error al analizar ticket' });
  }
});

module.exports = router;
