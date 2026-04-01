const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Serve static files
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Telegram message sender
async function sendToTelegram(formData, files) {
  try {
    let message = `<b>🎮 Шинэ захиалга ирлээ!</b>\n\n`;
    message += `<b>📱 Утасны дугаар:</b> ${formData.phone}\n`;
    message += `<b>⭐ Алтын хэмжээ:</b> ${formData.gold} GOLD\n`;
    message += `<b>💳 Данс эзэмшигчийн нэр:</b> ${formData.accountName}\n`;
    message += `<b>⏰ Шилжүүлсэн цаг:</b> ${formData.transferTime}\n`;
    message += `<b>💰 Шилжүүлсэн мөнгөн дүн:</b> ${formData.transferAmount}\n`;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    // Send text message
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });

    // Send MonPay QR image if exists
    if (files.monpayQr) {
      const monpayPath = files.monpayQr[0].path;
      const formDataTelegram = new FormData();
      formDataTelegram.append('chat_id', TELEGRAM_CHAT_ID);
      formDataTelegram.append('caption', '💳 MonPay QR код');
      formDataTelegram.append('photo', fs.createReadStream(monpayPath));

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, formDataTelegram, {
        headers: formDataTelegram.getHeaders()
      });

      fs.unlinkSync(monpayPath);
    }

    // Send graffiti image if exists
    if (files.graffitiImage) {
      const graffitiPath = files.graffitiImage[0].path;
      const formDataTelegram = new FormData();
      formDataTelegram.append('chat_id', TELEGRAM_CHAT_ID);
      formDataTelegram.append('caption', '🎨 GRAFFITI зарсан зураг');
      formDataTelegram.append('photo', fs.createReadStream(graffitiPath));

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, formDataTelegram, {
        headers: formDataTelegram.getHeaders()
      });

      fs.unlinkSync(graffitiPath);
    }

    return { success: true };
  } catch (error) {
    console.error('Telegram error:', error);
    throw error;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Form submission endpoint
app.post('/api/submit', upload.fields([
  { name: 'monpayQr', maxCount: 1 },
  { name: 'graffitiImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const formData = {
      phone: req.body.phone,
      gold: req.body.gold,
      accountName: req.body.accountName,
      transferTime: req.body.transferTime,
      transferAmount: req.body.transferAmount
    };

    // Validate required fields
    if (!formData.phone || !formData.gold || !formData.accountName || !formData.transferTime || !formData.transferAmount) {
      return res.status(400).json({ error: 'Бүх талбарыг бөглөнө үү!' });
    }

    // Validate gold amount
    if (parseInt(formData.gold) < 100) {
      return res.status(400).json({ error: 'Алтын хэмжээ 100-ээс доош байх боломжгүй!' });
    }

    // Check if images are provided
    if (!req.files || !req.files.monpayQr || !req.files.graffitiImage) {
      return res.status(400).json({ error: 'QR код болон GRAFFITI зургийг сонгоно уу!' });
    }

    // Send to Telegram
    await sendToTelegram(formData, req.files);

    res.json({ success: true, message: 'Захиалга амжилттай илгээгдлээ!' });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Алдаа гарлаа. Дахин оролдоно уу!' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📨 Telegram Bot Token configured`);
});
