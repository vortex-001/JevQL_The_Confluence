from django.test import TestCase, Client, RequestFactory
from django.urls import reverse
from apps.connections.security import (
    validate_host,
    validate_identifier,
    store_connection_in_session,
    get_connection_from_session,
    clear_connection_from_session,
    mask_connection_info,
)
from apps.connections.inspector import test_connection

class ConnectionSecurityTest(TestCase):
    def test_host_validation(self):
        self.assertTrue(validate_host('127.0.0.1'))
        self.assertTrue(validate_host('localhost'))
        self.assertTrue(validate_host('db.internal.local'))
        self.assertFalse(validate_host(''))
        self.assertFalse(validate_host('127.0.0.1; DROP TABLE users;'))
        self.assertFalse(validate_host('invalid host with spaces'))

    def test_identifier_validation(self):
        self.assertTrue(validate_identifier('students'))
        self.assertTrue(validate_identifier('employee_feedback_2026'))
        self.assertFalse(validate_identifier('123starts_with_num'))
        self.assertFalse(validate_identifier('table; DROP TABLE'))
        self.assertFalse(validate_identifier('table name'))

    def test_session_encryption_and_clear(self):
        factory = RequestFactory()
        request = factory.get('/')
        # Setup session
        from django.contrib.sessions.backends.db import SessionStore
        request.session = SessionStore()

        params = {
            'host': '127.0.0.1',
            'port': 5432,
            'database': 'test_db',
            'username': 'postgres',
            'password': 'secret_password_123',
        }
        store_connection_in_session(request, params, name='My Test DB')

        # Retrieve and verify
        retrieved = get_connection_from_session(request)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved['database'], 'test_db')
        self.assertEqual(retrieved['password'], 'secret_password_123')

        # Clear and verify
        clear_connection_from_session(request)
        self.assertIsNone(get_connection_from_session(request))

    def test_mask_connection_info(self):
        masked = mask_connection_info({
            'name': 'Prod DB',
            'database': 'customer_records',
            'host': '127.0.0.1',
            'port': 5432,
            'username': 'admin',
            'password': 'super_secret_value',
        })
        self.assertEqual(masked['database'], 'customer_records')
        self.assertNotIn('password', masked)

class ConnectionViewTest(TestCase):
    def setUp(self):
        self.client = Client()

    def test_connections_page_renders(self):
        response = self.client.get(reverse('connections:index'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'PostgreSQL Connections & Schemas')

    def test_invalid_host_test_connection(self):
        res = test_connection(
            host='invalid host ;;',
            port=5432,
            database='jevql_db',
            username='postgres',
            password='any',
            timeout_seconds=1.0
        )
        self.assertFalse(res['success'])
        self.assertIn('Invalid host format', res['error'])
