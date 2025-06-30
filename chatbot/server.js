const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
require('dotenv').config({ path: path.join(__dirname, '..') });

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// OpenAI API configuration
const configuration = new Configuration({
  apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Load context from markdown and JSON files
const loadContext = () => {
  let context = 'readme.md is the entrypoint of the documentation\n\n';
  context = 'please no mention of the documentation when you answer unless asked explicitely\n\n';

  const baseDir = path.join(__dirname, '..');

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

// Watch for changes in markdown and JSON files
const watchContextChanges = () => {
  const watcher = chokidar.watch(['**/*.md', '**/*.json'], {
    ignored: /node_modules/, // Ignore node_modules and package.json
    persistent: true,
  });

  watcher.on('change', (filePath) => {
    console.log(`File changed: ${filePath}`);
    context = loadContext();
  });

  watcher.on('unlink', (filePath) => {
    console.log(`File removed: ${filePath}`);
    context = loadContext();
  });

  watcher.on('add', (filePath) => {
    console.log(`File added: ${filePath}`);
    context = loadContext();
  });
};

watchContextChanges();

// Chat endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant grounded in the following documentation:\n\n${context}`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 150,
    });

    const reply = response.data.choices[0].message.content.trim();
    res.json({ reply });
  } catch (error) {
    if (error.response?.status === 404) {
      console.error('Model not found or access denied:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      res.status(404).json({
        error: 'Model not found or access denied',
        details: error.message,
      });
    } else {
      console.error('Error while fetching response from OpenAI:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      res.status(500).json({
        error: 'Failed to fetch response from OpenAI',
        details: error.message,
      });
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});