const fs = require('fs');
const path = require('path');

const loadContext = () => {
  let context = 'You are a helpful assistant grounded in the following documentation:\n\n';
  context += 'readme.md is the entrypoint of the documentation\n\n';
  context += 'please no mention of the documentation when you answer unless asked explicitely\n\n';

  const baseDir = path.join(__dirname, '.');

  const getFiles = (dir, ext) => {
    const files = [];
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory() && !filePath.includes('node_modules')) {
        files.push(...getFiles(filePath, ext));
      } else if (filePath.endsWith(ext) && !filePath.includes('package.json') && !filePath.includes('package-lock.json')) {
        files.push(filePath);
      }
    });
    return files;
  };

  const mdFiles = getFiles(baseDir, '.md');
  const jsonFiles = getFiles(baseDir, '.json');

  mdFiles.forEach((filePath) => {
    const relativePath = path.relative(baseDir, filePath);
    context += `File: ${relativePath}\n\n${fs.readFileSync(filePath, 'utf-8')}\n\n`;
  });

  jsonFiles.forEach((filePath) => {
    const relativePath = path.relative(baseDir, filePath);
    context += `File: ${relativePath}\n\n${fs.readFileSync(filePath, 'utf-8')}\n\n`;
  });

  return context;
};

let context = loadContext();

// Write context to context.txt
fs.writeFileSync(path.join(__dirname, 'context.txt'), context, 'utf-8');