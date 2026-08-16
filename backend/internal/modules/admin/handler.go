package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type CreateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Pin      string `json:"pin"`
	Status   string `json:"status"`
}

type UpdateUserRequest struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	Status string `json:"status"`
}

type AssignmentsRequest struct {
	Assignments []AssignmentInput `json:"assignments"`
}

func checkSuperadmin(c *fiber.Ctx) error {
	role, ok := c.Locals("role").(string)
	if !ok || role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access restricted to superadmin only",
		})
	}
	return nil
}

// HandleGetUsers handles GET /api/v1/admin/users
func HandleGetUsers(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	list, err := ListAllUsers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load users",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleCreateUser handles POST /api/v1/admin/users
func HandleCreateUser(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "User name is required",
		})
	}

	if req.Status == "" {
		req.Status = "active"
	}

	user, err := CreateUser(c.Context(), req.Name, req.Email, req.Password, req.Pin, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create user",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(user)
}

// HandleUpdateUser handles PUT /api/v1/admin/users/:id
func HandleUpdateUser(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	idStr := c.Params("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid user ID format",
		})
	}

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "User name is required",
		})
	}

	user, err := UpdateUser(c.Context(), userID, req.Name, req.Email, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update user",
			"error":   err.Error(),
		})
	}

	return c.JSON(user)
}

// HandleUpdateUserAssignments handles PUT /api/v1/admin/users/:id/assignments
func HandleUpdateUserAssignments(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	idStr := c.Params("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid user ID format",
		})
	}

	var req AssignmentsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	err = UpdateUserAssignments(c.Context(), userID, req.Assignments)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update user assignments",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "User assignments updated successfully",
	})
}

// HandleGetBusinesses handles GET /api/v1/admin/businesses
func HandleGetBusinesses(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	list, err := ListAllBusinesses(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load businesses",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleGetOutlets handles GET /api/v1/admin/outlets
func HandleGetOutlets(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	list, err := ListAllOutlets(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load outlets",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}
