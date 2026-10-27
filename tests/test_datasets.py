from datetime import date
from django.test import TestCase
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from apps.datasets.models import EmployeeFeedback, DatasetMetadata, Department, Sentiment
from apps.analytics.models import SavedQuery, QueryHistory


class EmployeeFeedbackModelTest(TestCase):
    def setUp(self):
        self.metadata = DatasetMetadata.objects.create(
            name='Test Dataset',
            slug='test-dataset',
            description='Test feedback dataset'
        )
        self.feedback = EmployeeFeedback.objects.create(
            dataset=self.metadata,
            anonymized_id='EMP-TEST-01',
            department=Department.ENGINEERING,
            role='Senior Backend Engineer',
            rating=4,
            sentiment=Sentiment.POSITIVE,
            feedback_text='Great engineering culture and collaboration on infrastructure projects.',
            tags=['culture', 'infrastructure'],
            submission_date=date.today(),
        )

    def test_record_creation(self):
        self.assertEqual(self.feedback.anonymized_id, 'EMP-TEST-01')
        self.assertEqual(self.feedback.department, Department.ENGINEERING)
        self.assertEqual(self.feedback.rating, 4)
        self.assertEqual(self.feedback.sentiment, Sentiment.POSITIVE)

    def test_str_representation(self):
        expected_str = f"[{Department.ENGINEERING}] Senior Backend Engineer - Positive (4/5)"
        self.assertEqual(str(self.feedback), expected_str)


class SeedFeedbackCommandTest(TestCase):
    def test_seed_command_creates_records(self):
        call_command('seed_feedback', '--clear', '--count=25')
        metadata = DatasetMetadata.objects.get(slug='employee-feedback')
        self.assertEqual(metadata.total_records, 25)
        self.assertEqual(EmployeeFeedback.objects.filter(dataset=metadata).count(), 25)


class CsvUploadParsingTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='uploader', password='password123', email='uploader@example.com')
        self.token, _ = Token.objects.get_or_create(user=self.user)
        self.client.force_login(self.user)
        self.auth_headers = {'HTTP_AUTHORIZATION': f'Token {self.token.key}'}

    def test_unauthenticated_upload_rejected(self):
        self.client.logout()
        upload = SimpleUploadedFile("test.csv", b"id,department\n1,Engineering\n", content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload})
        self.assertEqual(resp.status_code, 401)

    def test_valid_comma_separated_csv_imports_multiple_columns(self):
        csv_text = (
            "id,employee_name,department,role,rating,sentiment,feedback_text,tags\n"
            "EMP-001,Alice Smith,Engineering,Backend Lead,5,Positive,Loved the deployment speed,ci-cd,velocity\n"
            "EMP-002,Bob Jones,Product,Product Manager,2,Negative,Unclear product roadmap,planning\n"
        )
        upload = SimpleUploadedFile("employees.csv", csv_text.encode('utf-8'), content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['count'], 2)

        rec1 = EmployeeFeedback.objects.get(anonymized_id='EMP-001')
        self.assertEqual(rec1.employee_name, 'Alice Smith')
        self.assertEqual(rec1.department, 'Engineering')
        self.assertEqual(rec1.role, 'Backend Lead')
        self.assertEqual(rec1.rating, 5)
        self.assertEqual(rec1.sentiment, 'Positive')
        self.assertEqual(rec1.feedback_text, 'Loved the deployment speed')
        self.assertIn('ci-cd', rec1.tags)

        rec2 = EmployeeFeedback.objects.get(anonymized_id='EMP-002')
        self.assertEqual(rec2.employee_name, 'Bob Jones')
        self.assertEqual(rec2.department, 'Product')
        self.assertEqual(rec2.rating, 2)
        self.assertEqual(rec2.sentiment, 'Negative')

    def test_semicolon_delimited_csv_upload(self):
        csv_text = "id;department;role;rating;sentiment;feedback_text;tags\nEMP-SEMI-01;Customer Success;Support Lead;2;Negative;Tickets are delayed;support;queue\n"
        upload = SimpleUploadedFile("semicolon.csv", csv_text.encode('utf-8'), content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        rec = EmployeeFeedback.objects.get(anonymized_id='EMP-SEMI-01')
        self.assertEqual(rec.department, 'Customer Success')
        self.assertEqual(rec.role, 'Support Lead')
        self.assertEqual(rec.rating, 2)
        self.assertEqual(rec.sentiment, 'Negative')
        self.assertEqual(rec.feedback_text, 'Tickets are delayed')

    def test_tab_separated_csv_upload(self):
        csv_text = "id\tdepartment\trole\trating\tsentiment\tfeedback_text\ttags\nEMP-TAB-01\tSales\tAccount Exec\t4\tPositive\tGood pipeline\trevenue\n"
        upload = SimpleUploadedFile("tab.tsv", csv_text.encode('utf-8'), content_type="text/tab-separated-values")
        # Ensure it has .csv extension for the endpoint
        upload.name = "tab.csv"
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        rec = EmployeeFeedback.objects.get(anonymized_id='EMP-TAB-01')
        self.assertEqual(rec.department, 'Sales')
        self.assertEqual(rec.role, 'Account Exec')
        self.assertEqual(rec.rating, 4)
        self.assertEqual(rec.sentiment, 'Positive')

    def test_flexible_education_dataset_upload(self):
        csv_text = "Student ID,Student Name,Course,Instructor,Score,Review\nSTU-101,John Doe,Computer Science,Prof Smith,5,Excellent course and lectures\n"
        upload = SimpleUploadedFile("students.csv", csv_text.encode('utf-8'), content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        rec = EmployeeFeedback.objects.get(anonymized_id='STU-101')
        self.assertEqual(rec.employee_name, 'John Doe')
        self.assertEqual(rec.department, 'Computer Science')
        self.assertEqual(rec.role, 'Prof Smith')
        self.assertEqual(rec.rating, 5)
        self.assertEqual(rec.sentiment, 'Positive')
        self.assertEqual(rec.feedback_text, 'Excellent course and lectures')

    def test_quoted_values_containing_commas_preserved(self):
        csv_text = (
            'id,employee_name,department,role,rating,sentiment,feedback_text,tags\n'
            'EMP-Q-01,"Smith, Alice","Engineering, Cloud","Backend, Infrastructure",4,Positive,"Fast, reliable, and solid",infra\n'
        )
        upload = SimpleUploadedFile("quoted.csv", csv_text.encode('utf-8'), content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        rec = EmployeeFeedback.objects.get(anonymized_id='EMP-Q-01')
        self.assertEqual(rec.employee_name, 'Smith, Alice')
        self.assertEqual(rec.department, 'Engineering, Cloud')
        self.assertEqual(rec.role, 'Backend, Infrastructure')
        self.assertEqual(rec.feedback_text, 'Fast, reliable, and solid')

    def test_multiline_quoted_fields_and_crlf_line_endings(self):
        csv_text = (
            "id,department,role,rating,sentiment,feedback_text\r\n"
            "EMP-MULTI-01,Product,Design Lead,5,Positive,\"Line 1 feedback\r\nLine 2 feedback comment\"\r\n"
        )
        upload = SimpleUploadedFile("multiline.csv", csv_text.encode('utf-8'), content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        rec = EmployeeFeedback.objects.get(anonymized_id='EMP-MULTI-01')
        self.assertIn("Line 1 feedback", rec.feedback_text)
        self.assertIn("Line 2 feedback comment", rec.feedback_text)

    def test_empty_cells_and_utf8_bom(self):
        # UTF-8 with BOM prefix \xef\xbb\xbf
        csv_text = (
            "\ufeffid,employee_name,department,role,rating,sentiment,feedback_text,tags\n"
            "EMP-BOM-01,,Marketing,,3,,Standard feedback,\n"
        )
        upload = SimpleUploadedFile("bom.csv", csv_text.encode('utf-8-sig'), content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        rec = EmployeeFeedback.objects.get(anonymized_id='EMP-BOM-01')
        self.assertEqual(rec.department, 'Marketing')
        self.assertEqual(rec.rating, 3)
        self.assertEqual(rec.sentiment, 'Neutral')

    def test_empty_csv_returns_400(self):
        upload = SimpleUploadedFile("empty.csv", b"", content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 400)

    def test_unsupported_or_malformed_csv_returns_400(self):
        # Single column with no delimiter and unrecognizable format
        upload = SimpleUploadedFile("malformed.csv", b"random_gibberish_without_delimiters\n", content_type="text/csv")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.json())

    def test_transaction_rollback_on_failed_import(self):
        initial_count = EmployeeFeedback.objects.count()
        # Non-csv extension
        bad_upload = SimpleUploadedFile("bad.txt", b"id,dept\n1,Eng\n", content_type="text/plain")
        resp = self.client.post(reverse('api_datasets_upload'), {'file': bad_upload}, **self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(EmployeeFeedback.objects.count(), initial_count)


class UserIsolationTest(TestCase):
    def setUp(self):
        # User A
        self.user_a = User.objects.create_user(username='usera', password='passwordA123', email='usera@example.com')
        self.token_a, _ = Token.objects.get_or_create(user=self.user_a)
        self.headers_a = {'HTTP_AUTHORIZATION': f'Token {self.token_a.key}'}

        # User B
        self.user_b = User.objects.create_user(username='userb', password='passwordB123', email='userb@example.com')
        self.token_b, _ = Token.objects.get_or_create(user=self.user_b)
        self.headers_b = {'HTTP_AUTHORIZATION': f'Token {self.token_b.key}'}

    def test_user_a_and_user_b_complete_isolation(self):
        # 1. User A uploads CSV
        csv_a = (
            "id,employee_name,department,role,rating,sentiment,feedback_text,tags\n"
            "REC-A1,User A Emp 1,Engineering,Software Eng,5,Positive,User A Secret Project,confidential\n"
            "REC-A2,User A Emp 2,Sales,AE,4,Positive,User A Sales Target,revenue\n"
        )
        upload_a = SimpleUploadedFile("dataset_a.csv", csv_a.encode('utf-8'), content_type="text/csv")
        resp_a = self.client.post(reverse('api_datasets_upload'), {'file': upload_a}, **self.headers_a)
        self.assertEqual(resp_a.status_code, 200)
        self.assertEqual(resp_a.json()['count'], 2)

        # 2. User A can see their own records
        records_a_resp = self.client.get(reverse('api-feedback-records-list'), **self.headers_a)
        self.assertEqual(records_a_resp.status_code, 200)
        self.assertEqual(records_a_resp.json()['count'], 2)
        rec_a_id = records_a_resp.json()['results'][0]['id']

        # 3. User B sees NO records from User A
        records_b_resp = self.client.get(reverse('api-feedback-records-list'), **self.headers_b)
        self.assertEqual(records_b_resp.status_code, 200)
        self.assertEqual(records_b_resp.json()['count'], 0)

        # 4. User B cannot access User A's record by ID
        detail_b_resp = self.client.get(reverse('api-feedback-records-detail', kwargs={'pk': rec_a_id}), **self.headers_b)
        self.assertEqual(detail_b_resp.status_code, 404)

        # 5. User B uploads their own records
        csv_b = (
            "id,employee_name,department,role,rating,sentiment,feedback_text,tags\n"
            "REC-B1,User B Emp 1,Marketing,Growth Lead,2,Negative,User B Campaign friction,marketing\n"
        )
        upload_b = SimpleUploadedFile("dataset_b.csv", csv_b.encode('utf-8'), content_type="text/csv")
        resp_b = self.client.post(reverse('api_datasets_upload'), {'file': upload_b}, **self.headers_b)
        self.assertEqual(resp_b.status_code, 200)
        self.assertEqual(resp_b.json()['count'], 1)

        # 6. User B sees ONLY User B's records
        records_b_resp2 = self.client.get(reverse('api-feedback-records-list'), **self.headers_b)
        self.assertEqual(records_b_resp2.status_code, 200)
        self.assertEqual(records_b_resp2.json()['count'], 1)
        self.assertEqual(records_b_resp2.json()['results'][0]['anonymized_id'], 'REC-B1')

        # 7. User A still sees ONLY User A's 2 records
        records_a_resp2 = self.client.get(reverse('api-feedback-records-list'), **self.headers_a)
        self.assertEqual(records_a_resp2.status_code, 200)
        self.assertEqual(records_a_resp2.json()['count'], 2)

        # 8. User B cannot access User A's dataset metadata by ID
        meta_a = DatasetMetadata.objects.get(owner=self.user_a)
        meta_b_access = self.client.get(reverse('api-dataset-metadata-detail', kwargs={'pk': meta_a.id}), **self.headers_b)
        self.assertEqual(meta_b_access.status_code, 404)

    def test_search_export_analytics_user_isolation(self):
        # User A uploads records
        csv_a = "id,department,role,rating,sentiment,feedback_text\nREC-A,Sales,Rep,5,Positive,Unique User A Phrase\n"
        self.client.post(reverse('api_datasets_upload'), {'file': SimpleUploadedFile("a.csv", csv_a.encode('utf-8'), content_type="text/csv")}, **self.headers_a)

        # User B uploads records
        csv_b = "id,department,role,rating,sentiment,feedback_text\nREC-B,Engineering,Dev,1,Negative,Unique User B Phrase\n"
        self.client.post(reverse('api_datasets_upload'), {'file': SimpleUploadedFile("b.csv", csv_b.encode('utf-8'), content_type="text/csv")}, **self.headers_b)

        # Search isolation: User A searching finds only User A's phrase
        search_a = self.client.get(reverse('api_search'), {'q': 'Unique User'}, **self.headers_a)
        self.assertEqual(search_a.status_code, 200)
        self.assertEqual(search_a.json()['total_dataset_count'], 1)
        self.assertEqual(search_a.json()['results'][0]['anonymized_id'], 'REC-A')

        # Search isolation: User B searching finds only User B's phrase
        search_b = self.client.get(reverse('api_search'), {'q': 'Unique User'}, **self.headers_b)
        self.assertEqual(search_b.status_code, 200)
        self.assertEqual(search_b.json()['total_dataset_count'], 1)
        self.assertEqual(search_b.json()['results'][0]['anonymized_id'], 'REC-B')

        # Analytics isolation
        analytics_a = self.client.get(reverse('api_analytics_overview'), **self.headers_a)
        self.assertEqual(analytics_a.status_code, 200)
        self.assertEqual(analytics_a.json()['total_records'], 1)
        self.assertEqual(analytics_a.json()['sentiment_counts']['Positive'], 1)
        self.assertEqual(analytics_a.json()['sentiment_counts']['Negative'], 0)

        analytics_b = self.client.get(reverse('api_analytics_overview'), **self.headers_b)
        self.assertEqual(analytics_b.status_code, 200)
        self.assertEqual(analytics_b.json()['total_records'], 1)
        self.assertEqual(analytics_b.json()['sentiment_counts']['Positive'], 0)
        self.assertEqual(analytics_b.json()['sentiment_counts']['Negative'], 1)

        # Export isolation
        export_a = self.client.get(reverse('api_search_export'), **self.headers_a)
        self.assertEqual(export_a.status_code, 200)
        self.assertIn("REC-A", export_a.content.decode('utf-8'))
        self.assertNotIn("REC-B", export_a.content.decode('utf-8'))

        export_b = self.client.get(reverse('api_search_export'), **self.headers_b)
        self.assertEqual(export_b.status_code, 200)
        self.assertIn("REC-B", export_b.content.decode('utf-8'))
        self.assertNotIn("REC-A", export_b.content.decode('utf-8'))

    def test_saved_queries_and_history_isolation(self):
        # User A saves query
        self.client.post(reverse('api_saved_queries'), {'query_text': 'User A query', 'name': 'A Query'}, format='json', **self.headers_a)

        # User B saves query
        self.client.post(reverse('api_saved_queries'), {'query_text': 'User B query', 'name': 'B Query'}, format='json', **self.headers_b)

        # User A lists saved queries
        saved_a = self.client.get(reverse('api_saved_queries'), **self.headers_a).json()['saved_queries']
        self.assertEqual(len(saved_a), 1)
        self.assertEqual(saved_a[0]['name'], 'A Query')
        query_a_id = saved_a[0]['id']

        # User B cannot delete User A's query
        del_attempt = self.client.delete(reverse('api_saved_query_detail', kwargs={'query_id': query_a_id}), **self.headers_b)
        self.assertEqual(del_attempt.status_code, 404)
        self.assertTrue(SavedQuery.objects.filter(id=query_a_id).exists())

    def test_unauthenticated_private_endpoints_rejected(self):
        # Unauthenticated calls to dataset records, metadata, upload, saved queries
        self.assertEqual(self.client.get(reverse('api-feedback-records-list')).status_code, 401)
        self.assertEqual(self.client.get(reverse('api-dataset-metadata-list')).status_code, 401)
        self.assertEqual(self.client.post(reverse('api_datasets_upload')).status_code, 401)
        self.assertEqual(self.client.post(reverse('api_saved_queries'), {'query_text': 'test'}).status_code, 401)
