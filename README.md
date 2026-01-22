# APItester - Modern API Client

Modern Postman-like API client built with React, TypeScript, and Tailwind CSS.

## 🚀 Features

- ✅ Beautiful dark UI with glassmorphism effects
- ✅ Collections & requests management with localStorage persistence
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ HTTP methods: GET, POST, PUT, DELETE, PATCH
- ✅ Query parameters, custom headers, and JSON body
- ✅ Response viewer with syntax highlighting
- ✅ Status code indicators with color coding
- ✅ Inline editing for collections and requests
- ✅ Modern, responsive interface

## 📦 Installation

```bash
npm install
```

## 🏃 Run Development Server

```bash
npm run dev
```

Then open your browser to `http://localhost:5173`

## 🔨 Build for Production

```bash
npm run build
```

## 🎯 Usage

1. **Create a Collection**: Click the `+` button in the sidebar
2. **Add a Request**: Click "New Request" under a collection
3. **Configure Request**:
   - Select HTTP method (GET, POST, etc.)
   - Enter URL (e.g., `https://jsonplaceholder.typicode.com/users`)
   - Add query parameters in the Params tab
   - Add headers in the Headers tab
   - Add request body in the Body tab
4. **Send Request**: Click the orange "Send" button
5. **View Response**: See the response with status code, time, and formatted JSON
6. **Edit/Delete**: Double-click to rename, or use action buttons

## 🧪 Try It Out

Try this example:
- URL: `https://jsonplaceholder.typicode.com/users`
- Method: GET
- Click Send

Or for POST:
- URL: `https://jsonplaceholder.typicode.com/posts`
- Method: POST
- Body: `{"title": "test", "body": "test body", "userId": 1}`

## 🛠️ Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Native Fetch API

## Next Steps (Optional)

To make this a desktop app with Electron:
1. Install: `npm install electron electron-builder concurrently wait-on`
2. Create `electron/main.ts`
3. Configure electron-builder in package.json
4. Run: `npm run electron:dev`
