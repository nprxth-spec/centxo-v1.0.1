# API Endpoints Documentation

## Base URL
```
Development: http://localhost:9002/api
Production: https://your-domain.com/api
```

## Authentication
All endpoints (except OAuth callbacks) require NextAuth session authentication.

---

## Meta Connection Endpoints

### GET /api/meta/connect
Initialize Facebook OAuth flow.

**Response:**
```json
{
  "authUrl": "https://www.facebook.com/v21.0/dialog/oauth?client_id=..."
}
```

**Example:**
```javascript
const response = await fetch('/api/meta/connect');
const { authUrl } = await response.json();
window.location.href = authUrl;
```

---

### GET /api/meta/callback
OAuth callback handler (called by Facebook).

**Query Parameters:**
- `code` (string, required): Authorization code
- `state` (string, required): User email

**Redirects to:**
- Success: `/settings/meta?success=true`
- Error: `/settings/meta?error={error_code}`

---

### GET /api/meta/select
Get ad accounts or pages.

**Query Parameters:**
- `type` (string, required): `accounts` or `pages`

**Response (accounts):**
```json
{
  "accounts": [
    {
      "id": "act_123456789",
      "name": "My Ad Account",
      "account_status": 1,
      "currency": "USD",
      "timezone_name": "Asia/Bangkok"
    }
  ]
}
```

**Response (pages):**
```json
{
  "pages": [
    {
      "id": "123456789",
      "name": "My Business Page",
      "access_token": "EAABwz...",
      "tasks": ["ADVERTISE", "ANALYZE", "CREATE_CONTENT"]
    }
  ]
}
```

---

### POST /api/meta/select
Save selected ad account and page.

**Request Body:**
```json
{
  "adAccountId": "act_123456789",
  "adAccountName": "My Ad Account",
  "pageId": "123456789",
  "pageName": "My Business Page",
  "pageAccessToken": "EAABwz..."
}
```

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `400`: Missing required fields
- `401`: Unauthorized
- `500`: Server error

---

## Campaign Launch Endpoints

### GET /api/launch
Check if user is ready to launch campaigns.

**Response:**
```json
{
  "ready": true,
  "checks": {
    "metaConnected": true,
    "adAccountSelected": true,
    "pageSelected": true
  },
  "metaAccount": {
    "adAccountName": "My Ad Account",
    "pageName": "My Business Page"
  }
}
```

---

### POST /api/launch
Create and launch a new Messages campaign.

**Request Body:**
```json
{
  "videoPath": "/uploads/video.mp4",
  "pageId": "123456789",
  "numberOfAds": 5,
  "campaignName": "Summer Sale 2024",
  "dailyBudget": 20,
  "productContext": "Fitness coaching program for busy professionals"
}
```

**Response (Success):**
```json
{
  "success": true,
  "campaign": {
    "id": "clx123abc",
    "name": "Summer Sale 2024",
    "metaCampaignId": "120205123456789",
    "status": "ACTIVE",
    "numberOfAds": 5
  },
  "ads": [
    {
      "id": "clx456def",
      "metaAdId": "120205987654321",
      "primaryTextTH": "🎁 โปรโมชั่นพิเศษ!...",
      "primaryTextEN": "🎁 Special Promotion!..."
    }
  ]
}
```

**Response (Error):**
```json
{
  "error": "Failed to launch campaign",
  "message": "Meta API Error: Invalid OAuth access token",
  "details": "..."
}
```

**Status Codes:**
- `201`: Campaign created successfully
- `400`: Validation error or missing Meta connection
- `401`: Unauthorized
- `500`: Server error

**Process:**
1. Validate session and Meta connection
2. Upload video to Meta
3. Create campaign (PAUSED)
4. Create ad set with Thailand targeting
5. Generate N ad copies with AI
6. Create N ad creatives
7. Create N ads
8. Activate campaign and all ads
9. Log audit trail

---

## Campaign Management Endpoints

### GET /api/campaigns
List all campaigns for authenticated user.

**Response:**
```json
{
  "campaigns": [
    {
      "id": "clx123abc",
      "name": "Summer Sale 2024",
      "status": "ACTIVE",
      "objective": "MESSAGES",
      "dailyBudget": 20,
      "createdAt": "2024-12-24T10:00:00.000Z",
      "metrics": {
        "spend": 15.50,
        "messages": 12,
        "costPerMessage": 1.29
      },
      "adsCount": {
        "total": 5,
        "active": 3
      }
    }
  ],
  "total": 1
}
```

---

### GET /api/campaigns/[id]
Get campaign details with ads and insights.

**Response:**
```json
{
  "campaign": {
    "id": "clx123abc",
    "name": "Summer Sale 2024",
    "status": "ACTIVE",
    "objective": "MESSAGES",
    "dailyBudget": 20,
    "createdAt": "2024-12-24T10:00:00.000Z",
    "videoPath": "/uploads/video.mp4"
  },
  "ads": [
    {
      "id": "clx456def",
      "metaAdId": "120205987654321",
      "status": "ACTIVE",
      "isWinner": true,
      "creative": {
        "primaryTextTH": "🎁 โปรโมชั่นพิเศษ!...",
        "primaryTextEN": "🎁 Special Promotion!...",
        "headlineTH": "สอบถามเลย รับส่วนลด",
        "headlineEN": "Ask Now Get Discount"
      },
      "metrics": {
        "spend": 12.50,
        "messages": 8,
        "costPerMessage": 1.56
      },
      "createdAt": "2024-12-24T10:00:00.000Z"
    }
  ],
  "insights": [
    {
      "date": "2024-12-24T00:00:00.000Z",
      "spend": 15.50,
      "messages": 12,
      "costPerMessage": 1.29
    }
  ],
  "summary": {
    "totalAds": 5,
    "activeAds": 3,
    "winners": 1,
    "totalSpend": 45.80,
    "totalMessages": 35
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `403`: Forbidden (not campaign owner)
- `404`: Campaign not found
- `500`: Server error

---

### PATCH /api/campaigns/[id]
Update campaign status.

**Request Body:**
```json
{
  "action": "pause"  // or "resume", "archive"
}
```

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "clx123abc",
    "status": "PAUSED"
  }
}
```

**Status Codes:**
- `200`: Updated successfully
- `400`: Invalid action
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Campaign not found
- `500`: Server error

---

## Ad Management Endpoints

### PATCH /api/ads/[id]
Update ad status.

**Request Body:**
```json
{
  "action": "pause"  // or "resume"
}
```

**Response:**
```json
{
  "success": true,
  "ad": {
    "id": "clx456def",
    "status": "PAUSED"
  }
}
```

**Status Codes:**
- `200`: Updated successfully
- `400`: Invalid action
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Ad not found
- `500`: Server error

---

## Automation Endpoints

### POST /api/cron/optimize
Run campaign optimization (called by cron service).

**Headers:**
```
Authorization: Bearer {CRON_SECRET}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-12-24T10:15:00.000Z",
  "duration": 5432,
  "accountsProcessed": 3,
  "results": [
    {
      "metaAccountId": "clx789ghi",
      "userId": "clx111abc",
      "campaignsOptimized": 2,
      "results": [
        {
          "campaignId": "clx123abc",
          "actions": [
            {
              "entityType": "Ad",
              "entityId": "clx456def",
              "action": "PAUSE",
              "reason": "Spent $8.00 with 0 messages",
              "metadata": {
                "spend": 8.0,
                "messages": 0
              }
            }
          ],
          "summary": "Paused 2 ads, 0 campaigns, marked 1 winners"
        }
      ]
    }
  ]
}
```

**Status Codes:**
- `200`: Optimization completed
- `401`: Unauthorized (invalid CRON_SECRET)
- `500`: Server error

---

### GET /api/cron/optimize
Health check and stats.

**Headers:**
```
Authorization: Bearer {CRON_SECRET}
```

**Response:**
```json
{
  "status": "healthy",
  "stats": {
    "activeCampaigns": 5,
    "last24Hours": {
      "decisions": [
        {
          "action": "PAUSE",
          "_count": 12
        },
        {
          "action": "MARK_WINNER",
          "_count": 3
        }
      ],
      "auditLogs": 48
    }
  },
  "config": {
    "warmupHours": "3",
    "maxSpendNoMessages": "5",
    "costThresholdMultiplier": "1.5",
    "minMessagesForWinner": "3"
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "details": "Stack trace or additional info (dev only)"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

---

## Rate Limiting

Meta API has rate limits:
- **200 calls per hour** per user access token
- **4,800 calls per hour** per app

Our app handles this by:
1. Batch requests when possible
2. Caching insights data
3. Exponential backoff on rate limit errors
4. Graceful degradation

---

## Webhooks (Future)

For real-time updates, consider setting up Meta webhooks:
- Campaign status changes
- Ad delivery issues
- Budget alerts

---

## Testing

### Development Testing
```bash
# Test Meta connection
curl http://localhost:9002/api/meta/connect

# Test campaign launch
curl -X POST http://localhost:9002/api/launch \
  -H "Content-Type: application/json" \
  -d '{"videoPath":"/test.mp4","pageId":"123","numberOfAds":3}'

# Test cron job
curl -X POST http://localhost:9002/api/cron/optimize \
  -H "Authorization: Bearer your_cron_secret"
```

### Production Testing
Use Postman or similar tools with proper authentication cookies.

---

## Best Practices

1. **Always check `ready` status** before launching campaigns
2. **Handle token expiry** gracefully
3. **Log all Meta API calls** for debugging
4. **Monitor rate limits** and implement backoff
5. **Use batch endpoints** when fetching multiple insights
6. **Cache data appropriately** to reduce API calls

---

## Support

For issues or questions:
- Check logs in `DecisionLog` and `AuditLog` tables
- Review Meta API error codes: https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling
- Check Meta Business Help Center
