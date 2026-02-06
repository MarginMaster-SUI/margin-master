const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const html2pptx = require('./scripts/html2pptx');

async function generateSlides() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'MarginMaster Team';
    pptx.title = 'MarginMaster Pitch Deck';

    const slidesDir = path.join(__dirname, 'slides');
    const files = fs.readdirSync(slidesDir).filter(f => f.endsWith('.html')).sort();

    console.log(`Found ${files.length} slide templates.`);

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const filePath = path.join(slidesDir, file);
        
        // Ensure we create a new slide for each file
        const { slide } = await html2pptx(filePath, pptx);
    }

    const outputPath = path.join(__dirname, 'MarginMaster_Pitch_Deck.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log(`✅ Presentation saved to ${outputPath}`);
}

generateSlides().catch(console.error);
