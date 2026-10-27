from django.test import TestCase, Client
from django.urls import reverse
from apps.datasets.models import EmployeeFeedback, Department, Sentiment
from apps.search.query_planner import QueryPlanner
from apps.semantic.factory import get_semantic_provider

class QueryPlannerTest(TestCase):
    def test_department_extraction(self):
        planner = QueryPlanner("Show all engineering issues with deployments")
        q_obj, filters, clean_topic = planner.parse()
        self.assertEqual(filters.get('department'), Department.ENGINEERING)
        self.assertIn('deployments', clean_topic.lower())

    def test_sentiment_extraction(self):
        planner = QueryPlanner("Find sales complaints about CRM")
        q_obj, filters, clean_topic = planner.parse()
        self.assertEqual(filters.get('department'), Department.SALES)
        self.assertEqual(filters.get('sentiment'), Sentiment.NEGATIVE)
        self.assertIn('crm', clean_topic.lower())

    def test_rating_extraction(self):
        planner = QueryPlanner("Show product feedback with rating >= 4")
        q_obj, filters, clean_topic = planner.parse()
        self.assertEqual(filters.get('department'), Department.PRODUCT)
        self.assertEqual(filters.get('rating__gte'), 4)

class SearchDashboardViewTest(TestCase):
    def setUp(self):
        self.client = Client()
        EmployeeFeedback.objects.create(
            anonymized_id='EMP-TEST-ENG',
            department=Department.ENGINEERING,
            role='DevOps Engineer',
            rating=1,
            sentiment=Sentiment.NEGATIVE,
            feedback_text='On-call rotation is leading directly to burnout and sleep deprivation.',
            tags=['burnout', 'on-call'],
            submission_date='2026-10-01'
        )

    def test_dashboard_renders_home(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Natural-Language Database Search')

    def test_structured_query_search(self):
        response = self.client.get(reverse('home'), {'q': 'Engineering burnout'})
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.context['result_count'], 1)
        self.assertIn('EMP-TEST-ENG', str(response.content))
        self.assertGreater(response.context['execution_time_ms'], 0)

    def test_semantic_fallback_provider(self):
        provider = get_semantic_provider()
        self.assertTrue(provider.is_available())
        candidates = [{'id': 1, 'feedback_text': 'test candidate', 'similarity_score': 0.85}]
        evaluated = provider.evaluate_candidates('test', candidates)
        self.assertEqual(len(evaluated), 1)

    def test_all_eight_navigation_routes_return_200(self):
        routes = [
            reverse('home'),
            reverse('dashboard_overview'),
            reverse('saved_queries'),
            reverse('datasets:dataset_list'),
            reverse('analytics:overview'),
            reverse('history'),
            reverse('connections:index'),
            reverse('settings'),
        ]
        for url in routes:
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 200, f"Route {url} failed with {resp.status_code}")

    def test_export_csv_endpoint(self):
        resp = self.client.get(reverse('search:export_csv'), {'q': 'burnout'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment; filename=', resp['Content-Disposition'])
        self.assertIn('EMP-TEST-ENG', str(resp.content))

    def test_save_query_endpoint(self):
        resp = self.client.post(reverse('search:save_query'), {
            'query_text': 'Engineering burnout',
            'name': 'Burnout Alert Query',
            'dept': ['Engineering']
        }, follow=True)
        self.assertEqual(resp.status_code, 200)
        from apps.analytics.models import SavedQuery
        self.assertTrue(SavedQuery.objects.filter(name='Burnout Alert Query').exists())

    def test_sentiment_distribution_calculation(self):
        resp = self.client.get(reverse('home'))
        self.assertEqual(resp.status_code, 200)
        dist = resp.context.get('sentiment_dist')
        self.assertIsNotNone(dist)
        self.assertIn('negative_pct', dist)
        self.assertIn('neutral_pct', dist)
        self.assertIn('positive_pct', dist)
        self.assertEqual(dist['negative_count'], 1)
        self.assertEqual(dist['negative_pct'], 100.0)

    def test_empty_dataset_renders_without_crashing(self):
        EmployeeFeedback.objects.all().delete()
        resp = self.client.get(reverse('home'))
        self.assertEqual(resp.status_code, 200)
        dist = resp.context.get('sentiment_dist')
        self.assertIsNotNone(dist)
        self.assertEqual(dist['negative_pct'], 0.0)
        self.assertEqual(dist['positive_pct'], 0.0)
        self.assertEqual(dist['neutral_pct'], 0.0)
        self.assertEqual(dist['total'], 0)

    def test_custom_active_connection_sentiment_context(self):
        from apps.connections.security import store_connection_in_session
        session = self.client.session
        custom_params = {
            'host': '127.0.0.1',
            'port': 5432,
            'database': 'custom_db',
            'username': 'postgres',
            'password': 'test_password',
            'active_schema': 'public',
            'active_table': 'feedback_table',
        }
        # Simulate custom table in session
        store_connection_in_session(self.client, custom_params, name='Custom Uploaded Dataset')
        resp = self.client.get(reverse('home'))
        self.assertEqual(resp.status_code, 200)
        dist = resp.context.get('sentiment_dist')
        self.assertIsNotNone(dist)
        self.assertIn('negative_pct', dist)
        self.assertIn('neutral_pct', dist)
        self.assertIn('positive_pct', dist)

    def test_csv_dataset_upload_flow(self):
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile
        csv_content = (
            "id,employee_name,department,role,rating,sentiment,feedback_text,tags\n"
            "EMP-UP-01,Test User,Engineering,QA Engineer,1,Negative,Frequent regressions,bug,qa\n"
            "EMP-UP-02,Test User 2,Product,Product Lead,5,Positive,Smooth launch,launch\n"
        )
        uploaded = SimpleUploadedFile("test_feedback.csv", csv_content.encode('utf-8'), content_type="text/csv")
        resp = self.client.post(reverse('datasets:upload_dataset'), {'file': uploaded}, follow=True)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(EmployeeFeedback.objects.filter(anonymized_id='EMP-UP-01').exists())

        # Now test dashboard after upload
        dashboard_resp = self.client.get(reverse('home'))
        self.assertEqual(dashboard_resp.status_code, 200)
        dist = dashboard_resp.context.get('sentiment_dist')
        self.assertIsNotNone(dist)
        self.assertIn('negative_pct', dist)
        self.assertGreater(dist['total'], 0)

    def test_semantic_search_intent_matching(self):
        """
        Verify that semantic search retrieves semantically related records
        even if the exact query words do not appear (e.g., 'bad reviews' -> 'disappointing, poor quality').
        """
        from unittest.mock import patch
        from apps.datasets.models import RecordEmbedding

        rec = EmployeeFeedback.objects.create(
            anonymized_id='EMP-SEM-01',
            department=Department.CUSTOMER_SUCCESS,
            role='Support Specialist',
            rating=1,
            sentiment=Sentiment.NEGATIVE,
            feedback_text='Extremely disappointing, poor quality, not worth the money, terrible experience.',
            tags=['complaint', 'quality'],
            submission_date='2026-10-02'
        )
        # Create dummy embedding vector for rec
        RecordEmbedding.objects.create(
            feedback=rec,
            content_hash='test_hash_01',
            model_version='gemini-embedding-001',
            embedding=[0.8, 0.6] + [0.0] * 766
        )

        # Mock query embedding to align with rec
        with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.is_available', return_value=True):
            with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_document_embeddings', return_value=[[0.0] * 768]):
                with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_query_embedding', return_value=[0.8, 0.6] + [0.0] * 766):
                    resp = self.client.get(reverse('home'), {'q': 'bad reviews'})
                    self.assertEqual(resp.status_code, 200)
                    self.assertGreaterEqual(resp.context['result_count'], 1)
                    first_result = resp.context['results'][0]
                    self.assertEqual(first_result['anonymized_id'], 'EMP-SEM-01')
                    self.assertGreater(first_result['semantic_score'], 0.9)
                    self.assertIn('Semantic match', first_result.get('relevance_explanation', ''))

    def test_factual_return_verification(self):
        """
        Verify query 'product returned in 2 days' confirms factual return support
        ('sent it back after 48 hours') vs general complaints.
        """
        from unittest.mock import patch
        from apps.datasets.models import RecordEmbedding

        rec_return = EmployeeFeedback.objects.create(
            anonymized_id='EMP-RET-01',
            department=Department.PRODUCT,
            role='Product Lead',
            rating=2,
            sentiment=Sentiment.NEGATIVE,
            feedback_text='Customer sent it back after 48 hours due to defective parts.',
            tags=['returns'],
            submission_date='2026-10-03'
        )
        RecordEmbedding.objects.create(
            feedback=rec_return,
            content_hash='test_hash_ret',
            model_version='gemini-embedding-001',
            embedding=[0.7, 0.7] + [0.0] * 766
        )

        with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.is_available', return_value=True):
            with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_document_embeddings', return_value=[[0.0] * 768]):
                with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_query_embedding', return_value=[0.7, 0.7] + [0.0] * 766):
                    resp = self.client.get(reverse('home'), {'q': 'product returned in 2 days'})
                    self.assertEqual(resp.status_code, 200)
                    first_result = resp.context['results'][0]
                    self.assertEqual(first_result['anonymized_id'], 'EMP-RET-01')
                    self.assertIn('Verified return record', first_result.get('relevance_explanation', ''))

    def test_semantic_threshold_irrelevant_query(self):
        """
        Ensure irrelevant query below similarity threshold returns empty results.
        """
        from unittest.mock import patch

        with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.is_available', return_value=True):
            with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_document_embeddings', return_value=[[0.0] * 768]):
                # Query vector orthogonal to records
                with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_query_embedding', return_value=[0.0] * 767 + [1.0]):
                    resp = self.client.get(reverse('home'), {'q': 'quantum astrophysics satellite telescope'})
                    self.assertEqual(resp.status_code, 200)
                    self.assertEqual(resp.context['result_count'], 0)
                    self.assertContains(resp, 'No matching records found')

    def test_api_failure_graceful_fallback(self):
        """
        Ensure that if Gemini API throws exception or fails, search safely falls back to trigram.
        """
        from unittest.mock import patch

        with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.is_available', return_value=True):
            with patch('apps.semantic.gemini_provider.GeminiSemanticProvider.generate_query_embedding', return_value=None):
                resp = self.client.get(reverse('home'), {'q': 'burnout'})
                self.assertEqual(resp.status_code, 200)
                self.assertGreaterEqual(resp.context['result_count'], 1)

    def test_ui_branding_and_top_right_removed(self):
        """
        Test UI Requirements 5 & 6:
        - Built by The Confluence must be in sidebar bottom.
        - Persona switch buttons, Alex avatar, and notification bell must be removed.
        - Database status indicator is displayed.
        """
        resp = self.client.get(reverse('home'))
        self.assertEqual(resp.status_code, 200)
        html = resp.content.decode('utf-8')

        self.assertIn('Built by The Confluence', html)
        self.assertIn('PostgreSQL 18.6 Connected', html)
        self.assertNotIn('Alex ▾', html)
        self.assertNotIn('persona-switch', html)
        self.assertNotIn('persona-btn', html)


class GeminiProviderFocusedTest(TestCase):
    """
    Focused unit tests for GeminiSemanticProvider:
    - Verifies active model configuration (gemini-embedding-001).
    - Verifies successful mocked embedding responses.
    - Verifies HTTP 404 and connection error handling without raising exceptions or exposing keys.
    """

    def setUp(self):
        from apps.semantic.gemini_provider import GeminiSemanticProvider
        self.provider = GeminiSemanticProvider()

    def test_provider_model_and_availability(self):
        self.assertEqual(self.provider.model_version, 'gemini-embedding-001')
        self.assertIn('gemini-embedding-001', self.provider.get_provider_name())

    def test_successful_mocked_query_embedding(self):
        """Test successful generation of single query embedding from mocked response."""
        from unittest.mock import patch
        mock_response = {
            "embedding": {
                "values": [0.05, -0.12, 0.44, 0.91]
            }
        }
        with patch.object(self.provider, '_post_json', return_value=mock_response) as mock_post:
            embedding = self.provider.generate_query_embedding("employee satisfaction and compensation")
            self.assertIsNotNone(embedding)
            self.assertEqual(len(embedding), 4)
            self.assertEqual(embedding, [0.05, -0.12, 0.44, 0.91])
            self.assertTrue(mock_post.called)
            # Verify the call targeted the correct model endpoint and payload structure
            call_args = mock_post.call_args
            url_called = call_args[0][0]
            payload_called = call_args[0][1]
            self.assertIn("gemini-embedding-001:embedContent", url_called)
            self.assertEqual(payload_called["model"], "models/gemini-embedding-001")
            self.assertEqual(payload_called["taskType"], "RETRIEVAL_QUERY")

    def test_successful_mocked_batch_document_embeddings(self):
        """Test successful generation of batch document embeddings from mocked response."""
        from unittest.mock import patch
        mock_response = {
            "embeddings": [
                {"values": [0.1, 0.2]},
                {"values": [0.3, 0.4]}
            ]
        }
        with patch.object(self.provider, '_post_json', return_value=mock_response) as mock_post:
            results = self.provider.generate_document_embeddings(["Doc 1", "Doc 2"])
            self.assertEqual(len(results), 2)
            self.assertEqual(results[0], [0.1, 0.2])
            self.assertEqual(results[1], [0.3, 0.4])
            call_args = mock_post.call_args
            url_called = call_args[0][0]
            payload_called = call_args[0][1]
            self.assertIn("gemini-embedding-001:batchEmbedContents", url_called)
            self.assertEqual(len(payload_called["requests"]), 2)
            self.assertEqual(payload_called["requests"][0]["taskType"], "RETRIEVAL_DOCUMENT")

    def test_http_404_error_handling(self):
        """
        Verify that an HTTP 404 Not Found error (e.g. retired model or invalid endpoint)
        is gracefully caught and returns None without raising an unhandled exception.
        """
        from unittest.mock import patch
        # Simulate _post_json returning None after catching HTTP 404
        with patch.object(self.provider, '_post_json', return_value=None):
            result = self.provider.generate_query_embedding("some query")
            self.assertIsNone(result)

            batch_res = self.provider.generate_document_embeddings(["doc 1", "doc 2"])
            self.assertEqual(batch_res, [None, None])

    def test_post_json_http_error_exception_handling(self):
        """
        Verify _post_json handles urllib HTTPError (including 404) gracefully.
        """
        from unittest.mock import patch
        import urllib.error
        import io

        http_404_err = urllib.error.HTTPError(
            url="https://generativelanguage.googleapis.com/v1beta/models/invalid:embedContent",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=io.BytesIO(b'{"error": {"code": 404, "message": "models/invalid is not found"}}')
        )

        with patch('shutil.which', return_value=None):
            with patch('urllib.request.OpenerDirector.open', side_effect=http_404_err):
                res = self.provider._post_json("https://dummy.url", {"test": True}, timeout=1.0)
                self.assertIsNone(res)

class QueryHistoryApiTest(TestCase):
    def test_query_history_api_returns_executed_at(self):
        from apps.analytics.models import QueryHistory
        QueryHistory.objects.create(
            query_text="Find high latency",
            duration_ms=12.5,
            result_count=4,
            source="jevql_db",
            search_mode="Trigram"
        )
        resp = self.client.get(reverse('api_history'))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('history_records', data)
        self.assertEqual(len(data['history_records']), 1)
        record = data['history_records'][0]
        self.assertIn('executed_at', record)
        self.assertIn('created_at', record)
        self.assertNotEqual(record['executed_at'], '')

class DynamicSuggestionsTest(TestCase):
    def test_suggestions_empty_when_no_records(self):
        EmployeeFeedback.objects.all().delete()
        resp = self.client.get(reverse('api_search'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['suggested_queries'], [])

    def test_suggestions_adapt_to_dataset(self):
        EmployeeFeedback.objects.create(
            anonymized_id='EMP-TEST-BIO',
            department='Biology',
            role='Researcher',
            rating=5,
            sentiment='Positive',
            feedback_text='Lab equipment was state of the art',
            tags=['lab', 'equipment'],
            submission_date='2026-10-01'
        )
        resp = self.client.get(reverse('api_search'))
        self.assertEqual(resp.status_code, 200)
        sugs = resp.json()['suggested_queries']
        self.assertGreater(len(sugs), 0)
        # Verify suggestions reference the actual department or tags in dataset
        self.assertTrue(any('Biology' in s['q'] or 'equipment' in s['q'] or 'lab' in s['q'] for s in sugs))



