package main

import (
	"log"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/middleware"
	"andaya-erp/backend/internal/modules/admin"
	"andaya-erp/backend/internal/modules/auth"
	"andaya-erp/backend/internal/modules/bakso"
	"andaya-erp/backend/internal/modules/products"
	"andaya-erp/backend/internal/modules/transactions"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// 1. Load Configuration from .env
	config.LoadConfig()

	// 2. Connect to Database (pgxpool)
	config.ConnectDB()
	defer config.DB.Close()

	// 3. Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName: "Andaya Group Lean ERP API",
	})

	// 4. Global Middlewares
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(middleware.CORS())

	// 5. Serve Static Files
	app.Static("/uploads", "./uploads")

	// Root Endpoint
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"app":     "Andaya Group Lean ERP API",
			"status":  "running",
			"version": "1.0.0",
		})
	})

	// API Routing Group
	api := app.Group("/api/v1")

	// Public Auth Endpoints
	authGroup := api.Group("/auth")
	authGroup.Post("/login", auth.HandleLogin)
	authGroup.Post("/logout", auth.HandleLogout)

	// Protected Auth Endpoints (Require user session but not active workspace yet)
	protectedAuthGroup := api.Group("/auth", middleware.AuthGuard())
	protectedAuthGroup.Get("/me", auth.HandleGetMe)
	protectedAuthGroup.Post("/switch-business", auth.HandleSwitchBusiness)

	// Scoped Operational Endpoints (Require BOTH user authentication AND selected active tenant workspace context)
	scopedAPI := api.Group("", middleware.AuthGuard(), middleware.TenantContext())
	
	// Staff list for business
	scopedAPI.Get("/auth/staff", auth.HandleGetStaff)
	
	// Test Scoped Endpoint to verify tenant context injection works
	scopedAPI.Get("/tenant-check", func(c *fiber.Ctx) error {
		bID := c.Locals("business_id").(string)
		oID := c.Locals("outlet_id").(string)
		role := c.Locals("role").(string)

		return c.JSON(fiber.Map{
			"message":     "Tenant Context Verified",
			"business_id": bID,
			"outlet_id":   oID,
			"role":        role,
		})
	})

	// Upload Endpoints (Accepts authenticated uploads)
	api.Post("/upload", middleware.AuthGuard(), products.HandleUploadFile)
	scopedAPI.Post("/upload", products.HandleUploadFile)

	// Products CRUD Endpoints
	productsGroup := scopedAPI.Group("/products")
	productsGroup.Get("/", products.HandleGetProducts)
	productsGroup.Get("/:id", products.HandleGetProductByID)
	productsGroup.Post("/", products.HandleCreateProduct)
	productsGroup.Put("/:id", products.HandleUpdateProduct)
	productsGroup.Delete("/:id", products.HandleDeleteProduct)

	// Categories Endpoints
	scopedAPI.Get("/categories", products.HandleGetCategories)

	// Wastage / Opname Logs Endpoints
	wastageGroup := scopedAPI.Group("/wastage-logs")
	wastageGroup.Get("/", products.HandleGetWastageLogs)
	wastageGroup.Post("/", products.HandleCreateWastageLog)
	wastageGroup.Post("/:id/approve", products.HandleApproveWastageLog)
	wastageGroup.Post("/:id/reject", products.HandleRejectWastageLog)

	// Cashier Shift Endpoints
	shiftsGroup := scopedAPI.Group("/shifts")
	shiftsGroup.Get("/active", transactions.HandleGetActiveShift)
	shiftsGroup.Post("/open", transactions.HandleOpenShift)
	shiftsGroup.Post("/close", transactions.HandleCloseShift)

	// POS Transaction Endpoints
	transactionsGroup := scopedAPI.Group("/transactions")
	transactionsGroup.Get("/", transactions.HandleGetTransactions)
	transactionsGroup.Post("/", transactions.HandleCreateTransaction)
	transactionsGroup.Post("/:id/void", transactions.HandleVoidTransaction)

	// Procurement Endpoints
	procurementsGroup := scopedAPI.Group("/procurements")
	procurementsGroup.Get("/", products.HandleGetProcurements)
	procurementsGroup.Get("/:id", products.HandleGetProcurementByID)
	procurementsGroup.Post("/", products.HandleCreateProcurement)
	procurementsGroup.Put("/:id/payment", products.HandleUpdateProcurementPayment)

	// Sales Reports & Analytics Endpoints
	reportsGroup := scopedAPI.Group("/reports")
	reportsGroup.Get("/sales", transactions.HandleGetSalesReport)

	// Bakso Kang Gemoy Endpoints
	productionsGroup := scopedAPI.Group("/productions")
	productionsGroup.Post("/", bakso.HandleCreateProduction)
	productionsGroup.Get("/", bakso.HandleGetProductions)

	distributionsGroup := scopedAPI.Group("/distributions")
	distributionsGroup.Post("/", bakso.HandleCreateDistribution)
	distributionsGroup.Get("/", bakso.HandleGetDistributions)
	distributionsGroup.Post("/:id/receive", bakso.HandleReceiveDistribution)

	baksoGroup := scopedAPI.Group("/bakso")
	baksoGroup.Post("/thaw", bakso.HandleThawBatch)
	baksoGroup.Post("/batches/:id/qc", bakso.HandleQualityCheckBatch)
	baksoGroup.Post("/closing", bakso.HandleCloseDailyStock)
	baksoGroup.Get("/batches", bakso.HandleGetStockBatches)
	baksoGroup.Get("/stock-alerts", bakso.HandleGetStockAlerts)

	// Superadmin Control Center Endpoints
	adminGroup := api.Group("/admin", middleware.AuthGuard())
	adminGroup.Get("/users", admin.HandleGetUsers)
	adminGroup.Post("/users", admin.HandleCreateUser)
	adminGroup.Put("/users/:id", admin.HandleUpdateUser)
	adminGroup.Put("/users/:id/assignments", admin.HandleUpdateUserAssignments)
	adminGroup.Get("/businesses", admin.HandleGetBusinesses)
	adminGroup.Get("/outlets", admin.HandleGetOutlets)

	// 5. Start HTTP Server
	log.Printf("Starting API server on port %s in %s mode...", config.AppConfig.Port, config.AppConfig.Env)
	log.Fatal(app.Listen(":" + config.AppConfig.Port))
}
