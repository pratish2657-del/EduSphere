from __future__ import annotations

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# SELLER PROFILE
# ============================================================

def create_seller(
    user_id: int,
    name: str,
    phone: str,
    upi_id: str,
):
    """
    Create a marketplace seller profile.

    This stores only the seller's direct UPI details.

    No:
    - payment gateway onboarding
    - payout account
    - split payment
    - gateway seller ID
    - settlement account
    """
    name = name.strip()
    phone = phone.strip()
    upi_id = upi_id.strip()

    if not name:
        raise BadRequestError("Seller name is required.")

    if not phone:
        raise BadRequestError("Seller phone number is required.")

    if not upi_id:
        raise BadRequestError("Seller UPI ID is required.")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Check existing seller
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status,
                created_at,
                updated_at
            FROM marketplace_sellers
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        existing = cursor.fetchone()

        if existing:
            raise ConflictError(
                "Seller profile already exists."
            )

        # ----------------------------------------------------
        # Create seller
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO marketplace_sellers (
                user_id,
                name,
                phone,
                upi_id,
                status
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                'ACTIVE'
            )
            """,
            (
                user_id,
                name,
                phone,
                upi_id,
            ),
        )

        seller_id = cursor.lastrowid

        connection.commit()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status,
                created_at,
                updated_at
            FROM marketplace_sellers
            WHERE id = %s
            LIMIT 1
            """,
            (seller_id,),
        )

        seller = cursor.fetchone()

        return seller

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET SELLER
# ============================================================

def get_seller(
    user_id: int,
):
    """
    Get the authenticated user's seller profile.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status,
                created_at,
                updated_at
            FROM marketplace_sellers
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        seller = cursor.fetchone()

        if not seller:
            raise NotFoundError(
                "Seller profile not found."
            )

        return seller

    finally:
        connection.close()


def get_seller_by_id(
    seller_id: int,
):
    """
    Get a seller by marketplace seller ID.

    Intended for internal marketplace operations.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status,
                created_at,
                updated_at
            FROM marketplace_sellers
            WHERE id = %s
            LIMIT 1
            """,
            (seller_id,),
        )

        seller = cursor.fetchone()

        if not seller:
            raise NotFoundError(
                "Seller profile not found."
            )

        return seller

    finally:
        connection.close()


# ============================================================
# UPDATE SELLER
# ============================================================

def update_seller(
    user_id: int,
    name: str,
    phone: str,
    upi_id: str,
):
    """
    Update the authenticated user's seller profile.
    """
    name = name.strip()
    phone = phone.strip()
    upi_id = upi_id.strip()

    if not name:
        raise BadRequestError("Seller name is required.")

    if not phone:
        raise BadRequestError(
            "Seller phone number is required."
        )

    if not upi_id:
        raise BadRequestError(
            "Seller UPI ID is required."
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Check seller
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                status
            FROM marketplace_sellers
            WHERE user_id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (user_id,),
        )

        seller = cursor.fetchone()

        if not seller:
            raise NotFoundError(
                "Seller profile not found."
            )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_sellers
            SET
                name = %s,
                phone = %s,
                upi_id = %s
            WHERE user_id = %s
            """,
            (
                name,
                phone,
                upi_id,
                user_id,
            ),
        )

        connection.commit()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status,
                created_at,
                updated_at
            FROM marketplace_sellers
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        return cursor.fetchone()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ACTIVATE SELLER
# ============================================================

def activate_seller(
    user_id: int,
):
    """
    Activate the authenticated user's seller profile.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status
            FROM marketplace_sellers
            WHERE user_id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (user_id,),
        )

        seller = cursor.fetchone()

        if not seller:
            raise NotFoundError(
                "Seller profile not found."
            )

        cursor.execute(
            """
            UPDATE marketplace_sellers
            SET status = 'ACTIVE'
            WHERE user_id = %s
            """,
            (user_id,),
        )

        connection.commit()

        seller["status"] = "ACTIVE"

        return seller

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DEACTIVATE SELLER
# ============================================================

def deactivate_seller(
    user_id: int,
):
    """
    Deactivate the authenticated user's seller profile.

    Existing products are not deleted.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                name,
                phone,
                upi_id,
                status
            FROM marketplace_sellers
            WHERE user_id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (user_id,),
        )

        seller = cursor.fetchone()

        if not seller:
            raise NotFoundError(
                "Seller profile not found."
            )

        # ----------------------------------------------------
        # Do not deactivate if seller has reserved stock.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS reserved_products
            FROM marketplace_products
            WHERE seller_id = %s
              AND reserved_quantity > 0
              AND is_active = TRUE
            """,
            (user_id,),
        )

        reserved = cursor.fetchone()

        if reserved and reserved["reserved_products"] > 0:
            raise ConflictError(
                "Seller cannot be deactivated while products "
                "have reserved inventory."
            )

        cursor.execute(
            """
            UPDATE marketplace_sellers
            SET status = 'INACTIVE'
            WHERE user_id = %s
            """,
            (user_id,),
        )

        connection.commit()

        seller["status"] = "INACTIVE"

        return seller

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# SELLER STATUS
# ============================================================

def is_active_seller(
    user_id: int,
) -> bool:
    """
    Check whether the user has an active seller profile.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT 1
            FROM marketplace_sellers
            WHERE user_id = %s
              AND status = 'ACTIVE'
            LIMIT 1
            """,
            (user_id,),
        )

        return cursor.fetchone() is not None

    finally:
        connection.close()


# ============================================================
# SELLER ID FOR USER
# ============================================================

def get_seller_id_for_user(
    user_id: int,
) -> int:
    """
    Return the marketplace seller ID belonging to a user.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM marketplace_sellers
            WHERE user_id = %s
              AND status = 'ACTIVE'
            LIMIT 1
            """,
            (user_id,),
        )

        row = cursor.fetchone()

        if not row:
            raise NotFoundError(
                "Active seller profile not found."
            )

        return row[0]

    finally:
        connection.close()