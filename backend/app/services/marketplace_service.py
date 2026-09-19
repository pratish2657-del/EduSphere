import os

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# MARKETPLACE FILE RULES
# ============================================================

ALLOWED_MARKETPLACE_FILE_TYPES = {
    # PDF
    "application/pdf",
    # Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # PowerPoint
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Images
    "image/jpeg",
    "image/png",
    "image/webp",
    # Text / notes
    "text/plain",
}

MAX_MARKETPLACE_FILE_SIZE = 10 * 1024 * 1024

# ============================================================
# MARKETPLACE PREVIEW IMAGE RULES
# ============================================================

ALLOWED_MARKETPLACE_PREVIEW_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_MARKETPLACE_PREVIEW_SIZE = 5 * 1024 * 1024


# ============================================================
# LIST PRODUCTS
#
# ALL AUTHENTICATED / COMPLETED USERS
#
# Student     BUY + SELL
# Professor   BUY + SELL
# Admin       BUY + SELL
# SuperAdmin  BUY + SELL
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
                mp.is_active,

                mp.created_at,
                mp.updated_at

            FROM marketplace_products mp

            INNER JOIN users seller
                ON mp.seller_id = seller.id

            INNER JOIN institutions i
                ON mp.institution_id = i.id

            WHERE mp.is_active = TRUE
        """

        params = []

        if institution_id is not None:
            query += """
                AND mp.institution_id = %s
            """
            params.append(institution_id)

        if category is not None:
            query += """
                AND LOWER(mp.category) = LOWER(%s)
            """
            params.append(category)

        if product_type is not None:
            query += """
                AND mp.product_type = %s
            """
            params.append(product_type)

        if search is not None:
            query += """
                AND (
                    LOWER(mp.name) LIKE LOWER(%s)
                    OR LOWER(mp.description) LIKE LOWER(%s)
                )
            """

            search_value = f"%{search}%"
            params.append(search_value)
            params.append(search_value)

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
# GET SINGLE PRODUCT
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
                mp.is_active,

                mp.created_at,
                mp.updated_at

            FROM marketplace_products mp

            INNER JOIN users seller
                ON mp.seller_id = seller.id

            INNER JOIN institutions i
                ON mp.institution_id = i.id

            WHERE mp.id = %s
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        # ----------------------------------------------------
        # Product attachments
        #
        # IMPORTANT:
        # Do NOT expose file_path here.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id AS attachment_id,
                file_name,
                file_type,
                file_size,
                created_at

            FROM marketplace_attachments

            WHERE product_id = %s

            ORDER BY created_at ASC
            """,
            (product_id,),
        )

        attachments = cursor.fetchall()

        return {
            "product": product,
            "attachments": attachments,
        }

    finally:
        connection.close()


# ============================================================
# CREATE PRODUCT
#
# ANY COMPLETED USER CAN SELL
#
# Student     SELL
# Professor   SELL
# Admin       SELL
# SuperAdmin  SELL
# ============================================================


def create_product(user_id, data):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Verify seller
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                is_active
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise NotFoundError("User not found")

        if not user["is_active"]:
            raise ForbiddenError(
                "User account is inactive"
            )

        # ----------------------------------------------------
        # Verify institution
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name
            FROM institutions
            WHERE id = %s
            """,
            (data.institution_id,),
        )

        institution = cursor.fetchone()

        if not institution:
            raise NotFoundError(
                "Institution not found"
            )

        # ----------------------------------------------------
        # Validate product type
        # ----------------------------------------------------

        if data.product_type not in {
            "DIGITAL",
            "PHYSICAL",
        }:
            raise BadRequestError(
                "Product type must be DIGITAL or PHYSICAL"
            )

        # ----------------------------------------------------
        # DIGITAL product rules
        # ----------------------------------------------------

        if (
            data.product_type == "DIGITAL"
            and data.condition_type != "DIGITAL"
        ):
            raise BadRequestError(
                "Digital products must use DIGITAL condition"
            )

        # ----------------------------------------------------
        # PHYSICAL product rules
        # ----------------------------------------------------

        if (
            data.product_type == "PHYSICAL"
            and data.quantity < 0
        ):
            raise BadRequestError(
                "Quantity cannot be negative"
            )

        # ----------------------------------------------------
        # Price
        # ----------------------------------------------------

        if data.price < 0:
            raise BadRequestError(
                "Price cannot be negative"
            )

        # ----------------------------------------------------
        # DIGITAL products
        #
        # Quantity can represent available licenses/copies.
        # ----------------------------------------------------

        if (
            data.product_type == "DIGITAL"
            and data.quantity < 0
        ):
            raise BadRequestError(
                "Quantity cannot be negative"
            )

        # ----------------------------------------------------
        # Create product
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
                is_active
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                TRUE
            )
            """,
            (
                user_id,
                data.institution_id,
                data.name,
                data.description,
                data.category,
                data.product_type,
                data.condition_type,
                data.price,
                data.quantity,
            ),
        )

        product_id = cursor.lastrowid

        connection.commit()

        return {
            "message": (
                "Marketplace product created successfully"
            ),
            "product_id": product_id,
            "seller_id": user_id,
            "institution_id": data.institution_id,
            "name": data.name,
            "category": data.category,
            "product_type": data.product_type,
            "price": data.price,
            "quantity": data.quantity,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE PRODUCT
#
# SELLER — OWN PRODUCT ONLY
# ============================================================


def update_product(product_id, user_id, data):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find product
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                product_type,
                quantity,
                price
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

        # ----------------------------------------------------
        # Validate product type
        # ----------------------------------------------------

        if data.product_type not in {
            "DIGITAL",
            "PHYSICAL",
        }:
            raise BadRequestError(
                "Product type must be DIGITAL or PHYSICAL"
            )

        # ----------------------------------------------------
        # DIGITAL validation
        # ----------------------------------------------------

        if (
            data.product_type == "DIGITAL"
            and data.condition_type != "DIGITAL"
        ):
            raise BadRequestError(
                "Digital products must use DIGITAL condition"
            )

        # ----------------------------------------------------
        # Price
        # ----------------------------------------------------

        if data.price < 0:
            raise BadRequestError(
                "Price cannot be negative"
            )

        # ----------------------------------------------------
        # Quantity
        # ----------------------------------------------------

        if data.quantity < 0:
            raise BadRequestError(
                "Quantity cannot be negative"
            )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

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
                data.name,
                data.description,
                data.category,
                data.product_type,
                data.condition_type,
                data.price,
                data.quantity,
                data.is_active,
                product_id,
            ),
        )

        connection.commit()

        return {
            "message": (
                "Marketplace product updated successfully"
            ),
            "product_id": product_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE PRODUCT
#
# SELLER — OWN PRODUCT ONLY
#
# SOFT DELETE
# ============================================================


def delete_product(product_id, user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                seller_id
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

        # ----------------------------------------------------
        # Soft delete
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_products

            SET
                is_active = FALSE

            WHERE id = %s
            """,
            (product_id,),
        )

        connection.commit()

        return {
            "message": (
                "Marketplace product removed successfully"
            ),
            "product_id": product_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADD PRODUCT ATTACHMENT
#
# SELLER — OWN PRODUCT ONLY
#
# Files are physically stored by the route.
# This function only creates the DB record.
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

        # ----------------------------------------------------
        # Validate file type
        # ----------------------------------------------------

        if file_type not in ALLOWED_MARKETPLACE_FILE_TYPES:
            raise BadRequestError(
                "File type is not allowed"
            )

        # ----------------------------------------------------
        # Validate file size
        # ----------------------------------------------------

        if file_size <= 0:
            raise BadRequestError(
                "File cannot be empty"
            )

        if file_size > MAX_MARKETPLACE_FILE_SIZE:
            raise BadRequestError(
                "File size cannot exceed 10 MB"
            )

        # ----------------------------------------------------
        # Find product
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                product_type,
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

        # ----------------------------------------------------
        # Only DIGITAL products can have files
        # ----------------------------------------------------

        if product["product_type"] != "DIGITAL":
            raise BadRequestError(
                "Attachments can only be uploaded "
                "to DIGITAL products"
            )

        # ----------------------------------------------------
        # Product must be active
        # ----------------------------------------------------

        if not product["is_active"]:
            raise BadRequestError(
                "Cannot upload files to an inactive product"
            )

        # ----------------------------------------------------
        # Seller ownership
        # ----------------------------------------------------

        if product["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only upload files to your own products"
            )

        # ----------------------------------------------------
        # Validate path
        # ----------------------------------------------------

        if not file_path:
            raise BadRequestError(
                "File path is required"
            )

        # ----------------------------------------------------
        # Insert attachment
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO marketplace_attachments (
                product_id,
                file_name,
                file_path,
                file_type,
                file_size,
                uploaded_by
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                product_id,
                file_name,
                file_path,
                file_type,
                file_size,
                user_id,
            ),
        )

        attachment_id = cursor.lastrowid

        connection.commit()

        return {
            "message": (
                "Marketplace attachment uploaded successfully"
            ),
            "attachment_id": attachment_id,
            "product_id": product_id,
            "file_name": file_name,
            "file_type": file_type,
            "file_size": file_size,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET PRODUCT ATTACHMENT
#
# INTERNAL / SELLER USE
#
# Does NOT grant buyer download access.
# ============================================================


def get_product_attachment(attachment_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ma.id AS attachment_id,
                ma.product_id,

                ma.file_name,
                ma.file_path,
                ma.file_type,
                ma.file_size,

                ma.uploaded_by,

                mp.seller_id,
                mp.product_type,
                mp.is_active

            FROM marketplace_attachments ma

            INNER JOIN marketplace_products mp
                ON ma.product_id = mp.id

            WHERE ma.id = %s
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Marketplace attachment not found"
            )

        return attachment

    finally:
        connection.close()


# ============================================================
# DELETE ATTACHMENT
#
# SELLER — OWN PRODUCT ONLY
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
                ma.id AS attachment_id,
                ma.file_path,

                mp.seller_id,
                mp.product_type

            FROM marketplace_attachments ma

            INNER JOIN marketplace_products mp
                ON ma.product_id = mp.id

            WHERE ma.id = %s

            FOR UPDATE
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Marketplace attachment not found"
            )

        if attachment["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only delete attachments "
                "from your own products"
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
            "message": (
                "Marketplace attachment deleted successfully"
            ),
            "attachment_id": attachment_id,
            "file_path": attachment["file_path"],
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# BUYER / SELLER DOWNLOAD
#
# SELLER:
#   Can download own DIGITAL product files.
#
# BUYER:
#   Must have a CONFIRMED / PROCESSING / COMPLETED order.
#
# IMPORTANT:
#   private_uploads is NEVER mounted as StaticFiles.
# ============================================================


def get_marketplace_attachment_for_download(
    attachment_id,
    user_id,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Get attachment and product
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                ma.id AS attachment_id,
                ma.product_id,

                ma.file_name,
                ma.file_path,
                ma.file_type,
                ma.file_size,

                mp.name AS product_name,
                mp.product_type,
                mp.seller_id,
                mp.is_active

            FROM marketplace_attachments ma

            INNER JOIN marketplace_products mp
                ON mp.id = ma.product_id

            WHERE ma.id = %s

            LIMIT 1
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Marketplace attachment not found"
            )

        # ----------------------------------------------------
        # DIGITAL products only
        # ----------------------------------------------------

        if attachment["product_type"] != "DIGITAL":
            raise BadRequestError(
                "This product does not contain "
                "a downloadable digital file"
            )

        # ----------------------------------------------------
        # SELLER ACCESS
        # ----------------------------------------------------

        if attachment["seller_id"] == user_id:
            file_path = attachment["file_path"]

            if not file_path:
                raise BadRequestError(
                    "File path is missing"
                )

            if not os.path.isfile(file_path):
                raise NotFoundError(
                    "File is no longer available"
                )

            return attachment

        # ----------------------------------------------------
        # BUYER ACCESS
        #
        # Payment must have resulted in a valid marketplace
        # order status.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                mo.id AS order_id,
                mo.status AS order_status

            FROM marketplace_orders mo

            INNER JOIN marketplace_order_items moi
                ON moi.order_id = mo.id

            WHERE mo.buyer_id = %s

              AND moi.product_id = %s

              AND mo.status IN (
                  'CONFIRMED',
                  'PROCESSING',
                  'COMPLETED'
              )

            LIMIT 1
            """,
            (
                user_id,
                attachment["product_id"],
            ),
        )

        order = cursor.fetchone()

        if not order:
            raise ForbiddenError(
                "You must purchase this digital product "
                "before downloading its files"
            )

        # ----------------------------------------------------
        # Verify physical file exists
        # ----------------------------------------------------

        file_path = attachment["file_path"]

        if not file_path:
            raise BadRequestError(
                "File path is missing"
            )

        if not os.path.isfile(file_path):
            raise NotFoundError(
                "File is no longer available"
            )

        return attachment

    finally:
        connection.close()
        
# ============================================================
# SAVE MARKETPLACE PRODUCT PREVIEW IMAGE
#
# SELLER — OWN PRODUCT ONLY
#
# The route physically stores the file.
# This function only validates ownership and saves the path.
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

        # ----------------------------------------------------
        # Validate file type
        # ----------------------------------------------------

        if file_type not in ALLOWED_MARKETPLACE_PREVIEW_TYPES:
            raise BadRequestError(
                "Preview image must be JPG, PNG or WEBP"
            )

        # ----------------------------------------------------
        # Validate file size
        # ----------------------------------------------------

        if file_size <= 0:
            raise BadRequestError(
                "Preview image cannot be empty"
            )

        if file_size > MAX_MARKETPLACE_PREVIEW_SIZE:
            raise BadRequestError(
                "Preview image cannot exceed 5 MB"
            )

        # ----------------------------------------------------
        # Find product
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                is_active,
                preview_image_path

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

        # ----------------------------------------------------
        # Product must be active
        # ----------------------------------------------------

        if not product["is_active"]:
            raise BadRequestError(
                "Cannot upload preview to an inactive product"
            )

        # ----------------------------------------------------
        # Seller ownership
        # ----------------------------------------------------

        if product["seller_id"] != user_id:
            raise ForbiddenError(
                "You can only upload a preview to your own product"
            )

        # ----------------------------------------------------
        # Validate path
        # ----------------------------------------------------

        if not file_path:
            raise BadRequestError(
                "Preview image path is required"
            )

        # ----------------------------------------------------
        # Save preview path
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_products

            SET
                preview_image_path = %s,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = %s
            """,
            (
                file_path,
                product_id,
            ),
        )

        connection.commit()

        return {
            "message": (
                "Marketplace preview image uploaded successfully"
            ),
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
# GET MARKETPLACE PRODUCT PREVIEW
# ============================================================


def get_product_preview(product_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id AS product_id,
                preview_image_path

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

        if not product["preview_image_path"]:
            raise NotFoundError(
                "Preview image is not available"
            )

        return product

    finally:
        connection.close()