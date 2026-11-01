package middleware

import (
	"os"
	"strings"
	"sync"
	"time"

	"andaya-erp/backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const authStatusCacheTTL = 30 * time.Second

type cachedAuthStatus struct {
	userActive  bool
	staffActive bool
	suspension  string
	expiresAt   time.Time
}

var authStatusCache sync.Map

// InvalidateAuthStatusCache immediately evicts all cached status entries for a given userID
// so account suspension or outlet reassignment takes effect on the very next HTTP request.
func InvalidateAuthStatusCache(userID string) {
	if userID == "" {
		return
	}
	authStatusCache.Range(func(key, _ interface{}) bool {
		if k, ok := key.(string); ok && strings.HasPrefix(k, userID+":") {
			authStatusCache.Delete(key)
		}
		return true
	})
}

func clearTokenCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Now().Add(-24 * time.Hour),
		HTTPOnly: true,
		Secure:   false,
		SameSite: "Lax",
		Path:     "/",
	})
}

// AuthGuard parses and validates JWT tokens from cookies or Authorization header
// and verifies live account status using a 30-second read-through in-memory cache.
func AuthGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var tokenString string

		// 1. Try to read from HTTP-Only cookie first (mitigates XSS)
		tokenString = c.Cookies("token")

		// 2. Fallback to Bearer Token in Authorization header (for mobile/API clients)
		if tokenString == "" {
			authHeader := c.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Missing authentication token",
			})
		}

		// Parse and validate token
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.ErrUnauthorized
			}
			return config.AppConfig.JWTSecret, nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Invalid or expired authentication token",
			})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Failed to parse token claims",
			})
		}

		// Extract claims and store in Locals for downstream use
		userID, _ := claims["user_id"].(string)
		role, _ := claims["role"].(string)
		businessID, _ := claims["business_id"].(string)
		outletID, _ := claims["outlet_id"].(string)

		// Verify active status using Read-Through In-Memory Cache (TTL 30s)
		if userID != "" && config.DB != nil {
			cacheKey := userID + ":" + outletID
			now := time.Now()

			if val, found := authStatusCache.Load(cacheKey); found {
				entry := val.(cachedAuthStatus)
				if now.Before(entry.expiresAt) {
					if !entry.userActive || !entry.staffActive {
						clearTokenCookie(c)
						return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
							"code":    "ACCOUNT_SUSPENDED",
							"message": entry.suspension,
						})
					}
					goto Verified
				}
			}

			var userStatus string
			err := config.DB.QueryRow(c.Context(), "SELECT status FROM users WHERE id = $1", userID).Scan(&userStatus)
			if err != nil || userStatus != "active" {
				msg := "Akun Anda telah dinonaktifkan oleh administrator. Silakan hubungi pemilik usaha."
				authStatusCache.Store(cacheKey, cachedAuthStatus{
					userActive:  false,
					staffActive: false,
					suspension:  msg,
					expiresAt:   now.Add(authStatusCacheTTL),
				})
				clearTokenCookie(c)
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"code":    "ACCOUNT_SUSPENDED",
					"message": msg,
				})
			}

			if outletID != "" {
				var staffStatus string
				err := config.DB.QueryRow(c.Context(), "SELECT status FROM outlet_staff WHERE user_id = $1 AND outlet_id = $2", userID, outletID).Scan(&staffStatus)
				if err == nil && staffStatus != "active" {
					msg := "Penugasan outlet Anda telah dinonaktifkan oleh administrator. Silakan hubungi pemilik usaha."
					authStatusCache.Store(cacheKey, cachedAuthStatus{
						userActive:  true,
						staffActive: false,
						suspension:  msg,
						expiresAt:   now.Add(authStatusCacheTTL),
					})
					clearTokenCookie(c)
					return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
						"code":    "ACCOUNT_SUSPENDED",
						"message": msg,
					})
				}
			}

			authStatusCache.Store(cacheKey, cachedAuthStatus{
				userActive:  true,
				staffActive: true,
				expiresAt:   now.Add(authStatusCacheTTL),
			})
		}

	Verified:
		c.Locals("user_id", userID)
		c.Locals("role", role)
		c.Locals("business_id", businessID)
		c.Locals("outlet_id", outletID)

		return c.Next()
	}
}

// TenantContext ensures that business_id (and optionally outlet_id) is set and injected
func TenantContext() fiber.Handler {
	return func(c *fiber.Ctx) error {
		businessID := c.Locals("business_id")
		role := c.Locals("role")

		if businessID == nil || businessID == "" {
			outletID := c.Locals("outlet_id")
			if (outletID == nil || outletID == "") && role != "superadmin" {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"message": "Active business workspace context not selected",
				})
			}
		}

		return c.Next()
	}
}

func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}

	// Check explicit whitelist from CORS_ALLOWED_ORIGINS (comma-separated)
	if envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); envOrigins != "" {
		for _, allowed := range strings.Split(envOrigins, ",") {
			if strings.EqualFold(strings.TrimSpace(allowed), origin) {
				return true
			}
		}
	}

	// In non-production environments, permit standard local development origins
	if config.AppConfig == nil || config.AppConfig.Env != "production" {
		if strings.HasPrefix(origin, "http://localhost:") ||
			strings.HasPrefix(origin, "http://127.0.0.1:") ||
			origin == "http://localhost" ||
			origin == "http://127.0.0.1" {
			return true
		}
	}

	return false
}

// CORS enforces a strict Origin whitelist rather than blind Origin reflection
func CORS() fiber.Handler {
	return func(c *fiber.Ctx) error {
		origin := c.Get("Origin")
		if isAllowedOrigin(origin) {
			c.Set("Access-Control-Allow-Origin", origin)
			c.Set("Access-Control-Allow-Credentials", "true")
			c.Set("Vary", "Origin")
		}

		c.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, Cookie")
		c.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")

		if c.Method() == "OPTIONS" {
			return c.SendStatus(fiber.StatusNoContent)
		}

		return c.Next()
	}
}
