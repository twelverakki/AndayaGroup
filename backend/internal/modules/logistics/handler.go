package logistics

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LogisticsHandler struct {
	Service *LogisticsService
}

func NewLogisticsHandler(db *pgxpool.Pool) *LogisticsHandler {
	return &LogisticsHandler{
		Service: NewLogisticsService(db),
	}
}

func getTenantContext(c *fiber.Ctx) (uuid.UUID, *uuid.UUID, error) {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return uuid.Nil, nil, fiber.ErrForbidden
	}

	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return uuid.Nil, nil, fiber.ErrBadRequest
	}

	outletIDStr, _ := c.Locals("outlet_id").(string)
	var outletID *uuid.UUID
	if outletIDStr != "" {
		id, err := uuid.Parse(outletIDStr)
		if err == nil {
			outletID = &id
		}
	}

	return businessID, outletID, nil
}

func getLoggedUserID(c *fiber.Ctx) (uuid.UUID, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return uuid.Nil, fiber.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

func (h *LogisticsHandler) HandleCreateTransfer(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)

	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	var req CreateTransferRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	// RBAC Guard: Only Owner, Manager, or Admin Gudang can dispatch direct Outbound pasokan or Retur.
	// Staff/Cashier can only submit Requisition (Permintaan Pasokan) from their assigned outlet.
	if req.TransferType != "requisition" && role != "owner" && role != "admin_gudang" && role != "manager" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Hanya Owner, Manager, Superadmin, atau Admin Gudang yang dapat menerbitkan pengiriman pasokan langsung",
		})
	}

	if (role == "staff" || role == "cashier") && outletID != nil {
		// Staff requisition is strictly received at their own outlet
		req.ToOutletID = outletID
	}

	if req.FromOutletID == nil && req.OutletID == nil && outletID != nil {
		req.FromOutletID = outletID
	}

	res, err := h.Service.CreateTransfer(c.Context(), businessID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Surat Jalan / Pengiriman transfer berhasil dibuat",
		"data":    res,
	})
}

func (h *LogisticsHandler) HandleReceiveTransfer(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	role, _ := c.Locals("role").(string)

	transferIDParam := c.Params("id")
	transferID, err := uuid.Parse(transferIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid transfer ID parameter",
		})
	}

	var req ReceiveTransferRequest
	_ = c.BodyParser(&req)

	err = h.Service.ReceiveTransfer(c.Context(), businessID, userID, transferID, req, outletID, role)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Serah terima barang (handshake receipt) berhasil dikonfirmasi ke stok cabang",
	})
}

func (h *LogisticsHandler) HandleGetTransfers(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)

	var filterOutletID *uuid.UUID

	// 1. Explicit query parameter filter (e.g. ?outlet_id=...)
	if queryOutlet := c.Query("outlet_id"); queryOutlet != "" {
		if qID, err := uuid.Parse(queryOutlet); err == nil {
			filterOutletID = &qID
		}
	} else if outletID != nil && *outletID != uuid.Nil {
		// 2. If user is operating in an outlet context and not requesting enterprise-wide view
		// Branch staff/cashier/manager are strictly scoped to their outlet
		if role == "staff" || role == "cashier" || role == "manager" {
			filterOutletID = outletID
		} else if role != "superadmin" && c.Query("all") != "true" {
			// If an owner/admin is in a branch context (non-main outlet), filter by that outlet unless explicitly requesting ?all=true
			var isMain bool
			_ = h.Service.DB.QueryRow(c.Context(), `SELECT is_main FROM outlets WHERE id = $1`, *outletID).Scan(&isMain)
			if !isMain {
				filterOutletID = outletID
			}
		}
	}

	// Security check for branch staff/cashier: cannot view another outlet's transfers via ?outlet_id injection
	if (role == "staff" || role == "cashier") && outletID != nil && *outletID != uuid.Nil {
		filterOutletID = outletID
	}

	transfers, err := h.Service.GetTransfers(c.Context(), businessID, filterOutletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": transfers,
	})
}

func (h *LogisticsHandler) HandleGetTransferByID(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	transferIDParam := c.Params("id")
	transferID, err := uuid.Parse(transferIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid transfer ID parameter",
		})
	}

	transfer, err := h.Service.GetTransferByID(c.Context(), businessID, transferID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": transfer,
	})
}

func (h *LogisticsHandler) HandleUpdateTransfer(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" && role != "manager" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Hanya Owner, Manager, Superadmin, atau Admin Gudang yang dapat mengubah data pengiriman",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	transferIDParam := c.Params("id")
	transferID, err := uuid.Parse(transferIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid transfer ID parameter",
		})
	}

	var req UpdateTransferRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	res, err := h.Service.UpdateTransfer(c.Context(), businessID, transferID, req)
	if err != nil {
		if strings.Contains(err.Error(), "ERR_OCC_CONFLICT") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"message": "Dokumen ini baru saja diperbarui oleh pengguna lain. Sistem akan memuat data terbaru.",
				"code":    "OCC_CONFLICT",
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Data informasi dan biaya pengiriman berhasil diperbarui",
		"data":    res,
	})
}

func (h *LogisticsHandler) HandleUnbox(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	var req UnboxRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.OutletID == nil && outletID != nil {
		req.OutletID = outletID
	}

	err = h.Service.UnboxOrThawItem(c.Context(), businessID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Pecah kemasan / pencairan beku (thawing) berhasil dicatat ke mutasi stok",
	})
}

// Backward compatibility methods
func (h *LogisticsHandler) HandleCreateDistribution(c *fiber.Ctx) error {
	return h.HandleCreateTransfer(c)
}

func (h *LogisticsHandler) HandleReceiveDistribution(c *fiber.Ctx) error {
	return h.HandleReceiveTransfer(c)
}

func (h *LogisticsHandler) HandleGetDistributions(c *fiber.Ctx) error {
	return h.HandleGetTransfers(c)
}

func (h *LogisticsHandler) HandleThaw(c *fiber.Ctx) error {
	return h.HandleUnbox(c)
}

func (h *LogisticsHandler) HandleGetThawLogs(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"data": []interface{}{},
	})
}

// HandleGetClaimByToken handles public guest driver portal retrieval
func (h *LogisticsHandler) HandleGetClaimByToken(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Token klaim diperlukan",
		})
	}

	info, err := h.Service.GetTransferByClaimToken(c.Context(), token)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": info,
	})
}

// HandleSubmitDriverClaim handles driver submitting trip expenses from mobile
func (h *LogisticsHandler) HandleSubmitDriverClaim(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Token klaim diperlukan",
		})
	}

	var req SubmitDriverClaimRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Format data tidak valid",
		})
	}

	res, err := h.Service.SubmitDriverClaim(c.Context(), token, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Pengajuan klaim biaya perjalanan berhasil dikirim untuk ditinjau oleh Manager",
		"data":    res,
	})
}

// HandleApproveClaim handles manager approving a driver claim
func (h *LogisticsHandler) HandleApproveClaim(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "manager" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Hanya Owner, Manager, atau Admin Gudang yang dapat menyetujui klaim biaya",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	transferID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID pengiriman tidak valid",
		})
	}

	err = h.Service.ApproveClaim(c.Context(), businessID, transferID, userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Klaim biaya perjalanan kurir berhasil disetujui & dicatat ke ongkos kirim resmi",
	})
}

// HandleRejectClaim handles manager rejecting a driver claim
func (h *LogisticsHandler) HandleRejectClaim(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "manager" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Hanya Owner, Manager, atau Admin Gudang yang dapat menolak klaim biaya",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	transferID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID pengiriman tidak valid",
		})
	}

	var req RejectClaimRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Format data tidak valid",
		})
	}

	err = h.Service.RejectClaim(c.Context(), businessID, transferID, userID, req.Reason)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Klaim biaya perjalanan kurir telah ditolak",
	})
}

func (h *LogisticsHandler) HandleCreateBulkDraft(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" && role != "manager" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner, Manager, or Admin Gudang can create bulk distribution drafts",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	var req CreateBulkDraftRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	res, err := h.Service.CreateBulkDraftTransfer(c.Context(), businessID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Draft pengiriman bulk berhasil dibuat",
		"data":    res,
	})
}

func (h *LogisticsHandler) HandleDeleteTransfer(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" && role != "manager" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Hanya Owner, Manager, Superadmin, atau Admin Gudang yang dapat menghapus draf pengiriman",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	transferIDParam := c.Params("id")
	transferID, err := uuid.Parse(transferIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID pengiriman / transfer tidak valid",
		})
	}

	err = h.Service.DeleteDraftTransfer(c.Context(), businessID, transferID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Draf surat jalan berhasil dihapus secara permanen",
	})
}

type CancelTransferRequest struct {
	Reason string `json:"reason,omitempty"`
	Notes  string `json:"notes,omitempty"`
}

func (h *LogisticsHandler) HandleCancelTransfer(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" && role != "manager" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Hanya Owner, Manager, Superadmin, atau Admin Gudang yang dapat membatalkan pengiriman",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	transferIDParam := c.Params("id")
	transferID, err := uuid.Parse(transferIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "ID pengiriman / transfer tidak valid",
		})
	}

	var req CancelTransferRequest
	_ = c.BodyParser(&req)

	reason := req.Reason
	if reason == "" {
		reason = req.Notes
	}

	res, err := h.Service.CancelTransfer(c.Context(), businessID, userID, transferID, reason)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Surat jalan berhasil dibatalkan dan stok dikembalikan ke asal",
		"data":    res,
	})
}

// HandleGetSuggestedReorder calculates replenishment recommendation for target outlet
func (h *LogisticsHandler) HandleGetSuggestedReorder(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	targetOutletID := outletID
	if queryOutlet := c.Query("outlet_id"); queryOutlet != "" {
		if qID, err := uuid.Parse(queryOutlet); err == nil {
			targetOutletID = &qID
		}
	}

	if targetOutletID == nil || *targetOutletID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Outlet target diperlukan untuk kalkulasi auto-suggest restock",
		})
	}

	suggestions, err := h.Service.GetSuggestedReorder(c.Context(), businessID, *targetOutletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": suggestions,
	})
}

