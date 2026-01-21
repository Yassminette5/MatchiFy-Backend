# AI Profile Analysis - Documentation

## 1. Overview

### What the Feature Does

The **AI Profile Analysis** feature automatically analyzes a talent's profile using AI to provide structured feedback about their profile completeness, strengths, areas for improvement, recommended tags for matching, and an overall profile score.

### What Data It Uses

The analysis considers the following talent data:
- **Profile Information**: Full name, headline (composed from talent categories and description), location
- **Skills**: All skills associated with the talent profile (loaded from the Skill collection)
- **Portfolio Projects**: All portfolio projects including titles and descriptions
- **CV Content**: Text extracted from the uploaded CV file (PDF format supported)

### Where It Is Used in the App

- **Talent Profile Screen → AI Profile Insights**: The primary use case where talents can request an analysis of their profile
- **Reusable Analysis**: The analysis results can be retrieved without triggering a new analysis (GET endpoint)
- **Best Match Missions**: The analysis results (especially `recommendedTags`, `keyStrengths`, and `summary`) are reused by the Best Match missions feature to compute mission rankings

---

## 2. Architecture

### Services/Classes Involved

The feature is implemented across several layers:

#### Backend Services

1. **`AiController`** (`src/ai/ai.controller.ts`)
   - HTTP endpoints (`POST /ai/profile-analysis` and `GET /ai/profile-analysis`)
   - Rate limiting (5 analyses per day per user)
   - Request validation and error handling

2. **`AiProfileAnalyzerService`** (`src/ai/services/ai-profile-analyzer.service.ts`)
   - Core analysis logic
   - Aggregates talent data from multiple sources (User, Portfolio, Skills, CV)
   - Builds the AI prompt
   - Normalizes and validates AI responses
   - Handles caching logic based on profile hash

3. **`ProfileAnalysisService`** (`src/ai/services/profile-analysis.service.ts`)
   - Database operations for storing and retrieving analyses
   - MongoDB schema management (`ProfileAnalysis` collection)

4. **`AiService`** (`src/ai/services/ai.service.ts`)
   - Generic AI provider abstraction
   - Routes requests to configured provider (Ollama or Gemini)
   - JSON response parsing with retry logic
   - Error handling and availability checks

5. **Provider-Specific Services**:
   - **`OllamaService`** (`src/ai/services/ollama.service.ts`): Local Ollama integration
   - **`GeminiService`** (`src/ai/services/gemini.service.ts`): Google Gemini API integration

#### Data Models

- **`ProfileAnalysis` Schema** (`src/ai/schemas/profile-analysis.schema.ts`): MongoDB document storing analysis results
- **`ProfileAnalysisResponseDto`** (`src/ai/dto/profile-analysis-response.dto.ts`): API response structure

### How the AI Provider is Wired

The system uses a **generic AI service layer** that abstracts away the specific AI provider:

1. **Configuration**: The `AI_PROVIDER` environment variable determines which provider to use (`local`/`ollama` or `gemini`)
2. **Service Selection**: `AiService` routes requests to `OllamaService` or `GeminiService` based on configuration
3. **Unified Interface**: Both providers implement the same `generateContent()` and `generateJsonContent()` methods
4. **Provider Swapping**: Changing providers only requires environment variable updates; no code changes needed

### How the Feature is Decoupled

- **Modular Design**: The AI module (`AiModule`) is self-contained and can be imported independently
- **Dependency Injection**: Services depend on interfaces (NestJS dependency injection), not concrete implementations
- **Database Isolation**: Analysis results are stored in a separate `ProfileAnalysis` collection
- **Error Isolation**: AI failures are handled gracefully and don't crash the application
- **Reusability**: The same AI service layer is used by other features (e.g., Best Match missions)

---

## 3. Environment & Configuration

### Required Environment Variables

Add the following variables to your `.env` file:

#### For Local/Ollama Setup

```env
# AI Provider Configuration
AI_PROVIDER=local                    # or 'ollama' (both map to local provider)
AI_LOCAL_URL=http://localhost:11434/api/generate    # Ollama API endpoint
AI_MODEL=llama3.1                    # Ollama model name (e.g., llama3.1, mistral)
AI_TIMEOUT=60000                     # Request timeout in milliseconds (default: 30000)
```

#### For Gemini Setup

```env
# AI Provider Configuration
AI_PROVIDER=gemini                   # or 'google'
GEMINI_API_KEY=your-api-key-here     # Google Gemini API key (required)
GEMINI_MODEL=gemini-2.0-flash-exp    # Model name (default: gemini-2.0-flash-exp)
GEMINI_TEMPERATURE=0.7               # Temperature (0.0-1.0, default: 0.7)
GEMINI_MAX_TOKENS=8192               # Maximum tokens (default: 8192)
GEMINI_TIMEOUT=30000                 # Request timeout in milliseconds (default: 30000)
```

### How to Configure AI Locally (Ollama)

#### Prerequisites

1. **Install Ollama**: Download and install from [ollama.ai](https://ollama.ai)
2. **Pull a Model**: 
   ```bash
   ollama pull llama3.1
   ```
   Or use another model like `mistral`, `llama2`, etc.

3. **Start Ollama Server**:
   ```bash
   ollama serve
   ```
   The server runs on `http://localhost:11434` by default.

#### Configuration Steps

1. **Update `.env` File**:
   ```env
   AI_PROVIDER=local
   AI_LOCAL_URL=http://localhost:11434/api/generate
   AI_MODEL=llama3.1
   AI_TIMEOUT=60000
   ```

2. **Restart Backend**:
   ```bash
   npm run start:dev
   ```

3. **Verify Setup**:
   Check backend logs for:
   ```
   [OllamaService] Ollama service initialized with URL: http://localhost:11434/api/generate, Model: llama3.1
   ```

4. **Test Connection** (optional):
   ```bash
   curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{"model": "llama3.1", "prompt": "Hello", "stream": false}'
   ```

---

## 4. Data Preparation

### Exactly Which Data is Loaded

For each talent profile analysis, the following data is aggregated:

1. **User/Talent Data** (`UserService.findById()`):
   - `fullName`: Talent's full name
   - `talent`: Array of talent categories (e.g., ["Developer", "Photographer"])
   - `description`: Profile description
   - `location`: Location string
   - `cvUrl`: Path to uploaded CV file (if exists)

2. **Skills** (`SkillService.findByIds()`):
   - All skills referenced in `user.skills[]`
   - Skill names are extracted and normalized

3. **Portfolio Projects** (`PortfolioService.findAllByTalent()`):
   - All portfolio projects for the talent
   - For each project: `title` and `description` (optional)

4. **CV Text** (if `cvUrl` exists):
   - PDF file is read from disk
   - Text is extracted using `pdf-parse` library
   - Text is sanitized and truncated if necessary

### How CV is Read and Transformed

1. **File Path Resolution**:
   - If `cvUrl` is absolute, it's used as-is
   - If relative, it's resolved relative to `process.cwd()`

2. **PDF Extraction**:
   - Uses `pdf-parse` library to extract text from PDF files
   - DOC/DOCX formats are not yet supported (logs a warning and continues)

3. **Text Processing**:
   - HTML tags are removed
   - Special characters are normalized
   - Whitespace is normalized
   - Text length is limited to 3000 characters (important sections are prioritized)

4. **Section Extraction**:
   - If CV is too long, the system tries to extract key sections:
     - Summary/Résumé
     - Experience/Work History
     - Education/Formation
     - Skills/Compétences
     - Achievements/Réalisations

### How Everything is Sanitized/Normalized

All text data undergoes the following sanitization process (`sanitizeText()`):

1. **HTML Removal**: All HTML tags are stripped
2. **Entity Decoding**: HTML entities (`&nbsp;`, `&amp;`, etc.) are converted to plain text
3. **Character Filtering**: Non-printable characters are removed (except newlines, tabs, spaces)
4. **Whitespace Normalization**: Multiple spaces/newlines are collapsed
5. **Trimming**: Leading/trailing whitespace is removed

### What Happens if Parts are Missing

The system handles missing data gracefully:

- **No Skills**: Analysis continues with an empty skills array; AI is instructed to note this as an area to improve
- **No Portfolio Projects**: Analysis continues; AI is told this is a significant area to improve
- **No CV**: Analysis continues; AI is told CV is missing and should note this in recommendations
- **CV Extraction Failure**: Error is logged, but analysis continues without CV content

All missing data scenarios are explicitly mentioned in the AI prompt so the analysis can provide constructive feedback.

---

## 5. AI Prompt & Expected Response

### What Information We Send to the AI

The prompt includes:

1. **Role Definition**: "You are an expert career advisor analyzing a talent profile for a creative recruitment platform."

2. **Talent Data**:
   - Name
   - Headline (composed from talent categories and description)
   - Skills list (or "None listed" message)
   - Portfolio projects (titles and descriptions, limited to 500 chars per description)
   - CV content preview (truncated to 3000 chars if needed)

3. **Instructions**: Clear JSON format requirements and field descriptions

### What We Ask the AI to Return

The AI is required to return a **strict JSON structure**:

```json
{
  "summary": "A concise 3-4 line summary of the talent profile",
  "keyStrengths": ["strength 1", "strength 2", ...],
  "areasToImprove": ["improvement 1", "improvement 2", ...],
  "recommendedTags": ["tag1", "tag2", ...],
  "profileScore": 75
}
```

### Fields of the JSON Response

1. **`summary`** (string):
   - 3-4 sentences highlighting the talent's main attributes and potential
   - Required field

2. **`keyStrengths`** (array of strings):
   - 3-5 specific strengths based on profile, skills, projects, and CV
   - Limited to maximum 10 items after normalization

3. **`areasToImprove`** (array of strings):
   - 3-5 actionable suggestions to enhance the profile
   - Should mention missing elements (skills, projects, CV) if applicable
   - Limited to maximum 10 items after normalization

4. **`recommendedTags`** (array of strings):
   - 5-10 relevant tags/keywords for matching with opportunities
   - Based on skills, projects, and headline
   - Limited to maximum 15 items after normalization

5. **`profileScore`** (number, 0-100):
   - Indicates profile completeness and strength
   - Factors considered:
     - Profile completeness
     - Skill depth
     - Portfolio quality/quantity
     - CV presence
   - Lower scores for missing skills, projects, or CV
   - Higher scores for complete profiles with detailed information

### How Invalid AI Responses are Handled

1. **JSON Parsing**:
   - The response is cleaned (removes markdown code blocks, extracts JSON from surrounding text)
   - If parsing fails, the system retries once (configurable retry count)

2. **Field Validation**:
   - All fields are validated and normalized
   - Missing fields get default values:
     - `summary`: "Profile analysis completed."
     - `keyStrengths`: ["Profile shows potential for growth"]
     - `areasToImprove`: ["Consider adding more details to your profile"]
     - `profileScore`: 50 (default middle score)

3. **Score Normalization**:
   - Score is clamped to 0-100 range
   - Non-numeric values default to 50

4. **Array Limits**:
   - Arrays are filtered (empty/whitespace items removed)
   - Truncated to maximum lengths (10 for strengths/improvements, 15 for tags)

5. **Error Handling**:
   - If all retries fail, a `ServiceUnavailableException` is thrown
   - User receives a friendly error message
   - Full error details are logged for debugging

---

## 6. Backend Flow (Step by Step)

### From Request to Response

1. **User Action**: Talent presses "Analyze my profile" in the mobile app

2. **HTTP Request**: 
   - `POST /ai/profile-analysis`
   - Requires JWT authentication (Bearer token)
   - No request body (user ID extracted from JWT token)

3. **Controller Layer** (`AiController.analyzeProfile()`):
   - Extracts `userId` from `req.user.id` (set by JWT auth guard)
   - Checks rate limit (5 analyses per day per user)
   - If rate limit exceeded: returns `429 Too Many Requests`
   - Calls `AiProfileAnalyzerService.analyzeProfile(userId)`

4. **Service Layer - Analysis** (`AiProfileAnalyzerService.analyzeProfile()`):
   - Checks if AI service is available (`AiService.isAvailable()`)
   - If unavailable: throws `ServiceUnavailableException` (503)
   - Calls `aggregateTalentData(userId)` to load all profile data

5. **Data Aggregation** (`aggregateTalentData()`):
   - Loads user from `UserService.findById()`
   - Loads skills from `SkillService.findByIds(user.skills)`
   - Loads portfolio projects from `PortfolioService.findAllByTalent()`
   - Extracts CV text if `user.cvUrl` exists (`extractCvText()`)
   - Sanitizes all text data
   - Builds `TalentProfileData` object

6. **Cache Check**:
   - Computes profile hash (`computeProfileHash()`) based on:
     - Name, headline, skills (sorted), projects (titles + truncated descriptions), CV presence
   - Queries `ProfileAnalysisService.findLatestByTalentId()` for existing analysis
   - If cached analysis exists AND hash matches AND analysis is recent (< 24 hours):
     - Returns cached analysis (no AI call)
   - Otherwise: proceeds to new analysis

7. **Prompt Building** (`buildAnalysisPrompt()`):
   - Constructs detailed prompt with all talent data
   - Includes JSON format instructions
   - Includes guidelines for each field

8. **AI Call** (`AiService.generateJsonContent()`):
   - Routes to configured provider (Ollama or Gemini)
   - Provider service sends HTTP request to AI endpoint
   - Response is parsed and JSON is extracted
   - If parsing fails: retries once

9. **Response Normalization** (`normalizeAnalysisResponse()`):
   - Validates all fields
   - Sets default values for missing fields
   - Normalizes score to 0-100 range
   - Truncates arrays to maximum lengths

10. **Database Storage** (`ProfileAnalysisService.saveAnalysis()`):
    - Creates new `ProfileAnalysis` document with:
      - `talentId`
      - All analysis fields (summary, strengths, improvements, tags, score)
      - `profileHash` (for future cache checks)
      - `createdAt` timestamp (auto-generated)
    - Saves to MongoDB `ProfileAnalysis` collection

11. **Rate Limit Update**:
    - Increments rate limit counter for the user
    - Stores in-memory map (24-hour window)

12. **Response**:
    - Returns `ProfileAnalysisResponseDto` with all fields + `analyzedAt` timestamp
    - HTTP 200 status

### Error Cases

- **Rate Limit Exceeded**: HTTP 429 with message "Rate limit exceeded. Maximum 5 analyses per day."
- **AI Service Unavailable**: HTTP 503 with message "AI service is temporarily unavailable."
- **Talent Not Found**: HTTP 404 with message "Talent not found."
- **AI Request Timeout**: HTTP 503 with timeout message
- **JSON Parsing Failed**: HTTP 503 after retries exhausted
- **Database Error**: HTTP 500 with generic error message

---

## 7. API Contract

### POST /ai/profile-analysis

**HTTP Method**: `POST`

**URL**: `/ai/profile-analysis`

**Authentication**: Required (JWT Bearer token)

**Request Body**: None (user ID extracted from JWT token)

**Rate Limiting**: 5 analyses per day per user

**Success Response** (HTTP 200):

```json
{
  "summary": "Experienced software developer with strong expertise in React and Node.js. Demonstrates excellent problem-solving skills and a passion for creating innovative web applications.",
  "keyStrengths": [
    "Strong technical skills in React and Node.js",
    "Excellent portfolio showcasing real-world projects",
    "Clear communication in project descriptions"
  ],
  "areasToImprove": [
    "Add more detailed project descriptions",
    "Include links to live projects",
    "Expand skill set with testing frameworks"
  ],
  "recommendedTags": [
    "Full-Stack Developer",
    "React Expert",
    "Node.js Specialist",
    "Web Development"
  ],
  "profileScore": 75,
  "analyzedAt": "2025-01-15T10:30:00.000Z"
}
```

**Error Responses**:

- **400 Bad Request**: Invalid request
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User is not a talent
- **429 Too Many Requests**: Rate limit exceeded
- **503 Service Unavailable**: AI service unavailable or timeout

### GET /ai/profile-analysis

**HTTP Method**: `GET`

**URL**: `/ai/profile-analysis`

**Authentication**: Required (JWT Bearer token)

**Description**: Retrieves the most recent profile analysis without triggering a new analysis.

**Success Response** (HTTP 200): Same structure as POST response

**Error Responses**:

- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User is not a talent
- **404 Not Found**: No analysis found for this talent

---

## 8. iOS Integration Notes

### Which Screen Uses This Endpoint

- **Talent Profile Screen**: The primary screen where talents can request profile analysis
- Likely has a button or section titled "AI Profile Insights" or "Analyze my profile"

### What the UI Does While Waiting

- **Loading State**: The UI should display a loading indicator (spinner/progress bar)
- **Disabled Actions**: The analyze button should be disabled to prevent duplicate requests
- **User Feedback**: A message like "Analyzing your profile..." can be shown

### How the Result is Displayed

The UI should display the following sections:

1. **Profile Score**: 
   - Visual representation (progress bar, circular progress, or numerical display)
   - Often shown prominently at the top

2. **Summary**: 
   - Text block displaying the `summary` field
   - Usually 3-4 lines of text

3. **Key Strengths**: 
   - List or cards showing each strength
   - Often with checkmark icons or positive styling

4. **Areas to Improve**: 
   - List or cards showing each improvement suggestion
   - Often with warning icons or actionable styling

5. **Recommended Tags**: 
   - Chip/badge layout showing tags
   - May be used for filtering or matching

6. **Analysis Timestamp**: 
   - Display "Analyzed on [date]" using `analyzedAt` field

### How Caching of Last Analysis is Handled

**Backend Caching**:
- The backend automatically caches analysis results in MongoDB
- Cache is keyed by `talentId` and `profileHash`
- Cache is valid for 24 hours if profile hasn't changed

**Client-Side Considerations**:
- The app can call `GET /ai/profile-analysis` to retrieve the latest cached analysis
- No need to trigger a new analysis if one exists and is recent
- When profile changes significantly (skills, projects, CV), a new analysis should be requested

**Best Practices**:
- Show cached analysis immediately when opening the profile screen
- Allow manual refresh to trigger a new analysis
- Display cache age to users ("Last analyzed 2 hours ago")
- Automatically refresh if analysis is older than 24 hours

---

## 9. Limitations & Future Improvements

### Known Limitations

1. **Performance**:
   - Analysis can take 10-30 seconds depending on AI provider and model size
   - CV extraction adds additional processing time for large PDFs
   - No background processing: analysis is synchronous

2. **Rate Limiting**:
   - Currently limited to 5 analyses per day per user (in-memory, not persistent)
   - Rate limit is reset on server restart

3. **CV Support**:
   - Only PDF format is supported (DOC/DOCX not implemented)
   - Large PDFs may be truncated to 3000 characters

4. **Model Size**:
   - Smaller local models (like llama3.1) may produce less nuanced analysis
   - Larger models require more resources and longer processing times

5. **Error Handling**:
   - If AI provider is down, no fallback analysis is available
   - Failed analyses are not stored (user must retry)

6. **Token Limits**:
   - Very large profiles (many projects, long CVs) may hit token limits
   - Text is truncated, which may lose some context

### How the Analysis Could Later be Reused

1. **Mission Fit Scoring**:
   - Already used by Best Match missions feature
   - `recommendedTags` and `keyStrengths` are used to compute mission compatibility

2. **Statistics Dashboard**:
   - Aggregate analysis scores across all talents
   - Track profile improvement over time (comparison between analyses)

3. **Recommendations**:
   - Use `areasToImprove` to generate actionable recommendations
   - Suggest skills to add based on `recommendedTags`

4. **Recruiter Insights**:
   - Allow recruiters to see talent profile scores (with permission)
   - Help recruiters understand talent profile completeness

5. **Automated Alerts**:
   - Notify talents when their profile score improves
   - Remind talents to update their profile if score is low

6. **A/B Testing**:
   - Test different prompt formulations
   - Compare analysis quality across AI providers

7. **Historical Tracking**:
   - Store analysis history to track profile evolution
   - Show trends (score over time, strengths that changed)

---

## 10. Technical Notes

### Dependencies

- **MongoDB**: Stores analysis results in `ProfileAnalysis` collection
- **pdf-parse**: Node.js library for extracting text from PDF files
- **Ollama** (optional): Local AI provider
- **Google Generative AI SDK** (optional): For Gemini provider

### Database Schema

**ProfileAnalysis Collection**:
```typescript
{
  talentId: string (indexed),
  summary: string,
  keyStrengths: string[],
  areasToImprove: string[],
  recommendedTags: string[],
  profileScore: number (0-100),
  profileHash: string,  // SHA-256 hash of profile data
  createdAt: Date (indexed),
  updatedAt: Date
}
```

**Indexes**:
- `{ talentId: 1, createdAt: -1 }`: For efficient lookup of latest analysis per talent

---

## 11. Troubleshooting

### Common Issues

1. **"AI service is not available"**:
   - Check that Ollama server is running (`ollama serve`)
   - Verify `AI_PROVIDER` and `AI_LOCAL_URL` in `.env`
   - Check network connectivity to AI endpoint

2. **"Rate limit exceeded"**:
   - User has exceeded 5 analyses per day
   - Wait 24 hours or restart backend (clears in-memory rate limit)

3. **"Analysis takes too long"**:
   - Increase `AI_TIMEOUT` in `.env`
   - Consider using a faster model or provider
   - Check AI provider performance

4. **"CV text not extracted"**:
   - Verify CV file exists at path specified in `cvUrl`
   - Check file format (PDF only)
   - Review logs for extraction errors

5. **"Invalid JSON response"**:
   - AI model may not be following JSON format instructions
   - Check AI provider logs
   - Consider using a different model

---

**End of Documentation**

