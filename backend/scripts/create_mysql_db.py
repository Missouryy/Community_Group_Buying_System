import os
import pymysql
from dotenv import load_dotenv


def main():
    load_dotenv()
    name = os.getenv('DB_NAME', 'community_group_buying')
    host = os.getenv('DB_HOST', '127.0.0.1')
    port = int(os.getenv('DB_PORT', '3306'))
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')

    conn = pymysql.connect(host=host, port=port, user=user, password=password, autocommit=True)
    with conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    print('created-or-existed:', name)


if __name__ == '__main__':
    main()


