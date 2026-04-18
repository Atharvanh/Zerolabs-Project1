const fs = require('fs');
const files = ['index.html', 'dashboard.html', 'roadmap.html', 'skill_graph.html', 'projects.html', 'career_matches.html'];
const headLinkNodes = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap">
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap">
  <script>document.documentElement.classList.add('zl-fonts-loading');</script>
`;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if(!content.includes('fonts.gstatic.com')) {
    content = content.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter/g, headLinkNodes + '  <link href="https://fonts.googleapis.com/css2?family=Inter');
    fs.writeFileSync(file, content);
    console.log('patched', file);
  } else {
    console.log('already patched', file);
  }
});
