from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.database import get_connection
from app.services.marketplace_inventory_service import (
    expire_pending_orders,
    finalize_order_inventory,
)
from app.services.marketplace_payout_service import attempt_cashfree_split
from app.services.payment_gateway_service import (
    create_gateway_order,
    get_gateway_order,
)

# ============================================================
# CREATE PAYMENT
# BUYER
#
# Creates a PENDING Cashfree payment.
# It does NOT mark the order as paid.
# ============================================================


def create_payment(user_id, order_id):

    # Release abandoned checkout reservations before
    # checking stock/payment state.
    expire_pending_orders()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find buyer's order
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                buyer_id,
                total_amount,
                platform_fee_percent,
                platform_fee_amount,
                seller_net_amount,
                status,
                expires_at

            FROM marketplace_orders

            WHERE id = %s
              AND buyer_id = %s
            """,
            (order_id, user_id),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError("Order not found")

        # ----------------------------------------------------
        # Already confirmed
        # ----------------------------------------------------

        if order["status"] == "CONFIRMED":
            raise ConflictError(
                "Order has already been confirmed"
            )

        if order["status"] in ["CANCELLED", "REFUNDED"]:
            raise BadRequestError(
                "Payment cannot be created for this order"
            )

        # ----------------------------------------------------
        # Check checkout expiry
        # ----------------------------------------------------

        if order["expires_at"] is not None:

            cursor.execute(
                """
                SELECT
                    CURRENT_TIMESTAMP AS now,
                    expires_at

                FROM marketplace_orders

                WHERE id = %s
                """,
                (order_id,),
            )

            expiry = cursor.fetchone()

            if expiry and expiry["expires_at"] <= expiry["now"]:
                raise BadRequestError(
                    "This checkout session has expired. "
                    "Please create a new order."
                )

        # ----------------------------------------------------
        # Server-controlled amount
        # ----------------------------------------------------

        amount = order["total_amount"]

        if amount is None:
            raise BadRequestError(
                "Order amount is invalid"
            )

        if amount <= 0:
            raise BadRequestError(
                "Order amount must be greater than zero"
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
                status,
                amount,
                currency,
                gateway,
                gateway_order_id

            FROM marketplace_payments

            WHERE order_id = %s

            FOR UPDATE
            """,
            (order_id,),
        )

        existing_payment = cursor.fetchone()

        # ----------------------------------------------------
        # Already paid
        # ----------------------------------------------------

        if existing_payment:

            if existing_payment["status"] == "PAID":
                raise ConflictError(
                    "Order has already been paid"
                )

            # ------------------------------------------------
            # Existing Cashfree order
            # ------------------------------------------------

            if (
                existing_payment["gateway_order_id"]
                and existing_payment["gateway"] == "CASHFREE"
            ):
                # The browser needs a Payment Session ID to open Cashfree
                # checkout. Recover it from Cashfree for an existing local
                # payment instead of trying to create the same order again.
                existing_gateway_order = get_gateway_order(
                    existing_payment["gateway_order_id"]
                )
                existing_payment_session_id = (
                    existing_gateway_order.get("payment_session_id")
                )

                if not existing_payment_session_id:
                    raise ServiceUnavailableError(
                        "Cashfree did not return a payment session for "
                        "the existing order"
                    )

                connection.commit()

                return {
                    "message": "Payment already exists",
                    "payment_id": existing_payment["id"],
                    "order_id": order_id,
                    "gateway": existing_payment["gateway"],
                    "gateway_order_id": (
                        existing_payment["gateway_order_id"]
                    ),
                    "payment_session_id": existing_payment_session_id,
                    "amount": existing_payment["amount"],
                    "currency": existing_payment["currency"],
                    "status": existing_payment["status"],
                    "platform_fee_percent": (
                        order["platform_fee_percent"]
                    ),
                    "platform_fee_amount": (
                        order["platform_fee_amount"]
                    ),
                    "seller_net_amount": (
                        order["seller_net_amount"]
                    ),
                }

        # ----------------------------------------------------
        # Create local payment record
        # ----------------------------------------------------

        if not existing_payment:

            cursor.execute(
                """
                INSERT INTO marketplace_payments (
                    order_id,
                    buyer_id,
                    amount,
                    currency,
                    payment_method,
                    gateway,
                    status
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    'INR',
                    'UPI',
                    'CASHFREE',
                    'PENDING'
                )
                """,
                (
                    order_id,
                    user_id,
                    amount,
                ),
            )

            payment_id = cursor.lastrowid

        else:
            payment_id = existing_payment["id"]

        # ----------------------------------------------------
        # Create Cashfree Sandbox order
        # ----------------------------------------------------

        # Cashfree order IDs must be unique.  The old implementation used
        # EDU-{order_id}, which becomes a duplicate when the same EduSphere
        # checkout is retried after Cashfree has already created the remote
        # order.  Include the local payment ID so every payment attempt gets
        # a unique Cashfree order ID while retries of this same local payment
        # remain idempotent.
        gateway_order = create_gateway_order(
            amount=amount,
            receipt=f"EDU-{order_id}-PAY-{payment_id}",
            notify_url=(
                "https://edusphere-fovh.onrender.com/"
                "marketplace/payments/webhook"
            ),
            notes={
                "edusphere_order_id": str(order_id),
                "edusphere_payment_id": str(payment_id),
            },
        )

        gateway_order_id = gateway_order["order_id"]
        payment_session_id = gateway_order["payment_session_id"]

        # ----------------------------------------------------
        # Save Cashfree order ID
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments

            SET
                gateway = 'CASHFREE',
                payment_method = 'UPI',
                gateway_order_id = %s,
                status = 'PENDING'

            WHERE id = %s
            """,
            (
                gateway_order_id,
                payment_id,
            ),
        )

        connection.commit()

        return {
            "message": "Cashfree payment order created",
            "payment_id": payment_id,
            "order_id": order_id,
            "gateway": "CASHFREE",
            "gateway_order_id": gateway_order_id,
            "payment_session_id": payment_session_id,
            "amount": amount,
            "currency": "INR",
            "status": "PENDING",
            "platform_fee_percent": (
                order["platform_fee_percent"]
            ),
            "platform_fee_amount": (
                order["platform_fee_amount"]
            ),
            "seller_net_amount": (
                order["seller_net_amount"]
            ),
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


def get_payment(payment_id, user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                mp.id AS payment_id,
                mp.order_id,
                mp.buyer_id,

                mp.amount,
                mp.currency,

                mp.payment_method,
                mp.gateway,

                mp.gateway_order_id,
                mp.gateway_payment_id,

                mp.status,
                mp.paid_at,

                mp.created_at,
                mp.updated_at

            FROM marketplace_payments mp

            WHERE mp.id = %s
              AND mp.buyer_id = %s
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

        return payment

    finally:
        connection.close()


# ============================================================
# GET ORDER PAYMENT
# BUYER — OWN ORDER ONLY
# ============================================================


def get_order_payment(order_id, user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                mp.id AS payment_id,
                mp.order_id,
                mp.buyer_id,

                mp.amount,
                mp.currency,

                mp.payment_method,
                mp.gateway,

                mp.gateway_order_id,
                mp.gateway_payment_id,

                mp.status,
                mp.paid_at,

                mp.created_at,
                mp.updated_at

            FROM marketplace_payments mp

            WHERE mp.order_id = %s
              AND mp.buyer_id = %s
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

        return payment

    finally:
        connection.close()


# ============================================================
# VERIFY PAYMENT
# BUYER
#
# Cashfree is the authoritative payment source.
#
# The browser does NOT determine payment success.
#
# Verification flow:
#
# 1. Buyer owns the order
# 2. Cashfree order ID matches our database
# 3. Ask Cashfree for current order status
# 4. Verify Cashfree amount
# 5. Require order_status == PAID
# 6. Mark local payment PAID
# 7. Finalize inventory
# 8. Confirm marketplace order
# ============================================================


def verify_payment(
    user_id,
    order_id,
    gateway_order_id,
    gateway_payment_id=None,
    gateway_signature=None,
):
    """
    Verify a Cashfree payment server-side.

    The browser cannot decide whether a payment succeeded.

    EduSphere asks Cashfree for the authoritative order status
    and only marks the local payment as PAID when Cashfree
    confirms that the order is PAID.

    gateway_payment_id is optional because Cashfree order-status
    verification does not require the browser to provide a
    payment ID.

    gateway_signature is retained for schema compatibility but
    is not trusted for payment confirmation.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find our payment
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                amount,
                status,
                gateway,
                gateway_order_id

            FROM marketplace_payments

            WHERE order_id = %s
              AND buyer_id = %s

            FOR UPDATE
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

        # ----------------------------------------------------
        # Idempotency
        # ----------------------------------------------------

        if payment["status"] == "PAID":

            connection.commit()

            return {
                "message": "Payment already verified",
                "payment_id": payment["id"],
                "order_id": order_id,
                "status": "PAID",
            }

        # ----------------------------------------------------
        # Verify gateway
        # ----------------------------------------------------

        if payment["gateway"] != "CASHFREE":
            raise BadRequestError(
                "Payment does not belong to Cashfree"
            )

        # ----------------------------------------------------
        # Verify gateway order ID against our database
        # ----------------------------------------------------

        if (
            not gateway_order_id
            or payment["gateway_order_id"]
            != gateway_order_id
        ):
            raise BadRequestError(
                "Payment gateway order mismatch"
            )

        # ----------------------------------------------------
        # Ask Cashfree for the authoritative order status
        # ----------------------------------------------------

        gateway_order = get_gateway_order(
            payment["gateway_order_id"]
        )

        gateway_status = str(
            gateway_order.get(
                "order_status",
                "",
            )
        ).upper()

        # ----------------------------------------------------
        # Verify Cashfree amount against our database
        # ----------------------------------------------------

        gateway_amount = gateway_order.get(
            "order_amount"
        )

        if gateway_amount is None:
            raise BadRequestError(
                "Cashfree order amount is missing"
            )

        try:
            local_amount = float(
                payment["amount"]
            )

            cashfree_amount = float(
                gateway_amount
            )

        except (TypeError, ValueError) as error:
            raise BadRequestError(
                "Invalid payment amount returned by Cashfree"
            ) from error

        if cashfree_amount != local_amount:
            raise ConflictError(
                "Cashfree payment amount does not "
                "match the EduSphere order amount"
            )

        # ----------------------------------------------------
        # Payment is not successful yet
        # ----------------------------------------------------

        if gateway_status != "PAID":

            connection.commit()

            return {
                "message": (
                    "Cashfree payment is not completed"
                ),
                "payment_id": payment["id"],
                "order_id": order_id,
                "status": "PENDING",
                "gateway_status": gateway_status,
            }

        # ----------------------------------------------------
        # Mark payment PAID
        #
        # gateway_payment_id is optional.
        #
        # The frontend must NEVER send the Cashfree order ID
        # as the payment ID.
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments

            SET
                gateway = 'CASHFREE',
                payment_method = 'UPI',
                gateway_payment_id = %s,
                status = 'PAID',
                paid_at = CURRENT_TIMESTAMP

            WHERE id = %s
              AND status != 'PAID'
            """,
            (
                gateway_payment_id,
                payment["id"],
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Payment could not be marked as paid"
            )

        # ----------------------------------------------------
        # Convert reservation into completed sale
        # ----------------------------------------------------

        finalize_order_inventory(
            order_id,
            cursor,
        )

        # ----------------------------------------------------
        # Confirm marketplace order
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_orders

            SET
                status = 'CONFIRMED'

            WHERE id = %s
              AND buyer_id = %s
              AND status = 'PENDING'
            """,
            (
                order_id,
                user_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Marketplace order could not be confirmed"
            )

        connection.commit()

        # Easy Split is downstream of a successful customer payment.
        # A missing/unverified seller must not roll back the paid order; the
        # payout UI can retry the split after seller onboarding is complete.
        attempt_cashfree_split(order_id)

        return {
            "message": (
                "Cashfree payment verified successfully"
            ),
            "payment_id": payment["id"],
            "order_id": order_id,
            "status": "PAID",
            "gateway": "CASHFREE",
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# MARK COD PAYMENT COLLECTED
# ADMIN / SUPER ADMIN
#
# COD is not a Cashfree transaction.
#
# Staff confirm cash collection, then the local payment becomes
# PAID and the seller payout ledger becomes READY.
# ============================================================


def mark_cod_payment_collected(
    payment_id,
    admin_user_id,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                mp.id AS payment_id,
                mp.order_id,
                mp.buyer_id,
                mp.amount,
                mp.payment_method,
                mp.gateway,
                mp.status AS payment_status,
                o.status AS order_status,
                o.institution_id

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
        # Admin authorization
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT role
            FROM users
            WHERE id = %s
            LIMIT 1
            """,
            (admin_user_id,),
        )

        admin = cursor.fetchone()

        role = str(
            (admin or {}).get("role") or ""
        ).upper()

        if role not in {
            "ADMIN",
            "SUPER_ADMIN",
        }:
            raise BadRequestError(
                "Administrator access is required"
            )

        # ----------------------------------------------------
        # Institution restriction for ADMIN
        # ----------------------------------------------------

        if role == "ADMIN":

            cursor.execute(
                """
                SELECT 1

                FROM admin_profiles

                WHERE user_id = %s
                  AND institution_id = %s

                LIMIT 1
                """,
                (
                    admin_user_id,
                    payment["institution_id"],
                ),
            )

            if not cursor.fetchone():
                raise BadRequestError(
                    "You cannot collect a COD payment "
                    "outside your institution"
                )

        # ----------------------------------------------------
        # Verify COD payment
        # ----------------------------------------------------

        if (
            str(
                payment["payment_method"] or ""
            ).upper()
            != "COD"
        ):
            raise BadRequestError(
                "This payment is not a Cash on Delivery payment"
            )

        if (
            str(
                payment["payment_status"] or ""
            ).upper()
            == "PAID"
        ):
            return {
                "message": (
                    "COD payment was already "
                    "marked as collected"
                ),
                "payment_id": payment_id,
                "order_id": payment["order_id"],
                "status": "PAID",
            }

        if (
            str(
                payment["payment_status"] or ""
            ).upper()
            != "PENDING"
        ):
            raise ConflictError(
                "Only a pending COD payment can "
                "be marked as collected"
            )

        if (
            str(
                payment["order_status"] or ""
            ).upper()
            in {
                "CANCELLED",
                "REFUNDED",
            }
        ):
            raise BadRequestError(
                "A cancelled or refunded order "
                "cannot be collected"
            )

        # ----------------------------------------------------
        # Mark COD payment PAID
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments

            SET
                status = 'PAID',
                paid_at = CURRENT_TIMESTAMP,
                gateway = 'COD',
                payment_method = 'COD'

            WHERE id = %s
              AND status = 'PENDING'
              AND payment_method = 'COD'
            """,
            (payment_id,),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "COD payment could not be marked as collected"
            )

        # ----------------------------------------------------
        # Prepare seller payout ledger
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_seller_payout_transactions

            SET
                status = CASE
                    WHEN status = 'PENDING'
                    THEN 'READY'
                    ELSE status
                END

            WHERE order_id = %s
              AND status = 'PENDING'
            """,
            (payment["order_id"],),
        )

        connection.commit()

        return {
            "message": (
                "COD payment collected successfully"
            ),
            "payment_id": payment_id,
            "order_id": payment["order_id"],
            "amount": payment["amount"],
            "status": "PAID",
            "payout_status": "READY",
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()