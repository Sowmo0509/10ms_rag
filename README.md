# Bengali RAG System (HSC26)

A multilingual Retrieval-Augmented Generation (RAG) system that can answer questions in both Bengali and English based on the HSC26 Bengali textbook content.

## Features

- 🌏 **Multilingual Support**: Accepts questions in both Bengali and English
- 🧠 **Intelligent Language Detection**: Automatically responds in the user's input language
- 📚 **Document-Grounded Responses**: Answers based on HSC26 Bengali textbook content
- 💬 **Streaming Chat Interface**: Real-time response streaming with chat history
- 🔄 **Persistent Memory**: Chat history stored locally in browser
- 🎯 **Semantic Search**: Uses OpenAI embeddings with Pinecone for accurate retrieval

## Architecture

```
User Query → Language Detection → Embedding → Pinecone Retrieval → OpenAI Generation → Streaming Response
                                     ↓
                             Chat History (localStorage)
```

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Pinecone account and API key

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd 10ms_rag
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Fill in your API keys in `.env.local`:

```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=hsc26-rag-index

# Note: Chat history is now stored in browser localStorage
# No additional environment variables needed for chat storage
```

### 3. Configure Page Extraction (Optional)

By default, the system processes all pages of the PDF. To extract only specific pages, edit `config/pdf-pages.ts`:

```typescript
export const HSC26_PAGE_CONFIG: PageRange[] = [
  { start: 1, end: 20, description: "First 20 pages" },
  { start: 50, end: 75, description: "Specific chapters" },
];
```

**Predefined configurations available:**

- `FIRST_20_PAGES` - Extract first 20 pages
- `MAIN_STORIES` - Extract main story sections
- `POETRY_SECTION` - Extract poetry and literary pieces
- `SAMPLE_PAGES` - Just first 5 pages for testing

To use a predefined config:

```typescript
export const ACTIVE_PAGE_CONFIG = PREDEFINED_CONFIGS.FIRST_20_PAGES;
```

### 4. Setup Knowledge Base

The system uses the HSC26 Bengali textbook PDF located at `public/files/hsc26.pdf`.

#### Step 1: Create Pinecone Index

```bash
# Start the development server
npm run dev

# Create the Pinecone index (one-time setup)
curl -X POST http://localhost:3000/api/create-index
```

#### Step 2: Ingest Document

**Option A: Using the Admin UI (Recommended)**

1. Go to `http://localhost:3000/admin`
2. Configure page ranges using the visual interface
3. Click "Start Ingestion" button

**Option B: Using API directly**

```bash
# Process and ingest the HSC26 PDF into the vector database
# Uses page configuration from config/pdf-pages.ts
curl -X POST http://localhost:3000/api/ingest

# Or specify page ranges directly in the request:
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "pageRanges": [
      {"start": 1, "end": 20, "description": "First 20 pages"},
      {"start": 50, "end": 60, "description": "Specific chapter"}
    ]
  }'
```

This will:

- Extract text from the PDF
- Clean and chunk the Bengali text
- Generate embeddings using OpenAI
- Store vectors in Pinecone

### 5. Start the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to access the chat interface.
Visit `http://localhost:3000/admin` to access the admin panel for PDF configuration and ingestion.

## Usage

### Chat Interface

1. **Ask Questions**: Type questions in Bengali or English
2. **Language Detection**: The system automatically detects your language and responds accordingly
3. **Clear History**: Use the "Clear Chat" button to reset the conversation
4. **Streaming Responses**: Watch responses appear in real-time
5. **Admin Access**: Click the "Admin" button to configure PDF ingestion

### Admin Interface

The admin panel (`/admin`) provides a visual interface for:

1. **Index Management**: Check Pinecone index status and create if needed
2. **Page Configuration**: Set which PDF pages to extract using:
   - Visual form with start/end page inputs
   - Predefined configurations (First 20 pages, Sample pages, etc.)
   - Custom descriptions for each page range
3. **Ingestion Control**: Start document processing with real-time progress
4. **Status Monitoring**: View ingestion progress, errors, and statistics

### Sample Questions

Try these sample questions to test the system:

**Bengali:**

- অনুপমের ভাষায় সুপুরুষ কাকে বলা হয়েছে?
- কাকে অনুপমের ভাগ্য দেবতা বলে উল্লেখ করা হয়েছে?
- বিয়ের সময় কল্যাণীর প্রকৃত বয়স কত ছিল?

**English:**

- Who is described as a good man according to Anupam?
- Who is referred to as Anupam's fortune god?
- What was Kalyani's actual age at the time of marriage?

## API Endpoints

### Chat API

- **POST** `/api/chat` - Send a message and get streaming response
- **DELETE** `/api/chat?sessionId=<id>` - Clear chat history

### Setup APIs

- **POST** `/api/create-index` - Create Pinecone index (one-time)
- **POST** `/api/ingest` - Process and ingest documents

## Technical Details

### Document Processing

1. **PDF Extraction**: Uses `pdf-parse` to extract text from HSC26 PDF
2. **Text Cleaning**: Removes excessive whitespace, normalizes Bengali characters
3. **Smart Chunking**: Splits text at sentence boundaries (।.!?) with overlap
4. **Embeddings**: Uses OpenAI `text-embedding-ada-002` model

### Language Detection

- Analyzes Unicode ranges to detect Bengali characters
- Threshold: >30% Bengali characters = Bengali response
- Automatic system prompt adaptation based on detected language

### Chat History

- Stored in browser localStorage (persistent across sessions)
- Automatically saved after each message
- Per-browser session isolation
- No server-side storage required

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Manual Setup After Deployment

After deployment, run the setup APIs:

```bash
# Create index
curl -X POST https://your-app.vercel.app/api/create-index

# Ingest documents
curl -X POST https://your-app.vercel.app/api/ingest
```

## Troubleshooting

### Common Issues

1. **PDF Not Found**: Ensure `hsc26.pdf` exists in `public/files/`
2. **Pinecone Errors**: Check API key and index name in environment
3. **OpenAI Rate Limits**: Reduce batch size in ingestion process
4. **localStorage Issues**: Clear browser data if chat history seems corrupted

### Logs

Check the browser console and server logs for detailed error messages.

## Technology Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes
- **Vector Database**: Pinecone
- **LLM**: OpenAI GPT-4o-mini
- **Embeddings**: OpenAI text-embedding-ada-002
- **Chat Storage**: Browser localStorage
- **PDF Processing**: pdf-parse

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Please ensure you have rights to use the HSC26 textbook content.
