# Code Quality Audit - Notification System

**Date:** 2026-03-24
**Branch:** feat/notifications
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## 🔴 Critical Issues

### 1. **Missing Custom Tone Upload Endpoint**
**Severity:** HIGH
**File:** `backend/src/hotels/hotels.controller.ts`
**Issue:** No POST endpoint exists to upload custom MP3 files to S3 for notification tones.

**Current State:**
- HotelDetails has UI for custom tone upload
- Hotel model has `customToneUrl` field
- S3 service exists but no upload endpoint

**Fix Needed:**
```typescript
@Post(':id/notification-tone')
async uploadNotificationTone(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @CurrentAccount() account: Account
) {
  // Validate file is MP3
  // Upload to S3
  // Update hotel.customToneUrl
  // Return S3 URL
}
```

---

### 2. **Missing Error Handling in Notification Factory**
**Severity:** MEDIUM
**File:** `backend/src/notifications/notification.factory.ts:146`

```typescript
catch (error) {
  console.error(`Failed to create/emit notifications: ${error.message}`);
}
```

**Issues:**
- Uses `console.error` instead of logger service
- Error message lacks context (which hotel, which accounts)
- Silently swallows error - no retry mechanism

**Fix:**
```typescript
catch (error) {
  this.logger.error(`Failed to create/emit notifications for hotel ${hotelId}:`, error);
  // Could implement retry logic or alert admins
}
```

---

### 3. **Type Safety Issues - Using `as any`**
**Severity:** MEDIUM
**File:** `frontend/src/notifications/hooks/useNotifications.ts:29`

```typescript
const data = await (request as any)({...});
```

**Issue:** Uses `as any` which defeats TypeScript protection. Should type the request function properly.

---

### 4. **Silent Error Handling in Audio Playback**
**Severity:** LOW-MEDIUM
**File:** `frontend/src/notifications/hooks/useNotifications.ts:63-66`

```typescript
catch (error) {
  // Silently fail - could be browser autoplay policy or muted site
  // This is expected and not an error to log
}
```

**Issues:**
- Acceptable for autoplay policy failures, but **other errors are masked**
- No distinction between expected failures and real errors
- Makes debugging difficult

**Better approach:**
```typescript
catch (error) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    // Expected: autoplay blocked
    return;
  }
  console.warn('Unexpected audio error:', error);
}
```

---

### 5. **Untyped WebSocket Event Handler**
**Severity:** MEDIUM
**File:** `backend/src/notifications/notifications.gateway.ts:74, 86`

```typescript
emitToAccount(accountId: number, notificationData: any) {
  ...
}

emitToAccounts(accountIds: number[], notificationData: any) {
  ...
}
```

**Issue:** `notificationData: any` removes type safety. Should use `NotificationPayload` type.

---

### 6. **Console Logging Instead of Logger Service**
**Severity:** LOW
**Files:**
- `frontend/src/notifications/hooks/useNotifications.ts:38` - `console.error`
- `backend/src/notifications/notification.factory.ts:146` - `console.error`
- `backend/src/notifications/notifications.gateway.ts` - Uses `this.logger` ✅ (correct)

**Issue:** Inconsistent logging practices. Should use NestJS Logger service everywhere.

---

## 🟡 Medium Issues

### 7. **No Validation on Notification Tone Upload**
**Severity:** MEDIUM
**File:** `backend/src/hotels/hotels.service.ts`

**Missing:**
- File type validation (only MP3 allowed)
- File size validation (configured as 5MB max in constants but not enforced)
- S3 ACL/permissions verification

---

### 8. **Empty Hotel Staff Returns No Error**
**Severity:** LOW-MEDIUM
**File:** `backend/src/notifications/notification.factory.ts:115`

```typescript
if (accountIds.length === 0) return;
```

**Issue:** Silently skips notification when no hotel staff found. Should:
- Log this as a warning
- Alert admin that no staff are configured
- Or send notification only to hotel owner

---

### 9. **Missing Tests**
**Severity:** MEDIUM
**Issue:** No unit tests for notification system:
- No tests for notification factory
- No tests for gateway connection/disconnect
- No tests for tone URL resolution
- No tests for useNotifications hook

---

### 10. **Unused Variables in App.js**
**Severity:** LOW
**File:** `frontend/src/App.js:103`

```typescript
const { unreadCount, notifications, loading: notificationsLoading, markAsRead } = useNotifications({...});
// Later only unreadCount is used, others unused
```

**Better:**
```typescript
const { unreadCount } = useNotifications({...}); // Only destructure what's used
```

---

## 🟢 Good Practices

✅ **Proper error handling in notifications gateway** - Uses logger service, clear error messages
✅ **Type safety in notification models** - Well-defined interfaces (NotificationPayload)
✅ **Account isolation** - Non-admin users can't access other hotels
✅ **WebSocket security** - JWT token validation on connection
✅ **Memory management** - Socket cleanup on disconnect, account connections map management
✅ **Null checks** - Proper validation in getHotelStaffAccountIds

---

## 📋 Priority Fixes Checklist

- [ ] **CRITICAL:** Add POST endpoint for custom tone upload to S3
- [ ] **HIGH:** Replace console.error with logger service (backend)
- [ ] **HIGH:** Add file type/size validation for tone uploads
- [ ] **MEDIUM:** Type notification data parameters (remove `any`)
- [ ] **MEDIUM:** Improve error handling in playNotificationTone
- [ ] **MEDIUM:** Add console logging condition checks
- [ ] **LOW:** Remove unused destructured variables
- [ ] **LOW:** Add unit tests for notification system

---

## Summary

**Overall Code Quality:** 7/10

**Strengths:**
- Good error handling in gateways
- Proper security (JWT, account isolation)
- Clean separation of concerns
- WebSocket connection management

**Weaknesses:**
- Missing custom tone upload endpoint (major feature)
- Inconsistent logging practices
- Some error handling silences real issues
- No type safety in some areas
- No tests

**Recommendation:** Fix critical issues before merging to main. The missing upload endpoint is a feature blocker.
