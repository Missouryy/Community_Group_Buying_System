import os
import sys
import argparse
import pymysql
from dotenv import load_dotenv


def exec_sql_file(connection, sql_path: str):
    current_delimiter = ';'
    statement_parts = []

    with open(sql_path, 'r', encoding='utf-8') as f:
        for raw_line in f:
            line = raw_line.rstrip('\n')
            stripped = line.strip()

            if not stripped:
                statement_parts.append(line)
                continue

            if stripped.upper().startswith('DELIMITER '):
                # Flush any pending statement before changing delimiter
                if statement_parts:
                    pending = '\n'.join(statement_parts).strip()
                    if pending:
                        with connection.cursor() as cur:
                            cur.execute(pending)
                    statement_parts = []
                current_delimiter = stripped.split(' ', 1)[1]
                continue

            # Accumulate lines until we hit the delimiter
            if stripped.endswith(current_delimiter):
                statement_parts.append(line[: len(line) - len(current_delimiter)])
                statement = '\n'.join(statement_parts).strip()
                if statement:
                    with connection.cursor() as cur:
                        cur.execute(statement)
                statement_parts = []
            else:
                statement_parts.append(line)

    # Execute any trailing statement (without explicit delimiter)
    if statement_parts:
        trailing = '\n'.join(statement_parts).strip()
        if trailing:
            with connection.cursor() as cur:
                cur.execute(trailing)


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description='Import SQL file with DELIMITER support')
    parser.add_argument('--file', required=True, help='Path to .sql file')
    args = parser.parse_args()

    name = os.getenv('DB_NAME', 'community_group_buying')
    host = os.getenv('DB_HOST', '127.0.0.1')
    port = int(os.getenv('DB_PORT', '3306'))
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')

    conn = pymysql.connect(host=host, port=port, user=user, password=password, database=name, autocommit=True, charset='utf8mb4')
    exec_sql_file(conn, args.file)
    print('Imported:', args.file)


if __name__ == '__main__':
    main()


