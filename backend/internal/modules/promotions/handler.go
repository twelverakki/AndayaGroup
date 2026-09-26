package promotions

import (
	"andaya-erp/backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PromotionsHandler struct {
	service *PromotionsService
}

func NewPromotionsHandler(db *pgxpool.Pool) *PromotionsHandler {
	return &PromotionsHandler{
		service: NewPromotionsService(db),
	}
}

// HandleGetPromotions handles GET /api/v1/promotions
func (h *PromotionsHandler) HandleGetPromotions(c *fiber.Ctx) error {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Access to active workspace denied"})
	}
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid business ID"})
	}

	var outletID *uuid.UUID
	outletIDStr, ok := c.Locals("outlet_id").(string)
	if ok && outletIDStr != "" {
		if parsed, err := uuid.Parse(outletIDStr); err == nil {
			outletID = &parsed
		}
	}

	activeOnly := c.Query("active_only") == "true"
	if c.Query("active") == "true" {
		activeOnly = true
	}

	promos, err := h.service.GetPromotions(c.Context(), businessID, outletID, activeOnly)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to retrieve promotions",
			"error":   err.Error(),
		})
	}

	return c.JSON(promos)
}

// HandleCreatePromotion handles POST /api/v1/promotions
func (h *PromotionsHandler) HandleCreatePromotion(c *fiber.Ctx) error {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Access to active workspace denied"})
	}
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid business ID"})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthorized"})
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid user ID"})
	}

	var req models.CreatePromotionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
			"error":   err.Error(),
		})
	}

	promo, err := h.service.CreatePromotion(c.Context(), businessID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Failed to create promotion",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(promo)
}

// HandleUpdatePromotion handles PUT /api/v1/promotions/:id
func (h *PromotionsHandler) HandleUpdatePromotion(c *fiber.Ctx) error {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Access to active workspace denied"})
	}
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid business ID"})
	}

	idStr := c.Params("id")
	promoID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid promotion ID"})
	}

	var req models.UpdatePromotionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
			"error":   err.Error(),
		})
	}

	err = h.service.UpdatePromotion(c.Context(), businessID, promoID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Failed to update promotion",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{"message": "Promotion updated successfully"})
}

// HandleDeletePromotion handles DELETE /api/v1/promotions/:id
func (h *PromotionsHandler) HandleDeletePromotion(c *fiber.Ctx) error {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Access to active workspace denied"})
	}
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid business ID"})
	}

	idStr := c.Params("id")
	promoID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid promotion ID"})
	}

	err = h.service.DeletePromotion(c.Context(), businessID, promoID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete promotion",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{"message": "Promotion deactivated successfully"})
}
