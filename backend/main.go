package main

import (
	"log"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/middleware"
	"andaya-erp/backend/internal/modules/admin"
	"andaya-erp/backend/internal/modules/auth"
	"andaya-erp/backend/internal/modules/items"
	"andaya-erp/backend/internal/modules/logistics"
	"andaya-erp/backend/internal/modules/organization"
	"andaya-erp/backend/internal/modules/production"
	"andaya-erp/backend/internal/modules/promotions"
	"andaya-erp/backend/internal/modules/settlements"
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
	authGroup.Post("/forgot-password", auth.HandleForgotPassword)
	authGroup.Post("/reset-password", auth.HandleResetPassword)

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

	// Items Unified Master Catalog Endpoints
	itemsHandler := items.NewItemsHandler(config.DB)

	// Upload Endpoints (Accepts authenticated uploads)
	api.Post("/upload", middleware.AuthGuard(), itemsHandler.HandleUploadFile)
	scopedAPI.Post("/upload", itemsHandler.HandleUploadFile)
	itemsGroup := scopedAPI.Group("/items")
	itemsGroup.Get("/", itemsHandler.HandleGetItems)
	itemsGroup.Get("/matrix", itemsHandler.HandleGetStockMatrix)
	itemsGroup.Post("/", itemsHandler.HandleCreateItem)
	itemsGroup.Put("/:id", itemsHandler.HandleUpdateItem)
	itemsGroup.Patch("/:id/status", itemsHandler.HandleUpdateItemStatus)
	itemsGroup.Post("/:id/unbox", itemsHandler.HandleUnboxItem)
	itemsGroup.Post("/:id/adjust", itemsHandler.HandleAdjustStock)

	// Inventory Group
	inventoryGroup := scopedAPI.Group("/inventory")
	inventoryGroup.Get("/matrix", itemsHandler.HandleGetStockMatrix)

	// Backwards Compatibility Aliases
	productsGroup := scopedAPI.Group("/products")
	productsGroup.Get("/", itemsHandler.HandleGetItems)
	productsGroup.Post("/", itemsHandler.HandleCreateItem)
	productsGroup.Put("/:id", itemsHandler.HandleUpdateItem)
	productsGroup.Patch("/:id/status", itemsHandler.HandleUpdateItemStatus)
	productsGroup.Post("/:id/unbox", itemsHandler.HandleUnboxItem)
	productsGroup.Post("/:id/adjust", itemsHandler.HandleAdjustStock)

	ingredientsGroup := scopedAPI.Group("/ingredients")
	ingredientsGroup.Get("/", itemsHandler.HandleGetItems)
	ingredientsGroup.Post("/", itemsHandler.HandleCreateItem)

	// Categories Endpoints
	categoriesGroup := scopedAPI.Group("/categories")
	categoriesGroup.Get("/", itemsHandler.HandleGetCategories)
	categoriesGroup.Post("/", itemsHandler.HandleCreateCategory)
	categoriesGroup.Delete("/:id", itemsHandler.HandleDeleteCategory)

	// Wastage Logs Endpoints
	wastageGroup := scopedAPI.Group("/wastage-logs")
	wastageGroup.Get("/", itemsHandler.HandleGetWastageLogs)

	// Cashier Session Endpoints
	shiftsGroup := scopedAPI.Group("/shifts")
	shiftsGroup.Get("/active", transactions.HandleGetActiveShift)
	shiftsGroup.Post("/open", transactions.HandleOpenShift)
	shiftsGroup.Post("/close", transactions.HandleCloseShift)

	// Standard POS Sessions Route Alias
	sessionsGroup := scopedAPI.Group("/pos/sessions")
	sessionsGroup.Get("/active", transactions.HandleGetActiveShift)
	sessionsGroup.Post("/open", transactions.HandleOpenShift)
	sessionsGroup.Post("/close", transactions.HandleCloseShift)

	// POS Transaction Endpoints
	transactionsGroup := scopedAPI.Group("/transactions")
	transactionsGroup.Get("/", transactions.HandleGetTransactions)
	transactionsGroup.Post("/", transactions.HandleCreateTransaction)
	transactionsGroup.Post("/:id/void", transactions.HandleVoidTransaction)

	// Purchases / Procurement Endpoints
	procurementsGroup := scopedAPI.Group("/procurements")
	procurementsGroup.Get("/", itemsHandler.HandleGetProcurements)

	purchasesGroup := scopedAPI.Group("/purchases")
	purchasesGroup.Get("/", itemsHandler.HandleGetProcurements)

	// Sales Reports & Analytics Endpoints
	reportsGroup := scopedAPI.Group("/reports")
	reportsGroup.Get("/sales", transactions.HandleGetSalesReport)

	// F&B Batch Production Runs & EOD Usages Endpoints (Domain Agnostic)
	prodHandler := production.NewProductionHandler(config.DB)
	logisticsHandler := logistics.NewLogisticsHandler(config.DB)
	settlementHandler := settlements.NewSettlementsHandler(config.DB)

	productionsGroup := scopedAPI.Group("/productions")
	productionsGroup.Post("/", prodHandler.HandleCreateProduction)
	productionsGroup.Get("/", prodHandler.HandleGetProductions)
	productionsGroup.Post("/eod-usages", prodHandler.HandleCreateEodMaterialUsage)
	productionsGroup.Get("/eod-usages", prodHandler.HandleGetEodMaterialUsages)

	// Transfers & Logistics Endpoints (The Lean Odoo Way: Multi-Item Surat Jalan & Unboxing)
	transfersGroup := scopedAPI.Group("/transfers")
	transfersGroup.Post("/", logisticsHandler.HandleCreateTransfer)
	transfersGroup.Post("/bulk-draft", logisticsHandler.HandleCreateBulkDraft)
	transfersGroup.Get("/", logisticsHandler.HandleGetTransfers)
	transfersGroup.Get("/suggest-reorder", logisticsHandler.HandleGetSuggestedReorder)
	transfersGroup.Get("/:id", logisticsHandler.HandleGetTransferByID)
	transfersGroup.Put("/:id", logisticsHandler.HandleUpdateTransfer)
	transfersGroup.Patch("/:id", logisticsHandler.HandleUpdateTransfer)
	transfersGroup.Post("/:id", logisticsHandler.HandleUpdateTransfer)
	transfersGroup.Post("/:id/update", logisticsHandler.HandleUpdateTransfer)
	transfersGroup.Post("/:id/edit", logisticsHandler.HandleUpdateTransfer)
	transfersGroup.Post("/:id/cancel", logisticsHandler.HandleCancelTransfer)
	transfersGroup.Delete("/:id", logisticsHandler.HandleDeleteTransfer)
	transfersGroup.Post("/:id/receive", logisticsHandler.HandleReceiveTransfer)
	transfersGroup.Post("/:id/claim/approve", logisticsHandler.HandleApproveClaim)
	transfersGroup.Post("/:id/claim/reject", logisticsHandler.HandleRejectClaim)
	transfersGroup.Post("/unbox", logisticsHandler.HandleUnbox)
	transfersGroup.Post("/thaw", logisticsHandler.HandleUnbox)
	transfersGroup.Get("/thaw-logs", logisticsHandler.HandleGetThawLogs)

	// Public Driver Claim Portal Endpoints (Guest Access via Token)
	claimGroup := api.Group("/claim")
	claimGroup.Get("/:token", logisticsHandler.HandleGetClaimByToken)
	claimGroup.Post("/:token", logisticsHandler.HandleSubmitDriverClaim)

	// Promotions & Discount Rules Endpoints (The Lean Odoo Way: Rule-Based Pricing Engine)
	promotionsHandler := promotions.NewPromotionsHandler(config.DB)
	promotionsGroup := scopedAPI.Group("/promotions")
	promotionsGroup.Get("/", promotionsHandler.HandleGetPromotions)
	promotionsGroup.Post("/", promotionsHandler.HandleCreatePromotion)
	promotionsGroup.Put("/:id", promotionsHandler.HandleUpdatePromotion)
	promotionsGroup.Delete("/:id", promotionsHandler.HandleDeletePromotion)

	logisticsGroup := scopedAPI.Group("/logistics")
	logisticsGroup.Post("/distributions", logisticsHandler.HandleCreateDistribution)
	logisticsGroup.Post("/distributions/bulk-draft", logisticsHandler.HandleCreateBulkDraft)
	logisticsGroup.Get("/distributions", logisticsHandler.HandleGetDistributions)
	logisticsGroup.Get("/distributions/suggest-reorder", logisticsHandler.HandleGetSuggestedReorder)
	logisticsGroup.Get("/distributions/:id", logisticsHandler.HandleGetTransferByID)
	logisticsGroup.Put("/distributions/:id", logisticsHandler.HandleUpdateTransfer)
	logisticsGroup.Patch("/distributions/:id", logisticsHandler.HandleUpdateTransfer)
	logisticsGroup.Post("/distributions/:id", logisticsHandler.HandleUpdateTransfer)
	logisticsGroup.Post("/distributions/:id/update", logisticsHandler.HandleUpdateTransfer)
	logisticsGroup.Post("/distributions/:id/cancel", logisticsHandler.HandleCancelTransfer)
	logisticsGroup.Delete("/distributions/:id", logisticsHandler.HandleDeleteTransfer)
	logisticsGroup.Post("/distributions/:id/receive", logisticsHandler.HandleReceiveDistribution)
	logisticsGroup.Post("/thaw", logisticsHandler.HandleThaw)
	logisticsGroup.Get("/thaw-logs", logisticsHandler.HandleGetThawLogs)

	// Deprecated / Backwards Compatible Route Support
	distributionsGroup := scopedAPI.Group("/distributions")
	distributionsGroup.Post("/", logisticsHandler.HandleCreateDistribution)
	distributionsGroup.Get("/", logisticsHandler.HandleGetDistributions)
	distributionsGroup.Get("/suggest-reorder", logisticsHandler.HandleGetSuggestedReorder)
	distributionsGroup.Get("/:id", logisticsHandler.HandleGetTransferByID)
	distributionsGroup.Put("/:id", logisticsHandler.HandleUpdateTransfer)
	distributionsGroup.Patch("/:id", logisticsHandler.HandleUpdateTransfer)
	distributionsGroup.Post("/:id", logisticsHandler.HandleUpdateTransfer)
	distributionsGroup.Post("/:id/update", logisticsHandler.HandleUpdateTransfer)
	distributionsGroup.Post("/:id/cancel", logisticsHandler.HandleCancelTransfer)
	distributionsGroup.Delete("/:id", logisticsHandler.HandleDeleteTransfer)
	distributionsGroup.Post("/:id/receive", logisticsHandler.HandleReceiveDistribution)

	// Settlements & Daily Closing Endpoints (Domain Agnostic)
	settlementRouteGroup := scopedAPI.Group("/settlements")
	settlementRouteGroup.Post("/", settlementHandler.HandleCreateSettlement)
	settlementRouteGroup.Get("/", settlementHandler.HandleGetSettlements)
	settlementRouteGroup.Post("/direct-sales", settlementHandler.HandleCreateDirectSale)
	settlementRouteGroup.Post("/wholesale", settlementHandler.HandleCreateDirectSale)

	// Organization, Outlets & Staff Management (Owner & Superadmin)
	orgHandler := organization.NewHandler(organization.NewService(config.DB))
	orgGroup := scopedAPI.Group("/organization")
	orgGroup.Get("/businesses", orgHandler.GetAllBusinesses)
	orgGroup.Post("/businesses", orgHandler.CreateBusiness)
	orgGroup.Get("/staff", orgHandler.GetStaff)
	orgGroup.Post("/staff", orgHandler.CreateStaff)
	orgGroup.Put("/staff/:id", orgHandler.UpdateStaff)
	orgGroup.Get("/outlets", orgHandler.GetOutlets)
	orgGroup.Post("/outlets", orgHandler.CreateOutlet)
	orgGroup.Get("/business/profile", orgHandler.GetBusinessProfile)
	orgGroup.Put("/business/capabilities", orgHandler.UpdateCapabilities)
	orgGroup.Put("/business/profile", orgHandler.UpdateBusinessProfile)
	orgGroup.Put("/outlets/:id", orgHandler.UpdateOutletDetails)
	orgGroup.Get("/audit-logs", orgHandler.GetAuditLogs)

	// Superadmin Control Center Endpoints
	adminGroup := api.Group("/admin", middleware.AuthGuard())
	adminGroup.Get("/users", admin.HandleGetUsers)
	adminGroup.Post("/users", admin.HandleCreateUser)
	adminGroup.Put("/users/:id", admin.HandleUpdateUser)
	adminGroup.Put("/users/:id/assignments", admin.HandleUpdateUserAssignments)
	adminGroup.Get("/businesses", admin.HandleGetBusinesses)
	adminGroup.Get("/outlets", admin.HandleGetOutlets)
	adminGroup.Get("/security-logs", admin.HandleGetSecurityAuditLogs)
	adminGroup.Get("/owners", admin.HandleGetOwnersHierarchy)
	adminGroup.Post("/owners/:id/businesses", admin.HandleCreateBusinessForOwner)

	// 5. Start HTTP Server
	log.Printf("Starting API server on port %s in %s mode...", config.AppConfig.Port, config.AppConfig.Env)
	log.Fatal(app.Listen(":" + config.AppConfig.Port))
}
