# AI Best Match Missions - Documentation

## 1. Overview

### What "Best Match" Means

**Best Match** is an AI-powered feature that automatically ranks and recommends mission opportunities for talents based on how well their profile aligns with each mission's requirements. The system uses AI to evaluate the compatibility between a talent's profile (from their AI profile analysis) and available missions, assigning a match score (0-100) and reasoning for each match.

### When It Is Used

- **Missions Screen → Best Match Tab**: For talents, a dedicated "Best Match" tab displays missions ranked by AI-computed match scores
- **Real-time Updates**: Rankings are refreshed when the talent's profile changes or when new missions are added
- **Cached Results**: Rankings are cached for 12 hours to improve performance and reduce AI API calls

### High-Level Idea

The Best Match feature **reuses the AI profile analysis** data to compute mission compatibility:

1. **Profile Analysis Data**: Uses the talent's latest profile analysis (summary, keyStrengths, recommendedTags)
2. **Mission Data**: Evaluates each mission's title, description, required skills, duration, and budget
3. **AI Matching**: Calls the AI service to compare profile vs. mission and generate a match score + reasoning
4. **Ranking**: Sorts missions by match score (highest first) and returns top 20 matches
5. **Caching**: Stores rankings in database with 12-hour expiration to avoid recomputing on every request

---

## 2. Architecture

### Which Backend Modules/Services Are Used

1. **`BestMatchService`** (`src/missions/services/best-match.service.ts`)
   - Core service for computing and caching mission rankings
   - Handles AI calls for mission scoring
   - Manages cache lifecycle (12-hour TTL)

2. **`MissionsController`** (`src/missions/missions.controller.ts`)
   - HTTP endpoint: `GET /missions/best-match`
   - Authentication and authorization (talent-only)
   - Returns ranked missions list

3. **`ProfileAnalysisService`** (`src/ai/services/profile-analysis.service.ts`)
   - Retrieves the latest profile analysis for a talent
   - Provides data needed for mission matching (summary, strengths, tags)

4. **`AiService`** (`src/ai/services/ai.service.ts`)
   - Generic AI provider abstraction (same as profile analysis)
   - Routes to Ollama or Gemini based on configuration
   - Handles JSON response parsing

5. **`MissionsService`** (`src/missions/missions.service.ts`)
   - Not directly used, but missions data comes from `Mission` schema

### How the AI Provider is Reused

The Best Match feature uses the **exact same AI service layer** as profile analysis:

- **Same Configuration**: Uses `AI_PROVIDER`, `AI_LOCAL_URL`, `AI_MODEL` environment variables
- **Same Service Instance**: Shares `AiService` singleton across both features
- **Same Provider Support**: Works with Ollama (local) or Gemini (cloud)
- **Consistent Error Handling**: Same timeout and retry logic

### How Caching or Background Recomputation Works

#### Caching Strategy

1. **Cache Storage**: Rankings are stored in MongoDB `MissionRankingCache` collection
2. **Cache Key**: `talentId` + expiration check
3. **Cache Duration**: 12 hours (configurable via `CACHE_DURATION_HOURS` constant)
4. **Cache Structure**: Stores full mission data + match scores + reasoning

#### Background Recomputation

1. **Lazy Loading**: When a talent requests best matches:
   - First checks cache for valid rankings
   - If cache exists and valid: returns immediately
   - If cache missing or expired: triggers background refresh

2. **Non-Blocking**: If cache is missing, the system:
   - Returns empty array immediately (no blocking)
   - Triggers `refreshRankings()` asynchronously in background
   - Next request will have cached results

3. **Cache Invalidation**: Cache expires automatically after 12 hours (TTL index in MongoDB)

---

## 3. Data Used for Matching

### What We Use from the Talent Side

From the talent's latest **profile analysis** (stored in `ProfileAnalysis` collection):

1. **`summary`**: Profile summary text (3-4 lines)
   - Provides context about talent's background and expertise
   
2. **`keyStrengths`**: Array of strengths (e.g., ["React expertise", "Strong portfolio"])
   - Highlights talent's main capabilities
   
3. **`recommendedTags`**: Array of tags/keywords (e.g., ["Full-Stack Developer", "React Expert"])
   - Used for skill and domain matching

**Note**: If no profile analysis exists for the talent, the Best Match endpoint returns an empty array (analysis must be run first).

### What We Use from the Mission Side

From each **mission document** (`Mission` schema):

1. **`title`**: Mission title (e.g., "Développeur Full Stack React/Node.js")
   - Key indicator of mission type and requirements

2. **`description`**: Full mission description
   - Detailed requirements and context
   - No truncation applied (sent as-is to AI)

3. **`skills`**: Array of required skills (e.g., ["React", "Node.js", "TypeScript"])
   - Critical for matching talent skills to mission needs

4. **`duration`**: Mission duration (e.g., "6 mois")
   - Provides context but not heavily weighted in matching

5. **`budget`**: Budget amount (e.g., 50000)
   - Included for context but not used for matching logic

### Any Constraints on Data Size

- **No Description Truncation**: Mission descriptions are sent to AI in full (no length limit)
- **Prompt Size**: Large prompts may hit AI provider token limits (handled by provider)
- **Batch Processing**: Missions are scored in batches of 5 (configurable `CONCURRENCY_LIMIT`) to avoid overwhelming the AI service
- **Reasoning Truncation**: AI-generated reasoning is limited to 200 characters for storage efficiency

---

## 4. Ranking Logic (Step by Step)

### How We Go from Talent → List of Missions → Match Scores

#### Step 1: Load Profile Analysis

1. **Query Latest Analysis**: 
   - Calls `ProfileAnalysisService.findLatestByTalentId(talentId)`
   - Retrieves the most recent analysis document

2. **Validate Analysis Exists**:
   - If no analysis found: logs warning and returns empty array
   - User must run profile analysis first

3. **Extract Profile Data**:
   - `summary`: Full text
   - `keyStrengths`: Joined into comma-separated string
   - `recommendedTags`: Joined into comma-separated string

#### Step 2: Load All Missions

1. **Query All Missions**:
   - Calls `MissionModel.find().exec()`
   - Retrieves all active missions from database

2. **Handle Empty Missions**:
   - If no missions: returns empty array immediately

#### Step 3: Score All Missions Using AI

1. **Batch Processing**:
   - Missions are processed in batches of 5 (to avoid overwhelming AI)
   - For each batch: `Promise.all()` runs scoring in parallel

2. **For Each Mission** (`scoreSingleMission()`):
   - Builds ranking prompt with:
     - Talent profile data (summary, strengths, tags)
     - Mission data (title, description, skills, duration, budget)
   - Calls `AiService.generateJsonContent()` with ranking prompt
   - Extracts `matchScore` (0-100) and `reasoning` (text explanation)
   - Validates response structure
   - Creates `BestMatchMission` object

3. **Error Handling**:
   - If AI call fails for a mission: logs error and returns `null` (mission is skipped)
   - Failed missions are filtered out (don't appear in results)

#### Step 4: Sort and Limit Results

1. **Sorting**:
   - All scored missions are sorted by `matchScore` (descending)
   - Highest scores appear first

2. **Limiting**:
   - Top 20 missions are selected (`.slice(0, 20)`)
   - Configurable via constant `MAX_MISSIONS = 20` (if exists)

3. **Minimum Score Filter**:
   - Currently, all missions are included regardless of score
   - Future: could filter out missions with score < threshold (e.g., < 30)

#### Step 5: Cache Results

1. **Cache Storage**:
   - Old cache entries for this talent are deleted
   - New cache entry is created with:
     - `talentId`
     - `rankings`: Array of mission rankings (full mission data + scores)
     - `expiresAt`: Current time + 12 hours

2. **Database Persistence**:
   - Saved to `MissionRankingCache` collection
   - TTL index automatically deletes expired entries

### How the AI is Called to Evaluate Mission vs Profile

#### Prompt Structure

The ranking prompt includes:

1. **Role Definition**: "You are an expert recruiter matching talents with mission opportunities."

2. **Talent Profile Section**:
   ```
   === TALENT PROFILE ===
   Summary: [profile summary]
   Key Strengths: [comma-separated strengths]
   Recommended Tags: [comma-separated tags]
   ```

3. **Mission Section**:
   ```
   === MISSION ===
   Title: [mission title]
   Description: [full description]
   Skills Required: [comma-separated skills]
   Duration: [duration]
   Budget: [budget] €
   ```

4. **Instructions**:
   - Request JSON response with `matchScore` (0-100) and `reasoning` (1-2 lines)
   - Guidelines for scoring:
     - Higher scores for strong skill matches and relevant experience
     - Lower scores for weak/no skill matches or irrelevant experience
   - Instructions to be specific and professional

#### AI Response Format

Expected JSON:
```json
{
  "matchScore": 85,
  "reasoning": "Strong match: Your React and Node.js experience aligns perfectly with the mission requirements."
}
```

### What Fields the AI Returns for Each Mission

1. **`matchScore`** (number, 0-100):
   - Indicates compatibility between talent and mission
   - Validated and clamped to 0-100 range
   - Higher = better match

2. **`reasoning`** (string):
   - Short explanation (1-2 lines) of why this is a good or poor match
   - Truncated to 200 characters for storage
   - Helps users understand the match

### How Missions are Sorted and Limited

1. **Sorting**: 
   - `scoredMissions.sort((a, b) => b.matchScore - a.matchScore)`
   - Descending order (highest score first)

2. **Limiting**:
   - `.slice(0, 20)` - Top 20 missions only
   - Prevents overwhelming users with too many results
   - Improves performance (fewer items to cache/return)

### How We Handle Cases with Few or No Relevant Missions

1. **No Missions in Database**:
   - Returns empty array immediately
   - No AI calls made

2. **No Profile Analysis**:
   - Returns empty array
   - Logs warning: "No profile analysis found for talent [id]. Cannot compute best matches."

3. **All Missions Score Low**:
   - All missions are still returned (no minimum score threshold)
   - Sorted by score (best available matches first)
   - Future: could filter out scores < threshold (e.g., 30)

4. **Few Missions Available**:
   - Returns all available missions (even if < 20)
   - No padding or dummy results

5. **AI Failures**:
   - Failed missions are skipped (not included in results)
   - If all missions fail: returns empty array
   - Partial failures: returns successfully scored missions

---

## 5. Caching & Performance

### When Rankings are Recomputed

1. **Cache Miss**: When no valid cache exists for the talent
2. **Cache Expired**: When cache is older than 12 hours
3. **Background Trigger**: When cache is missing, refresh is triggered asynchronously
4. **Manual Refresh**: Not currently supported via API (could be added)

**Note**: Rankings are **not** automatically recomputed when:
- New missions are added (cache remains valid)
- Mission details are updated (cache remains valid)
- Talent profile changes (cache remains valid until expiration)

### How Long They are Cached

- **Cache Duration**: 12 hours (hardcoded in `CACHE_DURATION_HOURS` constant)
- **TTL Index**: MongoDB TTL index automatically deletes expired cache entries
- **Cache Key**: Based on `talentId` (one cache entry per talent)

### How We Avoid Calling AI on Every Single Request

1. **Cache-First Strategy**:
   - Every request checks cache first
   - If valid cache exists: returns immediately (no AI calls)
   - Only triggers AI calls when cache is missing/expired

2. **Background Processing**:
   - When cache is missing, refresh runs in background (non-blocking)
   - First request returns empty array
   - Subsequent requests (after refresh completes) get cached results

3. **Batch Scoring**:
   - Missions are scored in batches of 5 (parallel processing)
   - Reduces total time but still requires multiple AI calls

4. **Error Tolerance**:
   - Failed AI calls don't block entire refresh
   - Partial results are cached (successful scores only)

### How Failures are Handled (Fallback Behavior if AI is Down)

1. **Cache Fallback**:
   - If AI is unavailable but valid cache exists: returns cached results
   - Cache may be expired but still useful

2. **Empty Array**:
   - If AI is unavailable and no cache: returns empty array
   - User sees no matches (graceful degradation)

3. **Error Logging**:
   - All AI failures are logged for monitoring
   - Errors don't crash the service

4. **Partial Results**:
   - If some missions score successfully but others fail: returns successful ones
   - No all-or-nothing behavior

5. **No Retries**:
   - Currently, failed AI calls are not retried
   - Future: could add retry logic for transient failures

---

## 6. API Contract

### HTTP Method and URL

**Method**: `GET`

**URL**: `/missions/best-match`

**Full Path**: `http://localhost:3000/missions/best-match` (or your backend URL)

### Auth Requirement

- **Required**: Yes (JWT Bearer token)
- **Role**: Talent only (`Roles('talent')`)
- **Guards**: `JwtAuthGuard` + `RolesGuard`

### Query Params

Currently, **no query parameters** are supported. Future enhancements could include:
- `limit`: Override default limit of 20
- `minScore`: Filter out missions below threshold
- `refresh`: Force cache refresh

### Response Structure

**Success Response** (HTTP 200):

```json
{
  "missions": [
    {
      "missionId": "673ab2c3e8f9a1234567890c",
      "title": "Développeur Full Stack React/Node.js",
      "description": "Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe.",
      "duration": "6 mois",
      "budget": 50000,
      "skills": ["React", "Node.js", "TypeScript", "MongoDB"],
      "recruiterId": "673ab2c3e8f9a1234567890b",
      "matchScore": 85,
      "reasoning": "Strong match: Your React and Node.js experience aligns perfectly with the mission requirements."
    },
    {
      "missionId": "673ab2c3e8f9a1234567890d",
      "title": "Designer UX/UI",
      "description": "Recherche d'un designer UX/UI créatif pour notre équipe produit.",
      "duration": "3 mois",
      "budget": 35000,
      "skills": ["Figma", "Adobe XD", "User Research"],
      "recruiterId": "673ab2c3e8f9a1234567890e",
      "matchScore": 45,
      "reasoning": "Partial match: Some relevant skills, but mission focuses on design rather than development."
    }
  ]
}
```

**Response Fields**:

- **`missions`** (array): List of ranked missions (max 20)
  - **`missionId`** (string): MongoDB mission ID
  - **`title`** (string): Mission title
  - **`description`** (string): Full mission description
  - **`duration`** (string): Mission duration
  - **`budget`** (number): Budget amount
  - **`skills`** (array of strings): Required skills
  - **`recruiterId`** (string): Recruiter who posted the mission
  - **`matchScore`** (number, 0-100): AI-computed match score
  - **`reasoning`** (string): Short explanation of the match (max 200 chars)

### Error Responses

1. **401 Unauthorized**:
   ```json
   {
     "statusCode": 401,
     "message": "Unauthorized"
   }
   ```
   - Missing or invalid JWT token

2. **403 Forbidden**:
   ```json
   {
     "statusCode": 403,
     "message": "Access denied for role: recruiter",
     "error": "Forbidden"
   }
   ```
   - User is not a talent (recruiters cannot access this endpoint)

3. **Empty Array** (HTTP 200):
   ```json
   {
     "missions": []
   }
   ```
   - No profile analysis found
   - No missions in database
   - Cache refresh in progress (first request)

### Behavior When AI is Unavailable

- **If Valid Cache Exists**: Returns cached results (even if slightly expired)
- **If No Cache**: Returns empty array `{ "missions": [] }`
- **No Error Response**: AI unavailability doesn't trigger an error (graceful degradation)
- **Background Refresh Fails Silently**: Logs error but doesn't affect response

---

## 7. iOS & Android Integration Notes

### How Missions Screen Consumes the Best Match Endpoint

#### iOS Implementation

**Service Layer** (`MissionService.swift`):
```swift
func getBestMatchMissions() async throws -> BestMatchMissionsResponse {
    return try await ApiClient.shared.get(
        url: Endpoints.bestMatchMissions,  // "/missions/best-match"
        requiresAuth: true
    )
}
```

**Endpoint Definition** (`Endpoints.swift`):
```swift
static let bestMatchMissions = apiBase + "/missions/best-match"
```

**ViewModel** (`MissionListViewModel.swift`):
- `@Published var bestMatchMissions: [BestMatchMissionModel] = []`
- `@Published var isLoadingBestMatches: Bool = false`
- `loadBestMatches()` function calls service and updates state

#### Android Implementation

Similar pattern:
- API client calls `GET /missions/best-match`
- ViewModel manages state and loading indicators
- Response is parsed into `BestMatchMission` data models

### How the UI Displays Match Score and Reasoning

1. **Match Score Display**:
   - **Visual Indicator**: Progress bar, circular progress, or percentage badge
   - **Color Coding**: 
     - Green (80-100): Excellent match
     - Yellow (50-79): Good match
     - Red (0-49): Poor match
   - **Placement**: Often shown prominently (e.g., top-right corner of mission card)

2. **Reasoning Display**:
   - **Text Block**: Short explanation below mission details
   - **Expandable**: Could be hidden by default, expandable on tap
   - **Icon**: Info icon or explanation icon

3. **Mission Card Layout**:
   - Standard mission details (title, description, skills, budget)
   - Match score badge/indicator
   - Reasoning text (optional, expandable)

### What Happens When There are 0 Results

1. **Empty State UI**:
   - Shows message: "No matches found" or "We couldn't find any missions matching your profile"
   - Suggests actions:
     - "Run profile analysis" (if no analysis exists)
     - "Update your profile" (if analysis is old)
     - "Check back later" (if refresh in progress)

2. **Loading State**:
   - First request may show loading indicator
   - If empty array returned: switches to empty state

3. **Error Handling**:
   - Network errors: Show error message with retry button
   - API errors: Show user-friendly error message

### How This Integrates with Existing Tabs

The Best Match feature is typically part of a **tabbed interface**:

1. **Best Match Tab**:
   - Shows missions sorted by match score (highest first)
   - Displays match scores and reasoning
   - Updates when cache refreshes

2. **Most Recent Tab**:
   - Shows all missions sorted by creation date (newest first)
   - No match scores (standard mission list)

3. **Favorites Tab**:
   - Shows missions the talent has favorited
   - Could optionally show match scores here too

**Integration Points**:
- Tab switching doesn't trigger new API calls (data is cached in ViewModel)
- All tabs share the same mission data models
- Best Match tab is only visible for talents (hidden for recruiters)

---

## 8. Dependencies & Configuration

### Extra Environment Variables Specific to Best Match

Currently, **no Best Match-specific environment variables** exist. The feature uses the same AI configuration as profile analysis:

- `AI_PROVIDER`: Local (Ollama) or Gemini
- `AI_LOCAL_URL`: Ollama endpoint URL
- `AI_MODEL`: Model name (e.g., llama3.1)
- `AI_TIMEOUT`: Request timeout

**Future Configuration Options** (could be added):
- `BEST_MATCH_CACHE_HOURS`: Override default 12-hour cache duration
- `BEST_MATCH_MAX_RESULTS`: Override default limit of 20 missions
- `BEST_MATCH_MIN_SCORE`: Filter out missions below threshold
- `BEST_MATCH_BATCH_SIZE`: Override batch size of 5 missions

### Dependencies on Other Features

1. **Profile Analysis Must Be Available**:
   - Best Match requires a profile analysis to exist
   - If no analysis: returns empty array
   - User must run profile analysis first

2. **AI Service Must Be Configured**:
   - Same AI provider configuration as profile analysis
   - If AI is unavailable: falls back to cache or empty array

3. **Missions Must Exist**:
   - Requires active missions in database
   - No missions = empty array

4. **Database Collections**:
   - `Mission` collection: Source of mission data
   - `ProfileAnalysis` collection: Source of talent profile data
   - `MissionRankingCache` collection: Cache storage

### Module Dependencies

- **`AiModule`**: Exports `AiService` and `ProfileAnalysisService`
- **`MissionsModule`**: Imports `AiModule`, provides `BestMatchService`
- **`MongooseModule`**: Database access for `Mission` and `MissionRankingCache` schemas

---

## 9. Future Extensions

### Possible Evolution Toward Mission-Specific Analysis

1. **Detailed Match Breakdown**:
   - Skill-by-skill matching (which skills match, which are missing)
   - Experience level assessment
   - Budget alignment check

2. **Per-Mission Fit Score Components**:
   - Skill match: 40%
   - Experience match: 30%
   - Location/preferences: 20%
   - Budget alignment: 10%

3. **Recommendations per Mission**:
   - "Add these skills to improve your match"
   - "This mission is a great fit for your experience level"

### Use in Statistics, Recommendations, or Alerts

1. **Statistics Dashboard**:
   - Average match score across all missions
   - Number of high-match missions (>80 score)
   - Match score distribution histogram

2. **Recommendations**:
   - "Based on your profile, we recommend updating your skills to match high-scoring missions"
   - "You have 5 new missions matching your profile"

3. **Alerts**:
   - Notify talent when new high-match missions are posted
   - Alert when match scores change significantly
   - Remind talent to refresh analysis if match scores are consistently low

4. **Recruiter Insights**:
   - Show recruiters how many talents match their missions
   - Provide talent recommendations based on match scores

5. **A/B Testing**:
   - Test different prompt formulations
   - Compare scoring accuracy across AI providers
   - Optimize cache duration based on usage patterns

6. **Machine Learning Integration**:
   - Train ML model on successful matches (talent applied + got mission)
   - Improve scoring accuracy over time
   - Personalize rankings based on user behavior

---

## 10. Technical Notes

### Database Schema

**MissionRankingCache Collection**:
```typescript
{
  talentId: string (indexed),
  rankings: [
    {
      missionId: string,
      matchScore: number (0-100),
      reasoning: string (max 200 chars),
      // Cached mission data for faster retrieval:
      title?: string,
      description?: string,
      duration?: string,
      budget?: number,
      skills?: string[],
      recruiterId?: string
    }
  ],
  expiresAt: Date (indexed, TTL),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `{ talentId: 1, expiresAt: 1 }`: For efficient lookup of valid cache per talent
- `{ expiresAt: 1 }`: TTL index for automatic expiration (expireAfterSeconds: 0)

### Performance Considerations

1. **Batch Processing**: Missions are scored in batches of 5 to balance speed and API load
2. **Parallel Scoring**: Within each batch, missions are scored in parallel (Promise.all)
3. **Cache-First**: Most requests return cached data (no AI calls)
4. **Non-Blocking**: Cache refresh doesn't block request (async background process)

### Concurrency Limits

- **Batch Size**: 5 missions per batch (configurable `CONCURRENCY_LIMIT` constant)
- **Parallel Requests**: Up to 5 simultaneous AI calls per batch
- **Total Missions**: All missions are scored (no limit on total number)

### Error Handling

- **AI Failures**: Logged and skipped (mission excluded from results)
- **Cache Failures**: Returns empty array (graceful degradation)
- **Database Failures**: Throws exception (handled by NestJS error filters)

---

## 11. Troubleshooting

### Common Issues

1. **"No matches found" (empty array)**:
   - Check if profile analysis exists for talent
   - Verify missions exist in database
   - Check if cache refresh completed successfully
   - Review logs for AI errors

2. **"Matches are outdated"**:
   - Cache expires after 12 hours
   - Wait for automatic refresh or trigger manual refresh (if implemented)
   - Check cache expiration in database

3. **"Match scores seem inaccurate"**:
   - Verify AI model is appropriate for matching tasks
   - Check prompt quality in `buildRankingPrompt()`
   - Review profile analysis quality (garbage in = garbage out)

4. **"Best Match tab is slow"**:
   - First request may be slow if cache is missing (background refresh)
   - Subsequent requests should be fast (cached)
   - Check AI provider performance
   - Consider reducing batch size if AI is slow

5. **"AI errors in logs"**:
   - Verify AI service is available and configured correctly
   - Check AI provider logs (Ollama/Gemini)
   - Review timeout settings (may need to increase)

---

**End of Documentation**

