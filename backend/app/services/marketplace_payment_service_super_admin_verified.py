from datetime import datetime, timezone

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection
from app.services.marketplace_inventory_service import (
    expire_pending_orders,
    finalize_order_inventory,
)
from app.services.marketplace_receipt_service import (
    create_receipt_for_payment,
)

# ============================================================
# CONFIG
# ============================================================


def _payment_config():
    import os

    upi_id = os.getenv("MARKETPLACE_UPI_ID", "").strip()
    payment_name = os.getenv(
        "MARKETPLACE_PAYMENT_NAME",
        "",
    ).strip()
    payment_phone = os.getenv(
        "MARKETPLACE_PAYMENT_PHONE",
        "",
    ).strip()

    if not upi_id:
        raise BadRequestError(
            "Marketplace UPI ID is not configured"
        )

    if not payment_name:
        raise BadRequestError(
            "Marketplace payment name is not configured"
        )

    if not payment_phone:
        raise BadRequestError(
            "Marketplace payment phone is not configured"
        )

    return {
        "upi_id": upi_id,
        "payment_name": payment_name,
        "payment_phone": payment_phone,
    }


# ============================================================
# CREATE PAYMENT
# BUYER
#
# Creates a LOCAL PENDING UPI payment.
#
# NO PAYMENT GATEWAY.
# NO CASHFREE.
# NO RAZORPAY.
# ============================================================


def create_payment(
    user_id: int,
    order_id: int,
):
    # Release expired checkout reservations first.
    expire_pending_orders()

    config = _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # BUYER'S ORDER
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                buyer_id,
                total_amount,
                status,
                expires_at

            FROM marketplace_orders

            WHERE id = %s
              AND buyer_id = %s

            FOR UPDATE
            """,
            (
                order_id,
                user_id,
            ),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError(
                "Order not found"
            )

        # ----------------------------------------------------
        # ORDER STATUS
        # ----------------------------------------------------

        if order["status"] in (
            "CONFIRMED",
            "PROCESSING",
            "COMPLETED",
        ):
            raise ConflictError(
                "Order has already been confirmed"
            )

        if order["status"] == "CANCELLED":
            raise BadRequestError(
                "Payment cannot be created for a cancelled order"
            )

        # ----------------------------------------------------
        # EXPIRY
        # ----------------------------------------------------

        if order["expires_at"] is not None:
            now = datetime.now(
                timezone.utc
            ).replace(tzinfo=None)

            if order["expires_at"] <= now:
                raise BadRequestError(
                    "This checkout session has expired. "
                    "Please create a new order."
                )

        # ----------------------------------------------------
        # SERVER-CONTROLLED AMOUNT
        # ----------------------------------------------------

        amount = order["total_amount"]

        if amount is None or amount <= 0:
            raise BadRequestError(
                "Order amount must be greater than zero"
            )

        # ----------------------------------------------------
        # EXISTING PAYMENT
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
                verified_at

            FROM marketplace_payments

            WHERE order_id = %s

            FOR UPDATE
            """,
            (order_id,),
        )

        existing_payment = cursor.fetchone()

        # ----------------------------------------------------
        # ALREADY PAID
        # ----------------------------------------------------

        if existing_payment:
            if existing_payment["status"] == "PAID":
                raise ConflictError(
                    "Order has already been paid"
                )

            connection.commit()

            return {
                "message": "Payment already exists",
                "payment_id": existing_payment["id"],
                "order_id": order_id,
                "payment_method": "UPI",
                "status": existing_payment["status"],
                "amount": existing_payment["amount"],
                "currency": existing_payment["currency"],
                **config,
                "utr_number": existing_payment[
                    "utr_number"
                ],
                "payer_upi_id": existing_payment[
                    "payer_upi_id"
                ],
                "payer_phone": existing_payment[
                    "payer_phone"
                ],
                "submitted_at": (
                    existing_payment["submitted_at"].isoformat()
                    if existing_payment["submitted_at"]
                    else None
                ),
                "verified_at": (
                    existing_payment["verified_at"].isoformat()
                    if existing_payment["verified_at"]
                    else None
                ),
            }

        # ----------------------------------------------------
        # CREATE LOCAL PAYMENT
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
                amount,
            ),
        )

        payment_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "UPI payment created",
            "payment_id": payment_id,
            "order_id": order_id,
            "payment_method": "UPI",
            "status": "PENDING",
            "amount": amount,
            "currency": "INR",
            **config,
            "utr_number": None,
            "payer_upi_id": None,
            "payer_phone": None,
            "submitted_at": None,
            "verified_at": None,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET PAYMENT
# BUYER — OWN PAYMENT ONLY
# ============================================================


def get_payment(
    payment_id: int,
    user_id: int,
):
    config = _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id AS payment_id,
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
                verified_at

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
            raise NotFoundError(
                "Payment not found"
            )

        return {
            **payment,
            **config,
            "submitted_at": (
                payment["submitted_at"].isoformat()
                if payment["submitted_at"]
                else None
            ),
            "verified_at": (
                payment["verified_at"].isoformat()
                if payment["verified_at"]
                else None
            ),
        }

    finally:
        connection.close()


# ============================================================
# GET ORDER PAYMENT
# BUYER — OWN ORDER ONLY
# ============================================================


def get_order_payment(
    order_id: int,
    user_id: int,
):
    config = _payment_config()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                mp.id AS payment_id,
                mp.order_id,
                mp.buyer_id,
                mp.payment_method,
                mp.status,
                mp.amount,
                mp.currency,
                mp.utr_number,
                mp.payer_upi_id,
                mp.payer_phone,
                mp.submitted_at,
                mp.verified_at

            FROM marketplace_payments mp

            INNER JOIN marketplace_orders o
                ON o.id = mp.order_id

            WHERE mp.order_id = %s
              AND o.buyer_id = %s

            LIMIT 1
            """,
            (
                order_id,
                user_id,
            ),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "Payment not found"
            )

        return {
            **payment,
            **config,
            "submitted_at": (
                payment["submitted_at"].isoformat()
                if payment["submitted_at"]
                else None
            ),
            "verified_at": (
                payment["verified_at"].isoformat()
                if payment["verified_at"]
                else None
            ),
        }

    finally:
        connection.close()


# ============================================================
# SUBMIT UTR
# BUYER
#
# IMPORTANT:
# This NEVER marks payment as PAID.
# ============================================================


def submit_utr(
    payment_id: int,
    user_id: int,
    utr_number: str,
    payer_upi_id: str,
    payer_phone: str,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # PAYMENT + ORDER
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                mp.id,
                mp.order_id,
                mp.buyer_id,
                mp.status,
                mp.amount,

                o.status AS order_status,
                o.expires_at

            FROM marketplace_payments mp

            INNER JOIN marketplace_orders o
                ON o.id = mp.order_id

            WHERE mp.id = %s
              AND mp.buyer_id = %s

            FOR UPDATE
            """,
            (
                payment_id,
                user_id,
            ),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "Payment not found"
            )

        if payment["status"] == "PAID":
            raise ConflictError(
                "Payment has already been verified"
            )

        if payment["status"] != "PENDING":
            raise BadRequestError(
                "This payment is no longer accepting UTR submission"
            )

        if payment["order_status"] != "PENDING":
            raise BadRequestError(
                "This order is no longer awaiting payment"
            )

        # ----------------------------------------------------
        # EXPIRY
        # ----------------------------------------------------

        if payment["expires_at"] is not None:
            now = datetime.now(
                timezone.utc
            ).replace(tzinfo=None)

            if payment["expires_at"] <= now:
                raise BadRequestError(
                    "This checkout session has expired"
                )

        # ----------------------------------------------------
        # CLEAN INPUT
        # ----------------------------------------------------

        utr_number = utr_number.strip()
        payer_upi_id = payer_upi_id.strip()
        payer_phone = payer_phone.strip()

        if not utr_number:
            raise BadRequestError(
                "UTR number is required"
            )

        if not payer_upi_id:
            raise BadRequestError(
                "Payer UPI ID is required"
            )

        if not payer_phone:
            raise BadRequestError(
                "Payer phone is required"
            )

        # ----------------------------------------------------
        # DUPLICATE UTR
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM marketplace_payments

            WHERE utr_number = %s
              AND id != %s

            LIMIT 1
            """,
            (
                utr_number,
                payment_id,
            ),
        )

        duplicate = cursor.fetchone()

        if duplicate:
            raise ConflictError(
                "This UTR has already been submitted"
            )

        # ----------------------------------------------------
        # SAVE UTR
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments

            SET
                utr_number = %s,
                payer_upi_id = %s,
                payer_phone = %s,
                submitted_at = CURRENT_TIMESTAMP,
                status = 'PENDING'

            WHERE id = %s
              AND buyer_id = %s
              AND status = 'PENDING'
            """,
            (
                utr_number,
                payer_upi_id,
                payer_phone,
                payment_id,
                user_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Payment submission could not be saved"
            )

        connection.commit()

        return {
            "message": (
                "UPI payment details submitted. "
                "Payment is awaiting admin verification."
            ),
            "payment_id": payment_id,
            "order_id": payment["order_id"],
            "status": "PENDING",
            "amount": payment["amount"],
            "currency": "INR",
            "utr_number": utr_number,
            "payer_upi_id": payer_upi_id,
            "payer_phone": payer_phone,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# SUPER ADMIN — PENDING PAYMENTS
#
# Super Admin can review marketplace payments across all
# institutions.
# ============================================================


def get_pending_payments():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                mp.id AS payment_id,
                mp.order_id,
                mp.buyer_id,

                bu.full_name AS buyer_name,
                bu.email AS buyer_email,

                mp.payment_method,
                mp.status,
                mp.amount,
                mp.currency,

                mp.utr_number,
                mp.payer_upi_id,
                mp.payer_phone,
                mp.submitted_at,

                o.institution_id,
                i.name AS institution_name,
                o.status AS order_status,
                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,
                o.created_at AS order_created_at

            FROM marketplace_payments mp

            INNER JOIN marketplace_orders o
                ON o.id = mp.order_id

            LEFT JOIN users bu
                ON bu.id = mp.buyer_id

            LEFT JOIN institutions i
                ON i.id = o.institution_id

            WHERE mp.status = 'PENDING'
              AND mp.utr_number IS NOT NULL
              AND o.status = 'PENDING'

            ORDER BY
                mp.submitted_at ASC,
                mp.id ASC
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# SUPER ADMIN — VERIFY PAYMENT
#
# THIS IS THE ONLY PLACE WHERE A MANUAL UPI PAYMENT
# BECOMES PAID.
# ============================================================


def verify_payment(
    payment_id: int,
    super_admin_id: int,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # LOCK PAYMENT + ORDER
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                mp.id AS payment_id,
                mp.order_id,
                mp.buyer_id,
                mp.status AS payment_status,
                mp.amount,
                mp.utr_number,
                mp.payer_upi_id,
                mp.payer_phone,
                mp.submitted_at,

                o.institution_id,
                o.status AS order_status,
                o.expires_at,
                o.total_amount

            FROM marketplace_payments mp

            INNER JOIN marketplace_orders o
                ON o.id = mp.order_id

            WHERE mp.id = %s

            FOR UPDATE
            """,
            (payment_id,),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "Payment not found"
            )

        # ----------------------------------------------------
        # IDEMPOTENCY
        # ----------------------------------------------------

        if payment["payment_status"] == "PAID":
            connection.commit()

            return {
                "message": "Payment is already verified",
                "payment_id": payment_id,
                "order_id": payment["order_id"],
                "payment_status": "PAID",
                "order_status": payment["order_status"],
            }

        if payment["payment_status"] != "PENDING":
            raise BadRequestError(
                "Only PENDING payments can be verified"
            )

        if payment["order_status"] != "PENDING":
            raise ConflictError(
                "Order is not pending"
            )

        # ----------------------------------------------------
        # UTR REQUIRED
        # ----------------------------------------------------

        if not payment["utr_number"]:
            raise BadRequestError(
                "Buyer has not submitted a UTR"
            )

        # ----------------------------------------------------
        # PAYER DETAILS REQUIRED
        # ----------------------------------------------------

        if not payment["payer_upi_id"]:
            raise BadRequestError(
                "Buyer has not submitted the payer UPI ID"
            )

        if not payment["payer_phone"]:
            raise BadRequestError(
                "Buyer has not submitted the payer phone number"
            )

        # ----------------------------------------------------
        # CHECK EXPIRY
        #
        # IMPORTANT:
        #
        # The checkout may expire before the Super Admin
        # gets time to manually verify the actual UPI payment.
        #
        # If the buyer submitted the UTR BEFORE expiry,
        # verification remains allowed.
        # ----------------------------------------------------

        if payment["expires_at"] is not None:
            now = datetime.now(
                timezone.utc
            ).replace(tzinfo=None)

            if payment["expires_at"] <= now:

                submitted_at = payment.get(
                    "submitted_at"
                )

                if not submitted_at:
                    raise BadRequestError(
                        "This order has expired and no UTR was submitted before expiry"
                    )

                if submitted_at > payment["expires_at"]:
                    raise BadRequestError(
                        "The UTR was submitted after the checkout expired"
                    )

        # ----------------------------------------------------
        # AMOUNT MUST MATCH ORDER
        # ----------------------------------------------------

        if payment["amount"] != payment["total_amount"]:
            raise ConflictError(
                "Payment amount does not match order total"
            )

        # ----------------------------------------------------
        # MARK PAYMENT PAID
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
                super_admin_id,
                payment_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Payment could not be verified"
            )

        # ----------------------------------------------------
        # FINALIZE INVENTORY
        # ----------------------------------------------------

        finalize_order_inventory(
            payment["order_id"],
            cursor,
        )

        # ----------------------------------------------------
        # CONFIRM ORDER
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_orders

            SET
                status = 'CONFIRMED'

            WHERE id = %s
              AND status = 'PENDING'
            """,
            (payment["order_id"],),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Order could not be confirmed"
            )

        # ----------------------------------------------------
        # CREATE RECEIPT
        # ----------------------------------------------------

        receipt = create_receipt_for_payment(
            order_id=payment["order_id"],
            payment_id=payment_id,
            amount=payment["amount"],
            cursor=cursor,
        )

        connection.commit()

        return {
            "message": (
                "Payment verified and order confirmed"
            ),
            "payment_id": payment_id,
            "order_id": payment["order_id"],
            "payment_status": "PAID",
            "order_status": "CONFIRMED",
            "utr_number": payment["utr_number"],
            "verified_by": super_admin_id,
            "receipt": receipt,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()