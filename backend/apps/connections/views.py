from django.shortcuts import render, redirect
from django.contrib import messages
from .security import (
    store_connection_in_session,
    get_connection_from_session,
    clear_connection_from_session,
    mask_connection_info,
    validate_host,
    validate_identifier,
)
from .inspector import test_connection, inspect_database_structure, inspect_table_columns

def connections_index_view(request):
    current_conn = get_connection_from_session(request)
    test_result = None
    discovered_structure = None
    active_columns = []

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'test':
            name = request.POST.get('name', 'Custom Connection')
            host = request.POST.get('host', '127.0.0.1').strip()
            port = int(request.POST.get('port', 5432))
            database = request.POST.get('database', '').strip()
            username = request.POST.get('username', 'postgres').strip()
            password = request.POST.get('password', '')

            test_result = test_connection(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password
            )
            if test_result.get('success'):
                messages.success(request, f"Connection verified! Server latency: {test_result['latency_ms']} ms ({test_result['version']})")
            else:
                messages.error(request, f"Connection failed: {test_result.get('error')}")

        elif action == 'connect':
            name = request.POST.get('name', 'Custom Connection')
            host = request.POST.get('host', '127.0.0.1').strip()
            port = int(request.POST.get('port', 5432))
            database = request.POST.get('database', '').strip()
            username = request.POST.get('username', 'postgres').strip()
            password = request.POST.get('password', '')

            test_result = test_connection(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password
            )
            if test_result.get('success'):
                params = {
                    'host': host,
                    'port': port,
                    'database': database,
                    'username': username,
                    'password': password,
                }
                store_connection_in_session(request, params, name=name)
                messages.success(request, f"Successfully connected to '{database}' on {host}:{port}!")
                return redirect('connections:index')
            else:
                messages.error(request, f"Cannot connect: {test_result.get('error')}")

        elif action == 'select_table':
            if current_conn:
                schema_name = request.POST.get('schema_name', 'public')
                table_name = request.POST.get('table_name', '')
                current_conn['active_schema'] = schema_name
                current_conn['active_table'] = table_name
                store_connection_in_session(request, current_conn, name=current_conn.get('name', 'Custom DB'))
                messages.success(request, f"Active search target set to '{schema_name}.{table_name}'!")
                return redirect('connections:index')

        elif action == 'disconnect':
            clear_connection_from_session(request)
            messages.info(request, "Custom connection cleared. Reverted to default demo database (jevql_db).")
            return redirect('connections:index')

    # If active connection is set in session, inspect schemas & tables
    if current_conn:
        discovered_structure = inspect_database_structure(current_conn)
        active_table = current_conn.get('active_table')
        active_schema = current_conn.get('active_schema', 'public')
        if active_table:
            col_info = inspect_table_columns(current_conn, active_schema, active_table)
            if col_info.get('success'):
                active_columns = col_info.get('columns', [])

    masked_info = mask_connection_info(current_conn)

    context = {
        'current_conn': masked_info,
        'has_custom_conn': bool(current_conn),
        'test_result': test_result,
        'discovered_structure': discovered_structure,
        'active_columns': active_columns,
    }
    return render(request, 'connections/index.html', context)


# ==================== REST API ENDPOINT ====================
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def api_connections_view(request):
    """REST API endpoint for managing PostgreSQL database connections."""
    current_conn = get_connection_from_session(request)

    if request.method == 'POST':
        action = request.data.get('action')

        if action == 'test':
            host = request.data.get('host', '127.0.0.1').strip()
            try:
                port = int(request.data.get('port', 5432))
                if not (1 <= port <= 65535):
                    raise ValueError()
            except (ValueError, TypeError):
                return Response({'success': False, 'error': 'Port must be an integer between 1 and 65535.'}, status=status.HTTP_400_BAD_REQUEST)

            database = request.data.get('database', '').strip()
            username = request.data.get('username', 'postgres').strip()
            password = request.data.get('password', '')

            if not validate_host(host):
                return Response({'success': False, 'error': f"Invalid host format: '{host}'."}, status=status.HTTP_400_BAD_REQUEST)
            if not database or not validate_identifier(database):
                return Response({'success': False, 'error': f"Invalid database name identifier: '{database}'."}, status=status.HTTP_400_BAD_REQUEST)
            if not username or not validate_identifier(username):
                return Response({'success': False, 'error': f"Invalid username identifier: '{username}'."}, status=status.HTTP_400_BAD_REQUEST)

            test_result = test_connection(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password
            )
            return Response(test_result)

        elif action == 'connect':
            name = request.data.get('name', 'Custom Connection').strip()
            host = request.data.get('host', '127.0.0.1').strip()
            try:
                port = int(request.data.get('port', 5432))
                if not (1 <= port <= 65535):
                    raise ValueError()
            except (ValueError, TypeError):
                return Response({'success': False, 'error': 'Port must be an integer between 1 and 65535.'}, status=status.HTTP_400_BAD_REQUEST)

            database = request.data.get('database', '').strip()
            username = request.data.get('username', 'postgres').strip()
            password = request.data.get('password', '')

            if not validate_host(host):
                return Response({'success': False, 'error': f"Invalid host format: '{host}'."}, status=status.HTTP_400_BAD_REQUEST)
            if not database or not validate_identifier(database):
                return Response({'success': False, 'error': f"Invalid database name identifier: '{database}'."}, status=status.HTTP_400_BAD_REQUEST)
            if not username or not validate_identifier(username):
                return Response({'success': False, 'error': f"Invalid username identifier: '{username}'."}, status=status.HTTP_400_BAD_REQUEST)

            test_result = test_connection(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password
            )
            if test_result.get('success'):
                params = {
                    'host': host,
                    'port': port,
                    'database': database,
                    'username': username,
                    'password': password,
                }
                store_connection_in_session(request, params, name=name)
                return Response({
                    'success': True,
                    'message': f"Successfully connected to '{database}' on {host}:{port}!",
                    'current_conn': mask_connection_info(params)
                })
            else:
                return Response({
                    'success': False,
                    'error': test_result.get('error')
                }, status=status.HTTP_400_BAD_REQUEST)

        elif action == 'select_table':
            if current_conn:
                schema_name = request.data.get('schema_name', 'public').strip()
                table_name = request.data.get('table_name', '').strip()
                if not validate_identifier(schema_name):
                    return Response({'error': f"Invalid schema name '{schema_name}'."}, status=status.HTTP_400_BAD_REQUEST)
                if not validate_identifier(table_name):
                    return Response({'error': f"Invalid table name '{table_name}'."}, status=status.HTTP_400_BAD_REQUEST)

                current_conn['active_schema'] = schema_name
                current_conn['active_table'] = table_name
                store_connection_in_session(request, current_conn, name=current_conn.get('name', 'Custom DB'))
                return Response({
                    'success': True,
                    'message': f"Active search target set to '{schema_name}.{table_name}'!",
                    'current_conn': mask_connection_info(current_conn)
                })
            return Response({'error': 'No active connection found.'}, status=status.HTTP_400_BAD_REQUEST)

        elif action == 'disconnect':
            clear_connection_from_session(request)
            return Response({
                'success': True,
                'message': 'Custom connection cleared. Reverted to default demo database (jevql_db).'
            })

    # GET method
    discovered_structure = None
    active_columns = []
    if current_conn:
        discovered_structure = inspect_database_structure(current_conn)
        active_table = current_conn.get('active_table')
        active_schema = current_conn.get('active_schema', 'public')
        if active_table:
            col_info = inspect_table_columns(current_conn, active_schema, active_table)
            if col_info.get('success'):
                active_columns = col_info.get('columns', [])

    masked_info = mask_connection_info(current_conn)
    return Response({
        'current_conn': masked_info,
        'has_custom_conn': bool(current_conn),
        'discovered_structure': discovered_structure,
        'active_columns': active_columns,
    })

