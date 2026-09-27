package middleware

import (
	"strings"
	"time"

	"andaya-erp/backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

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
			// Ensure token signing method is HMAC
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

		// Check live active status in database to immediately enforce suspension / deactivation
		if userID != "" && config.DB != nil {
			var userStatus string
			err := config.DB.QueryRow(c.Context(), "SELECT status FROM users WHERE id = $1", userID).Scan(&userStatus)
			if err != nil || userStatus != "active" {
				clearTokenCookie(c)
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"code":    "ACCOUNT_SUSPENDED",
					"message": "Akun Anda telah dinonaktifkan oleh administrator. Silakan hubungi pemilik usaha.",
				})
			}

			// For staff with specific outlet assignment, also check outlet staff status
			if outletID != "" {
				var staffStatus string
				err := config.DB.QueryRow(c.Context(), "SELECT status FROM outlet_staff WHERE user_id = $1 AND outlet_id = $2", userID, outletID).Scan(&staffStatus)
				if err == nil && staffStatus != "active" {
					clearTokenCookie(c)
					return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
						"code":    "ACCOUNT_SUSPENDED",
						"message": "Penugasan outlet Anda telah dinonaktifkan oleh administrator. Silakan hubungi pemilik usaha.",
					})
				}
			}
		}

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
		// These variables must be populated by the AuthGuard middleware
		businessID := c.Locals("business_id")
		role := c.Locals("role")

		// If the user is an owner, they must have a business_id active context (or outlet_id for Yasaka)
		// For staff/manager, they must have an outlet_id and business_id active context.
		if businessID == nil || businessID == "" {
			// We check if outlet_id is present (for outlet-scoped owners like Yasaka)
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

// CORS returns standard CORS configuration
func CORS() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// In development, we can allow localhost or read from config in production
		origin := c.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Set("Access-Control-Allow-Origin", origin)
		c.Set("Access-Control-Allow-Credentials", "true")
		c.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, Cookie")
		c.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")

		if c.Method() == "OPTIONS" {
			return c.SendStatus(fiber.StatusNoContent)
		}

		return c.Next()
	}
}
