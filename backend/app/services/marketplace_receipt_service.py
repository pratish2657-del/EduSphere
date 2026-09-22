from __future__ import annotations

from decimal import Decimal

# ============================================================
# RECEIPT NUMBER
# ============================================================

def _build_receipt_number(order_id: int) -> str:
    """
    Generate a stable receipt number for a marketplace order.

    One receipt is allowed per order, so the order ID provides
    a simple unique receipt reference.
    """
    return f"EDU-MKT-{order_id:08d}"


# ============================================================
# CREATE RECEIPT
# ============================================================

def create_receipt_for_payment(
    order_id: int,
    payment_id: int,
    amount: Decimal,
    cursor,
):
    """
    Create a receipt for a successfully verified payment.

    This function intentionally receives the existing database
    cursor so receipt creation happens inside the same database
    transaction as:

        payment -> PAID
        inventory -> finalized
        order -> CONFIRMED
        receipt -> created
    """

    amount = Decimal(str(amount))

    if amount <= 0:
        raise ValueError(
            "Receipt amount must be greater than zero."
        )

    # --------------------------------------------------------
    # Check whether a receipt already exists.
    #
    # This makes the operation safe if verification is retried.
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            order_id,
            payment_id,
            receipt_number,
            amount,
            currency,
            issued_at
        FROM marketplace_receipts
        WHERE order_id = %s
        LIMIT 1
        """,
        (order_id,),
    )

    existing_receipt = cursor.fetchone()

    if existing_receipt:
        return {
            "receipt_id": existing_receipt["id"],
            "receipt_number": existing_receipt["receipt_number"],
            "order_id": existing_receipt["order_id"],
            "payment_id": existing_receipt["payment_id"],
            "amount": Decimal(
                str(existing_receipt["amount"])
            ),
            "currency": existing_receipt["currency"],
            "issued_at": (
                existing_receipt["issued_at"].isoformat()
                if existing_receipt["issued_at"]
                else None
            ),
        }

    # --------------------------------------------------------
    # Make sure the payment belongs to this order.
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            order_id,
            status,
            amount,
            currency
        FROM marketplace_payments
        WHERE id = %s
        LIMIT 1
        FOR UPDATE
        """,
        (payment_id,),
    )

    payment = cursor.fetchone()

    if not payment:
        raise ValueError("Payment not found.")

    if payment["order_id"] != order_id:
        raise ValueError(
            "Payment does not belong to this order."
        )

    if payment["status"] != "PAID":
        raise ValueError(
            "Receipt can only be generated for a paid payment."
        )

    payment_amount = Decimal(
        str(payment["amount"])
    )

    if payment_amount != amount:
        raise ValueError(
            "Receipt amount does not match payment amount."
        )

    # --------------------------------------------------------
    # Make sure the order is confirmed.
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            status,
            total_amount
        FROM marketplace_orders
        WHERE id = %s
        LIMIT 1
        FOR UPDATE
        """,
        (order_id,),
    )

    order = cursor.fetchone()

    if not order:
        raise ValueError("Order not found.")

    if order["status"] not in (
        "CONFIRMED",
        "PROCESSING",
        "COMPLETED",
    ):
        raise ValueError(
            "Receipt can only be generated for a confirmed order."
        )

    order_amount = Decimal(
        str(order["total_amount"])
    )

    if order_amount != amount:
        raise ValueError(
            "Receipt amount does not match order total."
        )

    # --------------------------------------------------------
    # Generate receipt number.
    # --------------------------------------------------------

    receipt_number = _build_receipt_number(order_id)

    # --------------------------------------------------------
    # Insert receipt.
    # --------------------------------------------------------

    cursor.execute(
        """
        INSERT INTO marketplace_receipts (
            order_id,
            payment_id,
            receipt_number,
            amount,
            currency
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s
        )
        """,
        (
            order_id,
            payment_id,
            receipt_number,
            amount,
            payment["currency"],
        ),
    )

    receipt_id = cursor.lastrowid

    # --------------------------------------------------------
    # Read the created receipt.
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            id,
            order_id,
            payment_id,
            receipt_number,
            amount,
            currency,
            issued_at
        FROM marketplace_receipts
        WHERE id = %s
        LIMIT 1
        """,
        (receipt_id,),
    )

    receipt = cursor.fetchone()

    if not receipt:
        raise ValueError(
            "Receipt could not be created."
        )

    return {
        "receipt_id": receipt["id"],
        "receipt_number": receipt["receipt_number"],
        "order_id": receipt["order_id"],
        "payment_id": receipt["payment_id"],
        "amount": Decimal(
            str(receipt["amount"])
        ),
        "currency": receipt["currency"],
        "issued_at": (
            receipt["issued_at"].isoformat()
            if receipt["issued_at"]
            else None
        ),
    }


# ============================================================
# GET RECEIPT
# ============================================================

def get_receipt_for_order(
    user_id: int,
    order_id: int,
):
    """
    Return a receipt only when it belongs to the authenticated
    buyer.
    """
    from app.core.exceptions import NotFoundError
    from app.database import get_connection

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                r.id AS receipt_id,
                r.order_id,
                r.payment_id,
                r.receipt_number,
                r.amount,
                r.currency,
                r.issued_at,

                o.buyer_id,
                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,
                o.status AS order_status,

                p.status AS payment_status

            FROM marketplace_receipts r

            INNER JOIN marketplace_orders o
                ON o.id = r.order_id

            INNER JOIN marketplace_payments p
                ON p.id = r.payment_id

            WHERE r.order_id = %s
              AND o.buyer_id = %s

            LIMIT 1
            """,
            (
                order_id,
                user_id,
            ),
        )

        receipt = cursor.fetchone()

        if not receipt:
            raise NotFoundError(
                "Receipt not found."
            )

        return {
            "receipt_id": receipt["receipt_id"],
            "receipt_number": receipt["receipt_number"],
            "order_id": receipt["order_id"],
            "payment_id": receipt["payment_id"],
            "amount": Decimal(
                str(receipt["amount"])
            ),
            "currency": receipt["currency"],
            "issued_at": (
                receipt["issued_at"].isoformat()
                if receipt["issued_at"]
                else None
            ),
            "subtotal_amount": Decimal(
                str(receipt["subtotal_amount"])
            ),
            "tax_percent": Decimal(
                str(receipt["tax_percent"])
            ),
            "tax_amount": Decimal(
                str(receipt["tax_amount"])
            ),
            "total_amount": Decimal(
                str(receipt["total_amount"])
            ),
            "order_status": receipt["order_status"],
            "payment_status": receipt["payment_status"],
        }

    finally:
        connection.close()


# ============================================================
# GET RECEIPT BY PAYMENT
# ============================================================

def get_receipt_for_payment(
    user_id: int,
    payment_id: int,
):
    """
    Return the receipt associated with a buyer's payment.
    """
    from app.core.exceptions import NotFoundError
    from app.database import get_connection

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                r.id AS receipt_id,
                r.order_id,
                r.payment_id,
                r.receipt_number,
                r.amount,
                r.currency,
                r.issued_at,

                o.buyer_id,
                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,
                o.status AS order_status,

                p.status AS payment_status

            FROM marketplace_receipts r

            INNER JOIN marketplace_orders o
                ON o.id = r.order_id

            INNER JOIN marketplace_payments p
                ON p.id = r.payment_id

            WHERE r.payment_id = %s
              AND o.buyer_id = %s

            LIMIT 1
            """,
            (
                payment_id,
                user_id,
            ),
        )

        receipt = cursor.fetchone()

        if not receipt:
            raise NotFoundError(
                "Receipt not found."
            )

        return {
            "receipt_id": receipt["receipt_id"],
            "receipt_number": receipt["receipt_number"],
            "order_id": receipt["order_id"],
            "payment_id": receipt["payment_id"],
            "amount": Decimal(
                str(receipt["amount"])
            ),
            "currency": receipt["currency"],
            "issued_at": (
                receipt["issued_at"].isoformat()
                if receipt["issued_at"]
                else None
            ),
            "subtotal_amount": Decimal(
                str(receipt["subtotal_amount"])
            ),
            "tax_percent": Decimal(
                str(receipt["tax_percent"])
            ),
            "tax_amount": Decimal(
                str(receipt["tax_amount"])
            ),
            "total_amount": Decimal(
                str(receipt["total_amount"])
            ),
            "order_status": receipt["order_status"],
            "payment_status": receipt["payment_status"],
        }

    finally:
        connection.close()