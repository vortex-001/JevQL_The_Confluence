import time
from typing import Dict, Any, List
import psycopg2
from psycopg2 import sql
from .inspector import inspect_table_columns

def query_custom_table(
    conn_params: Dict[str, Any],
    schema_name: str,
    table_name: str,
    query_text: str = "",
    limit: int = 50
) -> Dict[str, Any]:
    """
    Safely query an external user-selected PostgreSQL table.
    Enforces read-only transactions, strict column allowlisting, and parameterization.
    """
    start = time.perf_counter()

    # 1. Fetch column metadata for allowlisting
    col_info = inspect_table_columns(conn_params, schema_name, table_name)
    if not col_info.get('success'):
        return {
            "success": False,
            "error": f"Cannot inspect table columns: {col_info.get('error')}",
            "records": [],
            "total_count": 0,
            "columns": [],
            "latency_ms": 0.0,
        }

    columns = col_info['columns']
    col_names = [c['name'] for c in columns]
    text_cols = [c['name'] for c in columns if c['is_text']]

    if not col_names:
        return {
            "success": True,
            "records": [],
            "total_count": 0,
            "columns": [],
            "latency_ms": 0.0,
            "message": "Table contains no columns."
        }

    # 2. Build safe SQL query using psycopg2.sql to escape identifiers
    select_fields = [sql.Identifier(col) for col in col_names]
    base_query = sql.SQL("SELECT {fields} FROM {schema}.{table}").format(
        fields=sql.SQL(", ").join(select_fields),
        schema=sql.Identifier(schema_name),
        table=sql.Identifier(table_name)
    )

    params: List[Any] = []
    where_clauses = []

    # 3. Apply search query across text columns
    clean_q = query_text.strip()
    if clean_q and text_cols:
        like_pattern = f"%{clean_q}%"
        for t_col in text_cols[:5]:  # search up to 5 main text columns
            where_clauses.append(sql.SQL("{col}::text ILIKE %s").format(col=sql.Identifier(t_col)))
            params.append(like_pattern)

    if where_clauses:
        base_query += sql.SQL(" WHERE ") + sql.SQL(" OR ").join(where_clauses)

    base_query += sql.SQL(" LIMIT %s")
    params.append(min(max(1, limit), 100))

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
            cur.execute(base_query, params)
            rows = cur.fetchall()

            records = []
            for row in rows:
                rec = {}
                row_vals = []
                for idx, col in enumerate(col_names):
                    val = row[idx]
                    str_val = str(val) if val is not None else ""
                    rec[col] = str_val
                    row_vals.append(str_val)
                records.append({
                    "data": rec,
                    "values": row_vals,
                })

        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "success": True,
            "records": records,
            "total_count": len(records),
            "columns": col_names,
            "latency_ms": latency_ms,
            "compiled_sql": cur.query.decode('utf-8', errors='ignore') if hasattr(cur, 'query') and cur.query else "",
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "success": False,
            "error": f"Database execution error: {str(e)}",
            "records": [],
            "total_count": 0,
            "columns": col_names,
            "latency_ms": latency_ms,
        }
    finally:
        if conn and not conn.closed:
            conn.close()
