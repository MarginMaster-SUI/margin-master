const fs = require('fs');
const path = require('path');

const slidesDir = path.join(__dirname, 'slides');
const files = fs.readdirSync(slidesDir).filter(f => f.endsWith('.html'));

const cssPattern = /h1\s*{\s*font-size:\s*32pt;\s*margin:\s*0\s*0\s*30pt\s*0;\s*color:\s*#2c5282;\s*border-bottom:\s*3px\s*solid\s*#63b3ed;\s*padding-bottom:\s*10pt;\s*}/;
const newCss = 'h1 { font-size: 32pt; margin: 0; color: #2c5282; }';

const htmlPattern = /<h1>(.*?)<\/h1>/;

files.forEach(file => {
    if (file === '02_Problem.html') return; // Already fixed manually
    if (file === '01_Title.html') return; // No border
    if (file === '10_CTA.html') return; // No border or different style which might not match

    const filePath = path.join(slidesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (cssPattern.test(content)) {
        console.log(`Fixing ${file}...`);
        
        // Fix CSS
        content = content.replace(cssPattern, newCss);

        // Fix HTML structure
        // We use a function to capture the title text and wrap it
        content = content.replace(htmlPattern, (match, title) => {
            return `<div style="margin-bottom: 30pt; border-bottom: 3px solid #63b3ed; padding-bottom: 10pt;">
    <h1>${title}</h1>
  </div>`;
        });
        
        // Also fix specific margin issue in Roadmap or others if needed
        // For Roadmap 09, it also has margin-bottom: 20pt in H1? No, checked previous file content, looks standard.
        // But 06 Architecture has margin: 0 0 20pt 0. The regex is specific to 30pt.
        
        fs.writeFileSync(filePath, content);
    } else {
        // Try loose match for 06 Architecture and 07 WhySui which might have different margins
        // 06: margin: 0 0 20pt 0
        const cssPattern20 = /h1\s*{\s*font-size:\s*32pt;\s*margin:\s*0\s*0\s*20pt\s*0;\s*color:\s*#2c5282;\s*border-bottom:\s*3px\s*solid\s*#63b3ed;\s*padding-bottom:\s*10pt;\s*}/;
        if (cssPattern20.test(content)) {
             console.log(`Fixing ${file} (20pt margin)...`);
             content = content.replace(cssPattern20, newCss);
             content = content.replace(htmlPattern, (match, title) => {
                return `<div style="margin-bottom: 20pt; border-bottom: 3px solid #63b3ed; padding-bottom: 10pt;">
    <h1>${title}</h1>
  </div>`;
            });
            fs.writeFileSync(filePath, content);
        } else {
             console.log(`Skipping ${file} (Pattern not found)`);
        }
    }
});
