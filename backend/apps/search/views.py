import csv
import re
import time
from collections import Counter
from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.contrib.postgres.search import TrigramSimilarity
from django.conf import settings

from apps.datasets.models import EmployeeFeedback, Department, Sentiment
from apps.semantic.factory import get_semantic_provider
from apps.connections.security import get_connection_from_session, mask_connection_info
from apps.connections.service import query_custom_table
from apps.analytics.models import SavedQuery, QueryHistory
from .query_planner import QueryPlanner
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

def generate_dynamic_suggestions(is_custom_active=False, custom_conn=None, total_count=0, records_qs=None):
    """
    Generate 4-5 meaningful and executable suggestions derived strictly from the active dataset
    or connected database. Returns empty list if no dataset is connected.
    """
    if is_custom_active and custom_conn:
        active_table = custom_conn.get('active_table')
        if not active_table:
            return []
        return [
            {"label": f"All {active_table} records", "q": f"Show all records from {active_table} limit 20"},
            {"label": "Recent records", "q": f"Show recent entries from {active_table}"},
            {"label": "High rated records", "q": f"Find entries with high rating or positive feedback"},
            {"label": "Low rated / issues", "q": f"Find low rating or complaints in {active_table}"},
        ]

    if total_count == 0 or records_qs is None:
        return []

    # Inspect actual data in database scoped to user's dataset
    depts = [d for d in records_qs.values_list('department', flat=True).distinct()[:5] if d]
    all_tags = []
    for tags in records_qs.values_list('tags', flat=True)[:50]:
        if tags:
            if isinstance(tags, list):
                all_tags.extend(tags)
            elif isinstance(tags, str):
                all_tags.extend([t.strip().strip('#') for t in tags.split(',') if t.strip()])
    top_tags = [t for t, _ in Counter(all_tags).most_common(5) if t]

    suggestions = []
    if depts:
        d1 = depts[0]
        d2 = depts[1] if len(depts) > 1 else depts[0]
        if len(depts) > 1:
            suggestions.append({
                "label": f"Low rated {d1} & {d2}",
                "q": f"Show low rated feedback from {d1} and {d2} with rating <= 2"
            })
        else:
            suggestions.append({
                "label": f"Feedback from {d1}",
                "q": f"Show feedback from {d1}"
            })

    if top_tags:
        t1 = top_tags[0].replace('-', ' ')
        suggestions.append({
            "label": f"{t1.title()} issues",
            "q": f"Find entries mentioning {t1} with complaints"
        })

    if depts:
        target_d = depts[1] if len(depts) > 1 else depts[0]
        suggestions.append({
            "label": f"Positive feedback in {target_d}",
            "q": f"Show positive feedback from {target_d} with rating >= 4"
        })
    else:
        suggestions.append({
            "label": "High rated feedback",
            "q": "Show positive reviews and high ratings"
        })

    if len(top_tags) > 1:
        t2 = top_tags[1].replace('-', ' ')
        suggestions.append({
            "label": f"Feedback on {t2.title()}",
            "q": f"Show feedback regarding {t2}"
        })
    elif len(depts) > 2:
        d3 = depts[2]
        suggestions.append({
            "label": f"Submissions from {d3}",
            "q": f"Find feedback from {d3}"
        })
    else:
        suggestions.append({
            "label": "Recent submissions",
            "q": "Show recent feedback entries"
        })

    return suggestions[:5]

STOP_WORDS = {
    'the', 'and', 'to', 'of', 'a', 'in', 'is', 'for', 'that', 'our', 'with', 'on', 'was', 'as', 'at',
    'by', 'an', 'be', 'this', 'have', 'from', 'or', 'we', 'are', 'it', 'has', 'not', 'were', 'had',
    'been', 'they', 'all', 'more', 'about', 'team', 'work', 'due', 'my', 'their', 'very', 'survey',
    'note', 'pulse', 'response', 'follow-up', 'quarterly', 'comment', 'review', 'anonymous', 'submission'
}

def calculate_word_cloud(texts, top_n=20):
    words = []
    for text in texts:
        clean = re.findall(r'[a-zA-Z]{4,}', text.lower())
        words.extend([w for w in clean if w not in STOP_WORDS])
    counts = Counter(words).most_common(top_n)
    if not counts:
        return []
    max_count = counts[0][1]
    # Scale sizes between 12px and 34px
    word_cloud = []
    for word, count in counts:
        size = 12 + int((count / max_count) * 22)
        word_cloud.append({'word': word, 'count': count, 'size': size})
    return word_cloud

def compute_sentiment_distribution(records=None, fallback_model=None):
    """
    Safely compute sentiment distribution from available records or fallback model.
    Always returns all keys with numeric defaults to prevent VariableDoesNotExist errors.
    """
    dist = {
        'negative_count': 0,
        'negative_pct': 0.0,
        'neutral_count': 0,
        'neutral_pct': 0.0,
        'positive_count': 0,
        'positive_pct': 0.0,
        'total': 0,
        'neg_dash': '0 100',
        'neg_offset': 25,
        'neu_dash': '0 100',
        'neu_offset': 25,
        'pos_dash': '0 100',
        'pos_offset': 25,
    }

    sentiments = []
    if records:
        for r in records:
            if isinstance(r, dict):
                s = r.get('sentiment')
                if s:
                    sentiments.append(str(s).capitalize())
                elif 'data' in r and isinstance(r['data'], dict):
                    d = r['data']
                    found_s = None
                    for k, v in d.items():
                        if 'sentiment' in k.lower():
                            found_s = v
                            break
                    if found_s:
                        sentiments.append(str(found_s).capitalize())
                    else:
                        for k, v in d.items():
                            if any(term in k.lower() for term in ('rating', 'score', 'star')):
                                try:
                                    val = float(v)
                                    if val >= 4:
                                        sentiments.append('Positive')
                                    elif val == 3:
                                        sentiments.append('Neutral')
                                    elif val <= 2:
                                        sentiments.append('Negative')
                                except (ValueError, TypeError):
                                    pass
                                break
            else:
                s = getattr(r, 'sentiment', None)
                if s:
                    sentiments.append(str(s).capitalize())

    # Fallback to available dataset records if no sentiments found in filtered records
    if not sentiments and fallback_model:
        try:
            sentiments = list(fallback_model.objects.values_list('sentiment', flat=True))
        except Exception:
            sentiments = []

    total = len(sentiments)
    if total > 0:
        counts = Counter(sentiments)
        neg_c = counts.get('Negative', 0)
        neu_c = counts.get('Neutral', 0)
        pos_c = counts.get('Positive', 0)

        neg_pct = round((neg_c / total) * 100, 1)
        neu_pct = round((neu_c / total) * 100, 1)
        pos_pct = round((pos_c / total) * 100, 1)

        dist['negative_count'] = neg_c
        dist['negative_pct'] = neg_pct
        dist['neutral_count'] = neu_c
        dist['neutral_pct'] = neu_pct
        dist['positive_count'] = pos_c
        dist['positive_pct'] = pos_pct
        dist['total'] = total

        # Precalculated SVG stroke offsets and dashes for donut chart
        dist['neg_dash'] = f"{neg_pct} {max(0, round(100 - neg_pct, 1))}"
        dist['neg_offset'] = 25
        dist['neu_dash'] = f"{neu_pct} {max(0, round(100 - neu_pct, 1))}"
        dist['neu_offset'] = round((25 - neg_pct) % 100, 1)
        dist['pos_dash'] = f"{pos_pct} {max(0, round(100 - pos_pct, 1))}"
        dist['pos_offset'] = round((25 - neg_pct - neu_pct) % 100, 1)

    return dist

def execute_search_query(request):
    params = getattr(request, 'query_params', request.GET)
    raw_query = params.get('q', '').strip()
    selected_depts = params.getlist('dept') if hasattr(params, 'getlist') else params.get('dept', [])
    if isinstance(selected_depts, str):
        selected_depts = [d.strip() for d in selected_depts.split(',') if d.strip()]
    selected_sentiments = params.getlist('sentiment') if hasattr(params, 'getlist') else params.get('sentiment', [])
    if isinstance(selected_sentiments, str):
        selected_sentiments = [s.strip() for s in selected_sentiments.split(',') if s.strip()]
    min_rating = str(params.get('rating', '')).strip()
    time_range = str(params.get('time_range', 'all')).strip()
    workload_filter = str(params.get('workload', '')).strip()
    active_tab = str(params.get('tab', 'results')).strip()
    page_number = str(params.get('page', '1'))
    try:
        page_size = int(params.get('page_size', 10))
    except (ValueError, TypeError):
        page_size = 10

    start_time = time.perf_counter()

    custom_conn = get_connection_from_session(request)
    is_custom_active = bool(custom_conn and custom_conn.get('active_table'))

    planner_explanations = []
    extracted_filters = {}
    clean_topic = ''
    search_mode = 'Idle / Ready'
    results_list = []
    custom_columns = []
    total_count = 0
    generated_sql = ''

    # Filter counts for right sidebar
    dept_counts = {}
    sentiment_counts = {}

    if is_custom_active:
        # Search against User-Provided Custom PostgreSQL Table
        active_schema = custom_conn.get('active_schema', 'public')
        active_table = custom_conn.get('active_table')
        search_mode = f"Custom DB ({custom_conn.get('database')}.{active_table})"
        planner_explanations.append(f"Targeting user-provided connection '{custom_conn.get('name')}'")
        planner_explanations.append(f"Inspected table: {active_schema}.{active_table} with strict identifier quoting")

        query_res = query_custom_table(
            conn_params=custom_conn,
            schema_name=active_schema,
            table_name=active_table,
            query_text=raw_query,
            limit=100
        )
        if query_res.get('success'):
            results_list = query_res.get('records', [])
            custom_columns = query_res.get('columns', [])
            total_count = query_res.get('total_count', 0)
            generated_sql = query_res.get('compiled_sql', '')
            planner_explanations.append(f"Executed parameterized read-only query returning {len(results_list)} rows.")
        else:
            planner_explanations.append(f"Error querying custom table: {query_res.get('error')}")

        paginator = Paginator(results_list, page_size)
        page_obj = paginator.get_page(page_number)

    else:
        # Default Dataset: EmployeeFeedback on jevql_db scoped to user
        if request.user.is_authenticated:
            dataset_records = EmployeeFeedback.objects.filter(dataset__owner=request.user)
        else:
            dataset_records = EmployeeFeedback.objects.filter(Q(dataset__owner__isnull=True) | Q(dataset__isnull=True))

        total_count = dataset_records.count()

        # Parse query with QueryPlanner
        planner = QueryPlanner(raw_query) if raw_query else None
        if planner:
            q_plan, extracted_filters, clean_topic = planner.parse()
            planner_explanations = planner.explanations
        else:
            q_plan = Q()

        # UI Refine Filters
        if selected_depts:
            q_plan &= Q(department__in=selected_depts)
            planner_explanations.append(f"Filter: Departments IN {selected_depts}")
        if selected_sentiments:
            q_plan &= Q(sentiment__in=selected_sentiments)
            planner_explanations.append(f"Filter: Sentiments IN {selected_sentiments}")
        if min_rating and min_rating.isdigit():
            r_val = int(min_rating)
            q_plan &= Q(rating__gte=r_val)
            planner_explanations.append(f"Filter: Rating >= {r_val}")
        if workload_filter and workload_filter in ('High', 'Medium', 'Low'):
            q_plan &= Q(workload_level=workload_filter)
            planner_explanations.append(f"Filter: Workload = '{workload_filter}'")

        # PostgreSQL Query Execution scoped to user records
        base_qs = dataset_records.filter(q_plan)

        provider = get_semantic_provider()
        is_semantic_active = provider.is_available() and bool(raw_query)

        if total_count == 0:
            search_mode = 'No Dataset Available'
            planner_explanations.append('No dataset is currently available. Upload a CSV dataset or connect a PostgreSQL database.')
            results_list = []
        elif raw_query:
            query_text = clean_topic or raw_query
            tokens = [t.strip() for t in query_text.split() if len(t.strip()) > 2 and t.lower() not in ('and', 'or', 'the', 'for', 'about', 'with')]
            token_q = Q()
            for tok in tokens:
                token_q |= Q(feedback_text__icontains=tok) | Q(role__icontains=tok) | Q(tags__icontains=tok)

            if is_semantic_active:
                search_mode = provider.get_provider_name()
                planner_explanations.append(f"Semantic Search Active: {provider.get_provider_name()}")
                planner_explanations.append(f"Vectorizing query intent: '{query_text}' with taskType=RETRIEVAL_QUERY")
                if extracted_filters:
                    planner_explanations.append(f"Preserved structured filters: {extracted_filters}")

                # Retrieve eligible candidate pool respecting all structured filters
                candidate_limit = getattr(settings, 'SEMANTIC_CANDIDATE_LIMIT', 100)
                candidates_to_eval = list(base_qs.order_by('-submission_date')[:candidate_limit])

                candidate_list = []
                for rec in candidates_to_eval:
                    candidate_list.append({
                        'id': rec.id,
                        'anonymized_id': rec.anonymized_id,
                        'employee_name': rec.employee_name or f"Emp {rec.anonymized_id}",
                        'avatar_initial': rec.avatar_initial,
                        'department': rec.department,
                        'role': rec.role,
                        'rating': rec.rating,
                        'sentiment': rec.sentiment,
                        'workload_level': rec.workload_level,
                        'feedback_text': rec.feedback_text,
                        'tags': rec.tags,
                        'submission_date': rec.submission_date,
                        'similarity_score': 0.0,
                    })

                ranked = provider.evaluate_candidates(
                    query=query_text,
                    candidates=candidate_list,
                    timeout_seconds=getattr(settings, 'SEMANTIC_TIMEOUT_SECONDS', 5.0)
                )

                # If semantic vector evaluation succeeded
                has_semantic_scores = any(r.get('semantic_score') is not None for r in ranked)
                if ranked and has_semantic_scores:
                    results_list = ranked
                    planner_explanations.append(f"Retrieved {len(results_list)} records matching semantic threshold ({getattr(provider, 'similarity_threshold', 0.45)}).")
                elif not ranked and has_semantic_scores:
                    # Semantic search evaluated records, but none met the similarity threshold
                    results_list = []
                    planner_explanations.append(f"No records met the semantic relevance threshold ({getattr(provider, 'similarity_threshold', 0.45)}) for '{query_text}'.")
                else:
                    # Semantic API call failed or was unreachable; graceful fallback to PostgreSQL trigram
                    planner_explanations.append("Gemini vector API was unreachable. Falling back safely to PostgreSQL trigram search.")
                    search_mode = "PostgreSQL Trigram Search (Semantic Fallback)"
                    try:
                        trigram_qs = base_qs.annotate(
                            similarity_score=TrigramSimilarity('feedback_text', query_text)
                        ).filter(
                            token_q | Q(similarity_score__gt=0.03)
                        ).order_by('-similarity_score', '-submission_date')
                        results_list = list(trigram_qs[:50])
                    except Exception:
                        results_list = list(base_qs.filter(token_q).order_by('-submission_date')[:50])
            else:
                # Gemini API not configured or offline
                search_mode = "PostgreSQL Trigram Search (Semantic AI Offline)"
                planner_explanations.append("Gemini API key is not configured in backend .env. Operating in local PostgreSQL Trigram / Exact search mode.")
                try:
                    candidate_qs = base_qs.annotate(
                        similarity_score=TrigramSimilarity('feedback_text', query_text)
                    ).filter(
                        token_q | Q(similarity_score__gt=0.03)
                    ).order_by('-similarity_score', '-submission_date')
                    results_list = list(candidate_qs[:50])
                except Exception:
                    results_list = list(base_qs.filter(token_q).order_by('-submission_date')[:50])
        else:
            search_mode = "All Records (Idle)"
            results_list = list(base_qs.order_by('-submission_date'))

        try:
            generated_sql = str(base_qs.query)
        except Exception:
            generated_sql = "Django ORM QuerySet representation"

        paginator = Paginator(results_list, page_size)
        page_obj = paginator.get_page(page_number)

    # 4 Analytics Calculations derived strictly from live records or available dataset
    # 1. Sentiment Distribution (ALWAYS a fully populated dictionary)
    sentiment_dist = compute_sentiment_distribution(results_list, fallback_model=EmployeeFeedback)

    # 2. Top Themes
    all_tags = []
    for r in results_list:
        if isinstance(r, dict):
            tags = r.get('tags')
            if tags:
                if isinstance(tags, list):
                    all_tags.extend(tags)
                elif isinstance(tags, str):
                    all_tags.extend([t.strip().strip('#') for t in tags.split(',') if t.strip()])
        else:
            tags = getattr(r, 'tags', None)
            if tags:
                all_tags.extend(tags)

    if not all_tags and not is_custom_active:
        for tags in EmployeeFeedback.objects.values_list('tags', flat=True)[:100]:
            if tags:
                all_tags.extend(tags)

    theme_counts = Counter(all_tags).most_common(5)
    max_theme = theme_counts[0][1] if theme_counts else 1
    top_themes = [
        {'name': t.replace('-', ' ').title(), 'count': c, 'pct': int((c / max_theme) * 100)}
        for t, c in theme_counts
    ]

    # 3. Department distribution
    dept_vals = []
    for r in results_list:
        if isinstance(r, dict):
            d = r.get('department')
            if not d and 'data' in r and isinstance(r['data'], dict):
                for k, v in r['data'].items():
                    if any(term in k.lower() for term in ('dept', 'department')):
                        d = v
                        break
            if d:
                dept_vals.append(str(d))
        else:
            d = getattr(r, 'department', None)
            if d:
                dept_vals.append(str(d))

    if not dept_vals and not is_custom_active:
        dept_vals = list(EmployeeFeedback.objects.values_list('department', flat=True))

    dept_counts_map = Counter(dept_vals)
    dept_chart = [
        {'dept': d, 'short': d[:4], 'count': c}
        for d, c in dept_counts_map.most_common(5)
    ]
    max_dept = dept_chart[0]['count'] if dept_chart else 1
    for d in dept_chart:
        d['pct'] = int((d['count'] / max_dept) * 100)

    # 4. Word cloud
    text_samples = []
    for r in results_list:
        if isinstance(r, dict):
            txt = r.get('feedback_text')
            if not txt and 'data' in r and isinstance(r['data'], dict):
                txt = " ".join([str(v) for v in r['data'].values() if v])
            if txt:
                text_samples.append(txt)
        else:
            txt = getattr(r, 'feedback_text', None)
            if txt:
                text_samples.append(txt)

    if not text_samples and not is_custom_active:
        text_samples = list(dataset_records.values_list('feedback_text', flat=True)[:100])

    word_cloud = calculate_word_cloud(text_samples, top_n=20)

    # Dynamic counts for filter sidebar
    try:
        if not is_custom_active:
            dept_counts = dict(Counter(dataset_records.values_list('department', flat=True)))
            sentiment_counts = dict(Counter(dataset_records.values_list('sentiment', flat=True)))
        else:
            dept_counts = {}
            sentiment_counts = {}
    except Exception:
        dept_counts = {}
        sentiment_counts = {}

    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Log query history if a query was run
    if raw_query:
        try:
            QueryHistory.objects.create(
                user=request.user if request.user.is_authenticated else None,
                query_text=raw_query,
                duration_ms=execution_time_ms,
                result_count=len(results_list),
                source=custom_conn.get('name') if is_custom_active else 'Employee Feedback',
                search_mode=search_mode
            )
        except Exception:
            pass

    context = {
        'query': raw_query,
        'clean_topic': clean_topic,
        'selected_depts': selected_depts,
        'selected_sentiments': selected_sentiments,
        'min_rating': min_rating,
        'time_range': time_range,
        'workload_filter': workload_filter,
        'active_tab': active_tab,
        'page_obj': page_obj,
        'page_size': page_size,
        'results': page_obj.object_list if not is_custom_active else [r.get('values', []) for r in page_obj.object_list],
        'raw_results': results_list,
        'result_count': len(results_list),
        'total_dataset_count': total_count,
        'execution_time_ms': execution_time_ms,
        'search_mode': search_mode,
        'planner_explanations': planner_explanations,
        'generated_sql': generated_sql,
        'suggested_queries': generate_dynamic_suggestions(is_custom_active, custom_conn, total_count, dataset_records if not is_custom_active else None),
        'departments': Department.values,
        'sentiments': Sentiment.values,
        'dept_counts': dept_counts,
        'sentiment_counts': sentiment_counts,
        'is_custom_active': is_custom_active,
        'custom_columns': custom_columns,
        'active_connection_info': mask_connection_info(custom_conn),
        'sentiment_dist': sentiment_dist,
        'top_themes': top_themes,
        'dept_chart': dept_chart,
        'word_cloud': word_cloud,
    }
    return context


def search_dashboard_view(request):
    """Render the dashboard using Django template for HTML requests."""
    context = execute_search_query(request)
    return render(request, 'dashboard/index.html', context)


def serialize_search_results(records, is_custom=False):
    out = []
    for r in records:
        if is_custom:
            if isinstance(r, dict) and 'values' in r:
                out.append(r['values'])
            else:
                out.append(r)
        elif isinstance(r, dict):
            out.append(r)
        else:
            out.append({
                'id': r.id,
                'anonymized_id': r.anonymized_id,
                'employee_name': r.employee_name or f"Emp {r.anonymized_id}",
                'avatar_initial': r.avatar_initial,
                'department': r.department,
                'role': r.role,
                'rating': r.rating,
                'sentiment': r.sentiment,
                'workload_level': r.workload_level,
                'feedback_text': r.feedback_text,
                'tags': r.tags,
                'submission_date': str(r.submission_date),
                'relevance_explanation': getattr(r, 'relevance_explanation', None),
                'similarity_score': getattr(r, 'similarity_score', 0.0),
            })
    return out


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def api_search_view(request):
    """REST API endpoint for React frontend search."""
    context = execute_search_query(request)
    page_obj = context['page_obj']
    results_serialized = serialize_search_results(
        page_obj.object_list,
        is_custom=context['is_custom_active']
    )

    return Response({
        'query': context['query'],
        'clean_topic': context['clean_topic'],
        'selected_depts': context['selected_depts'],
        'selected_sentiments': context['selected_sentiments'],
        'min_rating': context['min_rating'],
        'time_range': context['time_range'],
        'workload_filter': context['workload_filter'],
        'results': results_serialized,
        'result_count': context['result_count'],
        'total_dataset_count': context['total_dataset_count'],
        'execution_time_ms': context['execution_time_ms'],
        'search_mode': context['search_mode'],
        'planner_explanations': context['planner_explanations'],
        'generated_sql': context['generated_sql'],
        'suggested_queries': context['suggested_queries'],
        'departments': list(context['departments']),
        'sentiments': list(context['sentiments']),
        'dept_counts': context['dept_counts'],
        'sentiment_counts': context['sentiment_counts'],
        'is_custom_active': context['is_custom_active'],
        'custom_columns': context['custom_columns'],
        'active_connection_info': context['active_connection_info'],
        'sentiment_dist': context['sentiment_dist'],
        'top_themes': context['top_themes'],
        'dept_chart': context['dept_chart'],
        'word_cloud': context['word_cloud'],
        'page': page_obj.number,
        'num_pages': page_obj.paginator.num_pages,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous(),
        'page_size': context['page_size'],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_save_query_view(request):
    """REST API endpoint to save query."""
    query_text = request.data.get('query_text', '').strip()
    name = request.data.get('name', '').strip() or f"Search: {query_text[:30]}"
    dept = request.data.get('dept', [])
    sentiment = request.data.get('sentiment', [])
    rating = request.data.get('rating', '')

    if not query_text:
        return Response({'error': 'Query text is required.'}, status=status.HTTP_400_BAD_REQUEST)

    sq = SavedQuery.objects.create(
        user=request.user,
        name=name,
        query_text=query_text,
        filters={
            'dept': dept if isinstance(dept, list) else [dept],
            'sentiment': sentiment if isinstance(sentiment, list) else [sentiment],
            'rating': rating
        }
    )
    return Response({'success': True, 'id': sq.id, 'name': sq.name})


def save_query_view(request):
    """Save query to database."""
    if request.method == 'POST':
        query_text = request.POST.get('query_text', '').strip()
        name = request.POST.get('name', '').strip() or f"Search: {query_text[:30]}"
        if query_text:
            SavedQuery.objects.create(
                user=request.user if request.user.is_authenticated else None,
                name=name,
                query_text=query_text,
                filters={
                    'dept': request.POST.getlist('dept'),
                    'sentiment': request.POST.getlist('sentiment'),
                    'rating': request.POST.get('rating', '')
                }
            )
            messages.success(request, f"Saved query '{name}' to your Saved Queries!")
    return redirect(request.META.get('HTTP_REFERER', 'home'))

def export_results_csv(request):
    """Export currently filtered records as a downloadable CSV."""
    from rest_framework.authtoken.models import Token
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        token_key = None
        if auth_header.startswith('Token ') or auth_header.startswith('Bearer '):
            token_key = auth_header.split(' ', 1)[1].strip()
        elif request.GET.get('token'):
            token_key = request.GET.get('token').strip()

        if token_key:
            try:
                user = Token.objects.get(key=token_key).user
            except Token.DoesNotExist:
                user = None

    if request.path.startswith('/api/'):
        if not user or not user.is_authenticated:
            return HttpResponse('{"error": "Authentication credentials were not provided."}', status=401, content_type='application/json')
        qs = EmployeeFeedback.objects.filter(dataset__owner=user)
    else:
        if user and user.is_authenticated:
            qs = EmployeeFeedback.objects.filter(dataset__owner=user)
        else:
            qs = EmployeeFeedback.objects.filter(Q(dataset__owner__isnull=True) | Q(dataset__isnull=True))

    raw_query = request.GET.get('q', '').strip()
    selected_depts = request.GET.getlist('dept')
    selected_sentiments = request.GET.getlist('sentiment')
    min_rating = request.GET.get('rating', '').strip()
    if raw_query:
        planner = QueryPlanner(raw_query)
        q_plan, _, clean_topic = planner.parse()
        qs = qs.filter(q_plan)
        if clean_topic:
            qs = qs.filter(Q(feedback_text__icontains=clean_topic) | Q(tags__icontains=clean_topic))

    if selected_depts:
        qs = qs.filter(department__in=selected_depts)
    if selected_sentiments:
        qs = qs.filter(sentiment__in=selected_sentiments)
    if min_rating and min_rating.isdigit():
        qs = qs.filter(rating__gte=int(min_rating))

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="jevql_search_results_{int(time.time())}.csv"'

    writer = csv.writer(response)
    writer.writerow(['ID', 'Employee Name', 'Department', 'Role', 'Rating', 'Sentiment', 'Workload', 'Submission Date', 'Feedback Text', 'Tags'])

    for rec in qs[:200]:
        writer.writerow([
            rec.anonymized_id,
            rec.employee_name,
            rec.department,
            rec.role,
            rec.rating,
            rec.sentiment,
            rec.workload_level,
            rec.submission_date,
            rec.feedback_text,
            ", ".join(rec.tags) if rec.tags else ""
        ])

    return response
