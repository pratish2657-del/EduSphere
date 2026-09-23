import os

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# FILE RULES
# ============================================================

ALLOWED_MARKETPLACE_FILE_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
}

MAX_MARKETPLACE_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_MARKETPLACE_PREVIEW_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_MARKETPLACE_PREVIEW_SIZE = 5 * 1024 * 1024


# ============================================================
# LIST PRODUCTS
# ============================================================


def get_products(
    institution_id=None,
    category=None,
    product_type=None,
    search=None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT
                mp.id AS product_id,
                mp.seller_id,
                seller.full_name AS seller_name,

                mp.institution_id,
                i.name AS institution_name,

                mp.name,
                mp.description,
                mp.preview_image_path,
                mp.category,
                mp.product_type,
                mp.condition_type,
                mp.price,
                mp.quantity,
                mp.reserved_quantity,
                mp.is_active,

                mp.created_at,
                mp.updated_at

            FROM marketplace_products mp

            INNER JOIN users seller
                ON seller.id = mp.seller_id

            INNER JOIN institutions i
                ON i.id = mp.institution_id

            WHERE mp.is_active = TRUE
        """

        params = []

        if institution_id is not None:
            query += """
                AND mp.institution_id = %s
            """
            params.append(institution_id)

        if category:
            query += """
                AND LOWER(mp.category) = LOWER(%s)
            """
            params.append(category.strip())

        if product_type:
            query += """
                AND mp.product_type = %s
            """
            params.append(product_type.upper())

        if search:
            query += """
                AND (
                    LOWER(mp.name) LIKE LOWER(%s)
                    OR LOWER(mp.description) LIKE LOWER(%s)
                )
            """

            value = f"%{search.strip()}%"
            params.extend([value, value])

        query += """
            ORDER BY mp.created_at DESC
        """

        cursor.execute(query, tuple(params))

        products = cursor.fetchall()

        return {
            "count": len(products),
            "products": products,
        }

    finally:
        connection.close()


# ============================================================
# GET PRODUCT
# ============================================================


def get_product(product_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                mp.id AS product_id,

                mp.seller_id,
                seller.full_name AS seller_name,

                mp.institution_id,
                i.name AS institution_name,

                mp.name,
                mp.description,
                mp.preview_image_path,
                mp.category,
                mp.product_type,
                mp.condition_type,
                mp.price,
                mp.quantity,
                mp.reserved_quantity,
                mp.is_active,

                mp.created_at,
                mp.updated_at

            FROM marketplace_products mp

            INNER JOIN users seller
                ON seller.id = mp.seller_id

            INNER JOIN institutions i
                ON i.id = mp.institution_id

            WHERE mp.id = %s
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        return product

    finally:
        connection.close()


# ============================================================
# CREATE PRODUCT
# ============================================================


def create_product(user_id, data):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Verify institution
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM institutions
            WHERE id = %s
            LIMIT 1
            """,
            (data.institution_id,),
        )

        if not cursor.fetchone():
            raise NotFoundError(
                "Institution not found"
            )

        # ----------------------------------------------------
        # Validate product
        # ----------------------------------------------------

        if data.product_type == "DIGITAL":
            condition_type = "DIGITAL"
        else:
            condition_type = data.condition_type

        if data.price < 0:
            raise BadRequestError(
                "Price cannot be negative"
            )

        if data.quantity < 0:
            raise BadRequestError(
                "Quantity cannot be negative"
            )

        # ----------------------------------------------------
        # Create
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO marketplace_products (
                seller_id,
                institution_id,
                name,
                description,
                category,
                product_type,
                condition_type,
                price,
                quantity,
                reserved_quantity,
                is_active
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, 0, TRUE
            )
            """,
            (
                user_id,
                data.institution_id,
                data.name.strip(),
                (
                    data.description.strip()
                    if data.description
                    else None
                ),
                (
                    data.category.strip()
                    if data.category
                    else None
                ),
                data.product_type,
                condition_type,
                data.price,
                data.quantity,
            ),
        )

        product_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Marketplace product created successfully",
            "product_id": product_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE PRODUCT
# ============================================================


def update_product(
    product_id,
    user_id,
    data,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                reserved_quantity
            FROM marketplace_products
            WHERE id = %s
            FOR UPDATE
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        if product["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only update your own products"
            )

        if data.quantity < product["reserved_quantity"]:
            raise BadRequestError(
                "Quantity cannot be lower than currently reserved stock"
            )

        condition_type = (
            "DIGITAL"
            if data.product_type == "DIGITAL"
            else data.condition_type
        )

        cursor.execute(
            """
            UPDATE marketplace_products
            SET
                name = %s,
                description = %s,
                category = %s,
                product_type = %s,
                condition_type = %s,
                price = %s,
                quantity = %s,
                is_active = %s
            WHERE id = %s
            """,
            (
                data.name.strip(),
                (
                    data.description.strip()
                    if data.description
                    else None
                ),
                (
                    data.category.strip()
                    if data.category
                    else None
                ),
                data.product_type,
                condition_type,
                data.price,
                data.quantity,
                data.is_active,
                product_id,
            ),
        )

        connection.commit()

        return {
            "message": "Marketplace product updated successfully",
            "product_id": product_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE PRODUCT
# ============================================================


def delete_product(product_id, user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                reserved_quantity
            FROM marketplace_products
            WHERE id = %s
            FOR UPDATE
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        if product["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only delete your own products"
            )

        if product["reserved_quantity"] > 0:
            raise BadRequestError(
                "This product cannot be removed while stock is reserved"
            )

        cursor.execute(
            """
            UPDATE marketplace_products
            SET is_active = FALSE
            WHERE id = %s
            """,
            (product_id,),
        )

        connection.commit()

        return {
            "message": "Marketplace product removed successfully",
            "product_id": product_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADD ATTACHMENT
# ============================================================


def add_product_attachment(
    product_id,
    user_id,
    file_name,
    file_path,
    file_type,
    file_size,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        if file_type not in ALLOWED_MARKETPLACE_FILE_TYPES:
            raise BadRequestError(
                "File type is not allowed"
            )

        if file_size <= 0:
            raise BadRequestError(
                "File cannot be empty"
            )

        if file_size > MAX_MARKETPLACE_FILE_SIZE:
            raise BadRequestError(
                "File size cannot exceed 10 MB"
            )

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                product_type
            FROM marketplace_products
            WHERE id = %s
            FOR UPDATE
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        if product["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only upload files for your own products"
            )

        if product["product_type"] != "DIGITAL":
            raise BadRequestError(
                "Attachments are only allowed for digital products"
            )

        cursor.execute(
            """
            INSERT INTO marketplace_attachments (
                product_id,
                file_name,
                file_type,
                file_size,
                storage_path
            )
            VALUES (
                %s, %s, %s, %s, %s
            )
            """,
            (
                product_id,
                file_name,
                file_type,
                file_size,
                file_path,
            ),
        )

        attachment_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Product attachment uploaded successfully",
            "attachment_id": attachment_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET PRODUCT ATTACHMENT
# ============================================================


def get_product_attachment(
    attachment_id,
    user_id=None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ma.id,
                ma.product_id,
                ma.file_name,
                ma.file_type,
                ma.file_size,
                ma.storage_path,
                mp.seller_id

            FROM marketplace_attachments ma

            INNER JOIN marketplace_products mp
                ON mp.id = ma.product_id

            WHERE ma.id = %s
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Attachment not found"
            )

        if (
            user_id is not None
            and attachment["seller_id"] != user_id
        ):
            raise ForbiddenError(
                "You do not have permission to access this attachment"
            )

        return attachment

    finally:
        connection.close()


# ============================================================
# DELETE ATTACHMENT
# ============================================================


def delete_product_attachment(
    attachment_id,
    user_id,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ma.id,
                ma.storage_path,
                mp.seller_id

            FROM marketplace_attachments ma

            INNER JOIN marketplace_products mp
                ON mp.id = ma.product_id

            WHERE ma.id = %s

            FOR UPDATE
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Attachment not found"
            )

        if attachment["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only delete your own attachment"
            )

        cursor.execute(
            """
            DELETE FROM marketplace_attachments
            WHERE id = %s
            """,
            (attachment_id,),
        )

        connection.commit()

        return {
            "message": "Attachment deleted successfully",
            "file_path": attachment["storage_path"],
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# SAVE PREVIEW IMAGE
# ============================================================


def save_product_preview(
    product_id,
    user_id,
    file_path,
    file_type,
    file_size,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        if file_type not in ALLOWED_MARKETPLACE_PREVIEW_TYPES:
            raise BadRequestError(
                "Preview image must be JPG, PNG or WEBP"
            )

        if file_size <= 0:
            raise BadRequestError(
                "Preview image cannot be empty"
            )

        if file_size > MAX_MARKETPLACE_PREVIEW_SIZE:
            raise BadRequestError(
                "Preview image cannot exceed 5 MB"
            )

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                is_active
            FROM marketplace_products
            WHERE id = %s
            FOR UPDATE
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        if product["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only update your own product"
            )

        if not product["is_active"]:
            raise BadRequestError(
                "Cannot upload preview to an inactive product"
            )

        if not file_path:
            raise BadRequestError(
                "Preview image path is required"
            )

        cursor.execute(
            """
            UPDATE marketplace_products
            SET preview_image_path = %s
            WHERE id = %s
            """,
            (
                file_path,
                product_id,
            ),
        )

        connection.commit()

        return {
            "message": "Product preview updated successfully",
            "product_id": product_id,
            "preview_image_path": file_path,
            "file_type": file_type,
            "file_size": file_size,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET PREVIEW
# ============================================================


def get_product_preview(product_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                preview_image_path,
                CASE
                    WHEN preview_image_path IS NOT NULL THEN
                        SUBSTRING_INDEX(preview_image_path, '/', -1)
                    ELSE NULL
                END AS file_name
            FROM marketplace_products
            WHERE id = %s
              AND is_active = TRUE
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        path = product["preview_image_path"]

        if not path or not os.path.isfile(path):
            raise NotFoundError(
                "Product preview not found"
            )

        extension = os.path.splitext(path)[1].lower()
        media_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(extension, "application/octet-stream")

        return {
            "storage_path": path,
            "file_name": product["file_name"],
            "file_type": media_type,
        }

    finally:
        connection.close()


def get_attachment_for_download(
    user_id: int,
    attachment_id: int,
):
    """
    Return a digital attachment only when the authenticated
    buyer has a successfully paid and confirmed order
    containing the attachment's product.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                a.id AS attachment_id,
                a.product_id,
                a.file_name,
                a.file_type,
                a.file_size,
                a.storage_path,

                oi.order_id,

                o.buyer_id,
                o.status AS order_status,

                p.status AS payment_status

            FROM marketplace_attachments a

            INNER JOIN marketplace_order_items oi
                ON oi.product_id = a.product_id

            INNER JOIN marketplace_orders o
                ON o.id = oi.order_id

            INNER JOIN marketplace_payments p
                ON p.order_id = o.id

            WHERE a.id = %s
              AND o.buyer_id = %s
              AND o.status = 'CONFIRMED'
              AND p.status = 'PAID'

            ORDER BY oi.id DESC

            LIMIT 1
            """,
            (
                attachment_id,
                user_id,
            ),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise ForbiddenError(
                "You do not have access to this digital file."
            )

        return attachment

    finally:
        connection.close()