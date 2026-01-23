# API Tester

A clean, modern API testing tool built with React and TypeScript. Think Postman but simpler and prettier.

## What it does

Test REST APIs right from your browser. Send HTTP requests, organize them in collections, and see nicely formatted responses. All your data stays in your browser's localStorage.

## Getting started

```bash
npm install
npm run dev
```

Visit http://localhost:5173/APItester/

## Features

- **Collections & Folders** - Organize requests in nested folders
- **HTTP Methods** - GET, POST, PUT, DELETE, PATCH
- **Request Building** - Query params, headers, JSON body
- **JSON Highlighting** - Syntax colored JSON in requests and responses
- **Method Colors** - Each HTTP method has its own color (GET=green, POST=orange, etc.)
- **Import cURL** - Paste cURL commands to create requests
- **Context Menus** - Right-click style menus for quick actions
- **Auto-save** - Everything saves automatically to localStorage

## Quick test

Try this to see it in action:
- Create a collection
- Add a request
- Set method to GET
- URL: `https://jsonplaceholder.typicode.com/users`
- Hit Send

You should see a list of fake users with nice syntax highlighting.

## How to use

1. Click **+ New** to create a collection
2. Click the **+** icon on a collection to add a request
3. Pick your HTTP method from the dropdown
4. Enter the URL
5. Add params, headers, or body as needed
6. Click **Send**

The **⋮** menu on collections and requests gives you more options like rename, delete, add folder, etc.

## Deploy

This app is set up to deploy to GitHub Pages:

```bash
npm run deploy
```

Your app will be live at `https://yourusername.github.io/APItester/`

## Stack

- React 18 + TypeScript
- Vite for blazing fast dev
- Tailwind CSS for styling
- No backend needed - everything runs client-side

## Project structure

```
src/
  components/     - UI components
  utils/          - Helper functions
  types.ts        - TypeScript types
  App.tsx         - Main app
```

Built this to learn React and make API testing less painful. Hope it helps!
