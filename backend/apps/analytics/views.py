from collections import Counter
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from apps.datasets.models import EmployeeFeedback, Department, Sentiment
from .models import SavedQuery, QueryHistory


def analytics_overview_view(request):
    """Deep-dive analytics view derived from database records."""
    if request.user.is_authenticated:
        user_records = EmployeeFeedback.objects.filter(dataset__owner=request.user)
    else:
        user_records = EmployeeFeedback.objects.filter(Q(dataset__owner__isnull=True) | Q(dataset__isnull=True))

    total_records = user_records.count()
    dept_distribution = []
    for dept in Department.values:
        cnt = user_records.filter(department=dept).count()
        dept_distribution.append({'dept': dept, 'count': cnt})

    sentiment_counts = {
        'Positive': user_records.filter(sentiment=Sentiment.POSITIVE).count(),
        'Neutral': user_records.filter(sentiment=Sentiment.NEUTRAL).count(),
        'Negative': user_records.filter(sentiment=Sentiment.NEGATIVE).count(),
    }

    rating_counts = [
        {'rating': r, 'count': user_records.filter(rating=r).count()}
        for r in range(5, 0, -1)
    ]

    all_tags = []
    for tags in user_records.values_list('tags', flat=True):
        if tags:
            if isinstance(tags, list):
                all_tags.extend(tags)
            elif isinstance(tags, str):
                all_tags.extend([t.strip().strip('#') for t in tags.split(',') if t.strip()])
    theme_counts = Counter(all_tags).most_common(8)

    context = {
        'total_records': total_records,
        'dept_distribution': dept_distribution,
        'sentiment_counts': sentiment_counts,
        'rating_counts': rating_counts,
        'theme_counts': theme_counts,
    }
    return render(request, 'analytics/index.html', context)


def saved_queries_view(request):
    """Manage saved queries in Django template."""
    if request.method == 'POST':
        if not request.user.is_authenticated:
            messages.info(request, "Please log in to manage your saved queries.")
            return redirect('/auth/login/')
        action = request.POST.get('action')
        if action == 'delete':
            qid = request.POST.get('query_id')
            SavedQuery.objects.filter(id=qid, user=request.user).delete()
            messages.info(request, "Saved query removed.")
            return redirect('analytics:saved_queries')

    if request.user.is_authenticated:
        queries = SavedQuery.objects.filter(user=request.user).order_by('-created_at')
    else:
        queries = SavedQuery.objects.filter(user__isnull=True).order_by('-created_at')
    return render(request, 'saved_queries/index.html', {'saved_queries': queries})


def query_history_view(request):
    """View query execution history in Django template."""
    if request.method == 'POST' and request.POST.get('action') == 'clear':
        if not request.user.is_authenticated:
            messages.info(request, "Please log in to clear query history.")
            return redirect('/auth/login/')
        QueryHistory.objects.filter(user=request.user).delete()
        messages.info(request, "Query history cleared.")
        return redirect('analytics:history')

    if request.user.is_authenticated:
        history_records = QueryHistory.objects.filter(user=request.user).order_by('-created_at')[:50]
    else:
        history_records = QueryHistory.objects.filter(user__isnull=True).order_by('-created_at')[:50]
    return render(request, 'history/index.html', {'history_records': history_records})


# ==================== REST API ENDPOINTS ====================

@api_view(['GET'])
def api_analytics_overview(request):
    """REST API endpoint for analytics overview data strictly scoped to authenticated user or demo."""
    if request.user.is_authenticated:
        user_records = EmployeeFeedback.objects.filter(dataset__owner=request.user)
    else:
        user_records = EmployeeFeedback.objects.filter(Q(dataset__owner__isnull=True) | Q(dataset__isnull=True))

    total_records = user_records.count()
    dept_distribution = []

    # Calculate real department distribution dynamically from actual records
    dept_counts = Counter(user_records.values_list('department', flat=True))
    for dept, cnt in dept_counts.most_common():
        if dept:
            dept_distribution.append({'dept': str(dept), 'count': cnt})

    sentiment_counts = {
        'Positive': user_records.filter(sentiment=Sentiment.POSITIVE).count(),
        'Neutral': user_records.filter(sentiment=Sentiment.NEUTRAL).count(),
        'Negative': user_records.filter(sentiment=Sentiment.NEGATIVE).count(),
    }

    rating_counts = [
        {'rating': r, 'count': user_records.filter(rating=r).count()}
        for r in range(5, 0, -1)
    ]

    all_tags = []
    for tags in user_records.values_list('tags', flat=True):
        if tags:
            if isinstance(tags, list):
                all_tags.extend(tags)
            elif isinstance(tags, str):
                all_tags.extend([t.strip().strip('#') for t in tags.split(',') if t.strip()])
    theme_counts = [
        {'name': t.replace('-', ' ').title(), 'count': c}
        for t, c in Counter(all_tags).most_common(8)
    ]

    return Response({
        'total_records': total_records,
        'dept_distribution': dept_distribution,
        'sentiment_counts': sentiment_counts,
        'rating_counts': rating_counts,
        'theme_counts': theme_counts,
    })


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def api_saved_queries_view(request, query_id=None):
    """REST API endpoint for saved queries CRUD strictly scoped to authenticated user."""
    if request.method == 'DELETE' or (request.method == 'POST' and request.data.get('action') == 'delete'):
        qid = query_id or request.data.get('query_id')
        if qid:
            try:
                deleted, _ = SavedQuery.objects.filter(id=int(qid), user=request.user).delete()
                if deleted:
                    return Response({'success': True, 'message': 'Saved query removed.'})
                return Response({'error': 'Saved query not found.'}, status=status.HTTP_404_NOT_FOUND)
            except (ValueError, TypeError):
                return Response({'error': 'Invalid query ID.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': 'query_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'POST':
        query_text = request.data.get('query_text', '').strip()
        name = request.data.get('name', '').strip() or f"Search: {query_text[:30]}"
        dept = request.data.get('dept', [])
        sentiment = request.data.get('sentiment', [])
        rating = request.data.get('rating', '')
        filters = request.data.get('filters')
        if not filters:
            filters = {
                'dept': dept if isinstance(dept, list) else ([dept] if dept else []),
                'sentiment': sentiment if isinstance(sentiment, list) else ([sentiment] if sentiment else []),
                'rating': rating
            }

        if not query_text:
            return Response({'error': 'Query text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        sq = SavedQuery.objects.create(
            user=request.user,
            name=name,
            query_text=query_text,
            filters=filters
        )
        created_str = sq.created_at.strftime('%b %d, %Y %H:%M') if sq.created_at else ''
        return Response({
            'success': True,
            'id': sq.id,
            'name': sq.name,
            'query_text': sq.query_text,
            'filters': sq.filters,
            'created_at': created_str,
            'executed_at': created_str,
        }, status=status.HTTP_201_CREATED)

    queries = SavedQuery.objects.filter(user=request.user).order_by('-created_at')
    data = [{
        'id': q.id,
        'name': q.name,
        'query_text': q.query_text,
        'filters': q.filters,
        'created_at': q.created_at.strftime('%b %d, %Y %H:%M') if q.created_at else '',
        'executed_at': q.created_at.strftime('%b %d, %Y %H:%M') if q.created_at else '',
    } for q in queries]
    return Response({'saved_queries': data})


@api_view(['GET', 'POST'])
def api_query_history_view(request):
    """REST API endpoint for query execution history scoped to authenticated user or demo."""
    if request.method == 'POST' and request.data.get('action') == 'clear':
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        QueryHistory.objects.filter(user=request.user).delete()
        return Response({'success': True, 'message': 'Query history cleared.'})

    if request.user.is_authenticated:
        records = QueryHistory.objects.filter(user=request.user).order_by('-created_at')[:50]
    else:
        records = QueryHistory.objects.filter(user__isnull=True).order_by('-created_at')[:50]
    data = []
    for h in records:
        dt_str = h.created_at.strftime('%b %d, %Y %H:%M') if h.created_at else ''
        data.append({
            'id': h.id,
            'query_text': h.query_text,
            'duration_ms': h.duration_ms,
            'result_count': h.result_count,
            'source': h.source,
            'search_mode': h.search_mode,
            'executed_at': dt_str,
            'created_at': dt_str,
        })
    return Response({'history_records': data})
