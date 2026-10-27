import time
from typing import Dict, Any, List
import psycopg2
from psycopg2 import sql
from .security import validate_identifier, validate_host

def test_connection(
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    timeout_seconds: float = 3.0
) -> Dict[str, Any]:
    """Test connection reachability and credentials in strict read-only mode."""
    if not validate_host(host):
        return {"success": False, "error": "Invalid host format."}
    if not validate_identifier(database):
        return {"success": False, "error": "Invalid database name format."}

    start = time.perf_counter()
    conn = None
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=database,
            user=username,
            password=password,
            connect_timeout=int(timeout_seconds)
        )
        conn.set_session(readonly=True)
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            ver = cur.fetchone()[0]

        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "success": True,
            "latency_ms": latency_ms,
            "version": ver.split(',')[0],
        }
    except Exception as e:
        # Sanitize error to avoid leaking credentials
        err_msg = str(e).replace(password, '***') if password else str(e)
        return {
            "success": False,
            "error": f"{type(e).__name__}: {err_msg}"
        }
    finally:
        if conn and not conn.closed:
            conn.close()

def inspect_database_structure(conn_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Introspect database to discover non-system schemas, tables, and column metadata.
    Enforces read-only execution.
    """
    host = conn_params.get('host', '127.0.0.1')
    port = int(conn_params.get('port', 5432))
    database = conn_params.get('database', '')
    username = conn_params.get('username', 'postgres')
    password = conn_params.get('password', '')

    conn = None
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=database,
            user=username,
            password=password,
            connect_timeout=3
        )
        conn.set_session(readonly=True)
        with conn.cursor() as cur:
            # 1. Discover Schemas
            cur.execute("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                ORDER BY schema_name;
            """)
            schemas = [row[0] for row in cur.fetchall()]

            # 2. Discover Tables
            cur.execute("""
                SELECT t.table_schema, t.table_name,
                       COALESCE(c.reltuples::bigint, 0) AS estimated_rows
                FROM information_schema.tables t
                LEFT JOIN pg_class c ON c.relname = t.table_name
                LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
                WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
                  AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_schema, t.table_name;
            """)
            tables = []
            for row in cur.fetchall():
                tables.append({
                    "schema": row[0],
                    "name": row[1],
                    "estimated_rows": max(0, row[2])
                })

            return {
                "success": True,
                "schemas": schemas,
                "tables": tables,
            }
    except Exception as e:
        err_msg = str(e).replace(password, '***') if password else str(e)
        return {
            "success": False,
            "error": f"Introspection Error: {err_msg}"
        }
    finally:
        if conn and not conn.closed:
            conn.close()

def inspect_table_columns(conn_params: Dict[str, Any], schema_name: str, table_name: str) -> Dict[str, Any]:
    """Retrieve column names, data types, and nullability for an approved table."""
    if not validate_identifier(schema_name) or not validate_identifier(table_name):
        return {"success": False, "error": "Invalid schema or table name identifier."}

    conn = None
    try:
        conn = psycopg2.connect(
            host=conn_params.get('host', '127.0.0.1'),
            port=int(conn_params.get('port', 5432)),
            dbname=conn_params.get('database', ''),
            user=conn_params.get('username', 'postgres'),
            password=conn_params.get('password', ''),
            connect_timeout=3
        )
        conn.set_session(readonly=True)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position;
            """, (schema_name, table_name))
            
            columns = []
            for row in cur.fetchall():
                c_name, c_type, c_null = row
                is_text = c_type in ('character varying', 'varchar', 'text', 'character', 'char')
                is_numeric = c_type in ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision')
                columns.append({
                    "name": c_name,
                    "data_type": c_type,
                    "is_nullable": c_null == 'YES',
                    "is_text": is_text,
                    "is_numeric": is_numeric,
                })

            return {
                "success": True,
                "schema": schema_name,
                "table": table_name,
                "columns": columns,
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if conn and not conn.closed:
            conn.close()
