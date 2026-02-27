const fs = require('fs');
const path = require('path');

const extractText = async (filePath) => {
    try {
        const fullPath = path.join(__dirname, '..', 'uploads', filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${fullPath}`);
        }

        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(fullPath);
        const data = await pdfParse(dataBuffer);
        return data.text || '';
    } catch (err) {
        console.error('PDF parse error:', err.message);
        // Return empty string on error - will still work with mock scoring
        return '';
    }
};

module.exports = { extractText };
