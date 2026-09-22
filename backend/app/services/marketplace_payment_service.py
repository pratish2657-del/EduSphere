from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection
from app.services.marketplace_inventory_service import (
    finalize_order_inventory,
)

# ============================================================
# CONFIG
# ============================================================

PAYMENT_METHOD = "UPI"
CURRENCY = "INR"


# ============================================================
# HELPERS
# ============================================================

def _payment_config() -> dict:
    """
    Return the marketplace's direct UPI payment details.
    """
    upi_id = os.getenv("MARKETPLACE_UPI_ID")
    payment_name = os.getenv(
        "MARKETPLACE_PAYMENT_NAME",
        "EduSphere Marketplace",
    )
    payment_phone = os.getenv(
        "MARKETPLACE_PAYMENT_PHONE",
        "",
    )

    if not upi_id:
        raise BadRequestError(
            "Marketplace UPI payment is not configured."
        )

    return {
        "upi_id": upi_id,
        "payment_name": payment_name,
        "payment_phone": payment_phone,
    }


def _serialize_payment(
    payment: dict,
    include_config: bool = True,
) -> dict:
    """
    Convert a database payment row into an API-safe response.
    """
    result = {
        "payment_id": payment["id"],
        "order_id": payment["order_id"],
        "payment_method": payment["payment_method"],
        "status": payment["status"],
        "amount": Decimal(str(payment["amount"])),
        "currency": payment["currency"],
        "utr_number": payment.get("utr_number"),
        "payer_upi_id": payment.get("payer_upi_id"),
        "payer_phone": payment.get("payer_phone"),
        "submitted_at": (
            payment["submitted_at"].isoformat()
            if payment.get("submitted_at")
            else None
        ),
        "verified_at": (
            payment["verified_at"].isoformat()
            if payment.get("verified_at")
            else None
        ),
    }

    if include_config:
        config = _payment_config()

        result.update(
            {
                "upi_id": config["upi_id"],
                "payment_name": config["payment_name"],
                "payment_phone": config["payment_phone"],
            }
        )

    return result


# ============================================================
# CREATE PAYMENT
# ============================================================

def create_payment(
    user_id: int,
    order_id: int,
):
    """
    Create or return the local UPI payment record for an order.

    No payment gateway is contacted here.

    The payment remains PENDING until an administrator manually
    verifies the submitted UTR.
    """
    _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        # ----------------------------------------------------
        # Lock order
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                buyer_id,
                subtotal_amount,
                tax_percent,
                tax_amount,
                total_amount,
                status,
                expires_at
            FROM marketplace_orders
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (order_id,),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError("Order not found.")

        if order["buyer_id"] != user_id:
            raise NotFoundError("Order not found.")

        if order["status"] != "PENDING":
            raise ConflictError(
                "Payment cannot be created for this order."
            )

        # ----------------------------------------------------
        # Check expiry
        # ----------------------------------------------------

        if (
            order["expires_at"] is not None
            and order["expires_at"] <= datetime.now(timezone.utc).replace(tzinfo=None)
        ):
            raise ConflictError(
                "This order has expired. Please create a new order."
            )

        # ----------------------------------------------------
        # Existing payment
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by,
                created_at,
                updated_at
            FROM marketplace_payments
            WHERE order_id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (order_id,),
        )

        payment = cursor.fetchone()

        if payment:
            # ------------------------------------------------
            # Existing PAID payment
            # ------------------------------------------------

            if payment["status"] == "PAID":
                connection.commit()

                return _serialize_payment(payment)

            # ------------------------------------------------
            # Existing payment
            # ------------------------------------------------

            connection.commit()

            return _serialize_payment(payment)

        # ----------------------------------------------------
        # Create payment
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO marketplace_payments (
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency
            )
            VALUES (
                %s,
                %s,
                'UPI',
                'PENDING',
                %s,
                'INR'
            )
            """,
            (
                order_id,
                user_id,
                order["total_amount"],
            ),
        )

        payment_id = cursor.lastrowid

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by,
                created_at,
                updated_at
            FROM marketplace_payments
            WHERE id = %s
            LIMIT 1
            """,
            (payment_id,),
        )

        payment = cursor.fetchone()

        connection.commit()

        return _serialize_payment(payment)

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET PAYMENT
# ============================================================

def get_payment(
    user_id: int,
    payment_id: int,
):
    """
    Get a payment belonging to the authenticated buyer.
    """
    _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by,
                created_at,
                updated_at
            FROM marketplace_payments
            WHERE id = %s
              AND buyer_id = %s
            LIMIT 1
            """,
            (
                payment_id,
                user_id,
            ),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError("Payment not found.")

        return _serialize_payment(payment)

    finally:
        connection.close()


def get_order_payment(
    user_id: int,
    order_id: int,
):
    """
    Get the payment associated with a buyer's order.
    """
    _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                p.id,
                p.order_id,
                p.buyer_id,
                p.payment_method,
                p.status,
                p.amount,
                p.currency,
                p.utr_number,
                p.payer_upi_id,
                p.payer_phone,
                p.submitted_at,
                p.verified_at,
                p.verified_by,
                p.created_at,
                p.updated_at
            FROM marketplace_payments p
            INNER JOIN marketplace_orders o
                ON o.id = p.order_id
            WHERE p.order_id = %s
              AND p.buyer_id = %s
              AND o.buyer_id = %s
            LIMIT 1
            """,
            (
                order_id,
                user_id,
                user_id,
            ),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "Payment has not been created for this order."
            )

        return _serialize_payment(payment)

    finally:
        connection.close()


# ============================================================
# UTR SUBMISSION
# ============================================================

def submit_utr(
    user_id: int,
    payment_id: int,
    utr_number: str,
    payer_upi_id: str,
    payer_phone: str,
):
    """
    Submit proof of a direct UPI payment.

    This DOES NOT mark the payment as PAID.

    The status remains PENDING until an administrator verifies
    the payment manually.
    """
    _payment_config()

    utr_number = utr_number.strip()
    payer_upi_id = payer_upi_id.strip()
    payer_phone = payer_phone.strip()

    if not utr_number:
        raise BadRequestError("UTR number is required.")

    if not payer_upi_id:
        raise BadRequestError("Payer UPI ID is required.")

    if not payer_phone:
        raise BadRequestError("Payer phone number is required.")

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        # ----------------------------------------------------
        # Lock payment
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by
            FROM marketplace_payments
            WHERE id = %s
              AND buyer_id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (
                payment_id,
                user_id,
            ),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError("Payment not found.")

        # ----------------------------------------------------
        # Already paid
        # ----------------------------------------------------

        if payment["status"] == "PAID":
            raise ConflictError(
                "This payment has already been verified."
            )

        # ----------------------------------------------------
        # Check order
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                buyer_id,
                status,
                expires_at,
                total_amount
            FROM marketplace_orders
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (payment["order_id"],),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError("Order not found.")

        if order["buyer_id"] != user_id:
            raise NotFoundError("Order not found.")

        if order["status"] != "PENDING":
            raise ConflictError(
                "UTR cannot be submitted for this order."
            )

        # ----------------------------------------------------
        # Expired order
        # ----------------------------------------------------

        if (
            order["expires_at"] is not None
            and order["expires_at"] <= datetime.now(timezone.utc).replace(tzinfo=None)
        ):
            raise ConflictError(
                "This order has expired."
            )

        # ----------------------------------------------------
        # Prevent duplicate UTR
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                status
            FROM marketplace_payments
            WHERE utr_number = %s
              AND id <> %s
            LIMIT 1
            FOR UPDATE
            """,
            (
                utr_number,
                payment_id,
            ),
        )

        duplicate = cursor.fetchone()

        if duplicate:
            raise ConflictError(
                "This UTR has already been submitted."
            )

        # ----------------------------------------------------
        # Verify amount consistency
        # ----------------------------------------------------

        payment_amount = Decimal(str(payment["amount"]))
        order_amount = Decimal(str(order["total_amount"]))

        if payment_amount != order_amount:
            raise ConflictError(
                "Payment amount does not match the order total."
            )

        # ----------------------------------------------------
        # Submit UTR
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments
            SET
                status = 'PENDING',
                utr_number = %s,
                payer_upi_id = %s,
                payer_phone = %s,
                submitted_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                utr_number,
                payer_upi_id,
                payer_phone,
                payment_id,
            ),
        )

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by
            FROM marketplace_payments
            WHERE id = %s
            LIMIT 1
            """,
            (payment_id,),
        )

        updated_payment = cursor.fetchone()

        connection.commit()

        return _serialize_payment(updated_payment)

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADMIN VERIFY
# ============================================================

def verify_payment(
    payment_id: int,
    admin_id: int,
):
    """
    Manually verify a direct UPI payment.

    Transaction:

        payment PENDING
             ↓
        verify UTR
             ↓
        payment PAID
             ↓
        finalize inventory
             ↓
        order CONFIRMED

    Everything happens inside one database transaction.
    """
    _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        # ----------------------------------------------------
        # Lock payment
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by
            FROM marketplace_payments
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (payment_id,),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError("Payment not found.")

        # ----------------------------------------------------
        # Idempotent verification
        # ----------------------------------------------------

        if payment["status"] == "PAID":
            connection.commit()

            return _serialize_payment(
                payment,
                include_config=True,
            )

        if payment["status"] != "PENDING":
            raise ConflictError(
                "Only pending payments can be verified."
            )

        if not payment["utr_number"]:
            raise BadRequestError(
                "Buyer has not submitted a UTR yet."
            )

        # ----------------------------------------------------
        # Lock order
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                buyer_id,
                subtotal_amount,
                tax_percent,
                tax_amount,
                total_amount,
                status,
                expires_at
            FROM marketplace_orders
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (payment["order_id"],),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError("Order not found.")

        if order["status"] != "PENDING":
            raise ConflictError(
                "This order is no longer pending."
            )

        # ----------------------------------------------------
        # Check payment/order amount
        # ----------------------------------------------------

        payment_amount = Decimal(str(payment["amount"]))
        order_amount = Decimal(str(order["total_amount"]))

        if payment_amount != order_amount:
            raise ConflictError(
                "Payment amount does not match the order total."
            )

        # ----------------------------------------------------
        # Check expiry
        # ----------------------------------------------------

        if (
            order["expires_at"] is not None
            and order["expires_at"] <= datetime.now(timezone.utc).replace(tzinfo=None)
        ):
            raise ConflictError(
                "This order has expired and cannot be verified."
            )

        # ----------------------------------------------------
        # Mark payment PAID
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments
            SET
                status = 'PAID',
                verified_at = CURRENT_TIMESTAMP,
                verified_by = %s
            WHERE id = %s
              AND status = 'PENDING'
            """,
            (
                admin_id,
                payment_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Payment was changed by another process."
            )

        # ----------------------------------------------------
        # Finalize inventory
        #
        # Reserved stock becomes sold stock here.
        # ----------------------------------------------------

        finalize_order_inventory(
            payment["order_id"],
            cursor,
        )

        # ----------------------------------------------------
        # Confirm order
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_orders
            SET status = 'CONFIRMED'
            WHERE id = %s
              AND status = 'PENDING'
            """,
            (payment["order_id"],),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Unable to confirm the order."
            )

        # ----------------------------------------------------
        # Create receipt
        #
        # Import here to avoid circular imports because the
        # receipt service may later use payment/order helpers.
        # ----------------------------------------------------

        from app.services.marketplace_receipt_service import (
            create_receipt_for_payment,
        )

        receipt = create_receipt_for_payment(
            order_id=payment["order_id"],
            payment_id=payment_id,
            amount=payment_amount,
            cursor=cursor,
        )

        # ----------------------------------------------------
        # Return updated payment
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by
            FROM marketplace_payments
            WHERE id = %s
            LIMIT 1
            """,
            (payment_id,),
        )

        updated_payment = cursor.fetchone()

        connection.commit()

        result = _serialize_payment(updated_payment)

        result["order_status"] = "CONFIRMED"
        result["receipt"] = receipt

        return result

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADMIN PAYMENT LIST
# ============================================================

def get_pending_payments():
    """
    Return payments waiting for manual administrator
    verification.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                p.id AS payment_id,
                p.order_id,
                p.buyer_id,
                u.full_name AS buyer_name,
                p.payment_method,
                p.status,
                p.amount,
                p.currency,
                p.utr_number,
                p.payer_upi_id,
                p.payer_phone,
                p.submitted_at,
                p.created_at,

                o.status AS order_status,
                o.total_amount AS order_total,
                o.created_at AS order_created_at

            FROM marketplace_payments p

            INNER JOIN marketplace_orders o
                ON o.id = p.order_id

            LEFT JOIN users u
                ON u.id = p.buyer_id

            WHERE p.status = 'PENDING'

            ORDER BY
                p.submitted_at IS NULL ASC,
                p.submitted_at ASC,
                p.created_at ASC
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()