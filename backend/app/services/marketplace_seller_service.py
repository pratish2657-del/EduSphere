from app.core.exceptions import BadRequestError
from app.database import get_connection


def get_seller_payout(user_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT user_id, enabled, preferred_upi_app, upi_id,
                   account_holder_name, payout_status,
                   razorpay_linked_account_id, created_at, updated_at
            FROM marketplace_seller_payouts
            WHERE user_id = %s
        """, (user_id,))
        row = cursor.fetchone()
        if not row:
            return {
                "user_id": user_id,
                "enabled": False,
                "preferred_upi_app": None,
                "upi_id": None,
                "account_holder_name": None,
                "payout_status": "NOT_CONFIGURED",
                "razorpay_linked_account_id": None,
            }
        return row
    finally:
        connection.close()


def save_seller_payout(user_id, data):
    if data.enabled:
        if not data.preferred_upi_app:
            raise BadRequestError("Please select your preferred UPI app")
        if not data.upi_id or not data.upi_id.strip():
            raise BadRequestError("Please enter your UPI ID")
        if not data.account_holder_name or not data.account_holder_name.strip():
            raise BadRequestError("Please enter the account holder name")

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO marketplace_seller_payouts
                (user_id, enabled, preferred_upi_app, upi_id,
                 account_holder_name, payout_status)
            VALUES (%s, %s, %s, %s, %s, 'PENDING_VERIFICATION')
            ON DUPLICATE KEY UPDATE
                enabled = VALUES(enabled),
                preferred_upi_app = VALUES(preferred_upi_app),
                upi_id = VALUES(upi_id),
                account_holder_name = VALUES(account_holder_name),
                payout_status = CASE
                    WHEN VALUES(enabled) = 0 THEN 'NOT_CONFIGURED'
                    ELSE 'PENDING_VERIFICATION'
                END,
                updated_at = CURRENT_TIMESTAMP
        """, (
            user_id,
            data.enabled,
            data.preferred_upi_app,
            data.upi_id.strip() if data.upi_id else None,
            data.account_holder_name.strip() if data.account_holder_name else None,
        ))
        connection.commit()
        return get_seller_payout(user_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
