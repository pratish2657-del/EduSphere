import os
from typing import Any

import requests

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.database import get_connection
from app.services.marketplace_inventory_service import restore_order_inventory
from app.services.marketplace_payout_service import attempt_route_transfers

BASE_URL = "https://api.razorpay.com"


def _credentials():
    key_id = os.getenv("PAYMENT_GATEWAY_KEY_ID")
    key_secret = os.getenv("PAYMENT_GATEWAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise ServiceUnavailableError("Razorpay Route credentials are not configured")
    if os.getenv("RAZORPAY_ROUTE_ENABLED", "false").lower() != "true":
        raise ServiceUnavailableError("Razorpay Route is not enabled for this EduSphere environment")
    return key_id, key_secret


def _rz(method: str, path: str, **kwargs):
    key_id, key_secret = _credentials()
    response = requests.request(method, BASE_URL + path, auth=(key_id, key_secret), timeout=20, **kwargs)
    try:
        payload = response.json() if response.content else {}
    except ValueError:
        payload = {"raw": response.text}
    if not response.ok:
        detail = payload.get("error") or payload.get("description") or response.text[:1000]
        raise BadRequestError(f"Razorpay Route error: {detail}")
    return payload


def get_route_onboarding(user_id: int) -> dict[str, Any]:
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT user_id, enabled, payout_status, razorpay_linked_account_id,
                   razorpay_stakeholder_id, razorpay_product_id,
                   route_activation_status, bank_account_last4, bank_ifsc,
                   onboarding_error, payout_verified_at
            FROM marketplace_seller_payouts
            WHERE user_id=%s
            LIMIT 1
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {"user_id": user_id, "payout_status": "NOT_CONFIGURED", "route_activation_status": None}
        return row
    finally:
        connection.close()



def refresh_route_status(user_id: int) -> dict[str, Any]:
    """Refresh the seller's Route product activation status from Razorpay."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT razorpay_linked_account_id, razorpay_product_id,
                   payout_status, route_activation_status
            FROM marketplace_seller_payouts
            WHERE user_id=%s
            LIMIT 1
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if not row or not row.get("razorpay_linked_account_id") or not row.get("razorpay_product_id"):
            return get_route_onboarding(user_id)

        account_id = row["razorpay_linked_account_id"]
        product_id = row["razorpay_product_id"]
        product = _rz("GET", f"/v2/accounts/{account_id}/products/{product_id}")

        active = (product.get("active_configuration") or {}).get("activation_status")
        requested = (product.get("requested_configuration") or {}).get("activation_status")
        activation = active or requested or product.get("activation_status") or "under_review"

        if activation == "activated":
            payout_status = "VERIFIED"
        elif activation in {"suspended", "rejected"}:
            payout_status = "REJECTED"
        else:
            payout_status = "PENDING_VERIFICATION"

        cursor.execute(
            """
            UPDATE marketplace_seller_payouts
            SET payout_status=%s,
                route_activation_status=%s,
                onboarding_error=NULL,
                payout_verified_at=CASE
                    WHEN %s='VERIFIED' THEN COALESCE(payout_verified_at, CURRENT_TIMESTAMP)
                    ELSE payout_verified_at
                END,
                updated_at=CURRENT_TIMESTAMP
            WHERE user_id=%s
            """,
            (payout_status, activation, payout_status, user_id),
        )
        connection.commit()
        return get_route_onboarding(user_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def retry_payout(payout_transaction_id: int, actor_user_id: int) -> dict[str, Any]:
    """Retry/reconcile a single seller payout after Route onboarding is active."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT pt.id, pt.order_id, pt.status, pt.razorpay_transfer_id,
                   p.gateway_payment_id
            FROM marketplace_seller_payout_transactions pt
            JOIN marketplace_payments p ON p.order_id=pt.order_id
            WHERE pt.id=%s
            LIMIT 1
            """,
            (payout_transaction_id,),
        )
        payout = cursor.fetchone()
        if not payout:
            raise NotFoundError("Payout transaction not found")
        if payout["status"] in {"SETTLED", "REVERSED"}:
            raise ConflictError("This payout does not need a retry")
        if not payout["gateway_payment_id"]:
            raise BadRequestError("Captured Razorpay payment ID is missing")

        result = attempt_route_transfers(
            order_id=payout["order_id"],
            gateway_payment_id=payout["gateway_payment_id"],
        )
        return {
            "success": True,
            "payout_transaction_id": payout_transaction_id,
            "result": result,
        }
    finally:
        connection.close()


def list_refunds() -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT r.id, r.order_id, r.payment_id, r.buyer_id,
                   u.full_name AS buyer_name, u.email AS buyer_email,
                   r.amount, r.reverse_transfers, r.razorpay_refund_id,
                   r.status, r.failure_reason, r.created_at, r.processed_at
            FROM marketplace_refunds r
            JOIN users u ON u.id=r.buyer_id
            ORDER BY r.created_at DESC
            LIMIT 1000
            """
        )
        return cursor.fetchall()
    finally:
        connection.close()


def submit_route_onboarding(user_id: int, data) -> dict[str, Any]:
    if not data.accept_terms:
        raise BadRequestError("You must accept the Razorpay Route terms before onboarding")

    # Never store the full bank account number in EduSphere. It is sent directly
    # to Razorpay's Route onboarding API and only the last four digits are retained.
    phone = "".join(ch for ch in data.phone if ch.isdigit())
    if not phone:
        raise BadRequestError("A valid phone number is required")

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT email, full_name FROM users WHERE id=%s LIMIT 1", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise NotFoundError("Seller account not found")

        cursor.execute(
            "SELECT razorpay_linked_account_id FROM marketplace_seller_payouts WHERE user_id=%s LIMIT 1",
            (user_id,),
        )
        existing = cursor.fetchone()
        if existing and existing.get("razorpay_linked_account_id"):
            raise ConflictError("Route onboarding already exists. Complete or update the existing onboarding instead.")

        email = data.stakeholder_email or user["email"]
        reference_id = f"EDUSELLER{user_id}"
        account_payload = {
            "email": user["email"],
            "phone": phone,
            "legal_business_name": data.legal_business_name,
            "customer_facing_business_name": data.customer_facing_business_name,
            "business_type": data.business_type,
            "reference_id": reference_id,
            "profile": {"category": "education", "subcategory": "educational_materials"},
            "contact_info": {"contact_name": data.stakeholder_name},
            "notes": {"edusphere_user_id": str(user_id)},
        }
        account = _rz("POST", "/v2/accounts", json=account_payload)
        account_id = account.get("id")
        if not account_id:
            raise BadRequestError("Razorpay did not return a Linked Account ID")

        stakeholder_payload = {
            "name": data.stakeholder_name,
            "email": email,
            "relationship": {"director": False, "executive": True},
            "phone": {"primary": phone},
            "notes": {"edusphere_user_id": str(user_id)},
        }
        stakeholder = _rz("POST", f"/v2/accounts/{account_id}/stakeholders", json=stakeholder_payload)
        stakeholder_id = stakeholder.get("id")

        product = _rz(
            "POST",
            f"/v2/accounts/{account_id}/products",
            json={"product_name": "route", "tnc_accepted": True},
        )
        product_id = product.get("id")
        if not product_id:
            raise BadRequestError("Razorpay did not return a Route product ID")

        configuration = _rz(
            "PATCH",
            f"/v2/accounts/{account_id}/products/{product_id}",
            json={
                "settlements": {
                    "account_number": data.bank_account_number,
                    "ifsc_code": data.ifsc_code.upper().strip(),
                    "beneficiary_name": data.beneficiary_name.strip(),
                },
                "tnc_accepted": True,
            },
        )

        activation = configuration.get("active_configuration", {}).get("activation_status") or product.get("activation_status") or "under_review"
        payout_status = "VERIFIED" if activation == "activated" else "PENDING_VERIFICATION"

        cursor.execute(
            """
            INSERT INTO marketplace_seller_payouts
                (user_id, enabled, payout_status, razorpay_linked_account_id,
                 razorpay_stakeholder_id, razorpay_product_id, route_activation_status,
                 account_holder_name, bank_account_last4, bank_ifsc, onboarding_error,
                 payout_verified_at)
            VALUES (%s, TRUE, %s, %s, %s, %s, %s, %s, %s, %s, NULL,
                    CASE WHEN %s='VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END)
            ON DUPLICATE KEY UPDATE
                enabled=TRUE,
                payout_status=VALUES(payout_status),
                razorpay_linked_account_id=VALUES(razorpay_linked_account_id),
                razorpay_stakeholder_id=VALUES(razorpay_stakeholder_id),
                razorpay_product_id=VALUES(razorpay_product_id),
                route_activation_status=VALUES(route_activation_status),
                account_holder_name=VALUES(account_holder_name),
                bank_account_last4=VALUES(bank_account_last4),
                bank_ifsc=VALUES(bank_ifsc),
                onboarding_error=NULL,
                payout_verified_at=CASE WHEN VALUES(payout_status)='VERIFIED' THEN CURRENT_TIMESTAMP ELSE payout_verified_at END,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                user_id, payout_status, account_id, stakeholder_id, product_id,
                activation, data.beneficiary_name.strip(), data.bank_account_number[-4:],
                data.ifsc_code.upper().strip(), payout_status,
            ),
        )
        connection.commit()
        return {"success": True, "account_id": account_id, "product_id": product_id, "activation_status": activation, "payout_status": payout_status}
    except requests.RequestException as error:
        connection.rollback()
        try:
            cursor.execute(
                "UPDATE marketplace_seller_payouts SET onboarding_error=%s, payout_status='REJECTED', updated_at=CURRENT_TIMESTAMP WHERE user_id=%s",
                (str(error)[:2000], user_id),
            )
            connection.commit()
        except requests.RequestException:
            connection.rollback()
        raise
    finally:
        connection.close()


def list_payouts(actor_user_id: int) -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT pt.id, pt.order_id, pt.seller_id, u.full_name AS seller_name,
                   u.email AS seller_email, pt.gross_amount, pt.platform_fee_amount,
                   pt.seller_amount, pt.status, pt.razorpay_linked_account_id,
                   pt.razorpay_transfer_id, pt.transfer_status, pt.settlement_status,
                   pt.failure_reason, pt.created_at, pt.settled_at,
                   sp.payout_status, sp.route_activation_status,
                   CASE
                     WHEN pt.status IN ('TRANSFER_INITIATED','SETTLED') THEN 'REVERSE'
                     WHEN sp.payout_status='VERIFIED' AND pt.status IN ('PENDING','READY','FAILED') THEN 'RETRY'
                     WHEN sp.payout_status IS NULL OR sp.payout_status <> 'VERIFIED' THEN 'SELLER_ONBOARDING_REQUIRED'
                     ELSE 'WAITING'
                   END AS action
            FROM marketplace_seller_payout_transactions pt
            JOIN users u ON u.id=pt.seller_id
            LEFT JOIN marketplace_seller_payouts sp ON sp.user_id=pt.seller_id
            ORDER BY pt.created_at DESC
            LIMIT 1000
            """
        )
        return cursor.fetchall()
    finally:
        connection.close()


def reverse_payout(payout_transaction_id: int, created_by: int, amount: float | None = None, reason: str | None = None):
    payout = None
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT * FROM marketplace_seller_payout_transactions WHERE id=%s FOR UPDATE",
            (payout_transaction_id,),
        )
        payout = cursor.fetchone()
        if not payout:
            raise NotFoundError("Payout transaction not found")
        if not payout.get("razorpay_transfer_id"):
            raise BadRequestError("This payout has no Razorpay transfer to reverse")
        if payout.get("status") not in {"TRANSFER_INITIATED", "SETTLED"}:
            raise BadRequestError("Only initiated or settled payouts can be reversed")

        requested = round((amount if amount is not None else float(payout["seller_amount"])) * 100)
        if requested < 100:
            raise BadRequestError("Reversal amount must be at least ₹1")

        payload = _rz(
            "POST",
            f"/v1/transfers/{payout['razorpay_transfer_id']}/reversals",
            json={"amount": requested, "notes": {"reason": reason or "EduSphere marketplace reversal", "payout_transaction_id": str(payout_transaction_id)}},
        )
        reversal_id = payload.get("id")
        if not reversal_id:
            raise BadRequestError("Razorpay did not return a reversal ID")

        cursor.execute(
            """
            INSERT INTO marketplace_payout_reversals
                (payout_transaction_id, amount, razorpay_reversal_id, status, created_by, processed_at)
            VALUES (%s, %s, %s, 'PROCESSED', %s, CURRENT_TIMESTAMP)
            """,
            (payout_transaction_id, requested / 100, reversal_id, created_by),
        )
        cursor.execute(
            "UPDATE marketplace_seller_payout_transactions SET status='REVERSED', failure_reason=NULL WHERE id=%s",
            (payout_transaction_id,),
        )
        connection.commit()
        return {"success": True, "reversal_id": reversal_id, "amount": requested / 100}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def cancel_marketplace_order(order_id: int, admin_user_id: int, reason: str | None = None):
    """Safely cancel an order and reconcile COD payment, inventory and payout."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                o.id AS order_id,
                o.buyer_id,
                o.institution_id,
                o.status AS order_status,
                mp.id AS payment_id,
                mp.payment_method,
                mp.status AS payment_status
            FROM marketplace_orders o
            LEFT JOIN marketplace_payments mp ON mp.order_id=o.id
            WHERE o.id=%s
            FOR UPDATE
            """,
            (order_id,),
        )
        order = cursor.fetchone()
        if not order:
            raise NotFoundError("Marketplace order not found")

        cursor.execute("SELECT role FROM users WHERE id=%s LIMIT 1", (admin_user_id,))
        admin = cursor.fetchone()
        role = str((admin or {}).get("role") or "").upper()
        if role not in {"ADMIN", "SUPER_ADMIN"}:
            raise BadRequestError("Administrator access is required")

        if role == "ADMIN":
            cursor.execute(
                """
                SELECT 1 FROM admin_profiles
                WHERE user_id=%s AND institution_id=%s
                LIMIT 1
                """,
                (admin_user_id, order["institution_id"]),
            )
            if not cursor.fetchone():
                raise BadRequestError("You cannot cancel an order outside your institution")

        if str(order["order_status"] or "").upper() == "REFUNDED":
            raise BadRequestError("A refunded order cannot be cancelled")

        if str(order["order_status"] or "").upper() == "CANCELLED":
            return {"message": "Order was already cancelled", "order_id": order_id, "status": "CANCELLED"}

        if order["payment_id"] is not None and str(order["payment_status"] or "").upper() == "PAID":
            raise BadRequestError(
                "This order has already been paid. Use the refund workflow instead of cancellation."
            )

        # Inventory was already consumed/reserved when the COD order was placed.
        # Restore it exactly once as part of the cancellation transaction.
        restore_order_inventory(order_id, cursor)

        if order["payment_id"] is not None:
            cursor.execute(
                """
                UPDATE marketplace_payments
                SET status='CANCELLED', updated_at=CURRENT_TIMESTAMP
                WHERE id=%s AND status='PENDING'
                """,
                (order["payment_id"],),
            )

        cursor.execute(
            """
            UPDATE marketplace_seller_payout_transactions
            SET
                status='REFUNDED',
                failure_reason=%s,
                updated_at=CURRENT_TIMESTAMP
            WHERE order_id=%s
              AND status IN ('PENDING','READY')
            """,
            (reason or "Order cancelled before payment collection", order_id),
        )

        cursor.execute(
            """
            UPDATE marketplace_orders
            SET status='CANCELLED', updated_at=CURRENT_TIMESTAMP
            WHERE id=%s AND status NOT IN ('CANCELLED','REFUNDED')
            """,
            (order_id,),
        )

        connection.commit()
        return {
            "message": "Marketplace order cancelled successfully",
            "order_id": order_id,
            "status": "CANCELLED",
            "payment_status": "CANCELLED" if order["payment_id"] is not None else None,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def refund_payment(payment_db_id: int, created_by: int, amount: float | None = None, reverse_all: bool = True, reason: str | None = None):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT * FROM marketplace_payments WHERE id=%s FOR UPDATE",
            (payment_db_id,),
        )
        payment = cursor.fetchone()
        if not payment:
            raise NotFoundError("Marketplace payment not found")
        if payment.get("status") != "PAID":
            raise BadRequestError("Only paid marketplace payments can be refunded")

        is_cod = str(payment.get("payment_method") or "").upper() == "COD"
        if is_cod:
            # COD is cash, so never call the Razorpay refund API. A collected
            # COD refund is a manual cash refund recorded by an administrator.
            requested_amount = amount if amount is not None else float(payment["amount"])
            if abs(float(requested_amount) - float(payment["amount"])) > 0.0001:
                raise BadRequestError(
                    "COD refunds must refund the full collected amount"
                )
            refund_amount = round(float(payment["amount"]) * 100)
        else:
            if not payment.get("gateway_payment_id"):
                raise BadRequestError("Gateway payment ID is missing")
            refund_amount = round((amount if amount is not None else float(payment["amount"])) * 100)
        if refund_amount < 100:
            raise BadRequestError("Refund amount must be at least ₹1")

        cursor.execute(
            "SELECT COALESCE(SUM(amount),0) AS refunded FROM marketplace_refunds WHERE payment_id=%s AND status='PROCESSED' FOR UPDATE",
            (payment_db_id,),
        )
        refunded = float(cursor.fetchone()["refunded"] or 0)
        if refunded + refund_amount / 100 > float(payment["amount"]) + 0.0001:
            raise ConflictError("Refund amount exceeds the remaining refundable amount")

        if is_cod:
            cursor.execute(
                """
                INSERT INTO marketplace_refunds
                    (order_id, payment_id, buyer_id, amount, reverse_transfers,
                     razorpay_refund_id, status, created_by, processed_at)
                VALUES (%s,%s,%s,%s,%s,NULL,'PROCESSED',%s,CURRENT_TIMESTAMP)
                """,
                (
                    payment["order_id"],
                    payment_db_id,
                    payment["buyer_id"],
                    refund_amount / 100,
                    reverse_all,
                    created_by,
                ),
            )
            refund_db_id = cursor.lastrowid

            restore_order_inventory(payment["order_id"], cursor)

            cursor.execute(
                """
                UPDATE marketplace_payments
                SET status='REFUNDED',
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=%s AND status='PAID' AND payment_method='COD'
                """,
                (payment_db_id,),
            )
            if cursor.rowcount != 1:
                raise ConflictError("COD payment could not be marked as refunded")

            cursor.execute(
                """
                UPDATE marketplace_seller_payout_transactions
                SET
                    status='REFUNDED',
                    failure_reason='Collected COD order manually refunded before payout settlement',
                    updated_at=CURRENT_TIMESTAMP
                WHERE order_id=%s
                  AND status IN ('PENDING','READY')
                """,
                (payment["order_id"],),
            )

            cursor.execute(
                """
                UPDATE marketplace_orders
                SET status='REFUNDED',
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=%s
                  AND status NOT IN ('CANCELLED','REFUNDED')
                """,
                (payment["order_id"],),
            )

            connection.commit()
            return {
                "success": True,
                "refund_id": None,
                "refund_db_id": refund_db_id,
                "amount": refund_amount / 100,
                "reverse_all": reverse_all,
                "gateway": "COD",
                "refund_mode": "MANUAL_CASH",
            }

        payload = _rz(
            "POST",
            f"/v1/payments/{payment['gateway_payment_id']}/refund",
            json={"amount": refund_amount, "reverse_all": bool(reverse_all), "notes": {"reason": reason or "EduSphere marketplace refund", "payment_id": str(payment_db_id)}},
        )
        refund_id = payload.get("id")
        if not refund_id:
            raise BadRequestError("Razorpay did not return a refund ID")

        cursor.execute(
            """
            INSERT INTO marketplace_refunds
                (order_id, payment_id, buyer_id, amount, reverse_transfers,
                 razorpay_refund_id, status, created_by, processed_at)
            VALUES (%s,%s,%s,%s,%s,%s,'PROCESSED',%s,CURRENT_TIMESTAMP)
            """,
            (payment["order_id"], payment_db_id, payment["buyer_id"], refund_amount / 100, reverse_all, refund_id, created_by),
        )
        refund_db_id = cursor.lastrowid

        cursor.execute(
            "SELECT COALESCE(SUM(amount),0) AS total_refunded FROM marketplace_refunds WHERE payment_id=%s AND status='PROCESSED'",
            (payment_db_id,),
        )
        total_refunded = float(cursor.fetchone()["total_refunded"] or 0)
        if total_refunded + 0.0001 >= float(payment["amount"]):
            cursor.execute(
                "SELECT inventory_restored FROM marketplace_refunds WHERE id=%s FOR UPDATE",
                (refund_db_id,),
            )
            # Restore stock only once for a full refund. The migration adds this
            # marker so repeated refund/webhook processing cannot double-restock.
            current_refund = cursor.fetchone()
            if current_refund and not current_refund["inventory_restored"]:
                restore_order_inventory(payment["order_id"], cursor)
                cursor.execute(
                    "UPDATE marketplace_refunds SET inventory_restored=TRUE WHERE id=%s",
                    (refund_db_id,),
                )
            cursor.execute(
                """
                UPDATE marketplace_seller_payout_transactions
                SET
                    status = 'REFUNDED',
                    failure_reason = 'Marketplace payment fully refunded before Route transfer',
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = %s
                    AND status IN ('PENDING', 'READY')
                """,
                (payment["order_id"],),
            )
            cursor.execute(
                """
                UPDATE marketplace_orders
                SET
                    status = 'REFUNDED',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                    AND status <> 'REFUNDED'
                """,
                (payment["order_id"],),
            )
        connection.commit()
        return {"success": True, "refund_id": refund_id, "amount": refund_amount / 100, "reverse_all": reverse_all}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
