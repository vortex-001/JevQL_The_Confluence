import json
import re
from typing import Dict, Any, Optional
from django.core.signing import Signer, BadSignature
from django.conf import settings

SIGNER = Signer(salt='jevql-connection-credentials-v1')
SESSION_KEY = 'jevql_active_custom_db'

ALLOWED_HOST_PATTERN = re.compile(r'^(localhost|127\.0\.0\.1|0\.0\.0\.0|[a-zA-Z0-9_\-\.]+)$')
SAFE_IDENTIFIER_PATTERN = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

def validate_host(host: str) -> bool:
    """Validate host string against permitted format (local/LAN/safe hostname)."""
    if not host or len(host) > 255:
        return False
    return bool(ALLOWED_HOST_PATTERN.match(host))

def validate_identifier(ident: str) -> bool:
    """Check if identifier consists strictly of valid alphanumeric/underscore characters."""
    if not ident or len(ident) > 63:
        return False
    return bool(SAFE_IDENTIFIER_PATTERN.match(ident))

def store_connection_in_session(request, params: Dict[str, Any], name: str = "Custom DB") -> None:
    """
    Encrypt and save connection credentials in the user's signed session.
    Passwords are NEVER written to disk, database tables, or logs.
    """
    payload = {
        'name': name.strip() or 'Custom PostgreSQL',
        'host': params.get('host', '127.0.0.1').strip(),
        'port': int(params.get('port', 5432)),
        'database': params.get('database', '').strip(),
        'username': params.get('username', 'postgres').strip(),
        'password': params.get('password', ''),
        'active_table': params.get('active_table', ''),
        'active_schema': params.get('active_schema', 'public'),
    }
    signed_data = SIGNER.sign_object(payload)
    request.session[SESSION_KEY] = signed_data
    request.session.modified = True

def get_connection_from_session(request) -> Optional[Dict[str, Any]]:
    """Retrieve and unsign connection credentials from the session."""
    signed_data = request.session.get(SESSION_KEY)
    if not signed_data:
        return None
    try:
        data = SIGNER.unsign_object(signed_data)
        return data
    except (BadSignature, Exception):
        request.session.pop(SESSION_KEY, None)
        return None

def clear_connection_from_session(request) -> None:
    """Clear active custom database connection from session."""
    if SESSION_KEY in request.session:
        del request.session[SESSION_KEY]
        request.session.modified = True

def mask_connection_info(conn_dict: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Return a sanitized copy of connection details safe for UI display."""
    if not conn_dict:
        return {
            'is_custom': False,
            'name': 'Default Demo Database (jevql_db)',
            'database': settings.DATABASES['default'].get('NAME', 'jevql_db'),
            'host': settings.DATABASES['default'].get('HOST', 'localhost'),
            'port': settings.DATABASES['default'].get('PORT', '5432'),
            'username': settings.DATABASES['default'].get('USER', 'postgres'),
            'active_table': 'EmployeeFeedback (Seed)',
        }

    return {
        'is_custom': True,
        'name': conn_dict.get('name', 'Custom DB'),
        'database': conn_dict.get('database', ''),
        'host': conn_dict.get('host', 'localhost'),
        'port': conn_dict.get('port', 5432),
        'username': conn_dict.get('username', 'postgres'),
        'active_schema': conn_dict.get('active_schema', 'public'),
        'active_table': conn_dict.get('active_table', ''),
    }
