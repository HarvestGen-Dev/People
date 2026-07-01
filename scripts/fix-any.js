const fs = require('fs');

const log = fs.readFileSync('lint-errors.log', 'utf8');
const lines = log.split('\n');

let currentFile = '';
for (const line of lines) {
  if (line.startsWith('/')) {
    currentFile = line.trim().split(':')[0];
  } else if (currentFile && line.includes('Unexpected any. Specify a different type')) {
    const match = line.match(/\s+(\d+):(\d+)/);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      const colNum = parseInt(match[2], 10);
      
      try {
        const fileContent = fs.readFileSync(currentFile, 'utf8');
        const fileLines = fileContent.split('\n');
        
        let targetLine = fileLines[lineNum - 1];
        if (targetLine !== undefined) {
          targetLine = targetLine.replace(/\bany\b/g, 'unknown');
          fileLines[lineNum - 1] = targetLine;
          fs.writeFileSync(currentFile, fileLines.join('\n'));
        }
      } catch (e) {
        console.error('Failed on', currentFile, e.message);
      }
    }
  }
}
