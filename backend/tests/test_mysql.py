from app.database import get_connection


def test_mysql_connection():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE() AS database_name")

        result = cursor.fetchone()

        assert result is not None
        assert result["database_name"] is not None

        cursor.close()

    finally:
        connection.close()