const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Checks if a user has exceeded the rate limit.
 * @param identifier Unique identifier for the user (e.g., user ID or IP)
 * @param maxRequests Maximum number of requests allowed within the window
 * @param windowMs Time window in milliseconds (default: 60000ms = 1 minute)
 * @returns true if allowed, false if limit exceeded
 */
export function checkRateLimit(
  identifier: string,
  maxRequests = 100,
  windowMs = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false; // Limit exceeded
  }

  record.count++;
  return true;
}
